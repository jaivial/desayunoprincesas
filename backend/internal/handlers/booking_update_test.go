package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

const updateTestBookingID = "test-booking-update-email"
const updateTestQRToken = "test-booking-update-qr"

func insertUpdateTestBooking(t *testing.T) {
	t.Helper()
	database := testDB(t)
	t.Cleanup(func() { database.Close() })
	database.Exec(`DELETE FROM bookings WHERE id = ?`, updateTestBookingID)
	t.Cleanup(func() { database.Exec(`DELETE FROM bookings WHERE id = ?`, updateTestBookingID) })
	_, err := database.Exec(`INSERT INTO bookings
		(id, name, surname, email, phone_country_code, phone_number, adults_count, children_count,
		 adult_price_cents, child_price_cents, total_amount_cents, payment_status, payment_method, qr_token, qr_code_url)
		VALUES (?, 'Ana', 'García', 'ana@example.com', '+34', '600111222', 1, 1,
		 3500, 4500, 8000, 'paid', 'stripe', ?, 'https://cdn.example/qr.png')`,
		updateTestBookingID, updateTestQRToken)
	if err != nil {
		t.Fatalf("insert booking: %v", err)
	}
}

func TestUpdateBookingPersistsMixedPaymentGroups(t *testing.T) {
	database := testDB(t)
	defer database.Close()
	database.Exec(`DELETE FROM bookings WHERE id = ?`, updateTestBookingID)
	defer database.Exec(`DELETE FROM bookings WHERE id = ?`, updateTestBookingID)
	_, err := database.Exec(`INSERT INTO bookings
		(id, name, surname, email, phone_country_code, phone_number, adults_count, children_count,
		 adult_price_cents, child_price_cents, total_amount_cents, payment_status, payment_method, qr_token)
		VALUES (?, 'Ana', 'García', 'ana@example.com', '+34', '600111222', 1, 1,
		 3500, 4500, 8000, 'paid', 'stripe', ?)`, updateTestBookingID, updateTestQRToken)
	if err != nil {
		t.Fatalf("insert booking: %v", err)
	}

	h := &Handler{db: database}
	body := []byte(`{
		"adultsCount": 2,
		"childrenCount": 1,
		"totalAmountCents": 11500,
		"items": [
			{"adults": 1, "children": 1, "amountCents": 8000, "paymentStatus": "paid", "paymentMethod": "stripe"},
			{"adults": 1, "children": 0, "amountCents": 3500, "paymentStatus": "pending", "paymentMethod": "bizum"}
		]
	}`)
	req := httptest.NewRequest(http.MethodPatch, "/api/admin/bookings/"+updateTestBookingID, bytes.NewReader(body))
	rec := httptest.NewRecorder()
	h.UpdateBooking(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var adults, children, amount int
	var method string
	if err := database.QueryRow(`SELECT adults_count, children_count, total_amount_cents, payment_method FROM bookings WHERE id = ?`, updateTestBookingID).Scan(&adults, &children, &amount, &method); err != nil {
		t.Fatalf("read booking: %v", err)
	}
	if adults != 2 || children != 1 || amount != 11500 || method != "mixed" {
		t.Fatalf("unexpected booking totals: adults=%d children=%d amount=%d method=%s", adults, children, amount, method)
	}

	rows, err := database.Query(`SELECT adults, children, line_total_cents, payment_status, payment_method FROM booking_items WHERE booking_id = ? ORDER BY id`, updateTestBookingID)
	if err != nil {
		t.Fatalf("read ticket groups: %v", err)
	}
	defer rows.Close()
	var groups []struct {
		adults, children, amount int
		status, method           string
	}
	for rows.Next() {
		var group struct {
			adults, children, amount int
			status, method           string
		}
		if err := rows.Scan(&group.adults, &group.children, &group.amount, &group.status, &group.method); err != nil {
			t.Fatalf("scan ticket group: %v", err)
		}
		groups = append(groups, group)
	}
	if len(groups) != 2 || groups[0].method != "stripe" || groups[1].method != "bizum" || groups[1].status != "pending" {
		t.Fatalf("unexpected ticket groups: %+v", groups)
	}
}

func TestUpdateBookingKeepsExistingPackPaymentMetadata(t *testing.T) {
	database := testDB(t)
	defer database.Close()
	database.Exec(`DELETE FROM bookings WHERE id = ?`, updateTestBookingID)
	defer database.Exec(`DELETE FROM bookings WHERE id = ?`, updateTestBookingID)
	_, err := database.Exec(`INSERT INTO bookings
		(id, name, surname, email, phone_country_code, phone_number, adults_count, children_count,
		 adult_price_cents, child_price_cents, total_amount_cents, payment_status, payment_method, qr_token)
		VALUES (?, 'Ana', 'García', 'ana@example.com', '+34', '600111222', 1, 1,
		 3500, 4500, 7500, 'paid', 'stripe', ?)`, updateTestBookingID, updateTestQRToken)
	if err != nil {
		t.Fatalf("insert booking: %v", err)
	}
	_, err = database.Exec(`INSERT INTO booking_items
		(booking_id, item_type, pack_type, pack_name, adults, children, quantity, unit_price_cents, line_total_cents)
		VALUES (?, 'pack', 'encantado', 'Pack Encantado', 1, 1, 1, 7500, 7500)`, updateTestBookingID)
	if err != nil {
		t.Fatalf("insert legacy pack item: %v", err)
	}

	h := &Handler{db: database}
	body := []byte(`{
		"adultsCount": 2,
		"childrenCount": 1,
		"totalAmountCents": 11000,
		"items": [{"adults": 1, "children": 0, "amountCents": 3500, "paymentStatus": "pending", "paymentMethod": "bizum"}]
	}`)
	req := httptest.NewRequest(http.MethodPatch, "/api/admin/bookings/"+updateTestBookingID, bytes.NewReader(body))
	rec := httptest.NewRecorder()
	h.UpdateBooking(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var packStatus, packMethod, ticketStatus, ticketMethod string
	if err := database.QueryRow(`SELECT payment_status, payment_method FROM booking_items WHERE booking_id = ? AND item_type = 'pack'`, updateTestBookingID).Scan(&packStatus, &packMethod); err != nil {
		t.Fatalf("read pack payment data: %v", err)
	}
	if err := database.QueryRow(`SELECT payment_status, payment_method FROM booking_items WHERE booking_id = ? AND item_type = 'individual'`, updateTestBookingID).Scan(&ticketStatus, &ticketMethod); err != nil {
		t.Fatalf("read ticket payment data: %v", err)
	}
	if packStatus != "paid" || packMethod != "stripe" || ticketStatus != "pending" || ticketMethod != "bizum" {
		t.Fatalf("unexpected per-line payment data: pack=%s/%s ticket=%s/%s", packStatus, packMethod, ticketStatus, ticketMethod)
	}
}

func TestConfirmQRReturnsPaymentDetailsForTicketGroups(t *testing.T) {
	database := testDB(t)
	defer database.Close()
	database.Exec(`DELETE FROM bookings WHERE id = ?`, updateTestBookingID)
	defer database.Exec(`DELETE FROM bookings WHERE id = ?`, updateTestBookingID)
	_, err := database.Exec(`INSERT INTO bookings
		(id, name, surname, email, phone_country_code, phone_number, adults_count, children_count,
		 adult_price_cents, child_price_cents, total_amount_cents, payment_status, payment_method, qr_token)
		VALUES (?, 'Ana', 'García', 'ana@example.com', '+34', '600111222', 2, 1,
		 3500, 4500, 11500, 'pending', 'mixed', ?)`, updateTestBookingID, updateTestQRToken)
	if err != nil {
		t.Fatalf("insert booking: %v", err)
	}
	_, err = database.Exec(`INSERT INTO booking_items
		(booking_id, item_type, adults, children, quantity, unit_price_cents, line_total_cents, payment_status, payment_method)
		VALUES (?, 'individual', 1, 1, 1, 8000, 8000, 'paid', 'stripe'),
		       (?, 'individual', 1, 0, 1, 3500, 3500, 'pending', 'bizum')`, updateTestBookingID, updateTestBookingID)
	if err != nil {
		t.Fatalf("insert ticket groups: %v", err)
	}

	h := &Handler{db: database}
	body, _ := json.Marshal(map[string]string{"qrToken": updateTestQRToken})
	req := httptest.NewRequest(http.MethodPost, "/api/admin/qr/confirm", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	h.ConfirmQR(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var response struct {
		Booking struct {
			PaymentMethod string `json:"paymentMethod"`
			Items         []struct {
				Adults         int    `json:"adults"`
				Children       int    `json:"children"`
				LineTotalCents int    `json:"lineTotalCents"`
				PaymentStatus  string `json:"paymentStatus"`
				PaymentMethod  string `json:"paymentMethod"`
			} `json:"items"`
		} `json:"booking"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if response.Booking.PaymentMethod != "mixed" || len(response.Booking.Items) != 2 {
		t.Fatalf("unexpected QR booking response: %+v", response.Booking)
	}
	if response.Booking.Items[0].PaymentMethod != "stripe" || response.Booking.Items[0].PaymentStatus != "paid" || response.Booking.Items[1].PaymentMethod != "bizum" || response.Booking.Items[1].PaymentStatus != "pending" {
		t.Fatalf("ticket payment details missing: %+v", response.Booking.Items)
	}
}

func TestSendBookingUpdateEmailEndpointEnsuresQRAndSendsEmail(t *testing.T) {
	database := testDB(t)
	defer database.Close()
	database.Exec(`DELETE FROM bookings WHERE id = ?`, updateTestBookingID)
	defer database.Exec(`DELETE FROM bookings WHERE id = ?`, updateTestBookingID)
	_, err := database.Exec(`INSERT INTO bookings
		(id, name, surname, email, phone_country_code, phone_number, adults_count, children_count,
		 adult_price_cents, child_price_cents, total_amount_cents, payment_status, payment_method, qr_token)
		VALUES (?, 'Ana', 'García', 'ana@example.com', '+34', '600111222', 1, 1,
		 3500, 4500, 8000, 'paid', 'stripe', ?)`, updateTestBookingID, updateTestQRToken)
	if err != nil {
		t.Fatalf("insert booking: %v", err)
	}

	var ensuredID, emailedID string
	h := &Handler{
		db: database,
		ensureQRCode: func(id string) error {
			ensuredID = id
			return nil
		},
		sendBookingUpdateEmail: func(id string, changes []string) error {
			emailedID = id
			if len(changes) != 1 || changes[0] != "Teléfono actualizado" {
				t.Errorf("unexpected email changes: %v", changes)
			}
			return nil
		},
	}
	req := httptest.NewRequest(http.MethodPost, "/api/admin/bookings/"+updateTestBookingID+"/send-update-email", bytes.NewBufferString(`{"changes":["Teléfono actualizado"]}`))
	rec := httptest.NewRecorder()
	h.SendBookingUpdateEmail(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	if ensuredID != updateTestBookingID || emailedID != updateTestBookingID {
		t.Fatalf("expected QR and email for booking %q, got QR=%q email=%q", updateTestBookingID, ensuredID, emailedID)
	}
}
