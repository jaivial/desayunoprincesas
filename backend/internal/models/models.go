// Package models defines the data structures used throughout the application.
//
// This package contains:
//   - Database entity structs (Settings, Booking)
//   - API request/response structs
//   - Computed/derived structs (Capacity, KPIs)
package models

import (
	"database/sql"
	"time"
)

// =============================================================================
// DATABASE ENTITIES
// =============================================================================

// Settings represents the event configuration stored in the database.
// There is only one settings row (id=1) which is created on first migration.
type Settings struct {
	ID                        int            `json:"id"`
	MaxCapacity               int            `json:"maxCapacity"`               // Maximum total tickets available
	AdultPriceCents           int            `json:"adultPriceCents"`           // Adult ticket price in cents (e.g., 3500 = 35.00€)
	ChildPriceCents           int            `json:"childPriceCents"`           // Child ticket price in cents
	EventDate                 sql.NullTime   `json:"eventDate"`                 // Date and time of the event
	EventInfo                 sql.NullString `json:"eventInfo"`                 // JSON with additional event information
	EarlyBirdCount            int            `json:"earlyBirdCount"`            // Number of first bookings eligible for discount
	EarlyBirdDiscountPercent  int            `json:"earlyBirdDiscountPercent"`  // Discount percentage for early bird bookings
	MaxIndividualAdultTickets int            `json:"maxIndividualAdultTickets"` // Max individual adult tickets per purchase (0 = unlimited)
	MaxIndividualChildTickets int            `json:"maxIndividualChildTickets"` // Max individual child tickets per purchase (0 = unlimited)
	EmailProvider             string         `json:"emailProvider"`             // "smtp" or "gmail"
	SMTPHost                  sql.NullString `json:"smtpHost"`                  // SMTP server hostname
	SMTPPort                  sql.NullInt64  `json:"smtpPort"`                  // SMTP server port
	SMTPUsername              sql.NullString `json:"smtpUsername"`              // SMTP authentication username
	SMTPPasswordEncrypted     sql.NullString `json:"-"`                         // Encrypted SMTP password (never exposed via API)
	SMTPFromEmail             sql.NullString `json:"smtpFromEmail"`             // Email address for From header
	GmailUsername             sql.NullString `json:"gmailUsername"`             // Gmail address
	GmailAppPasswordEncrypted sql.NullString `json:"-"`                         // Encrypted Gmail app password
	CreatedAt                 time.Time      `json:"createdAt"`
	UpdatedAt                 time.Time      `json:"updatedAt"`
}

// PublicSettings is the subset of Settings exposed to public API.
// Excludes sensitive email configuration.
type PublicSettings struct {
	MaxCapacity               int     `json:"maxCapacity"`
	AdultPriceCents           int     `json:"adultPriceCents"`
	ChildPriceCents           int     `json:"childPriceCents"`
	EventDate                 *string `json:"eventDate"`
	EventInfo                 *string `json:"eventInfo"`
	EarlyBirdCount            int     `json:"earlyBirdCount"`
	EarlyBirdDiscountPercent  int     `json:"earlyBirdDiscountPercent"`
	MaxIndividualAdultTickets int     `json:"maxIndividualAdultTickets"`
	MaxIndividualChildTickets int     `json:"maxIndividualChildTickets"`
	PaidBookingsCount         int     `json:"paidBookingsCount"`
	Packs                     []Pack  `json:"packs"`
}

// Pack represents a special booking pack stored in the database.
// It powers both the booking wizard cards and the packs explanation accordion.
type Pack struct {
	ID               string   `json:"id"`
	Name             string   `json:"name"`
	Emoji            string   `json:"emoji"`
	Icon             string   `json:"icon"`
	Adults           int      `json:"adults"`
	Children         int      `json:"children"`
	PriceCents       int      `json:"priceCents"`
	Price            float64  `json:"price"` // Euros, derived from PriceCents
	HasPhotographer  bool     `json:"hasPhotographer"`
	HasPremiumPass   bool     `json:"hasPremiumPass"`
	ShortDescription string   `json:"shortDescription"`
	Description      string   `json:"description"`
	Persons          string   `json:"persons"`
	Color            string   `json:"color"`
	BorderColor      string   `json:"borderColor"`
	Highlight        string   `json:"highlight"`
	Premium          bool     `json:"premium"`
	Includes         []string `json:"includes"`
	DisplayOrder     int      `json:"displayOrder"`
	Active           bool     `json:"active"`
	Completed        bool     `json:"completed"` // Sold out: disables selection and shows a "Completo" ribbon
	MaxLimitEnabled  bool     `json:"maxLimitEnabled"`  // Whether a per-pack limit is enabled
	MaxTickets       int      `json:"maxTickets"`       // Maximum number of packs allowed when the limit is enabled
	SoldTickets      int      `json:"soldTickets"`      // Number of packs already sold (paid bookings)
	AvailableTickets int      `json:"availableTickets"` // Remaining packs when the limit is enabled
}

