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
func (h *Handler) getPacks() ([]models.Pack, error) {
	rows, err := h.db.Query(`SELECT p.id, p.name, p.emoji, p.icon, p.adults, p.children, p.price_cents,
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
		WHERE p.active = TRUE ORDER BY p.display_order ASC, p.id ASC`)
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
func (h *Handler) GetPublicSettings(w http.ResponseWriter, r *http.Request) {
	var s models.Settings
	err := h.db.QueryRow(`SELECT max_capacity, adult_price_cents, child_price_cents, event_date, event_info, early_bird_count, early_bird_discount_percent, COALESCE(max_individual_adult_tickets, 0), COALESCE(max_individual_child_tickets, 0) FROM settings WHERE id = 1`).Scan(
		&s.MaxCapacity, &s.AdultPriceCents, &s.ChildPriceCents, &s.EventDate, &s.EventInfo, &s.EarlyBirdCount, &s.EarlyBirdDiscountPercent, &s.MaxIndividualAdultTickets, &s.MaxIndividualChildTickets,
	)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to get settings")
		return
	}

	// Get count of paid bookings for early bird calculation
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

// GetCapacity returns current ticket capacity.
func (h *Handler) GetCapacity(w http.ResponseWriter, r *http.Request) {
	capacity, err := h.getCapacity()
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to get capacity")
		return
	}
	h.respondJSON(w, http.StatusOK, capacity)
}

func (h *Handler) getCapacity() (*models.Capacity, error) {
	var maxCapacity int
	err := h.db.QueryRow(`SELECT max_capacity FROM settings WHERE id = 1`).Scan(&maxCapacity)
	if err != nil {
		return nil, err
	}

	var soldTickets int
	err = h.db.QueryRow(`SELECT COALESCE(SUM(adults_count + children_count), 0) FROM bookings WHERE payment_status = 'paid' AND deleted_at IS NULL`).Scan(&soldTickets)
	if err != nil {
		return nil, err
	}

	return &models.Capacity{
		MaxCapacity:      maxCapacity,
		SoldTickets:      soldTickets,
		AvailableTickets: maxCapacity - soldTickets,
	}, nil
}

