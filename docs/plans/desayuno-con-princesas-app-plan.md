# Plan: Desayuno con princesas website app

## 1. Goal
Build full-stack event platform for **Desayuno con princesas**:

- Public landing page to present event, schedules, prices, activities, included items, tickets.
- Ticket purchase flow with live capacity validation.
- Stripe Checkout payment.
- Payment success page with booking summary, QR code, confetti.
- Backoffice app for KPIs, bookings, QR attendance scan, settings.
- Go backend with REST API, WebSockets, MySQL, Stripe, SMTP/Gmail email sending.

## 2. Projects

```txt
desayunoconprincesas/
├── frontend/              # Public landing app: React + Vite + Redux + Tailwind v3
├── desayuno-backoffice/   # Admin app: React + Vite + Redux + Tailwind v3
├── backend/               # Go API + WebSockets
├── docs/
│   └── plans/
└── docker-compose.yml     # Optional local MySQL/dev services
```

## 3. Tech stack

### Frontend landing
- React
- Vite
- Tailwind CSS v3
- Redux Toolkit
- React Router
- Lucide React icons
- Stripe redirect checkout
- QR display on success page
- Confetti animation
- WebSocket client for live capacity/ticket availability

### Backoffice
- React
- Vite
- Tailwind CSS v3
- Redux Toolkit
- React Router
- QR scanner library using camera
- Tables, filters, dialogs, accordions

### Backend
- Go
- REST API
- WebSockets
- MySQL
- Stripe payment gateway
- SMTP email sending
- Gmail app password email sending
- QR booking token generation

### Database
- MySQL
- Local credentials requested:
  - user: `root`
  - password: `myth`

## 4. Core domain entities

### Settings
Stores values editable from backoffice:
- max capacity
- adult ticket price
- child ticket price
- event date
- event schedule metadata
- SMTP host, port, username, password, from address
- Gmail app password settings
- active email provider

### Booking / Inscripción
Fields:
- booking ID
- name
- surname
- email
- phone country extension
- phone number
- adults count
- children count
- total tickets
- adult unit price
- child unit price
- total amount
- payment status: pending, paid, failed, refunded
- payment method: stripe, cash
- Stripe checkout session ID
- Stripe payment intent ID
- QR token
- confirmed assistance boolean
- confirmation timestamp
- created at
- updated at

### Capacity
Derived from settings and paid/reserved bookings:
- max capacity
- sold tickets
- available tickets
- live updates via WebSocket

## 5. Public landing page sections

### 5.1 Navbar
Desktop:
- Logo / event name
- Links to sections
- CTA: Buy tickets

Mobile:
- Header with menu button
- Side navigation drawer
- Smooth scroll links
- CTA

### 5.2 Hero section
Requirements:
- Full viewport height
- Rotating background images
- Fade transition every 2 seconds
- 70% opacity black overlay
- Foreground content:
  - title
  - subtitle
  - event date from backend settings
  - CTA to buy tickets
- Magic/Disneyland-inspired visual feel
- Glassmorphism content card optional

### 5.3 Visual delight section
Purpose:
- Attract users with event imagery.

Content:
- Responsive image grid/carousel
- Princess/event atmosphere cards
- Glass overlays
- Lucide decorative icons

### 5.4 Schedules, activities, dates, more info
Content from backend/settings where needed:
- event date
- opening time
- breakfast time
- princess activities
- photo session
- show / animation timing
- location info if available

### 5.5 What event includes
Display list/cards:
- breakfast
- princess experience
- activities
- photos
- surprises
- any included gift/accessory

Use icons, glass cards, responsive flexbox.

### 5.6 Buy tickets section
Multistep onboarding.

#### Step 1: Ticket counters
- Adult counter:
  - minus button with icon
  - count in center
  - plus button with icon
  - price from backend settings, default 35€
- Child counter:
  - minus button with icon
  - count in center
  - plus button with icon
  - price from backend settings, default 40€
- Summary below:
  - adult tickets subtotal
  - child tickets subtotal
  - total tickets
  - total amount
