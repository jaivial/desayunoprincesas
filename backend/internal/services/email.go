package services

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/smtp"
	"strings"

	"desayuno-backend/internal/config"
)

type EmailService struct {
	db  *sql.DB
	cfg *config.Config
}

func NewEmailService(db *sql.DB, cfg *config.Config) *EmailService {
	return &EmailService{db: db, cfg: cfg}
}

type emailConfig struct {
	provider     string
	smtpHost     string
	smtpPort     int
	smtpUsername string
	smtpPassword string
	smtpFrom     string
	gmailUser    string
	gmailAppPass string
}

func (s *EmailService) getConfig() (*emailConfig, error) {
	var cfg emailConfig
	var smtpHost, smtpUsername, smtpPassword, smtpFrom, gmailUser, gmailAppPass sql.NullString
	var smtpPort sql.NullInt64

	err := s.db.QueryRow(`SELECT email_provider, smtp_host, smtp_port, smtp_username, smtp_password_encrypted, smtp_from_email, gmail_username, gmail_app_password_encrypted FROM settings WHERE id = 1`).Scan(
		&cfg.provider, &smtpHost, &smtpPort, &smtpUsername, &smtpPassword, &smtpFrom, &gmailUser, &gmailAppPass,
	)
	if err != nil {
		return nil, err
	}

	if smtpHost.Valid {
		cfg.smtpHost = smtpHost.String
	}
	if smtpPort.Valid {
		cfg.smtpPort = int(smtpPort.Int64)
	}
	if smtpUsername.Valid {
		cfg.smtpUsername = smtpUsername.String
	}
	if smtpPassword.Valid {
		cfg.smtpPassword = smtpPassword.String
	}
	if smtpFrom.Valid {
		cfg.smtpFrom = smtpFrom.String
	}
	if gmailUser.Valid {
		cfg.gmailUser = gmailUser.String
	}
	if gmailAppPass.Valid {
		cfg.gmailAppPass = gmailAppPass.String
	}

	return &cfg, nil
}

// Allergen definitions for email display
var allergenNames = map[string]string{
	"gluten":      "Gluten",
	"crustaceans": "Crustáceos",
	"eggs":        "Huevos",
	"fish":        "Pescado",
	"peanuts":     "Cacahuetes",
	"soy":         "Soja",
	"dairy":       "Lácteos",
	"nuts":        "Frutos secos",
	"celery":      "Apio",
	"mustard":     "Mostaza",
	"sesame":      "Sésamo",
	"sulfites":    "Sulfitos",
	"lupin":       "Altramuces",
	"mollusks":    "Moluscos",
}

type memberAllergyInfo struct {
	MemberType string
	Name       string
	Lastname   string
	Allergies  []string
}

// Pack names for email display
var packNames = map[string]string{
	"encantado":        "Pack Encantado",
	"reino_encantado":  "Pack Reino Encantado",
	"recuerdo_real_1":  "Pack Recuerdo Real 1",
	"recuerdo_real_2":  "Pack Recuerdo Real 2",
	"cuento_ensueno_1": "Pack Cuento de Ensueño 1",
	"cuento_ensueno_2": "Pack Cuento de Ensueño 2",
}

// emailBookingItem is a minimal view of a booking item for the email template.
type emailBookingItem struct {
	ItemType        string
	PackType        string
	PackName        string
	Adults          int
	Children        int
	HasPhotographer bool
	HasPremiumPass  bool
	Quantity        int
}

// getBookingItems loads the items (packs + individual tickets) of a booking.
func (s *EmailService) getBookingItems(bookingID string) []emailBookingItem {
	rows, err := s.db.Query(`SELECT item_type, COALESCE(pack_type, ''), COALESCE(pack_name, ''), adults, children, has_photographer, has_premium_pass, quantity
		FROM booking_items WHERE booking_id = ? ORDER BY id ASC`, bookingID)
	if err != nil {
		return nil
	}
	defer rows.Close()

	var items []emailBookingItem
	for rows.Next() {
		var it emailBookingItem
		if err := rows.Scan(&it.ItemType, &it.PackType, &it.PackName, &it.Adults, &it.Children, &it.HasPhotographer, &it.HasPremiumPass, &it.Quantity); err == nil {
			items = append(items, it)
		}
	}
	return items
}

