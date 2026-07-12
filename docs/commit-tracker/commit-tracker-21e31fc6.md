# Commit Tracker - 21e31fc6

Session: 2026-07-12

## Changes

| Time | File | Action | What Done |
|------|------|--------|-----------|
|  | backend/internal/models/models.go | edit | Add ticket payment update fields |
|  | backend/internal/db/db.go | edit | Add ticket payment columns |
|  | backend/internal/handlers/cart.go | edit | Return ticket payment metadata |
|  | backend/internal/handlers/handlers.go | edit | Persist booking and ticket changes |
|  | desayuno-backoffice/src/pages/EditBookingPage.jsx | edit | Add ticket groups and counters |
|  | desayuno-backoffice/src/store/bookingsSlice.js | edit | Show API save errors |
|  | desayuno-backoffice/src/pages/InscripcionesPage.jsx | edit | Display Bizum and mixed methods |
|  | desayuno-backoffice/src/pages/QRConfirmPage.jsx | edit | Display Bizum and mixed methods |
|  | backend/internal/services/email.go | edit | Add booking update email with QR |
|  | backend/internal/handlers/handlers.go | edit | Add update email API endpoint |
|  | backend/cmd/server/main.go | edit | Route update email request |
|  | desayuno-backoffice/src/pages/EditBookingPage.jsx | edit | Send booking update email after save |
|  | desayuno-backoffice/src/pages/QRConfirmPage.jsx | edit | Show payment details per ticket group |
|  | backend/internal/handlers/booking_update_test.go | add | Test ticket groups QR and email flow |
|  | backend/internal/services/email_test.go | add | Test update email contents |
|  | backend/internal/db/db.go | edit | Backfill ticket payment metadata |
|  | backend/internal/handlers/cart.go | edit | Save payment data on new ticket rows |
|  | backend/cmd/server/main.go | edit | Allow allergy PUT CORS request |
|  | backend/cmd/server/main_test.go | add | Test save request CORS methods |
|  | desayuno-backoffice/src/hooks/useToast.js | add | Split toast hook for lint |
|  | desayuno-backoffice/src/components/ui/Toast.jsx | edit | Keep component-only toast module |
|  | desayuno-backoffice/src/components/ui/MonthCalendar.jsx | edit | Remove useless calendar defaults |
|  | desayuno-backoffice/src/pages/EditPackPage.jsx | edit | Mark form hydration intent |
|  | desayuno-backoffice/src/pages/EmailSettingsPage.jsx | edit | Mark form hydration intent |
|  | desayuno-backoffice/src/pages/QRReaderPage.jsx | edit | Remove derived HTTPS state |
|  | desayuno-backoffice/src/pages/SettingsPage.jsx | edit | Mark form hydration intent |
|  | desayuno-backoffice/src/store/authSlice.js | edit | Remove unused error values |
|  | .gitignore | edit | Ignore deployed binary backups |