// PackInput is the payload for creating or updating a pack via settings.
type PackInput struct {
	ID               string   `json:"id"`
	Name             string   `json:"name"`
	Emoji            string   `json:"emoji"`
	Icon             string   `json:"icon"`
	Adults           int      `json:"adults"`
	Children         int      `json:"children"`
	PriceCents       int      `json:"priceCents"`
	HasPhotographer  bool     `json:"hasPhotographer"`
	HasPremiumPass   bool     `json:"hasPremiumPass"`
	ShortDescription string   `json:"shortDescription"`
	Description      string   `json:"description"`
	Persons          string   `json:"persons"`
	Color            string   `json:"color"`
	BorderColor      string   `json:"borderColor"`
	Highlight        string   `json:"highlight"`
	Premium          bool     `json:"premium"`
	Includes         []string `json:"includes"`
	DisplayOrder     int      `json:"displayOrder"`
	Active           *bool    `json:"active"`
	Completed        bool     `json:"completed"`
	MaxLimitEnabled  bool     `json:"maxLimitEnabled"`
	MaxTickets       int      `json:"maxTickets"`
}

// Booking represents a ticket reservation in the database.
// Bookings go through states: pending -> paid (or failed/refunded).
type Booking struct {
	ID                      string         `json:"id"`                      // UUID primary key
	Name                    string         `json:"name"`                    // Buyer's first name
	Surname                 string         `json:"surname"`                 // Buyer's last name
	Email                   string         `json:"email"`                   // Buyer's email
	PhoneCountryCode        string         `json:"phoneCountryCode"`        // Phone country code (e.g., "+34")
	PhoneNumber             string         `json:"phoneNumber"`             // Phone number without country code
	AdultsCount             int            `json:"adultsCount"`             // Number of adult tickets
	ChildrenCount           int            `json:"childrenCount"`           // Number of child tickets
	PackType                sql.NullString `json:"packType"`                // Pack type if booking is a pack
	HasPhotographer         bool           `json:"hasPhotographer"`         // Whether pack includes photographer
	HasPremiumPass          bool           `json:"hasPremiumPass"`          // Whether pack includes premium pass
	AdultPriceCents         int            `json:"adultPriceCents"`         // Price per adult at time of booking
	ChildPriceCents         int            `json:"childPriceCents"`         // Price per child at time of booking
	TotalAmountCents        int            `json:"totalAmountCents"`        // Total amount (adults*price + children*price)
	PaymentStatus           string         `json:"paymentStatus"`           // "pending", "paid", "failed", "refunded"
	PaymentMethod           string         `json:"paymentMethod"`           // "stripe" or "cash"
	StripeCheckoutSessionID sql.NullString `json:"stripeCheckoutSessionId"` // Stripe Checkout session ID
	StripePaymentIntentID   sql.NullString `json:"stripePaymentIntentId"`   // Stripe PaymentIntent ID after payment
	QRToken                 string         `json:"qrToken"`                 // Unique token for QR code (UUID)
	QRCodeURL               sql.NullString `json:"qrCodeUrl"`               // BunnyCDN URL of the QR code image
	ConfirmedAssistance     bool           `json:"confirmedAssistance"`     // Whether attendance was confirmed via QR scan
	ConfirmedAt             sql.NullTime   `json:"confirmedAt"`             // Timestamp of attendance confirmation
	CreatedAt               time.Time      `json:"createdAt"`
	UpdatedAt               time.Time      `json:"updatedAt"`
	DeletedAt               sql.NullTime   `json:"-"` // Soft delete timestamp
}

// =============================================================================
// COMPUTED/DERIVED STRUCTS
// =============================================================================

// Capacity represents the current ticket availability.
// Computed from settings.max_capacity minus paid bookings.
type Capacity struct {
	MaxCapacity      int `json:"maxCapacity"`      // Maximum from settings
	SoldTickets      int `json:"soldTickets"`      // Sum of tickets from paid bookings
	AvailableTickets int `json:"availableTickets"` // MaxCapacity - SoldTickets
}

// KPIs represents key performance indicators for the admin dashboard.
type KPIs struct {
	TotalTicketsSold    int `json:"totalTicketsSold"`    // Total tickets (adults + children) sold
	TotalAmountEarned   int `json:"totalAmountEarned"`   // Total revenue in cents
	AmountPaidOnline    int `json:"amountPaidOnline"`    // Revenue from Stripe payments
	AmountPaidCash      int `json:"amountPaidCash"`      // Revenue from cash payments
	TotalAdultTickets   int `json:"totalAdultTickets"`   // Total adult tickets sold
	TotalChildTickets   int `json:"totalChildTickets"`   // Total child tickets sold
	AvailableCapacity   int `json:"availableCapacity"`   // Remaining tickets
	ConfirmedAttendance int `json:"confirmedAttendance"` // Bookings with confirmed attendance
}

// =============================================================================
// API REQUEST STRUCTS
// =============================================================================

