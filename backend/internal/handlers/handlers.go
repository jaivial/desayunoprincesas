// Package handlers implements HTTP request handlers for the API.
package handlers

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"desayuno-backend/internal/auth"
	"desayuno-backend/internal/config"
	"desayuno-backend/internal/models"
	"desayuno-backend/internal/services"
	"desayuno-backend/internal/validation"
	"desayuno-backend/internal/ws"

	"github.com/google/uuid"
	"github.com/stripe/stripe-go/v76"
	"github.com/stripe/stripe-go/v76/checkout/session"
	"github.com/stripe/stripe-go/v76/webhook"
)

// Handler contains dependencies for HTTP handlers.
type Handler struct {
	db    *sql.DB
	hub   *ws.Hub
	cfg   *config.Config
	email *services.EmailService
	qr    *services.QRService
	auth  *auth.AuthService
}

// New creates a new Handler with all dependencies.
func New(db *sql.DB, hub *ws.Hub, cfg *config.Config, authService *auth.AuthService) *Handler {
	stripe.Key = cfg.StripeSecretKey
	return &Handler{
		db:    db,
		hub:   hub,
		cfg:   cfg,
		email: services.NewEmailService(db, cfg),
		qr:    services.NewQRService(db, cfg),
		auth:  authService,
	}
}

// Pack definitions with pricing
type PackInfo struct {
	ID              string
	Name            string
	Adults          int
	Children        int
	PriceCents      int
	HasPhotographer bool
	HasPremiumPass  bool
}

// getPacks loads all active packs from the database, ordered for display.
// Uses global packs catalog limits; for date-scoped limits use getPacksForDate.
func (h *Handler) getPacks() ([]models.Pack, error) {
	return h.getPacksForDate(0)
}

// getPacksForDate loads active packs. When eventDateID > 0 it overrides price/
// active/limits from event_date_packs and scopes sold counts to that date.
func (h *Handler) getPacksForDate(eventDateID int) ([]models.Pack, error) {
	var args []interface{}

	var q string
	if eventDateID > 0 {
		q = `SELECT p.id, p.name, p.emoji, p.icon, p.adults, p.children,
			COALESCE(dp.price_cents, p.price_cents) AS price_cents,
			p.has_photographer, p.has_premium_pass, p.short_description, p.description, p.persons,
			p.color, p.border_color, p.highlight, p.premium, p.includes, p.display_order,
			COALESCE(dp.active, p.active) AS active,
			p.completed,
			COALESCE(dp.max_enabled, COALESCE(l.enabled, FALSE)) AS limit_enabled,
			COALESCE(dp.max_tickets, COALESCE(l.max_tickets, 0)) AS max_tickets,
			CAST(
				COALESCE((SELECT SUM(bi.quantity) FROM booking_items bi
					JOIN bookings b ON b.id = bi.booking_id
					WHERE bi.pack_type = p.id AND b.payment_status = 'paid' AND b.deleted_at IS NULL AND b.event_date_id = ?), 0)
				+ COALESCE((SELECT COUNT(*) FROM bookings b
					WHERE b.pack_type = p.id AND b.payment_status = 'paid' AND b.deleted_at IS NULL
					AND b.event_date_id = ?
					AND NOT EXISTS (SELECT 1 FROM booking_items bi2 WHERE bi2.booking_id = b.id)), 0)
			AS SIGNED) AS sold_tickets
			FROM packs p
			LEFT JOIN packs_max_limits l ON l.pack_id = p.id
			LEFT JOIN event_date_packs dp ON dp.pack_id = p.id AND dp.event_date_id = ?
			WHERE COALESCE(dp.active, p.active) = TRUE
			ORDER BY p.display_order ASC, p.id ASC`
		args = []interface{}{eventDateID, eventDateID, eventDateID}
	} else {
		q = `SELECT p.id, p.name, p.emoji, p.icon, p.adults, p.children, p.price_cents,
			p.has_photographer, p.has_premium_pass, p.short_description, p.description, p.persons,
			p.color, p.border_color, p.highlight, p.premium, p.includes, p.display_order, p.active, p.completed,
			COALESCE(l.enabled, FALSE) AS limit_enabled,
			COALESCE(l.max_tickets, 0) AS max_tickets,
			CAST(
				COALESCE((SELECT SUM(bi.quantity) FROM booking_items bi
					JOIN bookings b ON b.id = bi.booking_id
					WHERE bi.pack_type = p.id AND b.payment_status = 'paid' AND b.deleted_at IS NULL), 0)
				+ COALESCE((SELECT COUNT(*) FROM bookings b
					WHERE b.pack_type = p.id AND b.payment_status = 'paid' AND b.deleted_at IS NULL
					AND NOT EXISTS (SELECT 1 FROM booking_items bi2 WHERE bi2.booking_id = b.id)), 0)
			AS SIGNED) AS sold_tickets
			FROM packs p
			LEFT JOIN packs_max_limits l ON l.pack_id = p.id
			WHERE p.active = TRUE ORDER BY p.display_order ASC, p.id ASC`
	}

	rows, err := h.db.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	packs := []models.Pack{}
	for rows.Next() {
		var p models.Pack
		var shortDesc, desc sql.NullString
		var includesJSON sql.NullString
		if err := rows.Scan(&p.ID, &p.Name, &p.Emoji, &p.Icon, &p.Adults, &p.Children, &p.PriceCents,
			&p.HasPhotographer, &p.HasPremiumPass, &shortDesc, &desc, &p.Persons,
			&p.Color, &p.BorderColor, &p.Highlight, &p.Premium, &includesJSON, &p.DisplayOrder, &p.Active, &p.Completed,
			&p.MaxLimitEnabled, &p.MaxTickets, &p.SoldTickets); err != nil {
			return nil, err
		}
		p.ShortDescription = shortDesc.String
		p.Description = desc.String
		p.Price = float64(p.PriceCents) / 100
		p.Includes = []string{}
		if includesJSON.Valid && includesJSON.String != "" {
			_ = json.Unmarshal([]byte(includesJSON.String), &p.Includes)
		}
		if p.MaxLimitEnabled {
			p.AvailableTickets = p.MaxTickets - p.SoldTickets
			if p.AvailableTickets < 0 {
				p.AvailableTickets = 0
			}
		}
		packs = append(packs, p)
	}
	return packs, rows.Err()
}

// getPackInfo returns pricing/capacity info for a pack from the database.
func (h *Handler) getPackInfo(packType string) *PackInfo {
	var info PackInfo
	err := h.db.QueryRow(`SELECT id, name, adults, children, price_cents, has_photographer, has_premium_pass
		FROM packs WHERE id = ?`, packType).Scan(
		&info.ID, &info.Name, &info.Adults, &info.Children, &info.PriceCents, &info.HasPhotographer, &info.HasPremiumPass,
	)
	if err != nil {
		return nil
	}
	return &info
}

// upsertPacks inserts or updates the given packs (used by UpdateSettings).
func (h *Handler) upsertPacks(packs []models.PackInput) error {
	const q = `INSERT INTO packs
		(id, name, emoji, icon, adults, children, price_cents, has_photographer, has_premium_pass,
		 short_description, description, persons, color, border_color, highlight, premium, includes, display_order, active, completed)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE
		 name=VALUES(name), emoji=VALUES(emoji), icon=VALUES(icon), adults=VALUES(adults),
		 children=VALUES(children), price_cents=VALUES(price_cents), has_photographer=VALUES(has_photographer),
		 has_premium_pass=VALUES(has_premium_pass), short_description=VALUES(short_description),
		 description=VALUES(description), persons=VALUES(persons), color=VALUES(color),
		 border_color=VALUES(border_color), highlight=VALUES(highlight), premium=VALUES(premium),
		 includes=VALUES(includes), display_order=VALUES(display_order), active=VALUES(active), completed=VALUES(completed)`

	for _, p := range packs {
		if strings.TrimSpace(p.ID) == "" || strings.TrimSpace(p.Name) == "" {
			return fmt.Errorf("pack id and name are required")
		}
		includes := p.Includes
		if includes == nil {
			includes = []string{}
		}
		includesJSON, err := json.Marshal(includes)
		if err != nil {
			return err
		}
		active := true
		if p.Active != nil {
			active = *p.Active
		}
		if _, err := h.db.Exec(q, p.ID, p.Name, p.Emoji, p.Icon, p.Adults, p.Children, p.PriceCents,
			p.HasPhotographer, p.HasPremiumPass, p.ShortDescription, p.Description, p.Persons,
			p.Color, p.BorderColor, p.Highlight, p.Premium, string(includesJSON), p.DisplayOrder, active, p.Completed); err != nil {
			return err
		}

		// Upsert the optional per-pack ticket capacity limit.
		if _, err := h.db.Exec(`INSERT INTO packs_max_limits (pack_id, enabled, max_tickets)
			VALUES (?, ?, ?)
			ON DUPLICATE KEY UPDATE enabled = VALUES(enabled), max_tickets = VALUES(max_tickets)`,
			p.ID, p.MaxLimitEnabled, p.MaxTickets); err != nil {
			return err
		}
		// Mirror limit changes into event_date_packs so per-date views stay in sync.
		h.db.Exec(`UPDATE event_date_packs SET max_enabled = ?, max_tickets = ? WHERE pack_id = ?`,
			p.MaxLimitEnabled, p.MaxTickets, p.ID)
	}
	return nil
}

// respondJSON sends a JSON response.
func (h *Handler) respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

// respondError sends a JSON error response.
func (h *Handler) respondError(w http.ResponseWriter, status int, message string) {
	h.respondJSON(w, status, map[string]string{"error": message})
}

// extractID extracts an ID from a URL path.
func extractID(path, prefix string) string {
	path = strings.TrimPrefix(path, prefix)
	parts := strings.Split(path, "/")
	if len(parts) > 0 {
		return parts[0]
	}
	return ""
}

// =============================================================================
// AUTH HANDLERS
// =============================================================================

// Login authenticates an admin user and returns a JWT token.
func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Username == "" || req.Password == "" {
		h.respondError(w, http.StatusBadRequest, "Username and password are required")
		return
	}

	token, user, err := h.auth.Login(req.Username, req.Password)
	if err != nil {
		h.respondError(w, http.StatusUnauthorized, "Invalid credentials")
		return
	}

	// Update last login
	h.db.Exec("UPDATE admin_users SET last_login_at = NOW() WHERE id = ?", user.ID)

	h.respondJSON(w, http.StatusOK, map[string]interface{}{
		"token": token,
		"user":  user,
	})
}

// GetCurrentUser returns the authenticated admin user.
func (h *Handler) GetCurrentUser(w http.ResponseWriter, r *http.Request) {
	user := auth.GetAdminUser(r)
	if user == nil {
		h.respondError(w, http.StatusUnauthorized, "Not authenticated")
		return
	}
	h.respondJSON(w, http.StatusOK, user)
}

// =============================================================================
// PUBLIC HANDLERS
// =============================================================================

