// Package db handles database connections and migrations.
//
// Uses MySQL with the go-sql-driver/mysql driver.
// Migrations run automatically on server start.
package db

import (
	"database/sql"
	"encoding/json"
	"fmt"

	_ "github.com/go-sql-driver/mysql"
)

// Connect establishes a connection to the MySQL database.
// Returns an error if the connection fails.
func Connect(dsn string) (*sql.DB, error) {
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	// Connection pool settings
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)

	return db, nil
}

// Migrate runs all database migrations.
// Creates tables if they don't exist and seeds initial data.
func Migrate(db *sql.DB) error {
	migrations := []string{
		// Settings table - stores event configuration
		`CREATE TABLE IF NOT EXISTS settings (
			id INT PRIMARY KEY AUTO_INCREMENT,
			max_capacity INT NOT NULL DEFAULT 120,
			adult_price_cents INT NOT NULL DEFAULT 3500,
			child_price_cents INT NOT NULL DEFAULT 4000,
			event_date DATETIME NULL,
			event_info JSON NULL,
			email_provider VARCHAR(20) NOT NULL DEFAULT 'smtp',
			smtp_host VARCHAR(255) NULL,
			smtp_port INT NULL,
			smtp_username VARCHAR(255) NULL,
			smtp_password_encrypted TEXT NULL,
			smtp_from_email VARCHAR(255) NULL,
			gmail_username VARCHAR(255) NULL,
			gmail_app_password_encrypted TEXT NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
		)`,

		// Bookings table - stores ticket reservations
		`CREATE TABLE IF NOT EXISTS bookings (
			id CHAR(36) PRIMARY KEY,
			name VARCHAR(120) NOT NULL,
			surname VARCHAR(120) NOT NULL,
			email VARCHAR(255) NOT NULL,
			phone_country_code VARCHAR(10) NOT NULL,
			phone_number VARCHAR(20) NOT NULL,
			adults_count INT NOT NULL DEFAULT 0,
			children_count INT NOT NULL DEFAULT 0,
			adult_price_cents INT NOT NULL,
			child_price_cents INT NOT NULL,
			total_amount_cents INT NOT NULL,
			payment_status VARCHAR(30) NOT NULL DEFAULT 'pending',
			payment_method VARCHAR(30) NOT NULL DEFAULT 'stripe',
			stripe_checkout_session_id VARCHAR(255) NULL,
			stripe_payment_intent_id VARCHAR(255) NULL,
			qr_token VARCHAR(255) NOT NULL,
			qr_code_url VARCHAR(512) NULL,
			confirmed_assistance BOOLEAN NOT NULL DEFAULT FALSE,
			confirmed_at DATETIME NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			deleted_at DATETIME NULL,
			UNIQUE KEY idx_qr_token (qr_token),
			KEY idx_payment_status (payment_status),
			KEY idx_created_at (created_at),
			KEY idx_email (email)
		)`,



		// Admin users table - stores backoffice users
		`CREATE TABLE IF NOT EXISTS admin_users (
			id INT PRIMARY KEY AUTO_INCREMENT,
			username VARCHAR(50) NOT NULL UNIQUE,
			email VARCHAR(255) NOT NULL UNIQUE,
			password_hash VARCHAR(255) NOT NULL,
			role VARCHAR(20) NOT NULL DEFAULT 'admin',
			last_login_at DATETIME NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			deleted_at DATETIME NULL
		)`,

		// Audit log table - tracks admin actions
		`CREATE TABLE IF NOT EXISTS audit_logs (
			id INT PRIMARY KEY AUTO_INCREMENT,
			admin_user_id INT NULL,
			action VARCHAR(50) NOT NULL,
			entity_type VARCHAR(50) NOT NULL,
			entity_id VARCHAR(36) NULL,
			details JSON NULL,
			ip_address VARCHAR(45) NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			KEY idx_admin_user (admin_user_id),
			KEY idx_action (action),
			KEY idx_created_at (created_at)
		)`,

		// Packs table - stores special booking packs shown on the landing page
		`CREATE TABLE IF NOT EXISTS packs (
			id VARCHAR(50) PRIMARY KEY,
			name VARCHAR(120) NOT NULL,
			emoji VARCHAR(20) NOT NULL DEFAULT '',
			icon VARCHAR(40) NOT NULL DEFAULT '',
			adults INT NOT NULL DEFAULT 1,
			children INT NOT NULL DEFAULT 1,
			price_cents INT NOT NULL DEFAULT 0,
			has_photographer BOOLEAN NOT NULL DEFAULT FALSE,
			has_premium_pass BOOLEAN NOT NULL DEFAULT FALSE,
			short_description TEXT NULL,
			description TEXT NULL,
			persons VARCHAR(120) NOT NULL DEFAULT '',
			color VARCHAR(120) NOT NULL DEFAULT '',
			border_color VARCHAR(120) NOT NULL DEFAULT '',
			highlight VARCHAR(120) NOT NULL DEFAULT '',
			premium BOOLEAN NOT NULL DEFAULT FALSE,
			includes JSON NULL,
			display_order INT NOT NULL DEFAULT 0,
			active BOOLEAN NOT NULL DEFAULT TRUE,
			completed BOOLEAN NOT NULL DEFAULT FALSE,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
		)`,

		// Pack max limits table - optional per-pack ticket capacity limit
		`CREATE TABLE IF NOT EXISTS packs_max_limits (
			id INT PRIMARY KEY AUTO_INCREMENT,
			pack_id VARCHAR(50) NOT NULL UNIQUE,
			enabled BOOLEAN NOT NULL DEFAULT FALSE,
			max_tickets INT NOT NULL DEFAULT 0,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			KEY idx_pack_id (pack_id)
		)`,

		// Booking items table - stores each line of a booking (packs with quantity
		// and/or groups of individual tickets). Allows combining several packs and
		// individual tickets in the same purchase.
		`CREATE TABLE IF NOT EXISTS booking_items (
			id INT PRIMARY KEY AUTO_INCREMENT,
			booking_id CHAR(36) NOT NULL,
			item_type VARCHAR(20) NOT NULL DEFAULT 'pack',
			pack_type VARCHAR(50) NULL,
			pack_name VARCHAR(120) NULL,
			adults INT NOT NULL DEFAULT 0,
			children INT NOT NULL DEFAULT 0,
			has_photographer BOOLEAN NOT NULL DEFAULT FALSE,
			has_premium_pass BOOLEAN NOT NULL DEFAULT FALSE,
			quantity INT NOT NULL DEFAULT 1,
			unit_price_cents INT NOT NULL DEFAULT 0,
			line_total_cents INT NOT NULL DEFAULT 0,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			KEY idx_booking_id (booking_id),
			KEY idx_pack_type (pack_type),
			FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
		)`,

		// Member allergies table - stores allergies for each member in a booking
		`CREATE TABLE IF NOT EXISTS member_allergies (
			id INT PRIMARY KEY AUTO_INCREMENT,
			booking_id CHAR(36) NOT NULL,
			member_type VARCHAR(10) NOT NULL,
			member_index INT NOT NULL,
			name VARCHAR(120) NOT NULL,
			lastname VARCHAR(120) NOT NULL,
			allergies JSON NOT NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			KEY idx_booking_id (booking_id),
			FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
		)`,

		// Seed default settings if not exists
		`INSERT IGNORE INTO settings (id, max_capacity, adult_price_cents, child_price_cents) 
		 VALUES (1, 120, 3500, 4000)`,

		// Seed default admin user (password: admin123) - CHANGE IN PRODUCTION
		`INSERT IGNORE INTO admin_users (id, username, email, password_hash, role) 
		 VALUES (1, 'admin', 'admin@desayunoconprincesas.com', 
		 '$2a$10$MxVhR.6BiGqhqczfYYACn.dJhiaxmPHHuCoApOO4kzhT4Qiq0HcWi', 'admin')`,
	}

	for _, m := range migrations {
		if _, err := db.Exec(m); err != nil {
			return fmt.Errorf("migration failed: %w", err)
		}
	}

	// Optional migrations (ignore errors for existing columns/indexes)
	optionalMigrations := []string{
		`ALTER TABLE bookings ADD COLUMN qr_code_url VARCHAR(512) NULL AFTER qr_token`,
		`ALTER TABLE bookings ADD UNIQUE INDEX idx_stripe_session (stripe_checkout_session_id)`,
		`ALTER TABLE settings ADD COLUMN early_bird_count INT NOT NULL DEFAULT 0`,
		`ALTER TABLE settings ADD COLUMN early_bird_discount_percent INT NOT NULL DEFAULT 0`,
		`ALTER TABLE bookings ADD COLUMN pack_type VARCHAR(50) NULL AFTER children_count`,
		`ALTER TABLE bookings ADD COLUMN has_photographer BOOLEAN NOT NULL DEFAULT FALSE AFTER pack_type`,
		`ALTER TABLE bookings ADD COLUMN has_premium_pass BOOLEAN NOT NULL DEFAULT FALSE AFTER has_photographer`,
		`ALTER TABLE packs ADD COLUMN completed BOOLEAN NOT NULL DEFAULT FALSE AFTER active`,
		// Convert legacy Tailwind-class colors to hex values so the picker and inline
		// styles work. Guarded by LIKE 'from-%' so admin edits are never overwritten.
		`UPDATE packs SET color='#ec4899,#a855f7', border_color='#ec4899' WHERE id='encantado' AND color LIKE 'from-%'`,
		`UPDATE packs SET color='#3b82f6,#a855f7', border_color='#3b82f6' WHERE id='reino_encantado' AND color LIKE 'from-%'`,
		`UPDATE packs SET color='#f59e0b,#f97316', border_color='#f59e0b' WHERE id='recuerdo_real_1' AND color LIKE 'from-%'`,
		`UPDATE packs SET color='#f59e0b,#f97316', border_color='#f59e0b' WHERE id='recuerdo_real_2' AND color LIKE 'from-%'`,
		`UPDATE packs SET color='#a855f7,#ec4899', border_color='#a855f7' WHERE id='cuento_ensueno_1' AND color LIKE 'from-%'`,
		`UPDATE packs SET color='#a855f7,#ec4899', border_color='#a855f7' WHERE id='cuento_ensueno_2' AND color LIKE 'from-%'`,
		// Individual ticket limits per purchase
		`ALTER TABLE settings ADD COLUMN max_individual_adult_tickets INT NOT NULL DEFAULT 0`,
		`ALTER TABLE settings ADD COLUMN max_individual_child_tickets INT NOT NULL DEFAULT 0`,
	}
	for _, m := range optionalMigrations {
		db.Exec(m) // Ignore errors (column/index may already exist)
	}

	if err := seedPacks(db); err != nil {
		return fmt.Errorf("seed packs failed: %w", err)
	}

	return nil
}