// MemberAllergy represents allergy information for a single member in a booking.
type MemberAllergy struct {
	ID          int      `json:"id"`
	BookingID   string   `json:"bookingId"`
	MemberType  string   `json:"memberType"`  // "adult" or "child"
	MemberIndex int      `json:"memberIndex"` // 0-based index
	Name        string   `json:"name"`
	Lastname    string   `json:"lastname"`
	Allergies   []string `json:"allergies"` // Array of allergen IDs
}

// MemberAllergyInput is the input for creating member allergies.
type MemberAllergyInput struct {
	MemberType  string   `json:"memberType"`
	MemberIndex int      `json:"memberIndex"`
	Name        string   `json:"name"`
	Lastname    string   `json:"lastname"`
	Allergies   []string `json:"allergies"`
}

// BookingItem represents one line of a booking: either a pack (with quantity)
// or a group of individual (non-pack) tickets. A single booking can combine
// several packs and individual tickets at once.
type BookingItem struct {
	ID              int            `json:"id"`
	BookingID       string         `json:"bookingId"`
	ItemType        string         `json:"itemType"` // "pack" or "individual"
	PackType        sql.NullString `json:"-"`
	PackName        sql.NullString `json:"-"`
	Adults          int            `json:"adults"`   // per single unit (pack) or total (individual)
	Children        int            `json:"children"` // per single unit (pack) or total (individual)
	HasPhotographer bool           `json:"hasPhotographer"`
	HasPremiumPass  bool           `json:"hasPremiumPass"`
	Quantity        int            `json:"quantity"`
	UnitPriceCents  int            `json:"unitPriceCents"`
	LineTotalCents  int            `json:"lineTotalCents"`
}

// BookingItemInput is one item submitted by the client when creating a booking.
type BookingItemInput struct {
	ItemType      string `json:"itemType"`      // "pack" or "individual"
	PackType      string `json:"packType"`      // required when itemType == "pack"
	Quantity      int    `json:"quantity"`      // pack quantity (defaults to 1)
	AdultsCount   int    `json:"adultsCount"`   // individual tickets only
	ChildrenCount int    `json:"childrenCount"` // individual tickets only
}

// CreateBookingRequest is the payload for creating a new booking.
// Items is the preferred way to describe the purchase (multiple packs and/or
// individual tickets). The legacy PackType/AdultsCount/ChildrenCount fields are
// still accepted as a fallback when Items is empty.
type CreateBookingRequest struct {
	Name             string               `json:"name"`
	Surname          string               `json:"surname"`
	Email            string               `json:"email"`
	PhoneCountryCode string               `json:"phoneCountryCode"`
	PhoneNumber      string               `json:"phoneNumber"`
	AdultsCount      int                  `json:"adultsCount"`
	ChildrenCount    int                  `json:"childrenCount"`
	PackType         string               `json:"packType"`
	HasPhotographer  bool                 `json:"hasPhotographer"`
	HasPremiumPass   bool                 `json:"hasPremiumPass"`
	Items            []BookingItemInput   `json:"items"`
	MemberAllergies  []MemberAllergyInput `json:"memberAllergies"`
}

// UpdateBookingRequest is the payload for updating a booking (admin).
// All fields are optional (pointers).
type UpdateBookingRequest struct {
	Name          *string `json:"name"`
	Surname       *string `json:"surname"`
	Email         *string `json:"email"`
	PhoneCountryCode *string `json:"phoneCountryCode"`
	PhoneNumber   *string `json:"phoneNumber"`
	AdultsCount   *int    `json:"adultsCount"`
	ChildrenCount *int    `json:"childrenCount"`
	PaymentStatus *string `json:"paymentStatus"`
	PaymentMethod *string `json:"paymentMethod"`
}

// UpdateSettingsRequest is the payload for updating settings (admin).
// All fields are optional (pointers).
type UpdateSettingsRequest struct {
	MaxCapacity               *int    `json:"maxCapacity"`
	AdultPriceCents           *int    `json:"adultPriceCents"`
	ChildPriceCents           *int    `json:"childPriceCents"`
	EventDate                 *string `json:"eventDate"`
	EventInfo                 *string `json:"eventInfo"`
	EarlyBirdCount            *int    `json:"earlyBirdCount"`
	EarlyBirdDiscountPercent  *int    `json:"earlyBirdDiscountPercent"`
	MaxIndividualAdultTickets *int    `json:"maxIndividualAdultTickets"`
	MaxIndividualChildTickets *int    `json:"maxIndividualChildTickets"`
	EmailProvider             *string `json:"emailProvider"`
	SMTPHost                  *string `json:"smtpHost"`
	SMTPPort                  *int    `json:"smtpPort"`
	SMTPUsername              *string `json:"smtpUsername"`
	SMTPPassword              *string `json:"smtpPassword"`
	SMTPFromEmail             *string `json:"smtpFromEmail"`
	GmailUsername             *string `json:"gmailUsername"`
	GmailAppPassword          *string `json:"gmailAppPassword"`
	Packs                     []PackInput `json:"packs"`
}
