package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"desayuno-backend/internal/config"
)

func TestCORSAllowsAllAdminBookingSaveMethods(t *testing.T) {
	cfg := &config.Config{
		Env:           "production",
		FrontendURL:   "https://desayunoprincesas.com",
		BackofficeURL: "https://backoffice.desayunoprincesas.com",
	}
	handler := corsMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}), cfg)

	for _, method := range []string{http.MethodPatch, http.MethodPut, http.MethodPost} {
		req := httptest.NewRequest(http.MethodOptions, "/api/admin/bookings/test", nil)
		req.Header.Set("Origin", cfg.BackofficeURL)
		req.Header.Set("Access-Control-Request-Method", method)
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected OPTIONS %s to return 200, got %d", method, rec.Code)
		}
		if !strings.Contains(rec.Header().Get("Access-Control-Allow-Methods"), method) {
			t.Fatalf("CORS methods do not allow %s: %q", method, rec.Header().Get("Access-Control-Allow-Methods"))
		}
	}
}
