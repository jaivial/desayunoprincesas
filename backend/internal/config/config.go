// Package config loads configuration from environment variables.
package config

import "os"

// Config holds all application configuration.
type Config struct {
	Env                 string // "development" or "production"
	Port                string // Server port
	DatabaseURL         string // MySQL connection string
	StripeSecretKey     string // Stripe API secret key
	StripeWebhookSecret string // Stripe webhook signing secret
	FrontendURL         string // Frontend URL for CORS/redirects
	BackofficeURL       string // Backoffice URL for CORS
	JWTSecret           string // Secret for signing JWT tokens
	QRSigningSecret     string // Secret for QR token generation
	EmailEncryptionKey  string // Key for encrypting email credentials
	// BunnyCDN configuration
	BunnyCDNStorageZonePassword string // BunnyCDN storage zone password
	BunnyCDNStorageEndpoint     string // BunnyCDN storage endpoint URL
	BunnyCDNPullZoneURL         string // BunnyCDN pull zone URL for public access
}

// Load reads configuration from environment variables.
// Uses sensible defaults for development.
func Load() *Config {
	return &Config{
		Env:                         getEnv("APP_ENV", "development"),
		Port:                        getEnv("APP_PORT", "8080"),
		DatabaseURL:                 getEnv("DATABASE_URL", "root:myth@tcp(127.0.0.1:3306)/desayuno_con_princesas?parseTime=true"),
		StripeSecretKey:             getEnv("STRIPE_SECRET_KEY", ""),
		StripeWebhookSecret:         getEnv("STRIPE_WEBHOOK_SECRET", ""),
		FrontendURL:                 getEnv("FRONTEND_URL", "http://localhost:5173"),
		BackofficeURL:               getEnv("BACKOFFICE_URL", "http://localhost:5174"),
		JWTSecret:                   getEnv("JWT_SECRET", "dev-jwt-secret-change-in-production"),
		QRSigningSecret:             getEnv("QR_SIGNING_SECRET", "dev-qr-secret-change-in-production"),
		EmailEncryptionKey:          getEnv("EMAIL_ENCRYPTION_KEY", ""),
		BunnyCDNStorageZonePassword: getEnv("BUNNYCDN_STORAGE_ZONE_PASSWORD", ""),
		BunnyCDNStorageEndpoint:     getEnv("BUNNYCDN_STORAGE_ENDPOINT", ""),
		BunnyCDNPullZoneURL:         getEnv("BUNNYCDN_PULL_ZONE_URL", ""),
	}
}

func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
