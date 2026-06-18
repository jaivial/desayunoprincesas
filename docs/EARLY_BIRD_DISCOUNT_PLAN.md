# Plan: Early Bird Discount Feature

## Status: IMPLEMENTED ✅

## Overview
Add configurable early bird discount for the first X bookings. Admins can set from backoffice:
- Number of first bookings eligible for discount
- Discount percentage to apply

## Files Modified

### 1. Backend (Go)

#### `backend/internal/db/db.go`
- [x] Added migration for new columns in `settings` table:
  ```sql
  early_bird_count INT NOT NULL DEFAULT 0,
  early_bird_discount_percent INT NOT NULL DEFAULT 0
  ```

#### `backend/internal/models/models.go`
- [x] Added fields to `Settings` struct
- [x] Added fields to `PublicSettings` struct + `PaidBookingsCount`
- [x] Added fields to `UpdateSettingsRequest` struct

#### `backend/internal/handlers/handlers.go`
- [x] Updated `GetPublicSettings` to include early bird fields + current booking count
- [x] Updated `GetSettings` (admin) to include early bird fields
- [x] Updated `UpdateSettings` to handle new fields with validation
- [x] Modified `CreateStripeCheckout` to calculate discounted price if booking qualifies

---

### 2. Backoffice (React)

#### `desayuno-backoffice/src/pages/SettingsPage.jsx`
- [x] Added new section "Descuento Early Bird" after "Precios" section
- [x] Added form fields for count and percentage
- [x] Added to form state initialization
- [x] Included in handleSubmit data

---

### 3. Frontend (React)

#### `frontend/src/components/booking/BookingSummary.jsx`
- [x] Checks if early bird applies: `paidBookingsCount < earlyBirdCount`
- [x] Calculates discounted prices if applicable
- [x] Shows original price with strikethrough + discounted price
- [x] Displays "Descuento Early Bird" banner with remaining slots
- [x] Shows discount line item in summary

---

## API Response Examples

### GET `/api/public/settings`
```json
{
  "maxCapacity": 120,
  "adultPriceCents": 3500,
  "childPriceCents": 4000,
  "earlyBirdCount": 15,
  "earlyBirdDiscountPercent": 10,
  "paidBookingsCount": 8
}
```

### PATCH `/api/admin/settings`
```json
{
  "earlyBirdCount": 15,
  "earlyBirdDiscountPercent": 10
}
```

---

## How It Works

1. Admin sets early bird count (e.g., 15) and discount (e.g., 10%) in backoffice
2. Frontend checks if `paidBookingsCount < earlyBirdCount`
3. If yes, shows discount banner and applies discount to displayed prices
4. Backend re-checks at checkout time and applies discount to Stripe line items
5. Stripe checkout shows discounted prices with "Early Bird" label

---

## Validation Rules

| Field | Min | Max | Default |
|-------|-----|-----|---------|
| earlyBirdCount | 0 | unlimited | 0 |
| earlyBirdDiscountPercent | 0 | 100 | 0 |

Setting `earlyBirdCount = 0` disables the feature.
