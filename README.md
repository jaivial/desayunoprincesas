# Desayuno con Princesas

Full-stack event ticketing platform.

## Projects

- `frontend/` - Public landing page (React + Vite + Tailwind + Redux)
- `desayuno-backoffice/` - Admin panel (React + Vite + Tailwind + Redux)
- `backend/` - API server (Go + MySQL + WebSockets + Stripe)

## Setup

### Prerequisites

- Node.js 18+
- Go 1.18+
- MySQL 8+

### Database

```sql
CREATE DATABASE desayuno_con_princesas;
```

### Backend

```bash
cd backend
cp .env.example .env
# Edit .env with your Stripe keys and database credentials
go run cmd/server/main.go
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Backoffice

```bash
cd desayuno-backoffice
npm install
npm run dev
```

## Ports

- Frontend: http://localhost:5173
- Backoffice: http://localhost:5174
- Backend API: http://localhost:8080
