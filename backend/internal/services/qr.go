package services

import (
	"bytes"
	"database/sql"
	"fmt"
	"io"
	"log"
	"net/http"

	"desayuno-backend/internal/config"

	"github.com/skip2/go-qrcode"
)

// QRService handles QR code generation and BunnyCDN upload.
type QRService struct {
	db  *sql.DB
	cfg *config.Config
}

// NewQRService creates a new QRService instance.
func NewQRService(db *sql.DB, cfg *config.Config) *QRService {
	return &QRService{db: db, cfg: cfg}
}

// GenerateAndUploadQR generates a QR code for the booking and uploads it to BunnyCDN.
// Returns the public URL of the uploaded QR code image.
func (s *QRService) GenerateAndUploadQR(bookingID, qrToken string) (string, error) {
	// Generate QR code PNG (512px for better scanning)
	qrCode, err := qrcode.Encode(qrToken, qrcode.Medium, 512)
	if err != nil {
		return "", fmt.Errorf("failed to generate QR code: %w", err)
	}

	// Upload to BunnyCDN
	filename := fmt.Sprintf("qr/%s.png", bookingID)
	publicURL, err := s.uploadToBunnyCDN(filename, qrCode)
	if err != nil {
		return "", fmt.Errorf("failed to upload to BunnyCDN: %w", err)
	}

	// Update booking with QR URL
	_, err = s.db.Exec(`UPDATE bookings SET qr_code_url = ? WHERE id = ?`, publicURL, bookingID)
	if err != nil {
		log.Printf("Warning: failed to update booking with QR URL: %v", err)
	}

	return publicURL, nil
}

// uploadToBunnyCDN uploads a file to BunnyCDN storage and returns the public URL.
func (s *QRService) uploadToBunnyCDN(filename string, data []byte) (string, error) {
	if s.cfg.BunnyCDNStorageEndpoint == "" || s.cfg.BunnyCDNStorageZonePassword == "" {
		return "", fmt.Errorf("BunnyCDN configuration missing")
	}

	// Create upload URL: endpoint/filename
	uploadURL := fmt.Sprintf("%s/%s", s.cfg.BunnyCDNStorageEndpoint, filename)

	req, err := http.NewRequest(http.MethodPut, uploadURL, bytes.NewReader(data))
	if err != nil {
		return "", err
	}

	req.Header.Set("AccessKey", s.cfg.BunnyCDNStorageZonePassword)
	req.Header.Set("Content-Type", "image/png")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("BunnyCDN upload failed with status %d: %s", resp.StatusCode, string(body))
	}

	// Return public URL using pull zone
	if s.cfg.BunnyCDNPullZoneURL != "" {
		return fmt.Sprintf("%s/%s", s.cfg.BunnyCDNPullZoneURL, filename), nil
	}

	// Fallback: construct URL from storage endpoint (replace storage with CDN pattern)
	return fmt.Sprintf("%s/%s", s.cfg.BunnyCDNStorageEndpoint, filename), nil
}

// GetQRCodeURL returns the QR code URL for a booking, generating it if needed.
func (s *QRService) GetQRCodeURL(bookingID string) (string, error) {
	var qrCodeURL sql.NullString
	var qrToken string

	err := s.db.QueryRow(`SELECT qr_token, qr_code_url FROM bookings WHERE id = ?`, bookingID).Scan(&qrToken, &qrCodeURL)
	if err != nil {
		return "", err
	}

	// If QR URL already exists, return it
	if qrCodeURL.Valid && qrCodeURL.String != "" {
		return qrCodeURL.String, nil
	}

	// Generate and upload QR code
	return s.GenerateAndUploadQR(bookingID, qrToken)
}
