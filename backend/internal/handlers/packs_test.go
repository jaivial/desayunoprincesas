package handlers

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"desayuno-backend/internal/db"
)

// testDB connects to the test database and runs migrations.
// Set TEST_DATABASE_URL to override the default test DSN.
func testDB(t *testing.T) *sql.DB {
	t.Helper()
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		dsn = "root:myth@tcp(127.0.0.1:3306)/desayuno_test?parseTime=true"
	}
	database, err := db.Connect(dsn)
	if err != nil {
		t.Skipf("test database unavailable: %v", err)
	}
	if err := db.Migrate(database); err != nil {
		t.Fatalf("migrate failed: %v", err)
	}
	return database
}

func TestMigrateSeedsPacks(t *testing.T) {
	database := testDB(t)
	defer database.Close()

	var count int
	if err := database.QueryRow(`SELECT COUNT(*) FROM packs`).Scan(&count); err != nil {
		t.Fatalf("packs table query failed: %v", err)
	}
	if count < 6 {
		t.Fatalf("expected at least 6 seeded packs, got %d", count)
	}

	// Verify a known seeded pack has the expected data.
	var name string
	var priceCents int
	if err := database.QueryRow(`SELECT name, price_cents FROM packs WHERE id = 'encantado'`).Scan(&name, &priceCents); err != nil {
		t.Fatalf("encantado pack not found: %v", err)
	}
	if name != "Pack Encantado" || priceCents != 7500 {
		t.Fatalf("unexpected encantado data: name=%q priceCents=%d", name, priceCents)
	}
}

