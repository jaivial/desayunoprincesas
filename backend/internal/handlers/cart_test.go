package handlers

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"desayuno-backend/internal/models"
)

// findItem returns the first resolved item matching the predicate.
func findItem(items []resolvedCartItem, pred func(resolvedCartItem) bool) *resolvedCartItem {
	for i := range items {
		if pred(items[i]) {
			return &items[i]
		}
	}
	return nil
}

func TestResolveCartCombinesPacksAndIndividual(t *testing.T) {
	database := testDB(t)
	defer database.Close()
	h := &Handler{db: database}

	// Make sure early bird is off and prices are at the seeded defaults.
	database.Exec(`UPDATE settings SET adult_price_cents = 3500, child_price_cents = 4000, early_bird_count = 0, early_bird_discount_percent = 0 WHERE id = 1`)

	req := &models.CreateBookingRequest{
		Items: []models.BookingItemInput{
			{ItemType: "pack", PackType: "encantado", Quantity: 2},     // 7500 each, 1A+1C each
			{ItemType: "individual", AdultsCount: 1, ChildrenCount: 1}, // 3500 + 4000
		},
	}

	cart, err := h.resolveCart(req)
	if err != nil {
		t.Fatalf("resolveCart failed: %v", err)
	}

	if cart.TotalAdults != 3 || cart.TotalChildren != 3 {
		t.Fatalf("expected 3 adults / 3 children, got %d / %d", cart.TotalAdults, cart.TotalChildren)
	}
	wantTotal := 2*7500 + 3500 + 4000
	if cart.TotalAmountCents != wantTotal {
		t.Fatalf("expected total %d, got %d", wantTotal, cart.TotalAmountCents)
	}
	if len(cart.Items) != 2 {
		t.Fatalf("expected 2 items, got %d", len(cart.Items))
	}

	pack := findItem(cart.Items, func(it resolvedCartItem) bool { return it.ItemType == "pack" })
	if pack == nil || pack.PackType != "encantado" || pack.Quantity != 2 {
		t.Fatalf("unexpected pack item: %+v", pack)
	}
	if pack.LineTotalCents != 2*7500 || pack.UnitPriceCents != 7500 {
		t.Fatalf("unexpected pack pricing: unit=%d line=%d", pack.UnitPriceCents, pack.LineTotalCents)
	}

	ind := findItem(cart.Items, func(it resolvedCartItem) bool { return it.ItemType == "individual" })
	if ind == nil || ind.Adults != 1 || ind.Children != 1 {
		t.Fatalf("unexpected individual item: %+v", ind)
	}
	if ind.LineTotalCents != 3500+4000 {
		t.Fatalf("unexpected individual line total: %d", ind.LineTotalCents)
	}
}

func TestResolveCartAppliesEarlyBird(t *testing.T) {
	database := testDB(t)
	defer database.Close()
	h := &Handler{db: database}

	// 10% early bird, large count so it always applies regardless of paid bookings.
	database.Exec(`UPDATE settings SET adult_price_cents = 3500, child_price_cents = 4000, early_bird_count = 100000, early_bird_discount_percent = 10 WHERE id = 1`)
	defer database.Exec(`UPDATE settings SET early_bird_count = 0, early_bird_discount_percent = 0 WHERE id = 1`)

	req := &models.CreateBookingRequest{
		Items: []models.BookingItemInput{
			{ItemType: "pack", PackType: "encantado", Quantity: 1},
			{ItemType: "individual", AdultsCount: 2, ChildrenCount: 0},
		},
	}

	cart, err := h.resolveCart(req)
	if err != nil {
		t.Fatalf("resolveCart failed: %v", err)
	}
	if !cart.AppliedEarlyBird || cart.EarlyBirdPercent != 10 {
		t.Fatalf("expected early bird applied at 10%%, got applied=%v pct=%d", cart.AppliedEarlyBird, cart.EarlyBirdPercent)
	}

	wantPack := 7500 - 750  // -10%
	wantAdult := 3500 - 350 // -10% per adult
	wantTotal := wantPack + 2*wantAdult
	if cart.TotalAmountCents != wantTotal {
		t.Fatalf("expected discounted total %d, got %d", wantTotal, cart.TotalAmountCents)
	}
}

func TestResolveCartRejectsSoldOutPack(t *testing.T) {
	database := testDB(t)
	defer database.Close()
	h := &Handler{db: database}

	database.Exec(`UPDATE packs SET completed = TRUE WHERE id = 'encantado'`)
	defer database.Exec(`UPDATE packs SET completed = FALSE WHERE id = 'encantado'`)

	req := &models.CreateBookingRequest{
		Items: []models.BookingItemInput{{ItemType: "pack", PackType: "encantado", Quantity: 1}},
	}

	_, err := h.resolveCart(req)
	if err == nil {
		t.Fatalf("expected error for sold-out pack")
	}
	var ce *cartError
	if !errors.As(err, &ce) {
		t.Fatalf("expected cartError, got %T: %v", err, err)
	}
}

