package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"strconv"

	"desayuno-backend/internal/models"

	"github.com/stripe/stripe-go/v76"
)

// resolvedCartItem is a fully-priced line of a booking. It is the canonical
// representation used to build Stripe line items, store Stripe metadata and
// persist booking_items rows.
type resolvedCartItem struct {
	ItemType        string `json:"itemType"`                  // "pack" or "individual"
	PackType        string `json:"packType,omitempty"`        // pack only
	PackName        string `json:"packName,omitempty"`        // pack only (snapshot)
	Adults          int    `json:"adults"`                    // per single unit (pack) or total (individual)
	Children        int    `json:"children"`                  // per single unit (pack) or total (individual)
	HasPhotographer bool   `json:"hasPhotographer,omitempty"` // pack only
	HasPremiumPass  bool   `json:"hasPremiumPass,omitempty"`  // pack only
	Quantity        int    `json:"quantity"`
	UnitPriceCents  int    `json:"unitPriceCents"`            // charged price per single unit (pack)
	AdultPriceCents int    `json:"adultPriceCents,omitempty"` // individual only (charged per adult)
	ChildPriceCents int    `json:"childPriceCents,omitempty"` // individual only (charged per child)
	LineTotalCents  int    `json:"lineTotalCents"`
	ProductName     string `json:"-"` // Stripe product name (not persisted)
}

// cartError is a user-facing validation error produced while resolving a cart
// (invalid pack, sold-out pack, per-pack limit exceeded, empty cart). The HTTP
// handlers surface its message with a 400 status; any other error is treated
// as an internal (500) error.
type cartError struct{ msg string }

func (e *cartError) Error() string { return e.msg }

// resolvedCart is the result of pricing a CreateBookingRequest. Totals are the
// aggregate values stored on the bookings row (used for capacity and KPIs).
type resolvedCart struct {
	Items            []resolvedCartItem
	TotalAdults      int
	TotalChildren    int
	TotalAmountCents int
	AdultPriceCents  int // charged price per adult (snapshot for bookings row)
	ChildPriceCents  int // charged price per child (snapshot for bookings row)
	AppliedEarlyBird bool
	EarlyBirdPercent int
}