// GetPublicSettings returns public event settings.
// Optional ?dateId= scopes prices/packs/limits to that event date.
// Falls back to global settings (legacy) when omitted or 0.
func (h *Handler) GetPublicSettings(w http.ResponseWriter, r *http.Request) {
	dateIDStr := r.URL.Query().Get("dateId")
	dateID, _ := strconv.Atoi(dateIDStr)

	// Only go date-scoped when the client explicitly provides dateId.
	// The default_event_date_id in settings is a hint for the frontend,
	// not a server-side auto-select. This preserves backward compatibility
	// for clients that don't send dateId.
	// ponytail: no auto-select; keeps sold-count queries stable for legacy bookings with NULL event_date_id.

	if dateID > 0 {
		// Serve from event_opening_dates row.
		var ed models.EventDate
		err := h.db.QueryRow(`SELECT id, event_date, is_open, max_capacity, adult_price_cents, child_price_cents,
			early_bird_count, early_bird_discount_percent, max_individual_adult_tickets, max_individual_child_tickets
			FROM event_opening_dates WHERE id = ?`, dateID).Scan(
			&ed.ID, &ed.EventDate, &ed.IsOpen, &ed.MaxCapacity, &ed.AdultPriceCents, &ed.ChildPriceCents,
			&ed.EarlyBirdCount, &ed.EarlyBirdDiscountPercent, &ed.MaxIndividualAdultTickets, &ed.MaxIndividualChildTickets,
		)
		if err != nil {
			h.respondError(w, http.StatusNotFound, "Event date not found")
			return
		}

		var paidBookingsCount int
		h.db.QueryRow(`SELECT COUNT(*) FROM bookings WHERE event_date_id = ? AND payment_status = 'paid' AND deleted_at IS NULL`, dateID).Scan(&paidBookingsCount)

		edStr := ed.EventDate
		var eventInfo *string
		// event_info lives in settings (global); pull it for back-compat display.
		var rawInfo sql.NullString
		h.db.QueryRow(`SELECT event_info FROM settings WHERE id = 1`).Scan(&rawInfo)
		if rawInfo.Valid {
			eventInfo = &rawInfo.String
		}

		ps := models.PublicSettings{
			MaxCapacity:               ed.MaxCapacity,
			AdultPriceCents:           ed.AdultPriceCents,
			ChildPriceCents:           ed.ChildPriceCents,
			EarlyBirdCount:            ed.EarlyBirdCount,
			EarlyBirdDiscountPercent:  ed.EarlyBirdDiscountPercent,
			MaxIndividualAdultTickets: ed.MaxIndividualAdultTickets,
			MaxIndividualChildTickets: ed.MaxIndividualChildTickets,
			PaidBookingsCount:         paidBookingsCount,
			EventDate:                 &edStr,
			EventInfo:                 eventInfo,
		}
		if packs, err := h.getPacksForDate(dateID); err == nil {
			ps.Packs = packs
		}
		h.respondJSON(w, http.StatusOK, ps)
		return
	}

	// Legacy: no event date configured at all — fall back to global settings row.
	var s models.Settings
	err := h.db.QueryRow(`SELECT max_capacity, adult_price_cents, child_price_cents, event_date, event_info, early_bird_count, early_bird_discount_percent, COALESCE(max_individual_adult_tickets, 0), COALESCE(max_individual_child_tickets, 0) FROM settings WHERE id = 1`).Scan(
		&s.MaxCapacity, &s.AdultPriceCents, &s.ChildPriceCents, &s.EventDate, &s.EventInfo, &s.EarlyBirdCount, &s.EarlyBirdDiscountPercent, &s.MaxIndividualAdultTickets, &s.MaxIndividualChildTickets,
	)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to get settings")
		return
	}

	var paidBookingsCount int
	h.db.QueryRow(`SELECT COUNT(*) FROM bookings WHERE payment_status = 'paid' AND deleted_at IS NULL`).Scan(&paidBookingsCount)

	ps := models.PublicSettings{
		MaxCapacity:               s.MaxCapacity,
		AdultPriceCents:           s.AdultPriceCents,
		ChildPriceCents:           s.ChildPriceCents,
		EarlyBirdCount:            s.EarlyBirdCount,
		EarlyBirdDiscountPercent:  s.EarlyBirdDiscountPercent,
		MaxIndividualAdultTickets: s.MaxIndividualAdultTickets,
		MaxIndividualChildTickets: s.MaxIndividualChildTickets,
		PaidBookingsCount:         paidBookingsCount,
	}
	if s.EventDate.Valid {
		dateStr := s.EventDate.Time.Format(time.RFC3339)
		ps.EventDate = &dateStr
	}
	if s.EventInfo.Valid {
		ps.EventInfo = &s.EventInfo.String
	}

	if packs, err := h.getPacks(); err == nil {
		ps.Packs = packs
	}

	h.respondJSON(w, http.StatusOK, ps)
}

// GetCapacity returns current ticket capacity. Optional ?dateId= scopes to that date.
func (h *Handler) GetCapacity(w http.ResponseWriter, r *http.Request) {
	dateIDStr := r.URL.Query().Get("dateId")
	dateID, _ := strconv.Atoi(dateIDStr)
	capacity, err := h.getCapacityForDate(dateID)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to get capacity")
		return
	}
	h.respondJSON(w, http.StatusOK, capacity)
}

// getCapacity returns global capacity (no date scope). Used by broadcastCapacity.
func (h *Handler) getCapacity() (*models.Capacity, error) {
	return h.getCapacityForDate(0)
}

// getCapacityForDate returns capacity for a specific event date (or global when 0).
func (h *Handler) getCapacityForDate(eventDateID int) (*models.Capacity, error) {
	var maxCapacity int
	if eventDateID > 0 {
		err := h.db.QueryRow(`SELECT max_capacity FROM event_opening_dates WHERE id = ?`, eventDateID).Scan(&maxCapacity)
		if err != nil {
			return nil, err
		}
	} else {
		err := h.db.QueryRow(`SELECT max_capacity FROM settings WHERE id = 1`).Scan(&maxCapacity)
		if err != nil {
			return nil, err
		}
	}

	var soldTickets int
	if eventDateID > 0 {
		h.db.QueryRow(`SELECT COALESCE(SUM(adults_count + children_count), 0) FROM bookings WHERE event_date_id = ? AND payment_status = 'paid' AND deleted_at IS NULL`, eventDateID).Scan(&soldTickets)
	} else {
		h.db.QueryRow(`SELECT COALESCE(SUM(adults_count + children_count), 0) FROM bookings WHERE payment_status = 'paid' AND deleted_at IS NULL`).Scan(&soldTickets)
	}

	return &models.Capacity{
		MaxCapacity:      maxCapacity,
		SoldTickets:      soldTickets,
		AvailableTickets: maxCapacity - soldTickets,
	}, nil
}

// broadcastCapacity pushes capacity for a specific event date over WS so clients
// viewing that date update live. Pass 0 for a global (legacy) broadcast.
func (h *Handler) broadcastCapacity(dateID int) {
	capacity, err := h.getCapacityForDate(dateID)
	if err != nil {
		log.Printf("Error getting capacity for broadcast: %v", err)
		return
	}
	h.hub.BroadcastCapacity(dateID, capacity.MaxCapacity, capacity.SoldTickets, capacity.AvailableTickets)
}