func (s *EmailService) SendConfirmation(bookingID string) {
	var name, surname, email, qrToken string
	var qrCodeURL, packType sql.NullString
	var adultsCount, childrenCount, totalAmountCents int
	var hasPhotographer, hasPremiumPass bool
	var eventDate sql.NullTime

	err := s.db.QueryRow(`
		SELECT b.name, b.surname, b.email, b.qr_token, b.qr_code_url, b.adults_count, b.children_count, b.pack_type, b.has_photographer, b.has_premium_pass, b.total_amount_cents,
			COALESCE(eod.event_date, s.event_date)
		FROM bookings b
		JOIN settings s ON s.id = 1
		LEFT JOIN event_opening_dates eod ON eod.id = b.event_date_id
		WHERE b.id = ?
	`, bookingID).Scan(&name, &surname, &email, &qrToken, &qrCodeURL, &adultsCount, &childrenCount, &packType, &hasPhotographer, &hasPremiumPass, &totalAmountCents, &eventDate)
	if err != nil {
		log.Printf("Failed to get booking for email: %v", err)
		return
	}

	// Load the booking items (packs + individual tickets) for the breakdown.
	items := s.getBookingItems(bookingID)

	// Fetch member allergies
	var memberAllergies []memberAllergyInfo
	rows, err := s.db.Query(`SELECT member_type, name, lastname, allergies FROM member_allergies WHERE booking_id = ? ORDER BY member_type, member_index`, bookingID)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var ma memberAllergyInfo
			var allergiesJSON string
			if err := rows.Scan(&ma.MemberType, &ma.Name, &ma.Lastname, &allergiesJSON); err == nil {
				// Parse JSON array
				var allergies []string
				if err := json.Unmarshal([]byte(allergiesJSON), &allergies); err == nil {
					ma.Allergies = allergies
					memberAllergies = append(memberAllergies, ma)
				}
			}
		}
	}

	cfg, err := s.getConfig()
	if err != nil {
		log.Printf("Failed to get email config: %v", err)
		return
	}

	eventDateStr := "Por confirmar"
	if eventDate.Valid {
		eventDateStr = eventDate.Time.Format("02/01/2006")
	}

	totalAmount := float64(totalAmountCents) / 100

	// Build QR code section
	var qrSection string
	if qrCodeURL.Valid && qrCodeURL.String != "" {
		qrSection = fmt.Sprintf(`
            <div style="text-align: center; margin: 30px 0; padding: 20px; background: #fff9fb; border-radius: 12px;">
                <p style="margin: 0 0 15px 0; font-size: 16px; font-weight: 600; color: #333;">Tu código QR de acceso</p>
                <img src="%s" alt="Código QR" style="width: 250px; height: 250px; border: 4px solid #d4a5c9; border-radius: 8px;" />
                <p style="margin: 15px 0 0 0; font-size: 12px; color: #888;">Código: %s</p>
            </div>
`, qrCodeURL.String, qrToken[:8])
	} else {
		qrSection = fmt.Sprintf(`
            <div style="text-align: center; margin: 30px 0; padding: 20px; background: #fff9fb; border-radius: 12px;">
                <p style="margin: 0 0 10px 0; font-size: 16px; font-weight: 600; color: #333;">Tu código de acceso</p>
                <p style="margin: 0; font-size: 28px; font-weight: bold; color: #9b59b6; letter-spacing: 2px;">%s</p>
            </div>
`, qrToken[:8])
	}

	// Build tickets breakdown section
	var ticketsBreakdownSection string
	var ticketRows strings.Builder

	// Process packs
	for _, it := range items {
		if it.ItemType != "pack" {
			continue
		}
		packName := it.PackName
		if packName == "" {
			packName = it.PackType
			if pn, ok := packNames[it.PackType]; ok {
				packName = pn
			}
		}
		label := packName
		if it.Quantity > 1 {
			label = fmt.Sprintf("%s x%d", packName, it.Quantity)
		}
		extras := ""
		if it.HasPhotographer {
			extras += `<span style="display: inline-block; background: #3b82f6; color: white; padding: 3px 8px; border-radius: 15px; font-size: 11px; margin: 3px 2px;">📸 Fotógrafo</span>`
		}
		if it.HasPremiumPass {
			extras += `<span style="display: inline-block; background: #8b5cf6; color: white; padding: 3px 8px; border-radius: 15px; font-size: 11px; margin: 3px 2px;">👑 Premium</span>`
		}
		totalAdults := it.Adults * it.Quantity
		totalChildren := it.Children * it.Quantity
		ticketRows.WriteString(fmt.Sprintf(`
                                <div style="background: #f3e8ff; padding: 12px; border-radius: 8px; margin: 8px 0; border-left: 4px solid #9333ea;">
                                    <p style="margin: 0 0 5px 0; font-size: 16px; font-weight: bold; color: #5b21b6;">🎁 %s</p>
                                    %s
                                    <p style="margin: 5px 0 0 0; font-size: 13px; color: #7c3aed;">Incluye: %d adulto(s), %d niño(s)</p>
                                </div>`, label, extras, totalAdults, totalChildren))
	}

	// Fallback for legacy bookings without items
	if ticketRows.Len() == 0 && packType.Valid && packType.String != "" {
		packName := packType.String
		if pn, ok := packNames[packType.String]; ok {
			packName = pn
		}
		extras := ""
		if hasPhotographer {
			extras += `<span style="display: inline-block; background: #3b82f6; color: white; padding: 3px 8px; border-radius: 15px; font-size: 11px; margin: 3px 2px;">📸 Fotógrafo</span>`
		}
		if hasPremiumPass {
			extras += `<span style="display: inline-block; background: #8b5cf6; color: white; padding: 3px 8px; border-radius: 15px; font-size: 11px; margin: 3px 2px;">👑 Premium</span>`
		}
		ticketRows.WriteString(fmt.Sprintf(`
                                <div style="background: #f3e8ff; padding: 12px; border-radius: 8px; margin: 8px 0; border-left: 4px solid #9333ea;">
                                    <p style="margin: 0 0 5px 0; font-size: 16px; font-weight: bold; color: #5b21b6;">🎁 %s</p>
                                    %s
                                </div>`, packName, extras))
	}

	// Process individual tickets
	for _, it := range items {
		if it.ItemType != "individual" {
			continue
		}
		var parts []string
		if it.Adults > 0 {
			parts = append(parts, fmt.Sprintf("%d adulto(s)", it.Adults))
		}
		if it.Children > 0 {
			parts = append(parts, fmt.Sprintf("%d niño(s)", it.Children))
		}
		ticketRows.WriteString(fmt.Sprintf(`
                                <div style="background: #e0f2fe; padding: 12px; border-radius: 8px; margin: 8px 0; border-left: 4px solid #0284c7;">
                                    <p style="margin: 0 0 5px 0; font-size: 16px; font-weight: bold; color: #0369a1;">🎫 Entradas individuales</p>
                                    <p style="margin: 0; font-size: 13px; color: #0284c7;">%s</p>
                                </div>`, strings.Join(parts, ", ")))
	}

	if ticketRows.Len() > 0 {
		ticketsBreakdownSection = fmt.Sprintf(`
                            <!-- Tickets Breakdown Section -->
                            <div style="background: #fafafa; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
                                <p style="margin: 0 0 15px 0; font-size: 14px; font-weight: 600; color: #333; text-transform: uppercase; letter-spacing: 1px;">🎫 Desglose de Entradas</p>
                                %s
                                <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e5e5e5;">
                                    <p style="margin: 0; font-size: 14px; color: #666;"><strong>Total:</strong> %d adulto(s), %d niño(s)</p>
                                </div>
                            </div>
`, ticketRows.String(), adultsCount, childrenCount)
	}

	// Build allergies section
	var allergiesSection string
	if len(memberAllergies) > 0 {
		var allergiesRows strings.Builder
		for _, ma := range memberAllergies {
			memberTypeLabel := "Adulto"
			if ma.MemberType == "child" {
				memberTypeLabel = "Niño/a"
			}
			// Convert allergy IDs to names
			var allergyNames []string
			for _, aid := range ma.Allergies {
				if name, ok := allergenNames[aid]; ok {
					allergyNames = append(allergyNames, name)
				} else {
					allergyNames = append(allergyNames, aid)
				}
			}
			allergiesRows.WriteString(fmt.Sprintf(`
                                    <tr>
                                        <td style="padding: 10px 0; color: #333; font-size: 14px; border-bottom: 1px solid rgba(217,119,6,0.2);">
                                            <span style="background: %s; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px; margin-right: 8px;">%s</span>
                                            <strong>%s %s</strong>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 5px 0 15px 0; color: #b45309; font-size: 13px;">
                                            %s
                                        </td>
                                    </tr>
`, func() string { if ma.MemberType == "adult" { return "#7c3aed" } else { return "#f59e0b" } }(), memberTypeLabel, ma.Name, ma.Lastname, strings.Join(allergyNames, ", ")))
		}
		allergiesSection = fmt.Sprintf(`
                            <!-- Allergies Section -->
                            <div style="background: linear-gradient(135deg, #fef3c7 0%%, #fde68a 100%%); padding: 25px; border-radius: 12px; margin: 25px 0;">
                                <h2 style="margin: 0 0 20px 0; color: #b45309; font-size: 18px; border-bottom: 2px solid rgba(217,119,6,0.2); padding-bottom: 10px;">⚠️ Alergias Registradas</h2>
                                <table role="presentation" width="100%%" cellspacing="0" cellpadding="0">
                                    %s
                                </table>
                                <p style="margin: 10px 0 0 0; font-size: 12px; color: #92400e; font-style: italic;">Por favor, recuerda informar al personal del evento sobre estas alergias.</p>
                            </div>
`, allergiesRows.String())
	}

	subject := "Confirmación de tu reserva - Desayuno con Princesas"
	body := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f5f5f5;">
    <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" style="background: #f5f5f5;">
        <tr>
            <td align="center" style="padding: 20px;">
                <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%%;">
                    
                    <!-- Header with Logo -->
                    <tr>
                        <td style="background: #1a1a1a; padding: 30px 40px; text-align: center; border-radius: 12px 12px 0 0;">
                            <img src="https://villacarmenmedia.b-cdn.net/images/icons/logoblancopng.PNG" alt="Villa Carmen" style="max-width: 180px; height: auto; margin-bottom: 15px;" />
                            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 300; letter-spacing: 1px;">Desayuno con Princesas</h1>
                            <p style="margin: 10px 0 0 0; color: #d4a5c9; font-size: 14px; font-style: italic;">Una experiencia mágica te espera</p>
                        </td>
                    </tr>
                    
                    <!-- Main Content -->
                    <tr>
                        <td style="background: #ffffff; padding: 40px;">
                            
                            <!-- Greeting -->
                            <p style="margin: 0 0 20px 0; font-size: 18px; color: #333;">Hola <strong>%s %s</strong>,</p>
                            <p style="margin: 0 0 30px 0; font-size: 16px; color: #555; line-height: 1.6;">
                                ¡Tu reserva ha sido confirmada! Estamos encantados de recibirte en nuestro mágico Desayuno con Princesas.</p>
                            
                            <!-- Age restriction notice -->
                            <div style="background: linear-gradient(135deg, #fce4ec 0%%, #f8bbd9 100%%); border: 2px solid #ec4899; padding: 15px 20px; border-radius: 12px; margin-bottom: 25px;">
                                <p style="margin: 0; font-size: 14px; color: #831843; font-weight: 600;">
                                    ⚠️ <strong>Importante:</strong> Evento exclusivo para niños a partir de 3 años.
                                </p>
                            </div>
                            <p style="margin: 0 0 30px 0; font-size: 16px; color: #555; line-height: 1.6;">
                            </p>
                            %s
                            <!-- Booking Details -->
                            <div style="background: linear-gradient(135deg, #fce4ec 0%%, #f8bbd9 100%%); padding: 25px; border-radius: 12px; margin-bottom: 25px;">
                                <h2 style="margin: 0 0 20px 0; color: #7b1fa2; font-size: 18px; border-bottom: 2px solid rgba(123,31,162,0.2); padding-bottom: 10px;">Detalles de tu Reserva</h2>
                                <table role="presentation" width="100%%" cellspacing="0" cellpadding="0">
                                    <tr>
                                        <td style="padding: 8px 0; color: #555; font-size: 14px;">Fecha del evento:</td>
                                        <td style="padding: 8px 0; color: #333; font-size: 14px; font-weight: 600; text-align: right;">%s</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 8px 0; color: #555; font-size: 14px;">Entradas adulto:</td>
                                        <td style="padding: 8px 0; color: #333; font-size: 14px; font-weight: 600; text-align: right;">%d</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 8px 0; color: #555; font-size: 14px;">Entradas niño/a:</td>
                                        <td style="padding: 8px 0; color: #333; font-size: 14px; font-weight: 600; text-align: right;">%d</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 12px 0 0 0; color: #555; font-size: 14px; border-top: 1px solid rgba(123,31,162,0.2);">Total pagado:</td>
                                        <td style="padding: 12px 0 0 0; color: #7b1fa2; font-size: 18px; font-weight: 700; text-align: right; border-top: 1px solid rgba(123,31,162,0.2);">%.2f€</td>
                                    </tr>
                                </table>
                            </div>
                            %s
                            <!-- QR Code -->
                            %s
                            
                            <p style="margin: 0; font-size: 14px; color: #666; text-align: center; font-style: italic;">
                                Presenta este código QR en la entrada del evento
                            </p>
                            
                        </td>
                    </tr>
                    
                    <!-- Location Section -->
                    <tr>
                        <td style="background: #fafafa; padding: 35px 40px; border-top: 1px solid #eee;">
                            <h2 style="margin: 0 0 20px 0; color: #333; font-size: 18px; text-align: center;">¿Cómo llegar?</h2>
                            
                            <div style="text-align: center; margin-bottom: 25px;">
                                <p style="margin: 0 0 5px 0; font-size: 16px; font-weight: 600; color: #333;">Alquería Villa Carmen</p>
                                <p style="margin: 0; font-size: 14px; color: #666; line-height: 1.5;">
                                    C/ Sequía de Rascanya, 2<br/>
                                    46470 Catarroja, Valencia
                                </p>
                            </div>
                            
                            <div style="text-align: center;">
                                <a href="https://maps.google.com/?q=C/+Sequía+de+Rascanya,+2,+46470+Catarroja,+Valencia" style="display: inline-block; background: #4285f4; color: #ffffff; text-decoration: none; padding: 12px 25px; border-radius: 25px; font-size: 14px; font-weight: 500;">
                                    Ver en Google Maps
                                </a>
                            </div>
                            
                            <!-- Contact Info -->
                            <div style="margin-top: 30px; padding-top: 25px; border-top: 1px solid #eee; text-align: center;">
                                <p style="margin: 0 0 15px 0; font-size: 14px; color: #555;">¿Tienes alguna pregunta? Contáctanos:</p>
                                <table role="presentation" align="center" cellspacing="0" cellpadding="0">
                                    <tr>
                                        <td style="padding: 0 10px;">
                                            <a href="https://wa.me/34638857294" style="display: inline-block; background: #25d366; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 20px; font-size: 13px;">
                                                WhatsApp
                                            </a>
                                        </td>
                                        <td style="padding: 0 10px;">
                                            <a href="mailto:reservas@alqueriavillacarmen.com" style="display: inline-block; background: #9b59b6; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 20px; font-size: 13px;">
                                                Email
                                            </a>
                                        </td>
                                    </tr>
                                </table>
                            </div>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background: #1a1a1a; padding: 25px 40px; border-radius: 0 0 12px 12px; text-align: center;">
                            <p style="margin: 0 0 15px 0; color: #999; font-size: 12px; line-height: 1.6;">
                                Al realizar esta reserva, has aceptado nuestros<br/>
                                <a href="https://desayunoprincesas.com/terminos-y-condiciones" style="color: #d4a5c9; text-decoration: underline;">Términos y Condiciones</a> 
                                y nuestra 
                                <a href="https://desayunoprincesas.com/politica-de-privacidad" style="color: #d4a5c9; text-decoration: underline;">Política de Privacidad</a>
                            </p>
                            <p style="margin: 0; color: #666; font-size: 11px;">
                                © 2024 Alquería Villa Carmen. Todos los derechos reservados.
                            </p>
                        </td>
                    </tr>
                    
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
`, name, surname, ticketsBreakdownSection, eventDateStr, adultsCount, childrenCount, totalAmount, allergiesSection, qrSection)

	message := fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n%s",
		cfg.smtpFrom, email, subject, body)

	var auth smtp.Auth
	var addr string

	if cfg.provider == "gmail" && cfg.gmailUser != "" && cfg.gmailAppPass != "" {
		auth = smtp.PlainAuth("", cfg.gmailUser, cfg.gmailAppPass, "smtp.gmail.com")
		addr = "smtp.gmail.com:587"
		message = fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n%s",
			cfg.gmailUser, email, subject, body)
	} else if cfg.smtpHost != "" && cfg.smtpPort > 0 {
		if cfg.smtpUsername != "" && cfg.smtpPassword != "" {
			auth = smtp.PlainAuth("", cfg.smtpUsername, cfg.smtpPassword, cfg.smtpHost)
		}
		addr = fmt.Sprintf("%s:%d", cfg.smtpHost, cfg.smtpPort)
	} else {
		log.Printf("No email configuration available")
		return
	}

	var from string
	if cfg.provider == "gmail" {
		from = cfg.gmailUser
	} else {
		from = cfg.smtpFrom
	}

	err = smtp.SendMail(addr, auth, from, []string{email}, []byte(message))
	if err != nil {
		log.Printf("Failed to send email: %v", err)
		return
	}

	log.Printf("Confirmation email sent to %s", email)
}

// sendEmail sends an email using the configured provider.
func (s *EmailService) sendEmail(to, subject, htmlBody string) error {
	cfg, err := s.getConfig()
	if err != nil {
		return err
	}

	var from string
	if cfg.provider == "gmail" && cfg.gmailUser != "" {
		from = cfg.gmailUser
	} else {
		from = cfg.smtpFrom
	}

	message := fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n%s",
		from, to, subject, htmlBody)

	var auth smtp.Auth
	var addr string

	if cfg.provider == "gmail" && cfg.gmailUser != "" && cfg.gmailAppPass != "" {
		auth = smtp.PlainAuth("", cfg.gmailUser, cfg.gmailAppPass, "smtp.gmail.com")
		addr = "smtp.gmail.com:587"
	} else if cfg.smtpHost != "" && cfg.smtpPort > 0 {
		if cfg.smtpUsername != "" && cfg.smtpPassword != "" {
			auth = smtp.PlainAuth("", cfg.smtpUsername, cfg.smtpPassword, cfg.smtpHost)
		}
		addr = fmt.Sprintf("%s:%d", cfg.smtpHost, cfg.smtpPort)
	} else {
		return fmt.Errorf("no email configuration available")
	}

	if err := smtp.SendMail(addr, auth, from, []string{to}, []byte(message)); err != nil {
		return err
	}
	log.Printf("Email sent to %s", to)
	return nil
}

// SendPackUpdateRequest sends an email to the client with the pack change payment link.
func (s *EmailService) SendPackUpdateRequest(bookingID, token, oldPackType, newPackType, newPackName string, differenceCents int) {
	var name, surname, email string
	err := s.db.QueryRow(`SELECT name, surname, email FROM bookings WHERE id = ?`, bookingID).Scan(&name, &surname, &email)
	if err != nil {
		log.Printf("Failed to get booking for pack update email: %v", err)
		return
	}

	oldLabel := oldPackType
	if pn, ok := packNames[oldPackType]; ok {
		oldLabel = pn
	}
	newLabel := newPackName
	if newLabel == "" {
		newLabel = newPackType
		if pn, ok := packNames[newPackType]; ok {
			newLabel = pn
		}
	}

	differenceEuros := float64(differenceCents) / 100
	paymentURL := fmt.Sprintf("%s/booking-update/%s", s.cfg.FrontendURL, token)

	subject := "Suplemento de pago - Cambio de pack - Desayuno con Princesas"
	body := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f5f5f5;">
    <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" style="background: #f5f5f5;">
        <tr>
            <td align="center" style="padding: 20px;">
                <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%%;">
                    <tr>
                        <td style="background: #1a1a1a; padding: 30px 40px; text-align: center; border-radius: 12px 12px 0 0;">
                            <img src="https://villacarmenmedia.b-cdn.net/images/icons/logoblancopng.PNG" alt="Villa Carmen" style="max-width: 180px; height: auto; margin-bottom: 15px;" />
                            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 300; letter-spacing: 1px;">Desayuno con Princesas</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="background: #ffffff; padding: 40px;">
                            <p style="margin: 0 0 20px 0; font-size: 18px; color: #333;">Hola <strong>%s %s</strong>,</p>
                            <p style="margin: 0 0 30px 0; font-size: 16px; color: #555; line-height: 1.6;">
                                Se ha solicitado un cambio de pack en tu reserva. El nuevo pack tiene un coste adicional que requiere ser abonado.</p>
                            
                            <div style="background: linear-gradient(135deg, #fce4ec 0%%, #f8bbd9 100%%); padding: 25px; border-radius: 12px; margin-bottom: 25px;">
                                <h2 style="margin: 0 0 20px 0; color: #7b1fa2; font-size: 18px;">Detalles del cambio</h2>
                                <table role="presentation" width="100%%" cellspacing="0" cellpadding="0">
                                    <tr>
                                        <td style="padding: 8px 0; color: #555; font-size: 14px;">Pack actual:</td>
                                        <td style="padding: 8px 0; color: #333; font-size: 14px; font-weight: 600; text-align: right;">%s</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 8px 0; color: #555; font-size: 14px;">Nuevo pack:</td>
                                        <td style="padding: 8px 0; color: #333; font-size: 14px; font-weight: 600; text-align: right;">%s</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 12px 0 0 0; color: #555; font-size: 14px; border-top: 1px solid rgba(123,31,162,0.2);">Suplemento a pagar:</td>
                                        <td style="padding: 12px 0 0 0; color: #7b1fa2; font-size: 24px; font-weight: 700; text-align: right; border-top: 1px solid rgba(123,31,162,0.2);">%.2f€</td>
                                    </tr>
                                </table>
                            </div>
                            
                            <div style="text-align: center; margin: 30px 0;">
                                <p style="margin: 0 0 20px 0; font-size: 14px; color: #666;">
                                    Haz clic en el botón para completar el pago del suplemento. El cambio se aplicará automáticamente al confirmar el pago.</p>
                                <a href="%s" style="display: inline-block; background: linear-gradient(135deg, #7b1fa2, #e91e63); color: #ffffff; text-decoration: none; padding: 15px 30px; border-radius: 25px; font-size: 16px; font-weight: 600; margin-bottom: 10px;">
                                    Pagar %.2f€
                                </a>
                                <p style="margin: 10px 0 0 0; font-size: 12px; color: #999;">
                                    O copia este enlace: <br/><a href="%s" style="color: #7b1fa2;">%s</a>
                                </p>
                            </div>
                            
                            <div style="background: #fff9fb; border: 1px solid #f8bbd9; padding: 15px 20px; border-radius: 8px; margin-top: 25px;">
                                <p style="margin: 0; font-size: 13px; color: #831843;">
                                    ⚠️ El cambio quedará en estado "pendiente" hasta que se complete el pago. Si no se realiza el pago, la reserva mantendrá el pack actual.</p>
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td style="background: #fafafa; padding: 25px 40px; border-top: 1px solid #eee; text-align: center;">
                            <p style="margin: 0 0 10px 0; font-size: 14px; color: #555;">¿Tienes alguna pregunta? Contáctanos:</p>
                            <a href="https://wa.me/34638857294" style="display: inline-block; background: #25d366; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 20px; font-size: 13px; margin: 0 5px;">WhatsApp</a>
                            <a href="mailto:reservas@alqueriavillacarmen.com" style="display: inline-block; background: #9b59b6; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 20px; font-size: 13px; margin: 0 5px;">Email</a>
                        </td>
                    </tr>
                    <tr>
                        <td style="background: #1a1a1a; padding: 25px 40px; border-radius: 0 0 12px 12px; text-align: center;">
                            <p style="margin: 0; color: #666; font-size: 11px;">
                                © 2024 Alquería Villa Carmen. Todos los derechos reservados.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
`, name, surname, oldLabel, newLabel, differenceEuros, paymentURL, differenceEuros, paymentURL, paymentURL)

	if err := s.sendEmail(email, subject, body); err != nil {
		log.Printf("Failed to send pack update email: %v", err)
		return
	}
		log.Printf("Pack update email sent to %s for booking %s", email, bookingID)
}