- Capacity rules:
  - fetch initial capacity via REST API
  - subscribe to WebSocket for live capacity changes
  - prevent total selected tickets from exceeding available capacity
  - if sold out, show fallback with magic/sad icon and message to follow social media for future dates

#### Step 2: Buyer form
Fields:
- name
- surname
- phone country extension selector
- phone number with 9 OTP-style digit boxes
- email

Validation:
- required name/surname
- 9 phone digits
- valid email
- at least 1 ticket selected
- selected count <= current available capacity

#### Step 3: Booking summary + legal accept
Display:
- buyer data
- ticket counts
- prices
- total amount
- event date

Legal:
- checkbox to accept privacy policy
- checkbox or combined acceptance for conditions & terms
- `Pay tickets` button disabled until accepted

Action:
- call backend to create pending booking and Stripe Checkout session
- redirect user to Stripe Checkout

### 5.7 Payment success page
Route: `/payment_success`

Content:
- confetti
- success title
- booking summary fetched by booking ID/session ID
- generated QR linked to booking ID or secure QR token
- ticket counts
- buyer info
- total paid
- event date
- instructions to show QR at entrance

## 6. Backoffice app: desayuno-backoffice

### 6.1 Auth note
Plan should include admin auth before production:
- login page
- JWT/session auth
- protected routes
- role for admin

### 6.2 Home page
KPIs:
- total tickets sold
- total amount earned
- amount paid online
- amount paid cash
- total adult tickets
- total child tickets
- available capacity
- confirmed attendance count

### 6.3 Inscripciones page
Table columns:
- name
- email
- phone
- adults count
- children count
- status paid
- payment method
- quantity paid
- date of inscription
- confirmed assistance
- actions

Actions:
- edit booking
- delete booking with confirmation dialog
- re-send confirmation email

Filters section:
- collapsible accordion
- collapsed by default
- filters for all practical columns:
  - name
  - email
  - phone
  - payment status
  - payment method
  - confirmed assistance
  - date range
  - adult count range
  - child count range
  - amount range

### 6.4 QR reader page
Purpose:
- scan booking QR at event entrance
- call backend confirmation endpoint
- mark confirmed assistance

Flow:
1. Open camera scanner.
2. Decode QR token.
3. Send token to backend.
4. Backend validates booking.
5. Backend marks assistance confirmed if valid and not already confirmed.
6. Navigate to confirmation page.

### 6.5 QR confirmation page
Display:
- confetti
- attendance confirmed message
- booking info:
  - name
  - adult count
  - children count
  - amount paid
  - payment status
  - payment method
  - total pulseras = adults + children
  - email
  - phone
- warning if QR was already used

### 6.6 Settings page
Editable settings:
- max capacity count
- adult ticket price
- child ticket price
- event date
- event schedule/info
- SMTP settings
- Gmail app password settings
- selected email provider

Settings save to MySQL via Go backend.
Frontend landing must consume settings; no hardcoded production values.

## 7. Backend modules

### 7.1 REST API
Suggested endpoints:

```txt
GET    /api/public/settings
GET    /api/public/capacity
POST   /api/public/bookings
GET    /api/public/bookings/:id
POST   /api/public/stripe/checkout
POST   /api/webhooks/stripe

GET    /api/admin/kpis
GET    /api/admin/bookings
GET    /api/admin/bookings/:id
PATCH  /api/admin/bookings/:id
DELETE /api/admin/bookings/:id
POST   /api/admin/bookings/:id/resend-email
POST   /api/admin/qr/confirm
GET    /api/admin/settings
PATCH  /api/admin/settings
```

### 7.2 WebSocket
Endpoint:

```txt
/ws/capacity
```

Broadcast events:

```json
{
  "type": "capacity.updated",
  "maxCapacity": 120,
  "soldTickets": 45,
  "availableTickets": 75
}
```

Trigger broadcasts when:
- Stripe payment succeeds
- booking is deleted/refunded
- cash booking is marked paid
- max capacity changes