// CreateBooking creates a new booking (without payment).
func (h *Handler) CreateBooking(w http.ResponseWriter, r *http.Request) {
	var req models.CreateBookingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Resolve and price the cart server-side.
	cart, err := h.resolveCart(&req)
	if err != nil {
		var ce *cartError
		if errors.As(err, &ce) {
			h.respondError(w, http.StatusBadRequest, ce.Error())
		} else {
			h.respondError(w, http.StatusInternalServerError, "Failed to process cart")
		}
		return
	}

	// Validate input
	verrs := validation.ValidateBookingRequest(
		req.Name, req.Surname, req.Email,
		req.PhoneCountryCode, req.PhoneNumber,
		cart.TotalAdults, cart.TotalChildren,
	)
	if verrs.HasErrors() {
		h.respondJSON(w, http.StatusBadRequest, map[string]interface{}{
			"error":  "Validation failed",
			"fields": verrs.Fields,
		})
		return
	}

	// Sanitize input
	req.Name = validation.SanitizeString(req.Name, 120)
	req.Surname = validation.SanitizeString(req.Surname, 120)
	req.Email = validation.SanitizeString(req.Email, 255)

	hasPhotographer, hasPremiumPass := aggregatePackFlags(cart.Items)
	id := uuid.New().String()
	qrToken := uuid.New().String()

	var eventDateIDArg interface{}
	if req.EventDateID > 0 {
		eventDateIDArg = req.EventDateID
	}
	_, err = h.db.Exec(`INSERT INTO bookings (id, event_date_id, name, surname, email, phone_country_code, phone_number, adults_count, children_count, has_photographer, has_premium_pass, adult_price_cents, child_price_cents, total_amount_cents, qr_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		id, eventDateIDArg, req.Name, req.Surname, req.Email, req.PhoneCountryCode, req.PhoneNumber, cart.TotalAdults, cart.TotalChildren, hasPhotographer, hasPremiumPass, cart.AdultPriceCents, cart.ChildPriceCents, cart.TotalAmountCents, qrToken,
	)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to create booking")
		return
	}

	h.insertBookingItems(id, cart.Items)

	h.respondJSON(w, http.StatusCreated, map[string]string{"id": id, "qrToken": qrToken})
}

// GetBooking returns a booking by ID or Stripe session ID.
func (h *Handler) GetBooking(w http.ResponseWriter, r *http.Request) {
	id := extractID(r.URL.Path, "/api/public/bookings/")
	if id == "" {
		id = extractID(r.URL.Path, "/api/admin/bookings/")
	}
	if id == "" {
		h.respondError(w, http.StatusBadRequest, "Missing booking ID")
		return
	}

	var booking models.Booking
	var eventDate sql.NullTime
	err := h.db.QueryRow(`
		SELECT b.id, b.name, b.surname, b.email, b.phone_country_code, b.phone_number, 
		       b.adults_count, b.children_count, b.adult_price_cents, b.child_price_cents, 
		       b.total_amount_cents, b.payment_status, b.payment_method, b.qr_token, 
		       b.confirmed_assistance, b.created_at,
		       COALESCE(eod.event_date, s.event_date)
		FROM bookings b
		JOIN settings s ON s.id = 1
		LEFT JOIN event_opening_dates eod ON eod.id = b.event_date_id
		WHERE (b.id = ? OR b.stripe_checkout_session_id = ?) AND b.deleted_at IS NULL
	`, id, id).Scan(
		&booking.ID, &booking.Name, &booking.Surname, &booking.Email,
		&booking.PhoneCountryCode, &booking.PhoneNumber, &booking.AdultsCount,
		&booking.ChildrenCount, &booking.AdultPriceCents, &booking.ChildPriceCents,
		&booking.TotalAmountCents, &booking.PaymentStatus, &booking.PaymentMethod,
		&booking.QRToken, &booking.ConfirmedAssistance, &booking.CreatedAt, &eventDate,
	)
	if err == sql.ErrNoRows {
		h.respondError(w, http.StatusNotFound, "Booking not found")
		return
	}
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to get booking")
		return
	}

	response := map[string]interface{}{
		"id":                  booking.ID,
		"name":                booking.Name,
		"surname":             booking.Surname,
		"email":               booking.Email,
		"phoneCountryCode":    booking.PhoneCountryCode,
		"phoneNumber":         booking.PhoneNumber,
		"adultsCount":         booking.AdultsCount,
		"childrenCount":       booking.ChildrenCount,
		"totalAmountCents":    booking.TotalAmountCents,
		"paymentStatus":       booking.PaymentStatus,
		"qrToken":             booking.QRToken,
		"confirmedAssistance": booking.ConfirmedAssistance,
	}
	if eventDate.Valid {
		response["eventDate"] = eventDate.Time.Format(time.RFC3339)
	}
	response["items"] = h.getBookingItems(booking.ID)
	response["memberAllergies"] = h.getMemberAllergies(booking.ID)

	h.respondJSON(w, http.StatusOK, response)
}

// CreateStripeCheckout creates a Stripe checkout session (booking created on webhook).
func (h *Handler) CreateStripeCheckout(w http.ResponseWriter, r *http.Request) {
	var req models.CreateBookingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Resolve the event date. Trust-boundary validation: must be open and non-full.
	eventDateID := req.EventDateID
	if eventDateID == 0 {
		// Fall back to the global default date.
		h.db.QueryRow(`SELECT COALESCE(default_event_date_id, 0) FROM settings WHERE id = 1`).Scan(&eventDateID)
	}
	var eventDateStr string
	if eventDateID > 0 {
		var isOpen bool
		err := h.db.QueryRow(`SELECT DATE_FORMAT(event_date, '%Y-%m-%d'), is_open FROM event_opening_dates WHERE id = ?`, eventDateID).Scan(&eventDateStr, &isOpen)
		if err != nil {
			h.respondError(w, http.StatusBadRequest, "Fecha de evento no válida")
			return
		}
		if !isOpen {
			h.respondError(w, http.StatusBadRequest, "Esta fecha no está disponible para reservas")
			return
		}
		req.EventDateID = eventDateID // ensure resolveCart uses correct dateID
	}

	// Resolve and price the cart server-side (supports multiple packs and
	// individual tickets combined in the same purchase).
	cart, err := h.resolveCart(&req)
	if err != nil {
		var ce *cartError
		if errors.As(err, &ce) {
			h.respondError(w, http.StatusBadRequest, ce.Error())
		} else {
			h.respondError(w, http.StatusInternalServerError, "Failed to process cart")
		}
		return
	}

	// Validate buyer fields and total ticket count.
	verrs := validation.ValidateBookingRequest(
		req.Name, req.Surname, req.Email,
		req.PhoneCountryCode, req.PhoneNumber,
		cart.TotalAdults, cart.TotalChildren,
	)
	if verrs.HasErrors() {
		h.respondJSON(w, http.StatusBadRequest, map[string]interface{}{
			"error":  "Validation failed",
			"fields": verrs.Fields,
		})
		return
	}

	// Serialize member allergies to JSON for metadata
	var memberAllergiesJSON string
	if len(req.MemberAllergies) > 0 {
		allergiesBytes, _ := json.Marshal(req.MemberAllergies)
		memberAllergiesJSON = string(allergiesBytes)
	}

	totalTickets := cart.TotalAdults + cart.TotalChildren

	// Check capacity (date-scoped when we have a dateID).
	capacity, err := h.getCapacityForDate(eventDateID)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to check capacity")
		return
	}
	if totalTickets > capacity.AvailableTickets {
		h.respondError(w, http.StatusBadRequest, "Not enough tickets available")
		return
	}

	totalAmount := cart.TotalAmountCents
	lineItems := cart.stripeLineItems()

	// Build human-readable date for Stripe description.
	stripeDesc := "Desayuno con Princesas"
	if eventDateStr != "" {
		// eventDateStr is YYYY-MM-DD from the DB DATE column.
		if t, err := time.Parse("2006-01-02", eventDateStr); err == nil {
			stripeDesc = fmt.Sprintf("Desayuno con Princesas — %s", t.Format("02/01/2006"))
		}
	}

	metadata := map[string]string{
		"name":               req.Name,
		"surname":            req.Surname,
		"email":              req.Email,
		"phone_country_code": req.PhoneCountryCode,
		"phone_number":       req.PhoneNumber,
		"adults_count":       fmt.Sprintf("%d", cart.TotalAdults),
		"children_count":     fmt.Sprintf("%d", cart.TotalChildren),
		"adult_price_cents":  fmt.Sprintf("%d", cart.AdultPriceCents),
		"child_price_cents":  fmt.Sprintf("%d", cart.ChildPriceCents),
		"total_amount_cents": fmt.Sprintf("%d", totalAmount),
		"event_date_id":      fmt.Sprintf("%d", eventDateID),
	}
	cart.writeToMetadata(metadata)
	if memberAllergiesJSON != "" {
		metadata["member_allergies"] = memberAllergiesJSON
	}

	params := &stripe.CheckoutSessionParams{
		PaymentMethodTypes: stripe.StringSlice([]string{"card"}),
		Mode:               stripe.String(string(stripe.CheckoutSessionModePayment)),
		CustomerEmail:      stripe.String(req.Email),
		LineItems:          lineItems,
		SuccessURL:         stripe.String(fmt.Sprintf("%s/payment_success?session_id={CHECKOUT_SESSION_ID}", h.cfg.FrontendURL)),
		CancelURL:          stripe.String(fmt.Sprintf("%s/payment_cancel", h.cfg.FrontendURL)),
		Metadata:           metadata,
		PaymentIntentData: &stripe.CheckoutSessionPaymentIntentDataParams{
			Description: stripe.String(stripeDesc),
		},
	}

	sess, err := session.New(params)
	if err != nil {
		log.Printf("Stripe session error: %v", err)
		h.respondError(w, http.StatusInternalServerError, "Failed to create checkout session")
		return
	}

	h.respondJSON(w, http.StatusOK, map[string]string{"checkoutUrl": sess.URL})
}

// StripeWebhook handles Stripe webhook events.
func (h *Handler) StripeWebhook(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		h.respondError(w, http.StatusBadRequest, "Failed to read body")
		return
	}

	var event stripe.Event

	// Validate signature in production
	if h.cfg.StripeWebhookSecret != "" {
		event, err = webhook.ConstructEventWithOptions(body, r.Header.Get("Stripe-Signature"), h.cfg.StripeWebhookSecret, webhook.ConstructEventOptions{
			// The Stripe webhook endpoint uses the account's API version
			// (2026-05-27.dahlia), which differs from the version pinned by
			// stripe-go v76. The fields we read are stable across versions.
			IgnoreAPIVersionMismatch: true,
		})
		if err != nil {
			log.Printf("Stripe webhook signature verification failed: %v", err)
			h.respondError(w, http.StatusBadRequest, "Invalid signature")
			return
		}
	} else {
		if err := json.Unmarshal(body, &event); err != nil {
			h.respondError(w, http.StatusBadRequest, "Invalid event")
			return
		}
	}

	switch event.Type {
	case "checkout.session.completed":
		var sess stripe.CheckoutSession
		if err := json.Unmarshal(event.Data.Raw, &sess); err != nil {
			log.Printf("Failed to parse checkout session: %v", err)
			break
		}

		// Handle booking_update payments (pack change price difference)
		if sess.Metadata["type"] == "booking_update" {
			h.handleBookingUpdatePayment(&sess)
			break
		}

		// Check if booking already exists for this session (created by verify-session)
		var existingID string
		err = h.db.QueryRow(`SELECT id FROM bookings WHERE stripe_checkout_session_id = ? AND deleted_at IS NULL`, sess.ID).Scan(&existingID)
		if err == nil {
			log.Printf("Webhook: Booking %s already exists for session %s, skipping", existingID, sess.ID)
			break
		}

		// Extract booking data from metadata
		meta := sess.Metadata
		if meta["email"] == "" {
			log.Printf("No booking data in session metadata")
			break
		}

		adultsCount, _ := strconv.Atoi(meta["adults_count"])
		childrenCount, _ := strconv.Atoi(meta["children_count"])
		adultPriceCents, _ := strconv.Atoi(meta["adult_price_cents"])
		childPriceCents, _ := strconv.Atoi(meta["child_price_cents"])
		totalAmountCents, _ := strconv.Atoi(meta["total_amount_cents"])
		eventDateIDMeta, _ := strconv.Atoi(meta["event_date_id"])
		cartItems := cartItemsFromMetadata(meta)
		hasPhotographer, hasPremiumPass := aggregatePackFlags(cartItems)

		// Check capacity again before inserting (date-scoped when available).
		capacity, capErr := h.getCapacityForDate(eventDateIDMeta)
		if capErr != nil {
			log.Printf("Capacity check failed for session %s: %v", sess.ID, capErr)
			break
		}
		totalTickets := adultsCount + childrenCount
		if totalTickets > capacity.AvailableTickets {
			log.Printf("Capacity exceeded for session %s - payment received but no capacity", sess.ID)
			// TODO: Trigger refund via Stripe API
			break
		}

		// Create the booking. pack_type stays NULL: the full composition lives in
		// booking_items, which supports several packs and individual tickets.
		bookingID := uuid.New().String()
		qrToken := uuid.New().String()
		paymentIntentID := ""
		if sess.PaymentIntent != nil {
			paymentIntentID = sess.PaymentIntent.ID
		}

		var eventDateIDArg interface{}
		if eventDateIDMeta > 0 {
			eventDateIDArg = eventDateIDMeta
		}
		_, err = h.db.Exec(`INSERT INTO bookings (id, event_date_id, name, surname, email, phone_country_code, phone_number, adults_count, children_count, has_photographer, has_premium_pass, adult_price_cents, child_price_cents, total_amount_cents, qr_token, payment_status, payment_method, stripe_checkout_session_id, stripe_payment_intent_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'paid', 'stripe', ?, ?)`,
			bookingID, eventDateIDArg, meta["name"], meta["surname"], meta["email"], meta["phone_country_code"], meta["phone_number"],
			adultsCount, childrenCount, hasPhotographer, hasPremiumPass, adultPriceCents, childPriceCents, totalAmountCents, qrToken, sess.ID, paymentIntentID,
		)
		if err != nil {
			// Check for duplicate (race condition)
			if strings.Contains(err.Error(), "Duplicate") {
				log.Printf("Webhook: Duplicate booking for session %s, already created", sess.ID)
				break
			}
			log.Printf("Failed to create booking: %v", err)
			break
		}

		h.insertBookingItems(bookingID, cartItems)

		// Store member allergies if present
		if memberAllergiesStr := meta["member_allergies"]; memberAllergiesStr != "" {
			var memberAllergies []models.MemberAllergyInput
			if err := json.Unmarshal([]byte(memberAllergiesStr), &memberAllergies); err == nil {
				for _, ma := range memberAllergies {
					if len(ma.Allergies) > 0 {
						allergiesJSON, _ := json.Marshal(ma.Allergies)
						h.db.Exec(`INSERT INTO member_allergies (booking_id, member_type, member_index, name, lastname, allergies) VALUES (?, ?, ?, ?, ?, ?)`,
							bookingID, ma.MemberType, ma.MemberIndex, ma.Name, ma.Lastname, string(allergiesJSON))
					}
				}
			}
		}

		log.Printf("Payment completed, booking %s created for %s", bookingID, meta["email"])

		// Generate QR code and upload to BunnyCDN
		go func(bid, token string) {
			qrURL, err := h.qr.GenerateAndUploadQR(bid, token)
			if err != nil {
				log.Printf("Failed to generate/upload QR for booking %s: %v", bid, err)
			} else {
				log.Printf("QR code uploaded for booking %s: %s", bid, qrURL)
			}
			// Send confirmation email after QR is ready
			h.email.SendConfirmation(bid)
		}(bookingID, qrToken)

		go h.broadcastCapacity(eventDateIDMeta)
	}

	w.WriteHeader(http.StatusOK)
}

// VerifyStripeSession verifies a Stripe session and creates the booking if needed.
// This is called from the payment success page to ensure the booking exists.
func (h *Handler) VerifyStripeSession(w http.ResponseWriter, r *http.Request) {
	sessionID := extractID(r.URL.Path, "/api/public/verify-session/")
	if sessionID == "" {
		h.respondError(w, http.StatusBadRequest, "Missing session ID")
		return
	}

	// Check if booking already exists for this session
	var existingID string
	err := h.db.QueryRow(`SELECT id FROM bookings WHERE stripe_checkout_session_id = ? AND deleted_at IS NULL`, sessionID).Scan(&existingID)
	if err == nil {
		// Booking already exists, return it
		h.respondJSON(w, http.StatusOK, map[string]string{"bookingId": existingID, "status": "exists"})
		return
	}
	if err != sql.ErrNoRows {
		log.Printf("Database error checking session: %v", err)
		h.respondError(w, http.StatusInternalServerError, "Database error")
		return
	}

	// Fetch session from Stripe
	sess, err := session.Get(sessionID, nil)
	if err != nil {
		log.Printf("Failed to fetch Stripe session %s: %v", sessionID, err)
		h.respondError(w, http.StatusBadRequest, "Invalid session")
		return
	}

	// Check if payment was successful
	if sess.PaymentStatus != stripe.CheckoutSessionPaymentStatusPaid {
		h.respondError(w, http.StatusBadRequest, "Payment not completed")
		return
	}

	// Extract booking data from metadata
	meta := sess.Metadata
	if meta["email"] == "" {
		h.respondError(w, http.StatusBadRequest, "Invalid session metadata")
		return
	}

	adultsCount, _ := strconv.Atoi(meta["adults_count"])
	childrenCount, _ := strconv.Atoi(meta["children_count"])
	adultPriceCents, _ := strconv.Atoi(meta["adult_price_cents"])
	childPriceCents, _ := strconv.Atoi(meta["child_price_cents"])
	totalAmountCents, _ := strconv.Atoi(meta["total_amount_cents"])
	eventDateIDMeta, _ := strconv.Atoi(meta["event_date_id"])
	cartItems := cartItemsFromMetadata(meta)
	hasPhotographer, hasPremiumPass := aggregatePackFlags(cartItems)

	// Check capacity (date-scoped when available).
	capacity, capErr := h.getCapacityForDate(eventDateIDMeta)
	if capErr != nil {
		log.Printf("Capacity check failed for session %s: %v", sessionID, capErr)
		h.respondError(w, http.StatusInternalServerError, "Failed to check capacity")
		return
	}
	totalTickets := adultsCount + childrenCount
	if totalTickets > capacity.AvailableTickets {
		log.Printf("Capacity exceeded for session %s", sessionID)
		h.respondError(w, http.StatusBadRequest, "Capacity exceeded")
		return
	}

	// Create the booking. pack_type stays NULL: the full composition lives in
	// booking_items, which supports several packs and individual tickets.
	bookingID := uuid.New().String()
	qrToken := uuid.New().String()
	paymentIntentID := ""
	if sess.PaymentIntent != nil {
		paymentIntentID = sess.PaymentIntent.ID
	}

	var eventDateIDArg interface{}
	if eventDateIDMeta > 0 {
		eventDateIDArg = eventDateIDMeta
	}
	_, err = h.db.Exec(`INSERT INTO bookings (id, event_date_id, name, surname, email, phone_country_code, phone_number, adults_count, children_count, has_photographer, has_premium_pass, adult_price_cents, child_price_cents, total_amount_cents, qr_token, payment_status, payment_method, stripe_checkout_session_id, stripe_payment_intent_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'paid', 'stripe', ?, ?)`,
		bookingID, eventDateIDArg, meta["name"], meta["surname"], meta["email"], meta["phone_country_code"], meta["phone_number"],
		adultsCount, childrenCount, hasPhotographer, hasPremiumPass, adultPriceCents, childPriceCents, totalAmountCents, qrToken, sessionID, paymentIntentID,
	)
	if err != nil {
		// Check if it's a duplicate (race condition with webhook)
		if strings.Contains(err.Error(), "Duplicate") {
			err = h.db.QueryRow(`SELECT id FROM bookings WHERE stripe_checkout_session_id = ? AND deleted_at IS NULL`, sessionID).Scan(&existingID)
			if err == nil {
				h.respondJSON(w, http.StatusOK, map[string]string{"bookingId": existingID, "status": "exists"})
				return
			}
		}
		log.Printf("Failed to create booking: %v", err)
		h.respondError(w, http.StatusInternalServerError, "Failed to create booking")
		return
	}

	h.insertBookingItems(bookingID, cartItems)

	// Store member allergies if present
	if memberAllergiesStr := meta["member_allergies"]; memberAllergiesStr != "" {
		var memberAllergies []models.MemberAllergyInput
		if err := json.Unmarshal([]byte(memberAllergiesStr), &memberAllergies); err == nil {
			for _, ma := range memberAllergies {
				if len(ma.Allergies) > 0 {
					allergiesJSON, _ := json.Marshal(ma.Allergies)
					h.db.Exec(`INSERT INTO member_allergies (booking_id, member_type, member_index, name, lastname, allergies) VALUES (?, ?, ?, ?, ?, ?)`,
						bookingID, ma.MemberType, ma.MemberIndex, ma.Name, ma.Lastname, string(allergiesJSON))
				}
			}
		}
	}

	log.Printf("Booking %s created via verify-session for %s", bookingID, meta["email"])

	// Generate QR code and upload to BunnyCDN (async)
	go func(bid, token string) {
		qrURL, err := h.qr.GenerateAndUploadQR(bid, token)
		if err != nil {
			log.Printf("Failed to generate/upload QR for booking %s: %v", bid, err)
		} else {
			log.Printf("QR code uploaded for booking %s: %s", bid, qrURL)
		}
		// Send confirmation email after QR is ready
		h.email.SendConfirmation(bid)
	}(bookingID, qrToken)

	go h.broadcastCapacity(eventDateIDMeta)

	h.respondJSON(w, http.StatusOK, map[string]string{"bookingId": bookingID, "status": "created"})
}

// GetKPIs returns dashboard KPIs.
func (h *Handler) GetKPIs(w http.ResponseWriter, r *http.Request) {
	var kpis models.KPIs

	h.db.QueryRow(`SELECT COALESCE(SUM(adults_count + children_count), 0) FROM bookings WHERE payment_status = 'paid' AND deleted_at IS NULL`).Scan(&kpis.TotalTicketsSold)
	h.db.QueryRow(`SELECT COALESCE(SUM(total_amount_cents), 0) FROM bookings WHERE payment_status = 'paid' AND deleted_at IS NULL`).Scan(&kpis.TotalAmountEarned)
	h.db.QueryRow(`SELECT COALESCE(SUM(total_amount_cents), 0) FROM bookings WHERE payment_status = 'paid' AND payment_method = 'stripe' AND deleted_at IS NULL`).Scan(&kpis.AmountPaidOnline)
	h.db.QueryRow(`SELECT COALESCE(SUM(total_amount_cents), 0) FROM bookings WHERE payment_status = 'paid' AND payment_method = 'cash' AND deleted_at IS NULL`).Scan(&kpis.AmountPaidCash)
	h.db.QueryRow(`SELECT COALESCE(SUM(adults_count), 0) FROM bookings WHERE payment_status = 'paid' AND deleted_at IS NULL`).Scan(&kpis.TotalAdultTickets)
	h.db.QueryRow(`SELECT COALESCE(SUM(children_count), 0) FROM bookings WHERE payment_status = 'paid' AND deleted_at IS NULL`).Scan(&kpis.TotalChildTickets)
	h.db.QueryRow(`SELECT max_capacity FROM settings WHERE id = 1`).Scan(&kpis.AvailableCapacity)
	kpis.AvailableCapacity -= kpis.TotalTicketsSold
	h.db.QueryRow(`SELECT COUNT(*) FROM bookings WHERE confirmed_assistance = true AND deleted_at IS NULL`).Scan(&kpis.ConfirmedAttendance)

	h.respondJSON(w, http.StatusOK, kpis)
}

// ListBookings returns filtered bookings list.
// Optional ?dateId= filters by b.event_date_id.
func (h *Handler) ListBookings(w http.ResponseWriter, r *http.Request) {
	query := `SELECT b.id, b.name, b.surname, b.email, b.phone_country_code, b.phone_number, b.adults_count, b.children_count, b.pack_type, b.has_photographer, b.has_premium_pass, b.total_amount_cents, b.payment_status, b.payment_method, b.confirmed_assistance, b.created_at,
		(SELECT COUNT(*) FROM member_allergies ma WHERE ma.booking_id = b.id) as allergy_count,
		DATE_FORMAT(eod.event_date, '%Y-%m-%d'),
		COALESCE((SELECT bu2.status FROM booking_updates bu2 WHERE bu2.booking_id = b.id ORDER BY bu2.created_at DESC LIMIT 1), ''),
		COALESCE((SELECT bu3.payment_method FROM booking_updates bu3 WHERE bu3.booking_id = b.id ORDER BY bu3.created_at DESC LIMIT 1), ''),
		COALESCE((SELECT bu4.new_pack_type FROM booking_updates bu4 WHERE bu4.booking_id = b.id ORDER BY bu4.created_at DESC LIMIT 1), '')
		FROM bookings b
		LEFT JOIN event_opening_dates eod ON eod.id = b.event_date_id
		WHERE b.deleted_at IS NULL`

	var conditions []string
	var args []interface{}

	if name := r.URL.Query().Get("name"); name != "" {
		conditions = append(conditions, "b.name LIKE ?")
		args = append(args, "%"+name+"%")
	}
	if email := r.URL.Query().Get("email"); email != "" {
		conditions = append(conditions, "b.email LIKE ?")
		args = append(args, "%"+email+"%")
	}
	if status := r.URL.Query().Get("status"); status != "" {
		conditions = append(conditions, "b.payment_status = ?")
		args = append(args, status)
	}
	if method := r.URL.Query().Get("method"); method != "" {
		conditions = append(conditions, "b.payment_method = ?")
		args = append(args, method)
	}
	if confirmed := r.URL.Query().Get("confirmed"); confirmed != "" {
		conditions = append(conditions, "b.confirmed_assistance = ?")
		args = append(args, confirmed == "true")
	}
	if dateIDStr := r.URL.Query().Get("dateId"); dateIDStr != "" {
		if dateID, err := strconv.Atoi(dateIDStr); err == nil && dateID > 0 {
			conditions = append(conditions, "b.event_date_id = ?")
			args = append(args, dateID)
		}
	}

	if len(conditions) > 0 {
		query += " AND " + strings.Join(conditions, " AND ")
	}
	query += " ORDER BY b.created_at DESC"

	rows, err := h.db.Query(query, args...)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to list bookings")
		return
	}
	defer rows.Close()

	var bookings []map[string]interface{}
	for rows.Next() {
		var b models.Booking
		var allergyCount int
		var eventDateCol, updateStatus, updatePaymentMethod, updateNewPackType sql.NullString
		err := rows.Scan(&b.ID, &b.Name, &b.Surname, &b.Email, &b.PhoneCountryCode, &b.PhoneNumber, &b.AdultsCount, &b.ChildrenCount, &b.PackType, &b.HasPhotographer, &b.HasPremiumPass, &b.TotalAmountCents, &b.PaymentStatus, &b.PaymentMethod, &b.ConfirmedAssistance, &b.CreatedAt, &allergyCount, &eventDateCol, &updateStatus, &updatePaymentMethod, &updateNewPackType)
		if err != nil {
			continue
		}
		booking := map[string]interface{}{
			"id":                  b.ID,
			"name":                b.Name,
			"surname":             b.Surname,
			"email":               b.Email,
			"phone":               b.PhoneCountryCode + " " + b.PhoneNumber,
			"adultsCount":         b.AdultsCount,
			"childrenCount":       b.ChildrenCount,
			"totalAmountCents":    b.TotalAmountCents,
			"paymentStatus":       b.PaymentStatus,
			"paymentMethod":       b.PaymentMethod,
			"confirmedAssistance": b.ConfirmedAssistance,
			"createdAt":           b.CreatedAt,
			"allergyCount":        allergyCount,
			"hasPhotographer":     b.HasPhotographer,
			"hasPremiumPass":      b.HasPremiumPass,
		}
		if updateStatus.Valid && updateStatus.String != "" {
			booking["bookingUpdateStatus"] = updateStatus.String
		}
		if updatePaymentMethod.Valid {
			booking["bookingUpdatePaymentMethod"] = updatePaymentMethod.String
		}
		if updateNewPackType.Valid {
			booking["bookingUpdateNewPackType"] = updateNewPackType.String
		}
		if eventDateCol.Valid {
			booking["eventDate"] = eventDateCol.String
		}
		if b.PackType.Valid {
			booking["packType"] = b.PackType.String
			if pack := h.getPackInfo(b.PackType.String); pack != nil {
				booking["packName"] = pack.Name
			}
		}

		// Attach the full composition (packs + individual tickets).
		items := h.getBookingItems(b.ID)
		booking["items"] = items
		packNames := []string{}
		for _, it := range items {
			if name, ok := it["packName"].(string); ok && name != "" {
				label := name
				if q, ok := it["quantity"].(int); ok && q > 1 {
					label = fmt.Sprintf("%s x%d", name, q)
				}
				packNames = append(packNames, label)
			}
		}
		booking["packNames"] = packNames

		bookings = append(bookings, booking)
	}

	if bookings == nil {
		bookings = []map[string]interface{}{}
	}

	h.respondJSON(w, http.StatusOK, bookings)
}

// GetBookingAdmin returns a single booking (admin).
func (h *Handler) GetBookingAdmin(w http.ResponseWriter, r *http.Request) {
	h.GetBooking(w, r)
}

// GetBookingAllergies returns allergies for a specific booking.
func (h *Handler) GetBookingAllergies(w http.ResponseWriter, r *http.Request) {
	id := extractID(r.URL.Path, "/api/admin/bookings/")
	id = strings.TrimSuffix(id, "/allergies")
	if id == "" {
		h.respondError(w, http.StatusBadRequest, "Missing booking ID")
		return
	}

	rows, err := h.db.Query(`SELECT id, booking_id, member_type, member_index, name, lastname, allergies FROM member_allergies WHERE booking_id = ? ORDER BY member_type, member_index`, id)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to get allergies")
		return
	}
	defer rows.Close()

	var allergies []map[string]interface{}
	for rows.Next() {
		var ma models.MemberAllergy
		var allergiesJSON string
		err := rows.Scan(&ma.ID, &ma.BookingID, &ma.MemberType, &ma.MemberIndex, &ma.Name, &ma.Lastname, &allergiesJSON)
		if err != nil {
			continue
		}
		var allergyList []string
		json.Unmarshal([]byte(allergiesJSON), &allergyList)
		allergies = append(allergies, map[string]interface{}{
			"id":          ma.ID,
			"bookingId":   ma.BookingID,
			"memberType":  ma.MemberType,
			"memberIndex": ma.MemberIndex,
			"name":        ma.Name,
			"lastname":    ma.Lastname,
			"allergies":   allergyList,
		})
	}

	if allergies == nil {
		allergies = []map[string]interface{}{}
	}

	h.respondJSON(w, http.StatusOK, allergies)
}

// UpdateBookingAllergies replaces all allergies for a booking.
func (h *Handler) UpdateBookingAllergies(w http.ResponseWriter, r *http.Request) {
	id := extractID(r.URL.Path, "/api/admin/bookings/")
	id = strings.TrimSuffix(id, "/allergies")
	if id == "" {
		h.respondError(w, http.StatusBadRequest, "Missing booking ID")
		return
	}

	// Check booking exists
	var exists bool
	err := h.db.QueryRow(`SELECT EXISTS(SELECT 1 FROM bookings WHERE id = ? AND deleted_at IS NULL)`, id).Scan(&exists)
	if err != nil || !exists {
		h.respondError(w, http.StatusNotFound, "Booking not found")
		return
	}

	var allergies []models.MemberAllergyInput
	if err := json.NewDecoder(r.Body).Decode(&allergies); err != nil {
		h.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Delete existing allergies
	_, err = h.db.Exec(`DELETE FROM member_allergies WHERE booking_id = ?`, id)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to update allergies")
		return
	}

	// Insert new allergies
	for _, ma := range allergies {
		if len(ma.Allergies) > 0 && ma.Name != "" && ma.Lastname != "" {
			allergiesJSON, _ := json.Marshal(ma.Allergies)
			_, err = h.db.Exec(`INSERT INTO member_allergies (booking_id, member_type, member_index, name, lastname, allergies) VALUES (?, ?, ?, ?, ?, ?)`,
				id, ma.MemberType, ma.MemberIndex, ma.Name, ma.Lastname, string(allergiesJSON))
			if err != nil {
				log.Printf("Failed to insert allergy: %v", err)
			}
		}
	}

	h.respondJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

// UpdateBooking updates a booking.
func (h *Handler) UpdateBooking(w http.ResponseWriter, r *http.Request) {
	id := extractID(r.URL.Path, "/api/admin/bookings/")
	if id == "" {
		h.respondError(w, http.StatusBadRequest, "Missing booking ID")
		return
	}

	var req models.UpdateBookingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	var updates []string
	var args []interface{}

	if req.Name != nil {
		updates = append(updates, "name = ?")
		args = append(args, validation.SanitizeString(*req.Name, 120))
	}
	if req.Surname != nil {
		updates = append(updates, "surname = ?")
		args = append(args, validation.SanitizeString(*req.Surname, 120))
	}
	if req.Email != nil {
		if err := validation.ValidateEmail(*req.Email); err != nil {
			h.respondError(w, http.StatusBadRequest, "Invalid email format")
			return
		}
		updates = append(updates, "email = ?")
		args = append(args, *req.Email)
	}
	if req.PaymentStatus != nil {
		validStatuses := map[string]bool{"pending": true, "paid": true, "failed": true, "refunded": true}
		if !validStatuses[*req.PaymentStatus] {
			h.respondError(w, http.StatusBadRequest, "Invalid payment status")
			return
		}
		updates = append(updates, "payment_status = ?")
		args = append(args, *req.PaymentStatus)
	}
	if req.PaymentMethod != nil {
		validMethods := map[string]bool{"stripe": true, "cash": true}
		if !validMethods[*req.PaymentMethod] {
			h.respondError(w, http.StatusBadRequest, "Invalid payment method")
			return
		}
		updates = append(updates, "payment_method = ?")
		args = append(args, *req.PaymentMethod)
	}

	if len(updates) == 0 {
		h.respondError(w, http.StatusBadRequest, "No fields to update")
		return
	}

	args = append(args, id)
	query := fmt.Sprintf("UPDATE bookings SET %s WHERE id = ? AND deleted_at IS NULL", strings.Join(updates, ", "))

	// Check if we're updating payment status to 'paid' - need to generate QR if not exists
	generateQR := req.PaymentStatus != nil && *req.PaymentStatus == "paid"

	result, err := h.db.Exec(query, args...)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to update booking")
		return
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		h.respondError(w, http.StatusNotFound, "Booking not found")
		return
	}

	// Generate QR code if payment status changed to paid and QR doesn't exist
	if generateQR {
		go func(bookingID string) {
			// Check if QR already exists
			var qrCodeURL sql.NullString
			var qrToken string
			err := h.db.QueryRow(`SELECT qr_token, qr_code_url FROM bookings WHERE id = ?`, bookingID).Scan(&qrToken, &qrCodeURL)
			if err != nil {
				log.Printf("Failed to get booking for QR generation: %v", err)
				return
			}
			if qrCodeURL.Valid && qrCodeURL.String != "" {
				return // QR already exists
			}
			qrURL, err := h.qr.GenerateAndUploadQR(bookingID, qrToken)
			if err != nil {
				log.Printf("Failed to generate/upload QR for booking %s: %v", bookingID, err)
			} else {
				log.Printf("QR code uploaded for booking %s: %s", bookingID, qrURL)
			}
		}(id)
	}

	go h.broadcastCapacity(0)
	h.respondJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

// DeleteBooking soft-deletes a booking.
func (h *Handler) DeleteBooking(w http.ResponseWriter, r *http.Request) {
	id := extractID(r.URL.Path, "/api/admin/bookings/")
	if id == "" {
		h.respondError(w, http.StatusBadRequest, "Missing booking ID")
		return
	}

	result, err := h.db.Exec(`UPDATE bookings SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL`, id)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to delete booking")
		return
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		h.respondError(w, http.StatusNotFound, "Booking not found")
		return
	}

	go h.broadcastCapacity(0)
	h.respondJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// ResendEmail resends confirmation email.
func (h *Handler) ResendEmail(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path
	id := strings.TrimSuffix(extractID(path, "/api/admin/bookings/"), "/resend-email")
	if id == "" {
		h.respondError(w, http.StatusBadRequest, "Missing booking ID")
		return
	}

	go h.email.SendConfirmation(id)
	h.respondJSON(w, http.StatusOK, map[string]string{"status": "email queued"})
}

// ConfirmQR confirms attendance via QR code scan.
func (h *Handler) ConfirmQR(w http.ResponseWriter, r *http.Request) {
	var req struct {
		QRToken string `json:"qrToken"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.QRToken == "" {
		h.respondError(w, http.StatusBadRequest, "QR token is required")
		return
	}

	var booking models.Booking
	var qrEventDate sql.NullString
	err := h.db.QueryRow(`
		SELECT b.id, b.name, b.surname, b.email, b.phone_country_code, b.phone_number,
		       b.adults_count, b.children_count, b.pack_type, b.has_photographer, b.has_premium_pass,
		       b.total_amount_cents, b.payment_status, b.payment_method, b.confirmed_assistance,
		       DATE_FORMAT(eod.event_date, '%Y-%m-%d')
		FROM bookings b
		LEFT JOIN event_opening_dates eod ON eod.id = b.event_date_id
		WHERE b.qr_token = ? AND b.deleted_at IS NULL`, req.QRToken).Scan(
		&booking.ID, &booking.Name, &booking.Surname, &booking.Email, &booking.PhoneCountryCode, &booking.PhoneNumber, &booking.AdultsCount, &booking.ChildrenCount, &booking.PackType, &booking.HasPhotographer, &booking.HasPremiumPass, &booking.TotalAmountCents, &booking.PaymentStatus, &booking.PaymentMethod, &booking.ConfirmedAssistance,
		&qrEventDate,
	)
	if err == sql.ErrNoRows {
		h.respondError(w, http.StatusNotFound, "Invalid QR code")
		return
	}
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to find booking")
		return
	}

	alreadyConfirmed := booking.ConfirmedAssistance

	if !alreadyConfirmed {
		_, err = h.db.Exec(`UPDATE bookings SET confirmed_assistance = true, confirmed_at = NOW() WHERE id = ?`, booking.ID)
		if err != nil {
			log.Printf("Failed to confirm attendance: %v", err)
		}
	}

	// Fetch member allergies
	var memberAllergies []map[string]interface{}
	rows, err := h.db.Query(`SELECT id, member_type, member_index, name, lastname, allergies FROM member_allergies WHERE booking_id = ? ORDER BY member_type, member_index`, booking.ID)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var id, memberIndex int
			var memberType, name, lastname, allergiesJSON string
			if err := rows.Scan(&id, &memberType, &memberIndex, &name, &lastname, &allergiesJSON); err == nil {
				var allergyList []string
				json.Unmarshal([]byte(allergiesJSON), &allergyList)
				memberAllergies = append(memberAllergies, map[string]interface{}{
					"id":          id,
					"memberType":  memberType,
					"memberIndex": memberIndex,
					"name":        name,
					"lastname":    lastname,
					"allergies":   allergyList,
				})
			}
		}
	}

	bookingResponse := map[string]interface{}{
		"id":               booking.ID,
		"name":             booking.Name,
		"surname":          booking.Surname,
		"email":            booking.Email,
		"phone":            booking.PhoneCountryCode + " " + booking.PhoneNumber,
		"adultsCount":      booking.AdultsCount,
		"childrenCount":    booking.ChildrenCount,
		"totalPulseras":    booking.AdultsCount + booking.ChildrenCount,
		"totalAmountCents": booking.TotalAmountCents,
		"paymentStatus":    booking.PaymentStatus,
		"paymentMethod":    booking.PaymentMethod,
		"memberAllergies":  memberAllergies,
		"items":            h.getBookingItems(booking.ID),
		"hasPhotographer":  booking.HasPhotographer,
		"hasPremiumPass":   booking.HasPremiumPass,
	}
	if qrEventDate.Valid {
		bookingResponse["eventDate"] = qrEventDate.String
	}
	if booking.PackType.Valid {
		bookingResponse["packType"] = booking.PackType.String
		if pack := h.getPackInfo(booking.PackType.String); pack != nil {
			bookingResponse["packName"] = pack.Name
		}
	}

	h.respondJSON(w, http.StatusOK, map[string]interface{}{
		"booking":          bookingResponse,
		"alreadyConfirmed": alreadyConfirmed,
	})
}

