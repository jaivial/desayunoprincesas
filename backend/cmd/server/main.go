// Package main is the entry point for the Desayuno con Princesas backend server.
package main

import (
	"log"
	"net/http"
	"strings"
	"time"

	"desayuno-backend/internal/auth"
	"desayuno-backend/internal/config"
	"desayuno-backend/internal/db"
	"desayuno-backend/internal/handlers"
	"desayuno-backend/internal/middleware"
	"desayuno-backend/internal/ws"
)

func main() {
	// Load configuration
	cfg := config.Load()

	// Connect to database
	database, err := db.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer database.Close()

	// Run migrations
	if err := db.Migrate(database); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}

	// Initialize services
	hub := ws.NewHub()
	go hub.Run()

	authService := auth.NewAuthService(database, cfg.JWTSecret)
	h := handlers.New(database, hub, cfg, authService)

	// Create rate limiters
	apiLimiter := middleware.NewRateLimiter(100, time.Minute)      // 100 req/min for API
	checkoutLimiter := middleware.NewRateLimiter(10, time.Minute)  // 10 req/min for checkout

	// Set up routes
	mux := http.NewServeMux()

	// Public routes (no auth required)
	mux.HandleFunc("/api/public/settings", methodHandler("GET", h.GetPublicSettings))
	mux.HandleFunc("/api/public/capacity", methodHandler("GET", h.GetCapacity))
	mux.HandleFunc("/api/public/event-dates", methodHandler("GET", h.GetPublicEventDates))
	mux.HandleFunc("/api/public/bookings", methodHandler("POST", h.CreateBooking))
	mux.HandleFunc("/api/public/bookings/", h.GetBooking)
	mux.HandleFunc("/api/public/verify-session/", methodHandler("GET", h.VerifyStripeSession))
	mux.HandleFunc("/api/public/stripe/checkout", rateLimitHandler(checkoutLimiter, methodHandler("POST", h.CreateStripeCheckout)))
	mux.HandleFunc("/api/public/booking-update/", methodHandler("GET", h.GetBookingUpdate))

	// Auth routes
	mux.HandleFunc("/api/auth/login", methodHandler("POST", h.Login))
	mux.HandleFunc("/api/auth/me", methodHandler("GET", authService.Middleware(http.HandlerFunc(h.GetCurrentUser)).ServeHTTP))

	// Stripe webhook (no auth, validates signature)
	mux.HandleFunc("/api/webhooks/stripe", methodHandler("POST", h.StripeWebhook))

	// Admin routes (auth required)
	adminMux := http.NewServeMux()
	adminMux.HandleFunc("/api/admin/kpis", methodHandler("GET", h.GetKPIs))
	adminMux.HandleFunc("/api/admin/bookings", methodHandler("GET", h.ListBookings))
	adminMux.HandleFunc("/api/admin/bookings/", adminBookingRouter(h))
	adminMux.HandleFunc("/api/admin/qr/confirm", methodHandler("POST", h.ConfirmQR))
	adminMux.HandleFunc("/api/admin/settings", settingsRouter(h))
	adminMux.HandleFunc("/api/admin/event-dates", eventDatesRouter(h))
	adminMux.HandleFunc("/api/admin/event-dates/", eventDateRouter(h))

	// Apply auth middleware to admin routes
	mux.Handle("/api/admin/", authService.Middleware(adminMux))

	// WebSocket (no auth for simplicity, could add token param)
	mux.HandleFunc("/ws/capacity", func(w http.ResponseWriter, r *http.Request) {
		ws.ServeWs(hub, w, r)
	})

	// Build middleware chain
	handler := middleware.Recovery(
		middleware.Logger(
			apiLimiter.Middleware(
				corsMiddleware(mux, cfg),
			),
		),
	)

	// Start server
	port := cfg.Port
	if port == "" {
		port = "8080"
	}

	log.Printf("Server starting on port %s (env: %s)", port, cfg.Env)
	if err := http.ListenAndServe(":"+port, handler); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}

func methodHandler(method string, handler http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		if r.Method != method {
			http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
			return
		}
		handler(w, r)
	}
}

func rateLimitHandler(rl *middleware.RateLimiter, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rl.Middleware(http.HandlerFunc(next)).ServeHTTP(w, r)
	}
}

func adminBookingRouter(h *handlers.Handler) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		if strings.HasSuffix(r.URL.Path, "/resend-email") {
			if r.Method == "POST" {
				h.ResendEmail(w, r)
				return
			}
		}
		if strings.HasSuffix(r.URL.Path, "/allergies") {
			switch r.Method {
			case "GET":
				h.GetBookingAllergies(w, r)
				return
			case "PUT", "POST":
				h.UpdateBookingAllergies(w, r)
				return
			}
		}
		if strings.HasSuffix(r.URL.Path, "/packs") {
			if r.Method == "GET" {
				h.GetBookingPacks(w, r)
				return
			}
		}
		if strings.HasSuffix(r.URL.Path, "/request-pack-update") {
			if r.Method == "POST" {
				h.RequestPackUpdate(w, r)
				return
			}
		}
		if strings.HasSuffix(r.URL.Path, "/updates") {
			if r.Method == "GET" {
				h.GetBookingUpdates(w, r)
				return
			}
		}
		switch r.Method {
		case "GET":
			h.GetBookingAdmin(w, r)
		case "PATCH":
			h.UpdateBooking(w, r)
		case "DELETE":
			h.DeleteBooking(w, r)
		default:
			http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		}
	}
}

func settingsRouter(h *handlers.Handler) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		switch r.Method {
		case "GET":
			h.GetSettings(w, r)
		case "PATCH":
			h.UpdateSettings(w, r)
		default:
			http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		}
	}
}

// eventDatesRouter handles /api/admin/event-dates (collection).
func eventDatesRouter(h *handlers.Handler) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		switch r.Method {
		case "GET":
			h.ListEventDates(w, r)
		case "POST":
			h.CreateEventDate(w, r)
		default:
			http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		}
	}
}

// eventDateRouter handles /api/admin/event-dates/{id} and /api/admin/event-dates/{id}/packs.
func eventDateRouter(h *handlers.Handler) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		if strings.HasSuffix(r.URL.Path, "/packs") {
			if r.Method == "PATCH" {
				h.UpsertEventDatePacks(w, r)
				return
			}
			http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
			return
		}
		if r.Method == "PATCH" {
			h.UpdateEventDate(w, r)
			return
		}
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
	}
}

// wwwVariant returns o with "www." inserted after the scheme, e.g.
// https://x.com -> https://www.x.com. Returns "" if not applicable.
func wwwVariant(o string) string {
	for _, p := range []string{"https://", "http://"} {
		if strings.HasPrefix(o, p) && !strings.HasPrefix(o, p+"www.") {
			return p + "www." + o[len(p):]
		}
	}
	return ""
}

func corsMiddleware(next http.Handler, cfg *config.Config) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		allowedOrigins := []string{cfg.FrontendURL, cfg.BackofficeURL}

		allowed := false
		for _, ao := range allowedOrigins {
			// ponytail: also accept www. variant of each configured origin so
			// Facebook/Instagram links (which open www.) aren't CORS-blocked.
			if origin == ao || origin == wwwVariant(ao) {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				allowed = true
				break
			}
		}

		if cfg.Env == "development" && !allowed {
			w.Header().Set("Access-Control-Allow-Origin", "*")
		}

		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Allow-Credentials", "true")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}