### 7.3 Stripe flow
1. Frontend sends booking data and ticket counts.
2. Backend validates capacity using DB transaction.
3. Backend creates pending booking.
4. Backend creates Stripe Checkout session.
5. Frontend redirects to Stripe.
6. Stripe webhook confirms payment.
7. Backend marks booking paid.
8. Backend generates/saves QR token if not already present.
9. Backend sends confirmation email.
10. Backend broadcasts capacity update.
11. Stripe success URL redirects to `/payment_success?bookingId=...` or session reference.

### 7.4 Email flow
Email providers:
- SMTP
- Gmail app password SMTP

Email types:
- payment confirmation
- booking confirmation with QR
- resend confirmation from backoffice

Email content:
- event title
- buyer name
- ticket summary
- total amount
- event date
- QR code or QR link
- support/contact info

## 8. MySQL schema draft

```sql
CREATE TABLE settings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  max_capacity INT NOT NULL,
  adult_price_cents INT NOT NULL,
  child_price_cents INT NOT NULL,
  event_date DATETIME NOT NULL,
  event_info JSON NULL,
  email_provider VARCHAR(20) NOT NULL DEFAULT 'smtp',
  smtp_host VARCHAR(255) NULL,
  smtp_port INT NULL,
  smtp_username VARCHAR(255) NULL,
  smtp_password_encrypted TEXT NULL,
  smtp_from_email VARCHAR(255) NULL,
  gmail_username VARCHAR(255) NULL,
  gmail_app_password_encrypted TEXT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
);

CREATE TABLE bookings (
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
  qr_token VARCHAR(255) NOT NULL UNIQUE,
  confirmed_assistance BOOLEAN NOT NULL DEFAULT FALSE,
  confirmed_at DATETIME NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  deleted_at DATETIME NULL
);

CREATE INDEX idx_bookings_payment_status ON bookings(payment_status);
CREATE INDEX idx_bookings_created_at ON bookings(created_at);
CREATE INDEX idx_bookings_qr_token ON bookings(qr_token);
```

## 9. UI design direction

Style keywords:
- clean
- modern
- glassmorphism
- magical
- Disneyland-inspired
- soft gradients
- glowing buttons
- rounded cards
- responsive flexbox

Tailwind patterns:
- `backdrop-blur-xl`
- `bg-white/10`
- `border-white/20`
- `shadow-2xl`
- `rounded-3xl`
- gradient backgrounds
- responsive `flex`, `flex-col`, `md:flex-row`

Accessibility:
- keyboard navigable buttons
- aria labels for counters/menu
- contrast over image backgrounds
- form error messages
- mobile-friendly tap targets

## 10. State management

Frontend Redux slices:
- settings slice
- capacity slice
- booking wizard slice
- payment/session slice

Backoffice Redux slices:
- auth slice
- kpis slice
- bookings slice
- filters slice
- settings slice
- qr scanner slice

## 11. Implementation phases

### Phase 1: Foundation
- Create monorepo/project structure.
- Configure React/Vite/Tailwind v3 for landing and backoffice.
- Configure Go backend.
- Connect MySQL.
- Add env config.

### Phase 2: Database + settings
- Create migrations.
- Add settings CRUD.
- Seed default settings: capacity, prices, event date.
- Expose public settings API.

### Phase 3: Landing UI
- Build navbar/mobile sidenav.
- Build hero with rotating images.
- Build visual section.
- Build schedule/info section.
- Build included section.
- Build responsive styling.

### Phase 4: Ticket wizard
- Build counters.
- Fetch capacity/settings.
- Connect WebSocket capacity updates.
- Add form validation.
- Add summary/legal step.

### Phase 5: Payments
- Add booking creation.
- Add Stripe Checkout session creation.
- Add Stripe webhook.
- Add payment success page.
- Add QR generation.

### Phase 6: Email
- Add SMTP/Gmail config storage.
- Add email sender service.
- Send confirmation email after payment.
- Add resend email endpoint.

### Phase 7: Backoffice
- Build home KPIs.
- Build inscripciones table.
- Build filters accordion.
- Build edit/delete/resend actions.
- Build settings page.