// GetSettings returns all settings (admin).
func (h *Handler) GetSettings(w http.ResponseWriter, r *http.Request) {
	var s models.Settings
	err := h.db.QueryRow(`SELECT id, max_capacity, adult_price_cents, child_price_cents, event_date, event_info, early_bird_count, early_bird_discount_percent, COALESCE(max_individual_adult_tickets, 0), COALESCE(max_individual_child_tickets, 0), email_provider, smtp_host, smtp_port, smtp_username, smtp_from_email, gmail_username, created_at, updated_at FROM settings WHERE id = 1`).Scan(
		&s.ID, &s.MaxCapacity, &s.AdultPriceCents, &s.ChildPriceCents, &s.EventDate, &s.EventInfo, &s.EarlyBirdCount, &s.EarlyBirdDiscountPercent, &s.MaxIndividualAdultTickets, &s.MaxIndividualChildTickets, &s.EmailProvider, &s.SMTPHost, &s.SMTPPort, &s.SMTPUsername, &s.SMTPFromEmail, &s.GmailUsername, &s.CreatedAt, &s.UpdatedAt,
	)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to get settings")
		return
	}

	response := map[string]interface{}{
		"id":                        s.ID,
		"maxCapacity":               s.MaxCapacity,
		"adultPriceCents":           s.AdultPriceCents,
		"childPriceCents":           s.ChildPriceCents,
		"earlyBirdCount":            s.EarlyBirdCount,
		"earlyBirdDiscountPercent":  s.EarlyBirdDiscountPercent,
		"maxIndividualAdultTickets": s.MaxIndividualAdultTickets,
		"maxIndividualChildTickets": s.MaxIndividualChildTickets,
		"emailProvider":             s.EmailProvider,
	}
	if s.EventDate.Valid {
		response["eventDate"] = s.EventDate.Time.Format("2006-01-02T15:04")
	}
	if s.EventInfo.Valid {
		response["eventInfo"] = s.EventInfo.String
	}
	if s.SMTPHost.Valid {
		response["smtpHost"] = s.SMTPHost.String
	}
	if s.SMTPPort.Valid {
		response["smtpPort"] = s.SMTPPort.Int64
	}
	if s.SMTPUsername.Valid {
		response["smtpUsername"] = s.SMTPUsername.String
	}
	if s.SMTPFromEmail.Valid {
		response["smtpFromEmail"] = s.SMTPFromEmail.String
	}
	if s.GmailUsername.Valid {
		response["gmailUsername"] = s.GmailUsername.String
	}

	packs, err := h.getPacks()
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to get packs")
		return
	}
	response["packs"] = packs

	h.respondJSON(w, http.StatusOK, response)
}