// seedPack describes the default data for a special booking pack.
type seedPack struct {
	id              string
	name            string
	emoji           string
	icon            string
	adults          int
	children        int
	priceCents      int
	hasPhotographer bool
	hasPremiumPass  bool
	shortDesc       string
	description     string
	persons         string
	color           string
	borderColor     string
	highlight       string
	premium         bool
	includes        []string
	order           int
}

// seedPacks inserts the default packs if they are not already present.
// Existing packs are never overwritten (INSERT IGNORE), so admin edits persist.
func seedPacks(db *sql.DB) error {
	packs := []seedPack{
		{
			id: "encantado", name: "Pack Encantado", emoji: "👑✨", icon: "Sparkles",
			adults: 1, children: 1, priceCents: 7500,
			shortDesc:   "Desayuno Real + show + fotocall + libro de recuerdos + globoflexia",
			description: "La opción perfecta para disfrutar de una mañana mágica con tu pequeño/a. Todo lo necesario para vivir la experiencia completa del Desayuno Real.",
			persons:     "1 adulto + 1 niño/a", color: "#ec4899,#a855f7", borderColor: "#ec4899",
			includes: []string{
				"Desayuno Real completo (menú mágico para adulto y niño/a)",
				"Show e interacción con las 4 princesas (Bella, Blancanieves, Ariel y Jasmine)",
				"Acceso al fotocall temático",
				"Firma del libro de recuerdos con las princesas",
				"Globoflexia y sorpresas",
			}, order: 1,
		},
		{
			id: "reino_encantado", name: "Pack Reino Encantado", emoji: "🏰✨", icon: "Castle",
			adults: 1, children: 2, priceCents: 11000,
			shortDesc:   "Desayuno Real + show + fotocall + libro de recuerdos + globoflexia",
			description: "Pensado especialmente para familias con dos pequeños. Hermanos, primos o amigos podrán vivir juntos esta experiencia mágica de cuento.",
			persons:     "1 adulto + 2 niños/as", color: "#3b82f6,#a855f7", borderColor: "#3b82f6",
			includes: []string{
				"Desayuno Real completo (menú mágico para adulto y 2 niños/as)",
				"Show e interacción con las 4 princesas (Bella, Blancanieves, Ariel y Jasmine)",
				"Acceso al fotocall temático",
				"Firma del libro de recuerdos con las princesas",
				"Globoflexia y sorpresas",
			}, order: 2,
		},
		{
			id: "recuerdo_real_1", name: "Pack Recuerdo Real 1", emoji: "📸👑", icon: "Camera",
			adults: 1, children: 1, priceCents: 10000, hasPhotographer: true,
			shortDesc:   "Pack Encantado + fotógrafo profesional + galería privada",
			description: "Porque algunos momentos merecen conservarse para siempre. Este pack añade la cobertura de nuestro fotógrafo profesional.",
			persons:     "1 adulto + 1 niño/a", color: "#f59e0b,#f97316", borderColor: "#f59e0b", highlight: "Incluye fotógrafo",
			includes: []string{
				"Todo lo incluido en el Pack Encantado",
				"📸 Cobertura fotográfica profesional durante todo el evento",
				"📸 Galería privada con todas las fotos en alta resolución",
			}, order: 3,
		},
		{
			id: "recuerdo_real_2", name: "Pack Recuerdo Real 2", emoji: "📸👑", icon: "Camera",
			adults: 1, children: 2, priceCents: 15000, hasPhotographer: true,
			shortDesc:   "Pack Reino Encantado + fotógrafo profesional + galería privada",
			description: "La versión familiar del Pack Recuerdo Real, perfecta para capturar los momentos mágicos de tus dos pequeños con las princesas.",
			persons:     "1 adulto + 2 niños/as", color: "#f59e0b,#f97316", borderColor: "#f59e0b", highlight: "Incluye fotógrafo",
			includes: []string{
				"Todo lo incluido en el Pack Reino Encantado",
				"📸 Cobertura fotográfica profesional de ambos niños durante todo el evento",
				"📸 Galería privada con todas las fotos en alta resolución",
			}, order: 4,
		},
		{
			id: "cuento_ensueno_1", name: "Pack Cuento de Ensueño 1", emoji: "👑🌹✨", icon: "Crown",
			adults: 1, children: 1, priceCents: 15000, hasPhotographer: true, hasPremiumPass: true,
			shortDesc:   "Recuerdo Real 1 + Meet the Queens + sesión privada exclusiva",
			description: "Nuestra experiencia más exclusiva y personalizada. Tu pequeño/a será el/la protagonista absoluto/a con un encuentro privado con su princesa favorita.",
			persons:     "1 adulto + 1 niño/a", color: "#a855f7,#ec4899", borderColor: "#a855f7", highlight: "Premium + Fotógrafo", premium: true,
			includes: []string{
				"Todo lo incluido en el Pack Recuerdo Real 1",
				"⭐ EXCLUSIVO: \"Meet the Queens\" - Encuentro especial con las princesas",
				"⭐ EXCLUSIVO: Sesión fotográfica privada con la princesa favorita",
				"⭐ EXCLUSIVO: Galería exclusiva con las fotos de la sesión privada",
			}, order: 5,
		},
		{
			id: "cuento_ensueno_2", name: "Pack Cuento de Ensueño 2", emoji: "👑🌹✨", icon: "Crown",
			adults: 1, children: 2, priceCents: 20000, hasPhotographer: true, hasPremiumPass: true,
			shortDesc:   "Recuerdo Real 2 + Meet the Queens + sesión privada para cada niño",
			description: "La experiencia premium definitiva para que cada uno de tus pequeños sea protagonista de su propio cuento de hadas.",
			persons:     "1 adulto + 2 niños/as", color: "#a855f7,#ec4899", borderColor: "#a855f7", highlight: "Premium + Fotógrafo", premium: true,
			includes: []string{
				"Todo lo incluido en el Pack Recuerdo Real 2",
				"⭐ EXCLUSIVO: \"Meet the Queens\" - Encuentro especial con las princesas",
				"⭐ EXCLUSIVO: Sesión fotográfica privada con las princesas para CADA niño/a",
				"⭐ EXCLUSIVO: Galería exclusiva con las fotos de las sesiones privadas",
			}, order: 6,
		},
	}

	const q = `INSERT IGNORE INTO packs
		(id, name, emoji, icon, adults, children, price_cents, has_photographer, has_premium_pass,
		 short_description, description, persons, color, border_color, highlight, premium, includes, display_order, active)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)`

	for _, p := range packs {
		includesJSON, err := json.Marshal(p.includes)
		if err != nil {
			return err
		}
		if _, err := db.Exec(q, p.id, p.name, p.emoji, p.icon, p.adults, p.children, p.priceCents,
			p.hasPhotographer, p.hasPremiumPass, p.shortDesc, p.description, p.persons, p.color,
			p.borderColor, p.highlight, p.premium, string(includesJSON), p.order); err != nil {
			return err
		}
	}
	return nil
}