### Phase 8: QR attendance
- Build QR reader.
- Add confirm assistance API.
- Build confirmation page with confetti.
- Handle already-used QR state.

### Phase 9: Hardening
- Add admin auth.
- Encrypt stored email passwords.
- Validate all API input.
- Add DB transactions for capacity-sensitive operations.
- Add Stripe webhook signature verification.
- Add rate limiting.
- Add logs.
- Add tests.

## 12. Environment variables

```env
# Backend
APP_ENV=development
APP_PORT=8080
DATABASE_URL=root:myth@tcp(127.0.0.1:3306)/desayuno_con_princesas?parseTime=true
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
FRONTEND_URL=http://localhost:5173
BACKOFFICE_URL=http://localhost:5174
QR_SIGNING_SECRET=
EMAIL_ENCRYPTION_KEY=

# Frontend landing
VITE_API_URL=http://localhost:8080
VITE_WS_URL=ws://localhost:8080/ws/capacity

# Backoffice
VITE_API_URL=http://localhost:8080
```

## 13. Important constraints

- Ticket prices, max capacity, event date, email settings must come from DB/settings.
- Landing app must not rely on hardcoded production event values.
- Capacity must be enforced server-side, not only UI-side.
- Stripe webhook is source of truth for paid status.
- QR token must be hard to guess.
- Delete booking should be soft delete unless explicit permanent delete is needed.
- Gmail app password and SMTP passwords should be encrypted at rest.

---

## 14. Phase Status (Updated)

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Foundation | ✅ Complete | Project structure, React/Vite/Tailwind, Go backend |
| Phase 2: Database + settings | ✅ Complete | MySQL migrations, settings CRUD, seed data |
| Phase 3: Landing UI | ✅ Complete | All sections: Navbar, Hero, Gallery, Schedule, Includes |
| Phase 4: Ticket wizard | ✅ Complete | 3-step flow with counters, form, summary |
| Phase 5: Payments | ✅ Complete | Stripe Checkout integration, webhook handler |
| Phase 6: Email | ⚠️ Partial | Code exists, needs real SMTP/Gmail credentials for testing |
| Phase 7: Backoffice | ✅ Complete | KPIs, inscripciones table, settings page |
| Phase 8: QR attendance | ⚠️ Partial | QR reader/confirm pages exist, needs device testing |
| Phase 9: Hardening | ❌ Pending | Auth, encryption, validation, rate limiting, tests |

## 15. Code Documentation

All major files now include JSDoc/GoDoc documentation:

### Frontend (`/frontend/src/`)
- `assets/images.ts` - Centralized image URL management with CDN support
- `store/index.js` - Redux store configuration
- `store/settingsSlice.js` - Event settings state
- `store/capacitySlice.js` - Real-time capacity state
- `store/bookingSlice.js` - Booking wizard state
- `components/sections/Hero.jsx` - Hero section with image carousel
- `components/sections/Gallery.jsx` - Image gallery grid

### Backend (`/backend/`)
- `cmd/server/main.go` - Server entry point and routing
- `internal/models/models.go` - Data structures and types
- `internal/config/config.go` - Environment configuration
- `internal/db/db.go` - Database connection and migrations
- `internal/handlers/handlers.go` - HTTP request handlers
- `internal/ws/hub.go` - WebSocket hub for real-time updates
- `internal/services/email.go` - Email sending service

## 16. Image Management

All image URLs are centralized in `/frontend/src/assets/images.ts`:

```typescript
// Future CDN migration - just change this:
export const CDN_BASE_URL = 'https://cdn.desayunoconprincesas.com';

// Image collections
export const HERO_IMAGES: string[];      // Hero carousel backgrounds
export const GALLERY_IMAGES: GalleryImage[];  // Gallery grid images
export const FALLBACK_IMAGES: {};        // Error/placeholder images
export const BRANDING: {};               // Logo and OG images

// Utilities
getCdnUrl(path)           // Prepend CDN base to path
getOptimizedUrl(url, w, q)  // Resize Unsplash images
preloadImages(urls)       // Preload for performance
```