// UpdateSettings updates settings.
func (h *Handler) UpdateSettings(w http.ResponseWriter, r *http.Request) {
	var req models.UpdateSettingsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Upsert packs if provided (create or edit). This reuses the settings
	// endpoint so the frontend does not need a dedicated packs endpoint.
	if len(req.Packs) > 0 {
		if err := h.upsertPacks(req.Packs); err != nil {
			h.respondError(w, http.StatusBadRequest, err.Error())
			return
		}
	}

	var updates []string
	var args []interface{}

	if req.MaxCapacity != nil {
		if *req.MaxCapacity < 1 {
			h.respondError(w, http.StatusBadRequest, "Max capacity must be at least 1")
			return
		}
		updates = append(updates, "max_capacity = ?")
		args = append(args, *req.MaxCapacity)
	}
	if req.AdultPriceCents != nil {
		if *req.AdultPriceCents < 0 {
			h.respondError(w, http.StatusBadRequest, "Price cannot be negative")
			return
		}
		updates = append(updates, "adult_price_cents = ?")
		args = append(args, *req.AdultPriceCents)
	}
	if req.ChildPriceCents != nil {
		if *req.ChildPriceCents < 0 {
			h.respondError(w, http.StatusBadRequest, "Price cannot be negative")
			return
		}
		updates = append(updates, "child_price_cents = ?")
		args = append(args, *req.ChildPriceCents)
	}
	if req.EventDate != nil {
		updates = append(updates, "event_date = ?")
		args = append(args, *req.EventDate)
	}
	if req.EmailProvider != nil {
		if *req.EmailProvider != "smtp" && *req.EmailProvider != "gmail" {
			h.respondError(w, http.StatusBadRequest, "Invalid email provider")
			return
		}
		updates = append(updates, "email_provider = ?")
		args = append(args, *req.EmailProvider)
	}
	if req.SMTPHost != nil {
		updates = append(updates, "smtp_host = ?")
		args = append(args, *req.SMTPHost)
	}
	if req.SMTPPort != nil {
		updates = append(updates, "smtp_port = ?")
		args = append(args, *req.SMTPPort)
	}
	if req.SMTPUsername != nil {
		updates = append(updates, "smtp_username = ?")
		args = append(args, *req.SMTPUsername)
	}
	if req.SMTPPassword != nil && *req.SMTPPassword != "" {
		// Store password (in production, this should be encrypted)
		updates = append(updates, "smtp_password_encrypted = ?")
		args = append(args, *req.SMTPPassword)
	}
	if req.SMTPFromEmail != nil {
		updates = append(updates, "smtp_from_email = ?")
		args = append(args, *req.SMTPFromEmail)
	}
	if req.GmailUsername != nil {
		updates = append(updates, "gmail_username = ?")
		args = append(args, *req.GmailUsername)
	}
	if req.EarlyBirdCount != nil {
		if *req.EarlyBirdCount < 0 {
			h.respondError(w, http.StatusBadRequest, "Early bird count cannot be negative")
			return
		}
		updates = append(updates, "early_bird_count = ?")
		args = append(args, *req.EarlyBirdCount)
	}
	if req.EarlyBirdDiscountPercent != nil {
		if *req.EarlyBirdDiscountPercent < 0 || *req.EarlyBirdDiscountPercent > 100 {
			h.respondError(w, http.StatusBadRequest, "Early bird discount must be between 0 and 100")
			return
		}
		updates = append(updates, "early_bird_discount_percent = ?")
		args = append(args, *req.EarlyBirdDiscountPercent)
	}
	if req.MaxIndividualAdultTickets != nil {
		if *req.MaxIndividualAdultTickets < 0 {
			h.respondError(w, http.StatusBadRequest, "Max individual adult tickets cannot be negative")
			return
		}
		updates = append(updates, "max_individual_adult_tickets = ?")
		args = append(args, *req.MaxIndividualAdultTickets)
	}
	if req.MaxIndividualChildTickets != nil {
		if *req.MaxIndividualChildTickets < 0 {
			h.respondError(w, http.StatusBadRequest, "Max individual child tickets cannot be negative")
			return
		}
		updates = append(updates, "max_individual_child_tickets = ?")
		args = append(args, *req.MaxIndividualChildTickets)
	}

	if len(updates) == 0 {
		if len(req.Packs) > 0 {
			// Packs were updated but no settings fields changed.
			h.respondJSON(w, http.StatusOK, map[string]string{"status": "updated"})
			return
		}
		h.respondError(w, http.StatusBadRequest, "No fields to update")
		return
	}

	query := fmt.Sprintf("UPDATE settings SET %s WHERE id = 1", strings.Join(updates, ", "))
	_, err := h.db.Exec(query, args...)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to update settings")
		return
	}

	go h.broadcastCapacity(0)
	h.respondJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