// resolveCart prices the requested items server-side (never trusting client
// prices). It supports multiple packs and individual tickets combined in the
// same booking. The legacy single-pack / individual fields are used as a
// fallback when Items is empty.
func (h *Handler) resolveCart(req *models.CreateBookingRequest) (*resolvedCart, error) {
	var adultPrice, childPrice, earlyBirdCount, earlyBirdPercent int

	if req.EventDateID > 0 {
		// Prices from the specific event date row.
		if err := h.db.QueryRow(
			`SELECT adult_price_cents, child_price_cents, early_bird_count, early_bird_discount_percent
			 FROM event_opening_dates WHERE id = ?`, req.EventDateID,
		).Scan(&adultPrice, &childPrice, &earlyBirdCount, &earlyBirdPercent); err != nil {
			return nil, err
		}
	} else {
		// Legacy fallback: global settings.
		if err := h.db.QueryRow(`SELECT adult_price_cents, child_price_cents, early_bird_count, early_bird_discount_percent FROM settings WHERE id = 1`).Scan(&adultPrice, &childPrice, &earlyBirdCount, &earlyBirdPercent); err != nil {
			return nil, err
		}
	}

	// Scope early-bird count to the specific date if one is given.
	var paidBookingsCount int
	if req.EventDateID > 0 {
		h.db.QueryRow(`SELECT COUNT(*) FROM bookings WHERE event_date_id = ? AND payment_status = 'paid' AND deleted_at IS NULL`, req.EventDateID).Scan(&paidBookingsCount)
	} else {
		h.db.QueryRow(`SELECT COUNT(*) FROM bookings WHERE payment_status = 'paid' AND deleted_at IS NULL`).Scan(&paidBookingsCount)
	}
	applyEarlyBird := earlyBirdCount > 0 && earlyBirdPercent > 0 && paidBookingsCount < earlyBirdCount

	discount := func(c int) int {
		if applyEarlyBird {
			return c - (c * earlyBirdPercent / 100)
		}
		return c
	}

	// Build the input item list, falling back to the legacy fields.
	inputs := req.Items
	if len(inputs) == 0 {
		if req.PackType != "" {
			inputs = append(inputs, models.BookingItemInput{ItemType: "pack", PackType: req.PackType, Quantity: 1})
		}
		if req.AdultsCount > 0 || req.ChildrenCount > 0 {
			inputs = append(inputs, models.BookingItemInput{ItemType: "individual", AdultsCount: req.AdultsCount, ChildrenCount: req.ChildrenCount})
		}
	}

	// Load active packs to validate sold-out state and per-pack ticket limits.
	activePacks, err := h.getPacks()
	if err != nil {
		return nil, err
	}
	packsByID := make(map[string]models.Pack, len(activePacks))
	for _, p := range activePacks {
		packsByID[p.ID] = p
	}

	cart := &resolvedCart{
		AdultPriceCents:  discount(adultPrice),
		ChildPriceCents:  discount(childPrice),
		AppliedEarlyBird: applyEarlyBird,
		EarlyBirdPercent: earlyBirdPercent,
	}

	// Number of pack units requested per pack across all items (to validate
	// limits even when the same pack appears in several items). The per-pack
	// limit counts packs, not the tickets inside each pack.
	requestedPackUnits := make(map[string]int)

	for _, in := range inputs {
		switch in.ItemType {
		case "pack":
			info := h.getPackInfo(in.PackType)
			if info == nil {
				return nil, &cartError{fmt.Sprintf("El pack seleccionado no es válido: %s", in.PackType)}
			}
			qty := in.Quantity
			if qty < 1 {
				qty = 1
			}
			requestedPackUnits[info.ID] += qty
			unit := discount(info.PriceCents)
			name := info.Name + " - Desayuno con Princesas"
			if applyEarlyBird {
				name = fmt.Sprintf("%s - Desayuno con Princesas (-%d%% Primeras Reservas)", info.Name, earlyBirdPercent)
			}
			cart.Items = append(cart.Items, resolvedCartItem{
				ItemType:        "pack",
				PackType:        info.ID,
				PackName:        info.Name,
				Adults:          info.Adults,
				Children:        info.Children,
				HasPhotographer: info.HasPhotographer,
				HasPremiumPass:  info.HasPremiumPass,
				Quantity:        qty,
				UnitPriceCents:  unit,
				LineTotalCents:  unit * qty,
				ProductName:     name,
			})
			cart.TotalAdults += info.Adults * qty
			cart.TotalChildren += info.Children * qty
			cart.TotalAmountCents += unit * qty
		case "individual":
			a, c := in.AdultsCount, in.ChildrenCount
			if a <= 0 && c <= 0 {
				continue
			}
			ap, cp := discount(adultPrice), discount(childPrice)
			line := a*ap + c*cp
			cart.Items = append(cart.Items, resolvedCartItem{
				ItemType:        "individual",
				Adults:          a,
				Children:        c,
				Quantity:        1,
				AdultPriceCents: ap,
				ChildPriceCents: cp,
				LineTotalCents:  line,
			})
			cart.TotalAdults += a
			cart.TotalChildren += c
			cart.TotalAmountCents += line
		default:
			return nil, &cartError{fmt.Sprintf("Tipo de artículo no válido: %s", in.ItemType)}
		}
	}

	if len(cart.Items) == 0 {
		return nil, &cartError{"Debe seleccionar al menos una entrada"}
	}

	// Validate sold-out state and per-pack limits (counted as number of packs).
	for packID, requested := range requestedPackUnits {
		p, ok := packsByID[packID]
		if !ok {
			// Pack is not active (hidden/disabled): not purchasable.
			return nil, &cartError{"El pack seleccionado ya no está disponible"}
		}
		if p.Completed {
			return nil, &cartError{fmt.Sprintf("El pack \"%s\" está agotado", p.Name)}
		}
		if p.MaxLimitEnabled && requested > p.AvailableTickets {
			return nil, &cartError{fmt.Sprintf("No quedan suficientes unidades del pack \"%s\"", p.Name)}
		}
	}

	return cart, nil
}

// stripeLineItems builds the Stripe Checkout line items for the cart. Packs are
// a single line each (with quantity); individual ticket groups are split into
// an adults line and a children line.
func (c *resolvedCart) stripeLineItems() []*stripe.CheckoutSessionLineItemParams {
	adultName := "Entrada Adulto - Desayuno con Princesas"
	childName := "Entrada Niño/a - Desayuno con Princesas"
	if c.AppliedEarlyBird {
		adultName = fmt.Sprintf("Entrada Adulto - Desayuno con Princesas (-%d%% Primeras Reservas)", c.EarlyBirdPercent)
		childName = fmt.Sprintf("Entrada Niño/a - Desayuno con Princesas (-%d%% Primeras Reservas)", c.EarlyBirdPercent)
	}

	var items []*stripe.CheckoutSessionLineItemParams
	for _, it := range c.Items {
		if it.ItemType == "pack" {
			items = append(items, stripeLineItem(it.ProductName, it.UnitPriceCents, it.Quantity))
			continue
		}
		if it.Adults > 0 {
			items = append(items, stripeLineItem(adultName, it.AdultPriceCents, it.Adults))
		}
		if it.Children > 0 {
			items = append(items, stripeLineItem(childName, it.ChildPriceCents, it.Children))
		}
	}
	return items
}

func stripeLineItem(name string, unitCents, qty int) *stripe.CheckoutSessionLineItemParams {
	return &stripe.CheckoutSessionLineItemParams{
		PriceData: &stripe.CheckoutSessionLineItemPriceDataParams{
			Currency: stripe.String("eur"),
			ProductData: &stripe.CheckoutSessionLineItemPriceDataProductDataParams{
				Name: stripe.String(name),
			},
			UnitAmount: stripe.Int64(int64(unitCents)),
		},
		Quantity: stripe.Int64(int64(qty)),
	}
}

