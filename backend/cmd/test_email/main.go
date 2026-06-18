package main

import (
	"log"
	"os"

	"desayuno-backend/internal/config"
	"desayuno-backend/internal/db"
	"desayuno-backend/internal/services"

	_ "github.com/go-sql-driver/mysql"
)

func main() {
	cfg := config.Load()

	// Connect to database
	database, err := db.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer database.Close()

	bookingID := "test-booking-001"
	if len(os.Args) > 1 {
		bookingID = os.Args[1]
	}

	// Get QR token
	var qrToken string
	err = database.QueryRow(`SELECT qr_token FROM bookings WHERE id = ?`, bookingID).Scan(&qrToken)
	if err != nil {
		log.Fatalf("Failed to get booking: %v", err)
	}
	log.Printf("Booking found: %s, QR token: %s", bookingID, qrToken)

	// Generate and upload QR
	qrService := services.NewQRService(database, cfg)
	qrURL, err := qrService.GenerateAndUploadQR(bookingID, qrToken)
	if err != nil {
		log.Fatalf("Failed to generate/upload QR: %v", err)
	}
	log.Printf("QR uploaded: %s", qrURL)

	// Send confirmation email
	emailService := services.NewEmailService(database, cfg)
	emailService.SendConfirmation(bookingID)

	log.Println("Done!")
}