// =============================================================================
// EVENT DATE HANDLERS
// =============================================================================

// ListEventDates returns all event dates with their settings and per-pack config (admin).
func (h *Handler) ListEventDates(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.Query(`SELECT id, DATE_FORMAT(event_date, '%Y-%m-%d'), is_open, max_capacity, adult_price_cents, child_price_cents,
		early_bird_count, early_bird_discount_percent, max_individual_adult_tickets, max_individual_child_tickets,
		created_at, updated_at FROM event_opening_dates ORDER BY event_date ASC`)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to list event dates")
		return
	}
	defer rows.Close()

	var dates []map[string]interface{}
	for rows.Next() {
		var ed models.EventDate
		if err := rows.Scan(&ed.ID, &ed.EventDate, &ed.IsOpen, &ed.MaxCapacity,
			&ed.AdultPriceCents, &ed.ChildPriceCents,
			&ed.EarlyBirdCount, &ed.EarlyBirdDiscountPercent,
			&ed.MaxIndividualAdultTickets, &ed.MaxIndividualChildTickets,
			&ed.CreatedAt, &ed.UpdatedAt); err != nil {
			continue
		}

		// Load per-date pack config.
		packRows, err := h.db.Query(`SELECT id, event_date_id, pack_id, active, price_cents, max_enabled, max_tickets
			FROM event_date_packs WHERE event_date_id = ? ORDER BY pack_id`, ed.ID)
		var packs []models.EventDatePack
		if err == nil {
			for packRows.Next() {
				var dp models.EventDatePack
				if err := packRows.Scan(&dp.ID, &dp.EventDateID, &dp.PackID, &dp.Active, &dp.PriceCents, &dp.MaxEnabled, &dp.MaxTickets); err == nil {
					packs = append(packs, dp)
				}
			}
			packRows.Close()
		}
		if packs == nil {
			packs = []models.EventDatePack{}
		}

		// Sold count + full flag so the backoffice calendar can show full dates red.
		sold, full := 0, false
		if cap, err := h.getCapacityForDate(ed.ID); err == nil {
			sold = cap.SoldTickets
			full = ed.IsOpen && cap.AvailableTickets <= 0
		}

		dates = append(dates, map[string]interface{}{
			"id":                        ed.ID,
			"eventDate":                 ed.EventDate,
			"isOpen":                    ed.IsOpen,
			"soldTickets":               sold,
			"full":                      full,
			"maxCapacity":               ed.MaxCapacity,
			"adultPriceCents":           ed.AdultPriceCents,
			"childPriceCents":           ed.ChildPriceCents,
			"earlyBirdCount":            ed.EarlyBirdCount,
			"earlyBirdDiscountPercent":  ed.EarlyBirdDiscountPercent,
			"maxIndividualAdultTickets": ed.MaxIndividualAdultTickets,
			"maxIndividualChildTickets": ed.MaxIndividualChildTickets,
			"createdAt":                 ed.CreatedAt,
			"updatedAt":                 ed.UpdatedAt,
			"packs":                     packs,
		})
	}
	if dates == nil {
		dates = []map[string]interface{}{}
	}
	h.respondJSON(w, http.StatusOK, dates)
}

// CreateEventDate opens/creates a new event date and seeds its pack config from the catalog.
func (h *Handler) CreateEventDate(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Date string `json:"date"` // YYYY-MM-DD
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Date == "" {
		h.respondError(w, http.StatusBadRequest, "date is required (YYYY-MM-DD)")
		return
	}
	if _, err := time.Parse("2006-01-02", req.Date); err != nil {
		h.respondError(w, http.StatusBadRequest, "invalid date format (expected YYYY-MM-DD)")
		return
	}

	// Insert (or open) the date, seeding prices from settings for convenience.
	_, err := h.db.Exec(`INSERT INTO event_opening_dates
		(event_date, is_open, max_capacity, adult_price_cents, child_price_cents,
		 early_bird_count, early_bird_discount_percent, max_individual_adult_tickets, max_individual_child_tickets)
		SELECT ?, TRUE, max_capacity, adult_price_cents, child_price_cents,
			early_bird_count, early_bird_discount_percent,
			max_individual_adult_tickets, max_individual_child_tickets
		FROM settings WHERE id = 1
		ON DUPLICATE KEY UPDATE is_open = TRUE`, req.Date)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to create event date")
		return
	}

	var dateID int
	if err := h.db.QueryRow(`SELECT id FROM event_opening_dates WHERE event_date = ?`, req.Date).Scan(&dateID); err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to retrieve new event date")
		return
	}

	// Seed event_date_packs from catalog (INSERT IGNORE so re-opens don't overwrite admin edits).
	h.db.Exec(`INSERT IGNORE INTO event_date_packs
		(event_date_id, pack_id, active, price_cents, max_enabled, max_tickets)
		SELECT ?, p.id, p.active, p.price_cents,
			COALESCE(l.enabled, FALSE), COALESCE(l.max_tickets, 0)
		FROM packs p
		LEFT JOIN packs_max_limits l ON l.pack_id = p.id`, dateID)

	h.respondJSON(w, http.StatusCreated, map[string]interface{}{"id": dateID, "date": req.Date})
}