// writeToMetadata stores the cart in Stripe metadata. Each item is serialized
// to its own key (item_0, item_1, ...) to stay within Stripe's 500-char per
// value limit.
func (c *resolvedCart) writeToMetadata(m map[string]string) {
	m["items_count"] = strconv.Itoa(len(c.Items))
	for i, it := range c.Items {
		b, _ := json.Marshal(it)
		m[fmt.Sprintf("item_%d", i)] = string(b)
	}
}

// cartItemsFromMetadata rebuilds the cart items from Stripe metadata.
func cartItemsFromMetadata(meta map[string]string) []resolvedCartItem {
	count, _ := strconv.Atoi(meta["items_count"])
	var items []resolvedCartItem
	for i := 0; i < count; i++ {
		raw := meta[fmt.Sprintf("item_%d", i)]
		if raw == "" {
			continue
		}
		var it resolvedCartItem
		if err := json.Unmarshal([]byte(raw), &it); err == nil {
			items = append(items, it)
		}
	}
	return items
}

// aggregatePack returns booking-level photographer/premium flags from the items.
// pack_type on the bookings row is intentionally left NULL for cart bookings;
// the full composition lives in booking_items.
func aggregatePackFlags(items []resolvedCartItem) (hasPhotographer, hasPremiumPass bool) {
	for _, it := range items {
		if it.ItemType == "pack" {
			if it.HasPhotographer {
				hasPhotographer = true
			}
			if it.HasPremiumPass {
				hasPremiumPass = true
			}
		}
	}
	return
}

// insertBookingItems persists the cart items for a booking.
func (h *Handler) insertBookingItems(bookingID string, items []resolvedCartItem) {
	for _, it := range items {
		_, err := h.db.Exec(`INSERT INTO booking_items
			(booking_id, item_type, pack_type, pack_name, adults, children, has_photographer, has_premium_pass, quantity, unit_price_cents, line_total_cents)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			bookingID, it.ItemType,
			sql.NullString{String: it.PackType, Valid: it.PackType != ""},
			sql.NullString{String: it.PackName, Valid: it.PackName != ""},
			it.Adults, it.Children, it.HasPhotographer, it.HasPremiumPass,
			it.Quantity, it.UnitPriceCents, it.LineTotalCents)
		if err != nil {
			return
		}
	}
}

// getBookingItems loads the persisted items for a booking, ready for JSON output.
func (h *Handler) getBookingItems(bookingID string) []map[string]interface{} {
	rows, err := h.db.Query(`SELECT item_type, pack_type, pack_name, adults, children, has_photographer, has_premium_pass, quantity, unit_price_cents, line_total_cents
		FROM booking_items WHERE booking_id = ? ORDER BY id ASC`, bookingID)
	if err != nil {
		return nil
	}
	defer rows.Close()

	items := []map[string]interface{}{}
	for rows.Next() {
		var it models.BookingItem
		if err := rows.Scan(&it.ItemType, &it.PackType, &it.PackName, &it.Adults, &it.Children,
			&it.HasPhotographer, &it.HasPremiumPass, &it.Quantity, &it.UnitPriceCents, &it.LineTotalCents); err != nil {
			continue
		}
		m := map[string]interface{}{
			"itemType":        it.ItemType,
			"adults":          it.Adults,
			"children":        it.Children,
			"hasPhotographer": it.HasPhotographer,
			"hasPremiumPass":  it.HasPremiumPass,
			"quantity":        it.Quantity,
			"unitPriceCents":  it.UnitPriceCents,
			"lineTotalCents":  it.LineTotalCents,
		}
		if it.PackType.Valid {
			m["packType"] = it.PackType.String
		}
		if it.PackName.Valid {
			m["packName"] = it.PackName.String
		}
		items = append(items, m)
	}
	return items
}

// getMemberAllergies loads the member allergies for a booking, ready for JSON output.
func (h *Handler) getMemberAllergies(bookingID string) []map[string]interface{} {
	rows, err := h.db.Query(`SELECT member_type, member_index, name, lastname, allergies
		FROM member_allergies WHERE booking_id = ? ORDER BY member_type, member_index`, bookingID)
	if err != nil {
		return nil
	}
	defer rows.Close()

	allergies := []map[string]interface{}{}
	for rows.Next() {
		var memberType, name, lastname, allergiesJSON string
		var memberIndex int
		if err := rows.Scan(&memberType, &memberIndex, &name, &lastname, &allergiesJSON); err != nil {
			continue
		}
		var allergyList []string
		json.Unmarshal([]byte(allergiesJSON), &allergyList)
		allergies = append(allergies, map[string]interface{}{
			"memberType":  memberType,
			"memberIndex": memberIndex,
			"name":        name,
			"lastname":    lastname,
			"allergies":   allergyList,
		})
	}
	return allergies
}