func TestGetPublicSettingsIncludesPacks(t *testing.T) {
	database := testDB(t)
	defer database.Close()
	h := &Handler{db: database}

	req := httptest.NewRequest("GET", "/api/public/settings", nil)
	rec := httptest.NewRecorder()
	h.GetPublicSettings(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var resp struct {
		Packs []struct {
			ID         string   `json:"id"`
			Name       string   `json:"name"`
			PriceCents int      `json:"priceCents"`
			Includes   []string `json:"includes"`
		} `json:"packs"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("invalid json: %v", err)
	}
	if len(resp.Packs) < 6 {
		t.Fatalf("expected packs in public settings, got %d", len(resp.Packs))
	}
	var found bool
	for _, p := range resp.Packs {
		if p.ID == "encantado" {
			found = true
			if len(p.Includes) == 0 {
				t.Fatalf("expected includes array populated for encantado")
			}
		}
	}
	if !found {
		t.Fatalf("encantado pack not present in public settings")
	}
}

func TestGetSettingsIncludesPacks(t *testing.T) {
	database := testDB(t)
	defer database.Close()
	h := &Handler{db: database}

	req := httptest.NewRequest("GET", "/api/admin/settings", nil)
	rec := httptest.NewRecorder()
	h.GetSettings(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var resp map[string]json.RawMessage
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("invalid json: %v", err)
	}
	raw, ok := resp["packs"]
	if !ok {
		t.Fatalf("admin settings missing packs key")
	}
	var packs []map[string]interface{}
	if err := json.Unmarshal(raw, &packs); err != nil {
		t.Fatalf("packs not an array: %v", err)
	}
	if len(packs) < 6 {
		t.Fatalf("expected >=6 packs, got %d", len(packs))
	}
}

func TestUpdateSettingsUpsertsPacks(t *testing.T) {
	database := testDB(t)
	defer database.Close()
	h := &Handler{db: database}

	// Edit existing pack + create new pack in one request.
	body := map[string]interface{}{
		"packs": []map[string]interface{}{
			{
				"id":         "encantado",
				"name":       "Pack Encantado EDIT",
				"emoji":      "👑",
				"icon":       "Sparkles",
				"adults":     1,
				"children":   1,
				"priceCents": 8000,
				"persons":    "1 adulto + 1 niño/a",
				"includes":   []string{"a", "b"},
			},
			{
				"id":         "test_new_pack",
				"name":       "Pack Nuevo Test",
				"emoji":      "🌟",
				"icon":       "Star",
				"adults":     2,
				"children":   3,
				"priceCents": 30000,
				"persons":    "2 adultos + 3 niños/as",
				"includes":   []string{"x"},
			},
		},
	}
	buf, _ := json.Marshal(body)
	req := httptest.NewRequest("PATCH", "/api/admin/settings", bytes.NewReader(buf))
	rec := httptest.NewRecorder()
	h.UpdateSettings(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var name string
	var priceCents int
	if err := database.QueryRow(`SELECT name, price_cents FROM packs WHERE id = 'encantado'`).Scan(&name, &priceCents); err != nil {
		t.Fatalf("encantado missing after update: %v", err)
	}
	if name != "Pack Encantado EDIT" || priceCents != 8000 {
		t.Fatalf("edit not applied: name=%q price=%d", name, priceCents)
	}

	if err := database.QueryRow(`SELECT name, price_cents FROM packs WHERE id = 'test_new_pack'`).Scan(&name, &priceCents); err != nil {
		t.Fatalf("new pack not created: %v", err)
	}
	if name != "Pack Nuevo Test" || priceCents != 30000 {
		t.Fatalf("create not applied: name=%q price=%d", name, priceCents)
	}

	// Cleanup new pack so reruns stay deterministic.
	database.Exec(`DELETE FROM packs WHERE id = 'test_new_pack'`)
	// Restore encantado seed values.
	database.Exec(`UPDATE packs SET name = 'Pack Encantado', price_cents = 7500 WHERE id = 'encantado'`)
}

func TestMigrateCreatesPacksMaxLimits(t *testing.T) {
	database := testDB(t)
	defer database.Close()

	var n int
	if err := database.QueryRow(`SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'packs_max_limits'`).Scan(&n); err != nil {
		t.Fatalf("query failed: %v", err)
	}
	if n != 1 {
		t.Fatalf("expected packs_max_limits table to exist")
	}
}

func TestPackMaxLimitCapacity(t *testing.T) {
	database := testDB(t)
	defer database.Close()
	h := &Handler{db: database}

	// Enable a max limit of 4 packs on the encantado pack.
	body := map[string]interface{}{
		"packs": []map[string]interface{}{
			{
				"id":              "encantado",
				"name":            "Pack Encantado",
				"emoji":           "👑",
				"icon":            "Sparkles",
				"adults":          1,
				"children":        1,
				"priceCents":      7500,
				"persons":         "1 adulto + 1 niño/a",
				"includes":        []string{"a"},
				"maxLimitEnabled": true,
				"maxTickets":      4,
			},
		},
	}
	buf, _ := json.Marshal(body)
	req := httptest.NewRequest("PATCH", "/api/admin/settings", bytes.NewReader(buf))
	rec := httptest.NewRecorder()
	h.UpdateSettings(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	// Insert a paid booking using the pack: this counts as 1 pack, regardless
	// of the number of tickets (1 adult + 1 child) inside it.
	database.Exec(`DELETE FROM bookings WHERE id = 'test-pack-limit-booking'`)
	_, err := database.Exec(`INSERT INTO bookings
		(id, name, surname, email, phone_country_code, phone_number, adults_count, children_count,
		 pack_type, adult_price_cents, child_price_cents, total_amount_cents, payment_status, payment_method, qr_token)
		VALUES ('test-pack-limit-booking', 'T', 'B', 't@e.com', '+34', '600000000', 1, 1,
		 'encantado', 0, 0, 7500, 'paid', 'cash', 'test-pack-limit-token')`)
	if err != nil {
		t.Fatalf("insert booking failed: %v", err)
	}

	preq := httptest.NewRequest("GET", "/api/public/settings", nil)
	prec := httptest.NewRecorder()
	h.GetPublicSettings(prec, preq)

	var resp struct {
		Packs []struct {
			ID               string `json:"id"`
			MaxLimitEnabled  bool   `json:"maxLimitEnabled"`
			MaxTickets       int    `json:"maxTickets"`
			SoldTickets      int    `json:"soldTickets"`
			AvailableTickets int    `json:"availableTickets"`
		} `json:"packs"`
	}
	if err := json.Unmarshal(prec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("invalid json: %v", err)
	}
	var found bool
	for _, p := range resp.Packs {
		if p.ID == "encantado" {
			found = true
			if !p.MaxLimitEnabled || p.MaxTickets != 4 {
				t.Fatalf("limit not saved: enabled=%v max=%d", p.MaxLimitEnabled, p.MaxTickets)
			}
			if p.SoldTickets != 1 {
				t.Fatalf("expected soldTickets=1 (packs), got %d", p.SoldTickets)
			}
			if p.AvailableTickets != 3 {
				t.Fatalf("expected availableTickets=3 (packs), got %d", p.AvailableTickets)
			}
		}
	}
	if !found {
		t.Fatalf("encantado pack not present")
	}

	// Cleanup.
	database.Exec(`DELETE FROM bookings WHERE id = 'test-pack-limit-booking'`)
	database.Exec(`DELETE FROM packs_max_limits WHERE pack_id = 'encantado'`)
}

func TestUpdateSettingsTogglesPackCompleted(t *testing.T) {
	database := testDB(t)
	defer database.Close()
	h := &Handler{db: database}

	// Mark the encantado pack as completed (sold out).
	body := map[string]interface{}{
		"packs": []map[string]interface{}{
			{
				"id":         "encantado",
				"name":       "Pack Encantado",
				"emoji":      "👑",
				"icon":       "Sparkles",
				"adults":     1,
				"children":   1,
				"priceCents": 7500,
				"persons":    "1 adulto + 1 niño/a",
				"includes":   []string{"a"},
				"completed":  true,
			},
		},
	}
	buf, _ := json.Marshal(body)
	req := httptest.NewRequest("PATCH", "/api/admin/settings", bytes.NewReader(buf))
	rec := httptest.NewRecorder()
	h.UpdateSettings(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	// The public settings endpoint must expose the completed flag.
	preq := httptest.NewRequest("GET", "/api/public/settings", nil)
	prec := httptest.NewRecorder()
	h.GetPublicSettings(prec, preq)

	var resp struct {
		Packs []struct {
			ID        string `json:"id"`
			Completed bool   `json:"completed"`
		} `json:"packs"`
	}
	if err := json.Unmarshal(prec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("invalid json: %v", err)
	}
	var found bool
	for _, p := range resp.Packs {
		if p.ID == "encantado" {
			found = true
			if !p.Completed {
				t.Fatalf("expected encantado completed=true")
			}
		}
	}
	if !found {
		t.Fatalf("encantado pack not present")
	}

	// Restore.
	database.Exec(`UPDATE packs SET completed = FALSE WHERE id = 'encantado'`)
}
