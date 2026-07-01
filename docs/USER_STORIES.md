# Desayuno con Princesas — User Stories

Full-stack event ticketing platform for "El Desayuno Real", a themed children's
event at Alquería Villa Carmen. Three apps:

- **Frontend** — public landing + booking (React 19, Vite, Redux Toolkit, Tailwind, react-router).
- **Backoffice** — admin panel (React 19, Vite, Redux Toolkit, Tailwind, ZXing QR).
- **Backend** — API (Go 1.18, MySQL, JWT, gorilla/websocket, stripe-go v76, go-qrcode, x/crypto).

Live: https://desayunoprincesas.com · https://backoffice.desayunoprincesas.com · https://api.desayunoprincesas.com

Screenshots hosted on `https://jaimedigitalstudio.b-cdn.net/images/desayunoprincesas/`.

---

## Frontend (public)

### F1 — Discover the event
*As a parent, I want an immersive landing page so that I instantly understand the magic and value of the event.*
Full-screen hero with fairy-tale palette and clear CTAs to buy tickets. Sticky nav to each section.
![hero](https://jaimedigitalstudio.b-cdn.net/images/desayunoprincesas/01-hero.webp)

### F2 — Choose an available date (live capacity)
*As a buyer, I want to pick the event day and only see dates with seats left so that I don't book a full session.*
Step 1 of the wizard. Calendar marks available vs full days; capacity updates in real time over WebSocket (`/ws/capacity`). Full days are disabled.
![date](https://jaimedigitalstudio.b-cdn.net/images/desayunoprincesas/06-entradas.webp)

### F3 — Build the order (packs + individual tickets)
*As a buyer, I want themed packs and individual adult/child tickets I can combine so that I match my family's size and budget.*
Packs: Encantado (75€), Reino Encantado (110€), Recuerdo Real 1/2 (100€/150€), Cuento de Ensueño 1/2 (150€/200€), plus standalone Adulto (35€) and Niño/a (45€). Live remaining-capacity counter.
![tickets](https://jaimedigitalstudio.b-cdn.net/images/desayunoprincesas/09-booking-entradas.webp)

### F4 — Provide buyer details
*As a buyer, I want a simple contact form so that I receive my confirmation and QR.*
Name, surname, email, international phone. Validated before continuing.
![datos](https://jaimedigitalstudio.b-cdn.net/images/desayunoprincesas/10-booking-datos.webp)

### F5 — Declare allergies per attendee
*As a parent, I want to declare each attendee's allergies so that catering is safe.*
Per-attendee selection across the 14 EU mandatory allergens. Optional but explicit.
![alergias](https://jaimedigitalstudio.b-cdn.net/images/desayunoprincesas/11-booking-alergias.webp)

### F6 — Review and pay securely
*As a buyer, I want a clear summary and secure payment so that I trust the purchase.*
Summary (date, buyer, line items, total) + privacy/terms consent gates. Pay via Stripe Checkout; server-side webhook confirms payment and releases the seat.
![confirmar](https://jaimedigitalstudio.b-cdn.net/images/desayunoprincesas/12-booking-confirmar.webp)

### F7 — Compare packs and prices
*As a buyer, I want a clear pricing section so that I can decide before entering the wizard.*
![packs](https://jaimedigitalstudio.b-cdn.net/images/desayunoprincesas/05-packs.webp)

### F8 — Read the itinerary
*As a parent, I want the morning's schedule so that I know what to expect.*
Reception & coronation → breakfast → themed-scenario tour with workshops → musical closing.
![horarios](https://jaimedigitalstudio.b-cdn.net/images/desayunoprincesas/03-horarios.webp)

### F9 — See what's included / gallery / location / FAQ
Supporting sections that build trust and reduce pre-sale questions.
- Includes: ![incluye](https://jaimedigitalstudio.b-cdn.net/images/desayunoprincesas/04-incluye.webp)
- Gallery: ![galeria](https://jaimedigitalstudio.b-cdn.net/images/desayunoprincesas/02-galeria.webp)
- Location: ![ubicacion](https://jaimedigitalstudio.b-cdn.net/images/desayunoprincesas/07-ubicacion.webp)
- FAQ: ![faq](https://jaimedigitalstudio.b-cdn.net/images/desayunoprincesas/08-faq.webp)

### F10 — Legal pages
Terms (`/terminos`) and Privacy (`/privacidad`), linked from the consent gate.
![terminos](https://jaimedigitalstudio.b-cdn.net/images/desayunoprincesas/13-terminos.webp)

### F11 — Mobile-first
The whole funnel is responsive.
![mobile](https://jaimedigitalstudio.b-cdn.net/images/desayunoprincesas/15-hero-mobile.webp)

---

## Backoffice (admin)

### B1 — Secure login
*As an organizer, I want a protected admin area so that only staff manage bookings.*
JWT auth, bcrypt-hashed passwords.
![login](https://jaimedigitalstudio.b-cdn.net/images/desayunoprincesas/20-login.webp)

### B2 — Monitor the event (dashboard KPIs)
*As an organizer, I want at-a-glance metrics so that I track sales and capacity.*
Tickets sold, total revenue, online vs cash, adults, children, capacity left, confirmed attendance.
![dashboard](https://jaimedigitalstudio.b-cdn.net/images/desayunoprincesas/21-dashboard.webp)

### B3 — Manage registrations
*As an organizer, I want a searchable, filterable table of bookings so that I can administer them.*
Columns: name, email, phone, pack, adults, children, allergies, status, method, amount, dates. Row actions: edit, resend email, delete. (Customer PII blurred in the screenshot.)
![inscripciones](https://jaimedigitalstudio.b-cdn.net/images/desayunoprincesas/22-inscripciones.webp)

### B4 — Edit a registration / resend confirmation
*As an organizer, I want to edit a booking and resend its confirmation so that I can fix mistakes.*
Editable purchase composition, personal data, attendees and allergies; resend email + QR. (PII blurred.)
![edit](https://jaimedigitalstudio.b-cdn.net/images/desayunoprincesas/23-edit-booking.webp)

### B5 — Check in attendees by QR
*As staff at the door, I want to scan each family's QR so that I validate entry fast.*
Camera scan (ZXing) or manual code entry; marks attendance.
![qr](https://jaimedigitalstudio.b-cdn.net/images/desayunoprincesas/24-qr-reader.webp)

### B6 — Configure event, packs, dates, pricing
*As an organizer, I want to set capacity, prices, packs and the date calendar so that I control the offer.*
![settings](https://jaimedigitalstudio.b-cdn.net/images/desayunoprincesas/25-settings.webp)

### B7 — Configure transactional email
*As an organizer, I want SMTP/Gmail settings so that confirmation and payment emails are sent from my account.*
Encrypted credentials.
![email](https://jaimedigitalstudio.b-cdn.net/images/desayunoprincesas/26-email-settings.webp)
