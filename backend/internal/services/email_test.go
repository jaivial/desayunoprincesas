package services

import (
	"strings"
	"testing"
)

func TestBuildBookingUpdateEmailIncludesQRAndMixedPaymentGroups(t *testing.T) {
	subject, body := buildBookingUpdateEmail(bookingUpdateEmailData{
		Name:             "Ana",
		Surname:          "García",
		QRCodeURL:        "https://cdn.example/qr.png",
		EventDate:        "18/07/2026",
		AdultsCount:      2,
		ChildrenCount:    1,
		TotalAmountCents: 11500,
		PaymentStatus:    "pending",
		PaymentMethod:    "mixed",
		Changes:          []string{"Teléfono actualizado", "Entradas actualizadas: 2 grupos de pago"},
		Items: []emailBookingItem{
			{ItemType: "individual", Adults: 1, Children: 1, LineTotalCents: 8000, PaymentStatus: "paid", PaymentMethod: "stripe"},
			{ItemType: "individual", Adults: 1, Children: 0, LineTotalCents: 3500, PaymentStatus: "pending", PaymentMethod: "bizum"},
		},
	})

	if !strings.Contains(subject, "Actualización") {
		t.Fatalf("unexpected subject: %q", subject)
	}
	for _, expected := range []string{
		"https://cdn.example/qr.png",
		"Estado final de la reserva",
		"Cambios realizados",
		"Teléfono actualizado",
		"Pago pendiente",
		"Método mixto",
		"Grupo de entradas 1",
		"Grupo de entradas 2",
		"Stripe",
		"Bizum",
		"80.00€",
		"35.00€",
		"115.00€",
	} {
		if !strings.Contains(body, expected) {
			t.Errorf("email body missing %q", expected)
		}
	}
}