func TestResolveCartEnforcesPerPackLimit(t *testing.T) {
	database := testDB(t)
	defer database.Close()
	h := &Handler{db: database}

	database.Exec(`UPDATE settings SET early_bird_count = 0, early_bird_discount_percent = 0 WHERE id = 1`)

	// Limit encantado to 2 packs total. The limit counts packs, not the
	// tickets inside each pack.
	database.Exec(`DELETE FROM packs_max_limits WHERE pack_id = 'encantado'`)
	database.Exec(`INSERT INTO packs_max_limits (pack_id, enabled, max_tickets) VALUES ('encantado', TRUE, 2)`)
	defer database.Exec(`DELETE FROM packs_max_limits WHERE pack_id = 'encantado'`)

	// One paid legacy booking already consumes 1 pack => 1 pack remaining.
	database.Exec(`DELETE FROM bookings WHERE id = 'test-cart-limit-booking'`)
	database.Exec(`INSERT INTO bookings
		(id, name, surname, email, phone_country_code, phone_number, adults_count, children_count,
		 pack_type, adult_price_cents, child_price_cents, total_amount_cents, payment_status, payment_method, qr_token)
		VALUES ('test-cart-limit-booking', 'T', 'B', 't@e.com', '+34', '600000000', 1, 1,
		 'encantado', 0, 0, 7500, 'paid', 'cash', 'test-cart-limit-token')`)
	defer database.Exec(`DELETE FROM bookings WHERE id = 'test-cart-limit-booking'`)

	// Requesting 2 packs exceeds the 1 remaining => rejected.
	over := &models.CreateBookingRequest{
		Items: []models.BookingItemInput{{ItemType: "pack", PackType: "encantado", Quantity: 2}},
	}
	if _, err := h.resolveCart(over); err == nil {
		t.Fatalf("expected limit error for 2 packs")
	} else {
		var ce *cartError
		if !errors.As(err, &ce) {
			t.Fatalf("expected cartError, got %T: %v", err, err)
		}
	}

	// Requesting 1 pack fits exactly the remaining => accepted.
	ok := &models.CreateBookingRequest{
		Items: []models.BookingItemInput{{ItemType: "pack", PackType: "encantado", Quantity: 1}},
	}
	if _, err := h.resolveCart(ok); err != nil {
		t.Fatalf("expected 1 pack to be accepted, got: %v", err)
	}
}

func TestCartMetadataRoundTrip(t *testing.T) {
	cart := &resolvedCart{
		Items: []resolvedCartItem{
			{ItemType: "pack", PackType: "encantado", PackName: "Pack Encantado", Adults: 1, Children: 1, HasPhotographer: true, Quantity: 2, UnitPriceCents: 7500, LineTotalCents: 15000},
			{ItemType: "individual", Adults: 1, Children: 2, Quantity: 1, AdultPriceCents: 3500, ChildPriceCents: 4000, LineTotalCents: 11500},
		},
	}

	meta := map[string]string{}
	cart.writeToMetadata(meta)

	if meta["items_count"] != "2" {
		t.Fatalf("expected items_count=2, got %q", meta["items_count"])
	}

	got := cartItemsFromMetadata(meta)
	if len(got) != 2 {
		t.Fatalf("expected 2 items round-tripped, got %d", len(got))
	}
	if got[0].PackType != "encantado" || got[0].Quantity != 2 || !got[0].HasPhotographer {
		t.Fatalf("pack item round-trip mismatch: %+v", got[0])
	}
	if got[1].ItemType != "individual" || got[1].Adults != 1 || got[1].Children != 2 {
		t.Fatalf("individual item round-trip mismatch: %+v", got[1])
	}
}

func TestCreateBookingPersistsItems(t *testing.T) {
	database := testDB(t)
	defer database.Close()
	h := &Handler{db: database}

	database.Exec(`UPDATE settings SET adult_price_cents = 3500, child_price_cents = 4000, early_bird_count = 0, early_bird_discount_percent = 0 WHERE id = 1`)

	body := map[string]interface{}{
		"name":             "Ana",
		"surname":          "García",
		"email":            "ana@example.com",
		"phoneCountryCode": "+34",
		"phoneNumber":      "600111222",
		"items": []map[string]interface{}{
			{"itemType": "pack", "packType": "encantado", "quantity": 2},
			{"itemType": "individual", "adultsCount": 1, "childrenCount": 1},
		},
	}
	buf, _ := json.Marshal(body)
	req := httptest.NewRequest("POST", "/api/public/bookings", bytes.NewReader(buf))
	rec := httptest.NewRecorder()
	h.CreateBooking(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", rec.Code, rec.Body.String())
	}

	var resp struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil || resp.ID == "" {
		t.Fatalf("invalid response: %v body=%s", err, rec.Body.String())
	}
	defer database.Exec(`DELETE FROM bookings WHERE id = ?`, resp.ID)

	// Aggregate counts on the booking row.
	var adults, children, total int
	if err := database.QueryRow(`SELECT adults_count, children_count, total_amount_cents FROM bookings WHERE id = ?`, resp.ID).Scan(&adults, &children, &total); err != nil {
		t.Fatalf("booking not found: %v", err)
	}
	if adults != 3 || children != 3 {
		t.Fatalf("expected aggregate 3/3, got %d/%d", adults, children)
	}
	if total != 2*7500+3500+4000 {
		t.Fatalf("unexpected total: %d", total)
	}

	// Items rows.
	var itemCount int
	database.QueryRow(`SELECT COUNT(*) FROM booking_items WHERE booking_id = ?`, resp.ID).Scan(&itemCount)
	if itemCount != 2 {
		t.Fatalf("expected 2 booking_items, got %d", itemCount)
	}

	var packQty int
	if err := database.QueryRow(`SELECT quantity FROM booking_items WHERE booking_id = ? AND pack_type = 'encantado'`, resp.ID).Scan(&packQty); err != nil {
		t.Fatalf("pack item not found: %v", err)
	}
	if packQty != 2 {
		t.Fatalf("expected pack quantity 2, got %d", packQty)
	}
}