// UpdateEventDate updates prices/limits/early-bird/is_open for an event date.
func (h *Handler) UpdateEventDate(w http.ResponseWriter, r *http.Request) {
	idStr := extractID(r.URL.Path, "/api/admin/event-dates/")
	// Trim any trailing segment (e.g. /packs).
	if idx := strings.Index(idStr, "/"); idx >= 0 {
		idStr = idStr[:idx]
	}
	id, err := strconv.Atoi(idStr)
	if err != nil || id == 0 {
		h.respondError(w, http.StatusBadRequest, "Invalid event date ID")
		return
	}

	var req struct {
		IsOpen                    *bool `json:"isOpen"`
		MaxCapacity               *int  `json:"maxCapacity"`
		AdultPriceCents           *int  `json:"adultPriceCents"`
		ChildPriceCents           *int  `json:"childPriceCents"`
		EarlyBirdCount            *int  `json:"earlyBirdCount"`
		EarlyBirdDiscountPercent  *int  `json:"earlyBirdDiscountPercent"`
		MaxIndividualAdultTickets *int  `json:"maxIndividualAdultTickets"`
		MaxIndividualChildTickets *int  `json:"maxIndividualChildTickets"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	var updates []string
	var args []interface{}
	if req.IsOpen != nil {
		updates = append(updates, "is_open = ?")
		args = append(args, *req.IsOpen)
	}
	if req.MaxCapacity != nil {
		updates = append(updates, "max_capacity = ?")
		args = append(args, *req.MaxCapacity)
	}
	if req.AdultPriceCents != nil {
		updates = append(updates, "adult_price_cents = ?")
		args = append(args, *req.AdultPriceCents)
	}
	if req.ChildPriceCents != nil {
		updates = append(updates, "child_price_cents = ?")
		args = append(args, *req.ChildPriceCents)
	}
	if req.EarlyBirdCount != nil {
		updates = append(updates, "early_bird_count = ?")
		args = append(args, *req.EarlyBirdCount)
	}
	if req.EarlyBirdDiscountPercent != nil {
		updates = append(updates, "early_bird_discount_percent = ?")
		args = append(args, *req.EarlyBirdDiscountPercent)
	}
	if req.MaxIndividualAdultTickets != nil {
		updates = append(updates, "max_individual_adult_tickets = ?")
		args = append(args, *req.MaxIndividualAdultTickets)
	}
	if req.MaxIndividualChildTickets != nil {
		updates = append(updates, "max_individual_child_tickets = ?")
		args = append(args, *req.MaxIndividualChildTickets)
	}
	if len(updates) == 0 {
		h.respondError(w, http.StatusBadRequest, "No fields to update")
		return
	}
	args = append(args, id)
	if _, err := h.db.Exec(fmt.Sprintf("UPDATE event_opening_dates SET %s WHERE id = ?", strings.Join(updates, ", ")), args...); err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to update event date")
		return
	}
	h.respondJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

// UpsertEventDatePacks upserts per-date pack rows (price/active/max).
func (h *Handler) UpsertEventDatePacks(w http.ResponseWriter, r *http.Request) {
	idStr := extractID(r.URL.Path, "/api/admin/event-dates/")
	idStr = strings.TrimSuffix(idStr, "/packs")
	id, err := strconv.Atoi(idStr)
	if err != nil || id == 0 {
		h.respondError(w, http.StatusBadRequest, "Invalid event date ID")
		return
	}

	var packs []models.EventDatePack
	if err := json.NewDecoder(r.Body).Decode(&packs); err != nil {
		h.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	for _, dp := range packs {
		if dp.PackID == "" {
			continue
		}
		if _, err := h.db.Exec(`INSERT INTO event_date_packs (event_date_id, pack_id, active, price_cents, max_enabled, max_tickets)
			VALUES (?, ?, ?, ?, ?, ?)
			ON DUPLICATE KEY UPDATE active=VALUES(active), price_cents=VALUES(price_cents),
			max_enabled=VALUES(max_enabled), max_tickets=VALUES(max_tickets)`,
			id, dp.PackID, dp.Active, dp.PriceCents, dp.MaxEnabled, dp.MaxTickets); err != nil {
			log.Printf("Failed to upsert event_date_pack %s for date %d: %v", dp.PackID, id, err)
		}
	}
	h.respondJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

// GetPublicEventDates returns open event dates with availability info (public).
func (h *Handler) GetPublicEventDates(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.Query(`
		SELECT e.id, DATE_FORMAT(e.event_date, '%Y-%m-%d'), e.max_capacity,
			COALESCE((SELECT SUM(adults_count+children_count) FROM bookings b
				WHERE b.event_date_id = e.id AND b.payment_status = 'paid' AND b.deleted_at IS NULL), 0) AS sold
		FROM event_opening_dates e
		WHERE e.is_open = TRUE
		ORDER BY e.event_date ASC`)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to get event dates")
		return
	}
	defer rows.Close()

	var dates []map[string]interface{}
	for rows.Next() {
		var id, maxCapacity, sold int
		var eventDate string
		if err := rows.Scan(&id, &eventDate, &maxCapacity, &sold); err != nil {
			continue
		}
		available := maxCapacity - sold
		if available < 0 {
			available = 0
		}
		dates = append(dates, map[string]interface{}{
			"id":               id,
			"date":             eventDate,
			"availableTickets": available,
			"full":             available == 0,
		})
	}
	if dates == nil {
		dates = []map[string]interface{}{}
	}
	h.respondJSON(w, http.StatusOK, dates)
}

// =============================================================================
// BOOKING UPDATE HANDLERS (pack change with price difference)
// =============================================================================

// GetBookingPacks returns available packs for the booking's event date (admin).
func (h *Handler) GetBookingPacks(w http.ResponseWriter, r *http.Request) {
	bookingID := extractID(r.URL.Path, "/api/admin/bookings/")
	bookingID = strings.TrimSuffix(bookingID, "/packs")
	if bookingID == "" {
		h.respondError(w, http.StatusBadRequest, "Missing booking ID")
		return
	}

	// Get booking's event_date_id and current pack info
	var eventDateID sql.NullInt64
	var packType sql.NullString
	err := h.db.QueryRow(`SELECT event_date_id, pack_type FROM bookings WHERE id = ? AND deleted_at IS NULL`, bookingID).Scan(&eventDateID, &packType)
	if err == sql.ErrNoRows {
		h.respondError(w, http.StatusNotFound, "Booking not found")
		return
	}
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to get booking")
		return
	}

	var dID int
	if eventDateID.Valid {
		dID = int(eventDateID.Int64)
	}

	// Load packs scoped to this date (or global if no date)
	packs, err := h.getPacksForDate(dID)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to get packs")
		return
	}

	// Get booking items to find the current pack and its price
	var currentPackID string
	var currentPackName string
	var currentPriceCents int
	if packType.Valid {
		currentPackID = packType.String
	}

	// prefer booking_items for accurate price
	err = h.db.QueryRow(`SELECT COALESCE(pack_type, ''), COALESCE(pack_name, ''), COALESCE(unit_price_cents, 0)
		FROM booking_items WHERE booking_id = ? AND item_type = 'pack' LIMIT 1`, bookingID).Scan(&currentPackID, &currentPackName, &currentPriceCents)
	if err != nil && currentPackID == "" {
		if packType.Valid {
			currentPackID = packType.String
		}
	}

	// Build response: packs with their per-date prices
	type packItem struct {
		ID              string  `json:"id"`
		Name            string  `json:"name"`
		PriceCents      int     `json:"priceCents"`
		Price           float64 `json:"price"`
		Adults          int     `json:"adults"`
		Children        int     `json:"children"`
		Active          bool    `json:"active"`
		HasPhotographer bool    `json:"hasPhotographer"`
		HasPremiumPass  bool    `json:"hasPremiumPass"`
	}
	var result []packItem
	for _, p := range packs {
		result = append(result, packItem{
			ID:              p.ID,
			Name:            p.Name,
			PriceCents:      p.PriceCents,
			Price:           p.Price,
			Adults:          p.Adults,
			Children:        p.Children,
			Active:          p.Active,
			HasPhotographer: p.HasPhotographer,
			HasPremiumPass:  p.HasPremiumPass,
		})
	}

	h.respondJSON(w, http.StatusOK, map[string]interface{}{
		"currentPackId":     currentPackID,
		"currentPackName":   currentPackName,
		"currentPriceCents": currentPriceCents,
		"eventDateId":       dID,
		"packs":             result,
	})
}

// RequestPackUpdate creates a booking_update record with status 'awaiting_payment'
// and sends an email to the client to pay the price difference (admin).
func (h *Handler) RequestPackUpdate(w http.ResponseWriter, r *http.Request) {
	bookingID := extractID(r.URL.Path, "/api/admin/bookings/")
	bookingID = strings.TrimSuffix(bookingID, "/request-pack-update")
	if bookingID == "" {
		h.respondError(w, http.StatusBadRequest, "Missing booking ID")
		return
	}

	var req models.BookingUpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.NewPackType == "" {
		h.respondError(w, http.StatusBadRequest, "newPackType is required")
		return
	}

	// Get booking info
	var bookingName, bookingSurname, bookingEmail, oldPackType string
	var oldPackNameDB sql.NullString
	var eventDateID sql.NullInt64
	var oldPriceCents int
	err := h.db.QueryRow(`
		SELECT b.name, b.surname, b.email,
		       COALESCE(b.pack_type, bi.pack_type, ''),
		       COALESCE(bi.pack_name, ''), COALESCE(bi.unit_price_cents, 0),
		       b.event_date_id
		FROM bookings b
		LEFT JOIN booking_items bi ON bi.booking_id = b.id AND bi.item_type = 'pack'
		WHERE b.id = ? AND b.deleted_at IS NULL
		LIMIT 1`, bookingID).Scan(&bookingName, &bookingSurname, &bookingEmail,
		&oldPackType, &oldPackNameDB, &oldPriceCents, &eventDateID)
	if err == sql.ErrNoRows {
		h.respondError(w, http.StatusNotFound, "Booking not found")
		return
	}
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to get booking")
		return
	}
	if oldPackType == "" {
		h.respondError(w, http.StatusBadRequest, "Booking has no pack to change")
		return
	}

	// Get new pack info slogged to the event date
	newPack := h.getPackInfo(req.NewPackType)
	if newPack == nil {
		h.respondError(w, http.StatusBadRequest, "Invalid pack type")
		return
	}

	// Get per-date price for the new pack
	var dID int
	if eventDateID.Valid {
		dID = int(eventDateID.Int64)
	}
	newPriceCents := newPack.PriceCents
	if dID > 0 {
		h.db.QueryRow(`SELECT price_cents FROM event_date_packs WHERE event_date_id = ? AND pack_id = ? AND active = TRUE`,
			dID, req.NewPackType).Scan(&newPriceCents)
	}

	differenceCents := newPriceCents - oldPriceCents

	// Negative difference: pack is cheaper, client gets money back
	if differenceCents < 0 {
		if req.PaymentMethod == "" {
			h.respondError(w, http.StatusBadRequest, "Se requiere método de reembolso (reembolso_bizum, reembolso_transferencia, reembolso_efectivo)")
			return
		}
		validRefundMethods := map[string]bool{"reembolso_bizum": true, "reembolso_transferencia": true, "reembolso_efectivo": true}
		if !validRefundMethods[req.PaymentMethod] {
			h.respondError(w, http.StatusBadRequest, "Método de reembolso no válido")
			return
		}

		token := uuid.New().String()
		_, err = h.db.Exec(`INSERT INTO booking_updates (booking_id, old_pack_type, new_pack_type, old_price_cents, new_price_cents, difference_cents, status, payment_method, token)
			VALUES (?, ?, ?, ?, ?, ?, 'refund', ?, ?)`,
			bookingID, oldPackType, req.NewPackType, oldPriceCents, newPriceCents, differenceCents, req.PaymentMethod, token)
		if err != nil {
			h.respondError(w, http.StatusInternalServerError, "Failed to create booking update")
			return
		}

		h.db.Exec(`UPDATE bookings SET pack_type = ? WHERE id = ?`, req.NewPackType, bookingID)
		h.db.Exec(`DELETE FROM booking_items WHERE booking_id = ? AND item_type = 'pack'`, bookingID)
		h.db.Exec(`INSERT INTO booking_items (booking_id, item_type, pack_type, pack_name, adults, children, has_photographer, has_premium_pass, quantity, unit_price_cents, line_total_cents)
			VALUES (?, 'pack', ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
			bookingID, newPack.ID, newPack.Name, newPack.Adults, newPack.Children,
			newPack.HasPhotographer, newPack.HasPremiumPass, newPriceCents, newPriceCents)

		go h.email.SendPackUpdateConfirmation(bookingID, req.PaymentMethod, oldPackType, req.NewPackType, req.NewPackName, differenceCents)

		h.respondJSON(w, http.StatusOK, map[string]interface{}{
			"status":          "updated",
			"paymentMethod":   req.PaymentMethod,
			"differenceCents": differenceCents,
			"message":         "Pack actualizado con reembolso registrado.",
		})
		return
	}

	// Same price: apply directly
	if differenceCents == 0 {
		h.db.Exec(`UPDATE bookings SET pack_type = ? WHERE id = ?`, req.NewPackType, bookingID)
		h.db.Exec(`DELETE FROM booking_items WHERE booking_id = ? AND item_type = 'pack'`, bookingID)
		h.db.Exec(`INSERT INTO booking_items (booking_id, item_type, pack_type, pack_name, adults, children, has_photographer, has_premium_pass, quantity, unit_price_cents, line_total_cents)
			VALUES (?, 'pack', ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
			bookingID, newPack.ID, newPack.Name, newPack.Adults, newPack.Children,
			newPack.HasPhotographer, newPack.HasPremiumPass, newPriceCents, newPriceCents)
		h.respondJSON(w, http.StatusOK, map[string]interface{}{
			"status":          "updated",
			"differenceCents": 0,
			"message":         "Pack actualizado sin coste adicional",
		})
		return
	}

	// Price is higher: check payment method
	isManual := req.PaymentMethod == "bizum" || req.PaymentMethod == "transferencia" || req.PaymentMethod == "efectivo"
	if isManual {
		// Manual payment: apply directly + send confirmation email with QR
		token := uuid.New().String()
		_, err = h.db.Exec(`INSERT INTO booking_updates (booking_id, old_pack_type, new_pack_type, old_price_cents, new_price_cents, difference_cents, status, payment_method, token)
			VALUES (?, ?, ?, ?, ?, ?, 'manual', ?, ?)`,
			bookingID, oldPackType, req.NewPackType, oldPriceCents, newPriceCents, differenceCents, req.PaymentMethod, token)
		if err != nil {
			h.respondError(w, http.StatusInternalServerError, "Failed to create booking update")
			return
		}

		h.db.Exec(`UPDATE bookings SET pack_type = ? WHERE id = ?`, req.NewPackType, bookingID)
		h.db.Exec(`DELETE FROM booking_items WHERE booking_id = ? AND item_type = 'pack'`, bookingID)
		h.db.Exec(`INSERT INTO booking_items (booking_id, item_type, pack_type, pack_name, adults, children, has_photographer, has_premium_pass, quantity, unit_price_cents, line_total_cents)
			VALUES (?, 'pack', ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
			bookingID, newPack.ID, newPack.Name, newPack.Adults, newPack.Children,
			newPack.HasPhotographer, newPack.HasPremiumPass, newPriceCents, newPriceCents)

		// Generate QR if missing, then send confirmation email (in order)
		go func(bid, method, oldP, newP, newPN string, diff int) {
			if _, err := h.qr.GetQRCodeURL(bid); err != nil {
				log.Printf("Failed to generate QR for booking %s: %v", bid, err)
			}
			h.email.SendPackUpdateConfirmation(bid, method, oldP, newP, newPN, diff)
		}(bookingID, req.PaymentMethod, oldPackType, req.NewPackType, req.NewPackName, differenceCents)

		h.respondJSON(w, http.StatusOK, map[string]interface{}{
			"status":          "updated",
			"paymentMethod":   req.PaymentMethod,
			"differenceCents": differenceCents,
			"message":         "Pack actualizado. Email de confirmación enviado al cliente.",
		})
		return
	}

	// Stripe payment: create booking_update record + send email with payment link
	token := uuid.New().String()
	_, err = h.db.Exec(`INSERT INTO booking_updates (booking_id, old_pack_type, new_pack_type, old_price_cents, new_price_cents, difference_cents, status, token)
		VALUES (?, ?, ?, ?, ?, ?, 'awaiting_payment', ?)`,
		bookingID, oldPackType, req.NewPackType, oldPriceCents, newPriceCents, differenceCents, token)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to create booking update")
		return
	}

	go h.email.SendPackUpdateRequest(bookingID, token, oldPackType, req.NewPackType, req.NewPackName, differenceCents)

	h.respondJSON(w, http.StatusOK, map[string]interface{}{
		"status":          "awaiting_payment",
		"token":           token,
		"differenceCents": differenceCents,
		"message":         "Email enviado al cliente para completar el pago",
	})
}