// SendPackUpdateConfirmation sends a full booking confirmation email with QR after a manual pack change.
func (s *EmailService) SendPackUpdateConfirmation(bookingID, paymentMethod, oldPackType, newPackType, newPackName string, differenceCents int) {
	var name, surname, email, qrToken string
	var qrCodeURL sql.NullString
	var adultsCount, childrenCount, totalAmountCents int
	var eventDate sql.NullTime
	var hasPhotographer, hasPremiumPass bool

	err := s.db.QueryRow(`
		SELECT b.name, b.surname, b.email, b.qr_token, b.qr_code_url,
		       b.adults_count, b.children_count, b.has_photographer, b.has_premium_pass,
		       b.total_amount_cents, COALESCE(eod.event_date, s.event_date)
		FROM bookings b
		JOIN settings s ON s.id = 1
		LEFT JOIN event_opening_dates eod ON eod.id = b.event_date_id
		WHERE b.id = ?
	`, bookingID).Scan(&name, &surname, &email, &qrToken, &qrCodeURL,
		&adultsCount, &childrenCount, &hasPhotographer, &hasPremiumPass,
		&totalAmountCents, &eventDate)
	if err != nil {
		log.Printf("Failed to get booking for pack update confirmation: %v", err)
		return
	}

	// Build pack names
	oldLabel := oldPackType
	if pn, ok := packNames[oldPackType]; ok {
		oldLabel = pn
	}
	newLabel := newPackName
	if newLabel == "" {
		newLabel = newPackType
		if pn, ok := packNames[newPackType]; ok {
			newLabel = pn
		}
	}

	paymentLabels := map[string]string{
		"bizum":        "Bizum",
		"transferencia": "Transferencia bancaria",
		"efectivo":     "Efectivo",
	}
	methodLabel := paymentMethod
	if l, ok := paymentLabels[paymentMethod]; ok {
		methodLabel = l
	}

	eventDateStr := "Por confirmar"
	if eventDate.Valid {
		eventDateStr = eventDate.Time.Format("02/01/2006")
	}

	totalAmount := float64(totalAmountCents) / 100
	differenceEuros := float64(differenceCents) / 100

	subject := "Confirmación de cambio de pack - Desayuno con Princesas"

	// Build QR section
	var qrSection string
	if qrCodeURL.Valid && qrCodeURL.String != "" {
		qrSection = fmt.Sprintf(`
			<div style="text-align: center; margin: 30px 0; padding: 20px; background: #fff9fb; border-radius: 12px;">
				<p style="margin: 0 0 15px 0; font-size: 16px; font-weight: 600; color: #333;">Tu código QR de acceso</p>
				<img src="%s" alt="Código QR" style="width: 250px; height: 250px; border: 4px solid #d4a5c9; border-radius: 8px;" />
				<p style="margin: 15px 0 0 0; font-size: 12px; color: #888;">Código: %s</p>
			</div>
`, qrCodeURL.String, qrToken[:8])
	} else {
		qrSection = fmt.Sprintf(`
			<div style="text-align: center; margin: 30px 0; padding: 20px; background: #fff9fb; border-radius: 12px;">
				<p style="margin: 0 0 10px 0; font-size: 16px; font-weight: 600; color: #333;">Tu código de acceso</p>
				<p style="margin: 0; font-size: 28px; font-weight: bold; color: #9b59b6; letter-spacing: 2px;">%s</p>
			</div>
`, qrToken[:8])
	}

	body := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f5f5f5;">
    <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" style="background: #f5f5f5;">
        <tr>
            <td align="center" style="padding: 20px;">
                <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%%;">
                    <tr>
                        <td style="background: #1a1a1a; padding: 30px 40px; text-align: center; border-radius: 12px 12px 0 0;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 300; letter-spacing: 1px;">Desayuno con Princesas</h1>
                            <p style="margin: 10px 0 0 0; color: #d4a5c9; font-size: 14px;">Reserva actualizada</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="background: #ffffff; padding: 40px;">
                            <p style="margin: 0 0 20px 0; font-size: 18px; color: #333;">Hola <strong>%s %s</strong>,</p>
                            <p style="margin: 0 0 30px 0; font-size: 16px; color: #555; line-height: 1.6;">Tu reserva ha sido actualizada. A continuación te mostramos los cambios realizados y los detalles actualizados de tu reserva.</p>

                            <div style="background: linear-gradient(135deg, #e8f5e9, #c8e6c9); padding: 25px; border-radius: 12px; margin-bottom: 25px;">
                                <h2 style="margin: 0 0 15px 0; color: #2e7d32; font-size: 18px;">✅ Cambio de pack realizado</h2>
                                <table role="presentation" width="100%%" cellspacing="0" cellpadding="0">
                                    <tr>
                                        <td style="padding: 5px 0; color: #555; font-size: 14px;">Pack anterior:</td>
                                        <td style="padding: 5px 0; color: #333; font-size: 14px; font-weight: 600; text-align: right;">%s</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 5px 0; color: #555; font-size: 14px;">Nuevo pack:</td>
                                        <td style="padding: 5px 0; color: #2e7d32; font-size: 14px; font-weight: 600; text-align: right;">%s</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 8px 0; color: #555; font-size: 14px;">Suplemento abonado:</td>
                                        <td style="padding: 8px 0; color: #2e7d32; font-size: 16px; font-weight: 700; text-align: right;">%.2f€</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 5px 0; color: #555; font-size: 14px;">Método de pago:</td>
                                        <td style="padding: 5px 0; color: #333; font-size: 14px; font-weight: 600; text-align: right;">%s</td>
                                    </tr>
                                </table>
                            </div>

                            <div style="background: linear-gradient(135deg, #fce4ec 0%%, #f8bbd9 100%%); padding: 25px; border-radius: 12px; margin-bottom: 25px;">
                                <h2 style="margin: 0 0 20px 0; color: #7b1fa2; font-size: 18px;">Detalles actualizados de tu Reserva</h2>
                                <table role="presentation" width="100%%" cellspacing="0" cellpadding="0">
                                    <tr>
                                        <td style="padding: 8px 0; color: #555; font-size: 14px;">Fecha del evento:</td>
                                        <td style="padding: 8px 0; color: #333; font-size: 14px; font-weight: 600; text-align: right;">%s</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 8px 0; color: #555; font-size: 14px;">Entradas adulto:</td>
                                        <td style="padding: 8px 0; color: #333; font-size: 14px; font-weight: 600; text-align: right;">%d</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 8px 0; color: #555; font-size: 14px;">Entradas niño/a:</td>
                                        <td style="padding: 8px 0; color: #333; font-size: 14px; font-weight: 600; text-align: right;">%d</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 12px 0 0 0; color: #555; font-size: 14px; border-top: 1px solid rgba(123,31,162,0.2);">Total pagado:</td>
                                        <td style="padding: 12px 0 0 0; color: #7b1fa2; font-size: 18px; font-weight: 700; text-align: right; border-top: 1px solid rgba(123,31,162,0.2);">%.2f€</td>
                                    </tr>
                                </table>
                            </div>

                            %s

                            <p style="margin: 0; font-size: 14px; color: #666; text-align: center; font-style: italic;">
                                Presenta este código QR en la entrada del evento
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="background: #fafafa; padding: 25px 40px; border-top: 1px solid #eee; text-align: center;">
                            <p style="margin: 0 0 15px 0; font-size: 14px; color: #555;">¿Tienes alguna pregunta? Contáctanos:</p>
                            <a href="https://wa.me/34638857294" style="display: inline-block; background: #25d366; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 20px; font-size: 13px; margin: 0 5px;">WhatsApp</a>
                            <a href="mailto:reservas@alqueriavillacarmen.com" style="display: inline-block; background: #9b59b6; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 20px; font-size: 13px; margin: 0 5px;">Email</a>
                        </td>
                    </tr>
                    <tr>
                        <td style="background: #1a1a1a; padding: 25px 40px; border-radius: 0 0 12px 12px; text-align: center;">
                            <p style="margin: 0; color: #666; font-size: 11px;">© 2024 Alquería Villa Carmen. Todos los derechos reservados.</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
`, name, surname, oldLabel, newLabel, differenceEuros, methodLabel, eventDateStr, adultsCount, childrenCount, totalAmount, qrSection)

	if err := s.sendEmail(email, subject, body); err != nil {
		log.Printf("Failed to send pack update confirmation: %v", err)
		return
	}
	log.Printf("Pack update confirmation sent to %s for booking %s", email, bookingID)
}
