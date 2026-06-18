// Package validation provides input validation utilities.
//
// Includes validators for:
//   - Email addresses
//   - Phone numbers
//   - Required fields
//   - Numeric ranges
package validation

import (
	"errors"
	"regexp"
	"strings"
)

var (
	// ErrRequired indicates a required field is missing
	ErrRequired = errors.New("field is required")
	// ErrInvalidEmail indicates an invalid email format
	ErrInvalidEmail = errors.New("invalid email format")
	// ErrInvalidPhone indicates an invalid phone number
	ErrInvalidPhone = errors.New("invalid phone number")
	// ErrInvalidRange indicates a value is out of range
	ErrInvalidRange = errors.New("value out of range")
)

// Email regex pattern (RFC 5322 simplified)
var emailRegex = regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`)

// Phone regex pattern (digits only, 6-15 characters)
var phoneRegex = regexp.MustCompile(`^\d{6,15}$`)

// ValidationError holds multiple field validation errors.
type ValidationError struct {
	Fields map[string]string `json:"fields"`
}

func (e *ValidationError) Error() string {
	return "validation failed"
}

// HasErrors returns true if there are validation errors.
func (e *ValidationError) HasErrors() bool {
	return len(e.Fields) > 0
}

// Add adds a field error.
func (e *ValidationError) Add(field, message string) {
	if e.Fields == nil {
		e.Fields = make(map[string]string)
	}
	e.Fields[field] = message
}

// NewValidationError creates a new validation error container.
func NewValidationError() *ValidationError {
	return &ValidationError{Fields: make(map[string]string)}
}

// ValidateEmail validates an email address format.
func ValidateEmail(email string) error {
	email = strings.TrimSpace(email)
	if email == "" {
		return ErrRequired
	}
	if !emailRegex.MatchString(email) {
		return ErrInvalidEmail
	}
	return nil
}

// ValidatePhone validates a phone number (digits only).
func ValidatePhone(phone string) error {
	phone = strings.TrimSpace(phone)
	if phone == "" {
		return ErrRequired
	}
	// Remove common separators
	phone = strings.ReplaceAll(phone, " ", "")
	phone = strings.ReplaceAll(phone, "-", "")
	phone = strings.ReplaceAll(phone, ".", "")
	
	if !phoneRegex.MatchString(phone) {
		return ErrInvalidPhone
	}
	return nil
}

// ValidateRequired checks if a string field is non-empty.
func ValidateRequired(value, fieldName string) error {
	if strings.TrimSpace(value) == "" {
		return ErrRequired
	}
	return nil
}

// ValidateRange checks if an integer is within a range.
func ValidateRange(value, min, max int) error {
	if value < min || value > max {
		return ErrInvalidRange
	}
	return nil
}

// ValidatePositive checks if an integer is positive (> 0).
func ValidatePositive(value int) error {
	if value <= 0 {
		return ErrInvalidRange
	}
	return nil
}

// ValidateNonNegative checks if an integer is non-negative (>= 0).
func ValidateNonNegative(value int) error {
	if value < 0 {
		return ErrInvalidRange
	}
	return nil
}

// SanitizeString trims whitespace and limits length.
func SanitizeString(s string, maxLen int) string {
	s = strings.TrimSpace(s)
	if len(s) > maxLen {
		return s[:maxLen]
	}
	return s
}

// ValidateBookingRequest validates a booking creation request.
func ValidateBookingRequest(name, surname, email, phoneCountryCode, phoneNumber string, adultsCount, childrenCount int) *ValidationError {
	errs := NewValidationError()

	if err := ValidateRequired(name, "name"); err != nil {
		errs.Add("name", "El nombre es obligatorio")
	}
	if err := ValidateRequired(surname, "surname"); err != nil {
		errs.Add("surname", "Los apellidos son obligatorios")
	}
	if err := ValidateEmail(email); err != nil {
		if err == ErrRequired {
			errs.Add("email", "El email es obligatorio")
		} else {
			errs.Add("email", "El formato del email no es válido")
		}
	}
	if err := ValidateRequired(phoneCountryCode, "phoneCountryCode"); err != nil {
		errs.Add("phoneCountryCode", "El prefijo telefónico es obligatorio")
	}
	if err := ValidatePhone(phoneNumber); err != nil {
		if err == ErrRequired {
			errs.Add("phoneNumber", "El teléfono es obligatorio")
		} else {
			errs.Add("phoneNumber", "El teléfono debe tener entre 6 y 15 dígitos")
		}
	}
	if adultsCount < 0 {
		errs.Add("adultsCount", "El número de adultos no puede ser negativo")
	}
	if childrenCount < 0 {
		errs.Add("childrenCount", "El número de niños no puede ser negativo")
	}
	if adultsCount+childrenCount == 0 {
		errs.Add("tickets", "Debe seleccionar al menos una entrada")
	}

	return errs
}