// GetBookingUpdate returns a booking update by token and creates a Stripe checkout if needed.
func (h *Handler) GetBookingUpdate(w http.ResponseWriter, r *http.Request) {
	token := extractID(r.URL.Path, "/api/public/booking-update/")
	if token == "" {
		h.respondError(w, http.StatusBadRequest, "Missing token")
		return
	}

	var update models.BookingUpdate
	var bookingName, bookingEmail string
	var oldPackName, newPackName sql.NullString
	err := h.db.QueryRow(`
		SELECT bu.id, bu.booking_id, bu.old_pack_type, bu.new_pack_type,
		       bu.old_price_cents, bu.new_price_cents, bu.difference_cents, bu.status,
		       COALESCE(bu.stripe_session_id, ''), bu.token, bu.created_at, bu.updated_at,
		       b.name, b.email,
		       (SELECT name FROM packs WHERE id = bu.old_pack_type) AS old_pack_label,
		       (SELECT name FROM packs WHERE id = bu.new_pack_type) AS new_pack_label
		FROM booking_updates bu
		JOIN bookings b ON b.id = bu.booking_id
		WHERE bu.token = ?`, token).Scan(
		&update.ID, &update.BookingID, &update.OldPackType, &update.NewPackType,
		&update.OldPriceCents, &update.NewPriceCents, &update.DifferenceCents, &update.Status,
		&update.StripeSessionID, &update.Token, &update.CreatedAt, &update.UpdatedAt,
		&bookingName, &bookingEmail, &oldPackName, &newPackName)
	if err == sql.ErrNoRows {
		h.respondError(w, http.StatusNotFound, "Booking update not found")
		return
	}
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to get booking update")
		return
	}

	response := map[string]interface{}{
		"id":              update.ID,
		"bookingId":       update.BookingID,
		"bookingName":     bookingName,
		"oldPackType":     update.OldPackType,
		"newPackType":     update.NewPackType,
		"oldPriceCents":   update.OldPriceCents,
		"newPriceCents":   update.NewPriceCents,
		"differenceCents": update.DifferenceCents,
		"status":          update.Status,
		"token":           update.Token,
	}

	if oldPackName.Valid {
		response["oldPackName"] = oldPackName.String
	}
	if newPackName.Valid {
		response["newPackName"] = newPackName.String
	}

	// If already paid, just return status
	if update.Status == "paid" {
		h.respondJSON(w, http.StatusOK, response)
		return
	}

	// If awaiting_payment, create Stripe checkout if not already created
	if update.Status == "awaiting_payment" {
		if update.StripeSessionID.Valid && update.StripeSessionID.String != "" {
			// Check if existing session is still valid
			sess, stripeErr := session.Get(update.StripeSessionID.String, nil)
			if stripeErr == nil && sess.URL != "" && sess.PaymentStatus != "paid" {
				response["checkoutUrl"] = sess.URL
				h.respondJSON(w, http.StatusOK, response)
				return
			}
			// Session expired or paid, create a new one
		}

		// Create new Stripe checkout session for the difference
		differenceEuros := float64(update.DifferenceCents) / 100

		params := &stripe.CheckoutSessionParams{
			PaymentMethodTypes: stripe.StringSlice([]string{"card"}),
			Mode:               stripe.String(string(stripe.CheckoutSessionModePayment)),
			CustomerEmail:      stripe.String(bookingEmail),
			LineItems: []*stripe.CheckoutSessionLineItemParams{
				{
					PriceData: &stripe.CheckoutSessionLineItemPriceDataParams{
						Currency:   stripe.String("eur"),
						ProductData: &stripe.CheckoutSessionLineItemPriceDataProductDataParams{
							Name: stripe.String(fmt.Sprintf("Suplemento cambio de pack (%.2f€)", differenceEuros)),
						},
						UnitAmount: stripe.Int64(int64(update.DifferenceCents)),
					},
					Quantity: stripe.Int64(1),
				},
			},
			SuccessURL: stripe.String(fmt.Sprintf("%s/payment_success?update_token=%s", h.cfg.FrontendURL, token)),
			CancelURL:  stripe.String(fmt.Sprintf("%s/booking-update/%s", h.cfg.FrontendURL, token)),
			Metadata: map[string]string{
				"booking_update_token": token,
				"booking_update_id":    fmt.Sprintf("%d", update.ID),
				"booking_id":           update.BookingID,
				"type":                 "booking_update",
			},
		}

		sess, stripeErr := session.New(params)
		if stripeErr != nil {
			log.Printf("Stripe session error for booking update: %v", stripeErr)
			h.respondError(w, http.StatusInternalServerError, "Failed to create checkout session")
			return
		}

		// Store session ID
		h.db.Exec(`UPDATE booking_updates SET stripe_session_id = ? WHERE id = ?`, sess.ID, update.ID)

		response["checkoutUrl"] = sess.URL
		h.respondJSON(w, http.StatusOK, response)
		return
	}

	h.respondJSON(w, http.StatusOK, response)
}

// handleBookingUpdatePayment processes a completed Stripe checkout for a booking update.
func (h *Handler) handleBookingUpdatePayment(sess *stripe.CheckoutSession) {
	meta := sess.Metadata
	if meta["type"] != "booking_update" {
		return
	}

	token := meta["booking_update_token"]
	if token == "" {
		return
	}

	// Mark booking_update as paid
	_, err := h.db.Exec(`UPDATE booking_updates SET status = 'paid' WHERE token = ? AND status = 'awaiting_payment'`, token)
	if err != nil {
		log.Printf("Failed to update booking_update status: %v", err)
		return
	}

	// Get update details and apply to booking
	var update models.BookingUpdate
	err = h.db.QueryRow(`SELECT booking_id, new_pack_type, new_price_cents FROM booking_updates WHERE token = ?`, token).Scan(
		&update.BookingID, &update.NewPackType, &update.NewPriceCents)
	if err != nil {
		log.Printf("Failed to get booking_update for apply: %v", err)
		return
	}

	// Update booking pack_type
	h.db.Exec(`UPDATE bookings SET pack_type = ? WHERE id = ?`, update.NewPackType, update.BookingID)

	// Get new pack info for booking_items update
	newPack := h.getPackInfo(update.NewPackType)
	if newPack != nil {
		// Replace pack items
		h.db.Exec(`DELETE FROM booking_items WHERE booking_id = ? AND item_type = 'pack'`, update.BookingID)
		h.db.Exec(`INSERT INTO booking_items (booking_id, item_type, pack_type, pack_name, adults, children, has_photographer, has_premium_pass, quantity, unit_price_cents, line_total_cents)
			VALUES (?, 'pack', ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
			update.BookingID, newPack.ID, newPack.Name, newPack.Adults, newPack.Children,
			newPack.HasPhotographer, newPack.HasPremiumPass, update.NewPriceCents, update.NewPriceCents)
	}

	log.Printf("Booking update %s applied: booking %s pack changed to %s", token, update.BookingID, update.NewPackType)
}

// GetBookingUpdates returns booking_updates for a specific booking (admin).
func (h *Handler) GetBookingUpdates(w http.ResponseWriter, r *http.Request) {
	bookingID := extractID(r.URL.Path, "/api/admin/bookings/")
	bookingID = strings.TrimSuffix(bookingID, "/updates")
	if bookingID == "" {
		h.respondError(w, http.StatusBadRequest, "Missing booking ID")
		return
	}

	rows, err := h.db.Query(`SELECT bu.id, bu.booking_id, bu.old_pack_type, bu.new_pack_type,
		bu.old_price_cents, bu.new_price_cents, bu.difference_cents, bu.status,
		COALESCE(bu.payment_method, ''), bu.created_at, bu.updated_at,
		COALESCE(op.name, ''), COALESCE(np.name, '')
		FROM booking_updates bu
		LEFT JOIN packs op ON op.id = bu.old_pack_type
		LEFT JOIN packs np ON np.id = bu.new_pack_type
		WHERE bu.booking_id = ?
		ORDER BY bu.created_at DESC`, bookingID)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to get booking updates")
		return
	}
	defer rows.Close()

	var updates []map[string]interface{}
	for rows.Next() {
		var id, oldPriceCents, newPriceCents, diffCents int
		var bookingID, oldPackType, newPackType, status, paymentMethod, createdAt, updatedAt, oldPackName, newPackName string
		if err := rows.Scan(&id, &bookingID, &oldPackType, &newPackType,
			&oldPriceCents, &newPriceCents, &diffCents, &status,
			&paymentMethod, &createdAt, &updatedAt, &oldPackName, &newPackName); err != nil {
			continue
		}
		updates = append(updates, map[string]interface{}{
			"id":              id,
			"bookingId":       bookingID,
			"oldPackType":     oldPackType,
			"newPackType":     newPackType,
			"oldPackName":     oldPackName,
			"newPackName":     newPackName,
			"oldPriceCents":   oldPriceCents,
			"newPriceCents":   newPriceCents,
			"differenceCents": diffCents,
			"status":          status,
			"paymentMethod":   paymentMethod,
			"createdAt":       createdAt,
			"updatedAt":       updatedAt,
		})
	}
	if updates == nil {
		updates = []map[string]interface{}{}
	}
	h.respondJSON(w, http.StatusOK, updates)
}