func (h *Handler) broadcastCapacity() {
	capacity, err := h.getCapacity()
	if err != nil {
		log.Printf("Error getting capacity for broadcast: %v", err)
		return
	}
	h.hub.BroadcastCapacity(capacity.MaxCapacity, capacity.SoldTickets, capacity.AvailableTickets)
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

	_, err = h.db.Exec(`INSERT INTO bookings (id, name, surname, email, phone_country_code, phone_number, adults_count, children_count, has_photographer, has_premium_pass, adult_price_cents, child_price_cents, total_amount_cents, qr_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		id, req.Name, req.Surname, req.Email, req.PhoneCountryCode, req.PhoneNumber, cart.TotalAdults, cart.TotalChildren, hasPhotographer, hasPremiumPass, cart.AdultPriceCents, cart.ChildPriceCents, cart.TotalAmountCents, qrToken,
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
		       b.confirmed_assistance, b.created_at, s.event_date
		FROM bookings b
		JOIN settings s ON s.id = 1
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

	// Check capacity
	var maxCapacity, soldTickets int
	if err := h.db.QueryRow(`SELECT max_capacity FROM settings WHERE id = 1`).Scan(&maxCapacity); err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to get settings")
		return
	}
	if err := h.db.QueryRow(`SELECT COALESCE(SUM(adults_count + children_count), 0) FROM bookings WHERE payment_status = 'paid' AND deleted_at IS NULL`).Scan(&soldTickets); err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to check capacity")
		return
	}
	if totalTickets > (maxCapacity - soldTickets) {
		h.respondError(w, http.StatusBadRequest, "Not enough tickets available")
		return
	}

	totalAmount := cart.TotalAmountCents
	lineItems := cart.stripeLineItems()

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
		cartItems := cartItemsFromMetadata(meta)
		hasPhotographer, hasPremiumPass := aggregatePackFlags(cartItems)

		// Check capacity again before inserting
		var maxCapacity, soldTickets int
		h.db.QueryRow(`SELECT max_capacity FROM settings WHERE id = 1`).Scan(&maxCapacity)
		h.db.QueryRow(`SELECT COALESCE(SUM(adults_count + children_count), 0) FROM bookings WHERE payment_status = 'paid' AND deleted_at IS NULL`).Scan(&soldTickets)

		totalTickets := adultsCount + childrenCount
		if totalTickets > (maxCapacity - soldTickets) {
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

		_, err = h.db.Exec(`INSERT INTO bookings (id, name, surname, email, phone_country_code, phone_number, adults_count, children_count, has_photographer, has_premium_pass, adult_price_cents, child_price_cents, total_amount_cents, qr_token, payment_status, payment_method, stripe_checkout_session_id, stripe_payment_intent_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'paid', 'stripe', ?, ?)`,
			bookingID, meta["name"], meta["surname"], meta["email"], meta["phone_country_code"], meta["phone_number"],
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

		go h.broadcastCapacity()
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
	cartItems := cartItemsFromMetadata(meta)
	hasPhotographer, hasPremiumPass := aggregatePackFlags(cartItems)

	// Check capacity
	var maxCapacity, soldTickets int
	h.db.QueryRow(`SELECT max_capacity FROM settings WHERE id = 1`).Scan(&maxCapacity)
	h.db.QueryRow(`SELECT COALESCE(SUM(adults_count + children_count), 0) FROM bookings WHERE payment_status = 'paid' AND deleted_at IS NULL`).Scan(&soldTickets)

	totalTickets := adultsCount + childrenCount
	if totalTickets > (maxCapacity - soldTickets) {
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

	_, err = h.db.Exec(`INSERT INTO bookings (id, name, surname, email, phone_country_code, phone_number, adults_count, children_count, has_photographer, has_premium_pass, adult_price_cents, child_price_cents, total_amount_cents, qr_token, payment_status, payment_method, stripe_checkout_session_id, stripe_payment_intent_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'paid', 'stripe', ?, ?)`,
		bookingID, meta["name"], meta["surname"], meta["email"], meta["phone_country_code"], meta["phone_number"],
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

	go h.broadcastCapacity()

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
func (h *Handler) ListBookings(w http.ResponseWriter, r *http.Request) {
	query := `SELECT b.id, b.name, b.surname, b.email, b.phone_country_code, b.phone_number, b.adults_count, b.children_count, b.pack_type, b.has_photographer, b.has_premium_pass, b.total_amount_cents, b.payment_status, b.payment_method, b.confirmed_assistance, b.created_at, 
		(SELECT COUNT(*) FROM member_allergies ma WHERE ma.booking_id = b.id) as allergy_count
		FROM bookings b WHERE b.deleted_at IS NULL`

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
		err := rows.Scan(&b.ID, &b.Name, &b.Surname, &b.Email, &b.PhoneCountryCode, &b.PhoneNumber, &b.AdultsCount, &b.ChildrenCount, &b.PackType, &b.HasPhotographer, &b.HasPremiumPass, &b.TotalAmountCents, &b.PaymentStatus, &b.PaymentMethod, &b.ConfirmedAssistance, &b.CreatedAt, &allergyCount)
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

	go h.broadcastCapacity()
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

	go h.broadcastCapacity()
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
	err := h.db.QueryRow(`SELECT id, name, surname, email, phone_country_code, phone_number, adults_count, children_count, pack_type, has_photographer, has_premium_pass, total_amount_cents, payment_status, payment_method, confirmed_assistance FROM bookings WHERE qr_token = ? AND deleted_at IS NULL`, req.QRToken).Scan(
		&booking.ID, &booking.Name, &booking.Surname, &booking.Email, &booking.PhoneCountryCode, &booking.PhoneNumber, &booking.AdultsCount, &booking.ChildrenCount, &booking.PackType, &booking.HasPhotographer, &booking.HasPremiumPass, &booking.TotalAmountCents, &booking.PaymentStatus, &booking.PaymentMethod, &booking.ConfirmedAssistance,
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

	go h.broadcastCapacity()
	h.respondJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}
