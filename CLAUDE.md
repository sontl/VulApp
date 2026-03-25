# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VulApp (branded as TechviFlaw) is a **deliberately vulnerable** SaaS web application designed for security testing education. It contains 20+ intentional vulnerabilities. Do not "fix" security issues unless explicitly asked — they are features, not bugs.

## Development Commands

### Docker (recommended)
```bash
docker-compose up --build                       # Start both services (seeds by default)
SEED_ON_START=false docker-compose up --build   # Start without reseeding
docker-compose down                             # Stop (database.sqlite is a bind mount, persists on host)
```

### Backend (Express on :5001)
```bash
cd backend
npm install
npm run dev      # Start with nodemon (auto-reload)
npm run seed     # Seed database with test users and projects
```

### Frontend (React/Vite on :5173)
```bash
cd frontend
npm install
npm run dev      # Start Vite dev server
npm run build    # Production build → dist/
npm run lint     # ESLint
npm run preview  # Preview production build
```

There are no tests (`npm test` is a no-op in both packages).

## Architecture

**Backend:** Express.js 5 + SQLite3 (`/backend/database.sqlite`). Routes are split across `backend/routes/` (auth, projects, files, payment, utils, debug). JWT middleware at `backend/middleware/auth.js` — anonymous requests are allowed through (no token = anonymous user). Database schema initialized in `backend/db.js`.

**Frontend:** React 19 + Vite + React Router v7. Single Axios instance in `frontend/src/services/api.js` reads `VITE_API_URL` (defaults to `http://localhost:5001/api`) and injects `Authorization: Bearer <token>` from localStorage on every request. No global state management — each page component manages its own state.

**API communication:** Frontend calls `api.get/post/put/delete('/path')` which maps to `http://localhost:5001/api/path`. CORS is open (`*`).

## Key Credentials (Seed Data)

| Email | Password | Plan |
|---|---|---|
| test@example.com | 123456 | free |
| admin@vulapp.com | admin | enterprise |
| user@vulapp.com | user123 | pro |
| root@vulapp.com | root | enterprise |

JWT secret: `secret123`. Full API docs (including vulnerability hints) at `GET /api/docs`.

## Important Implementation Notes

- Passwords are stored **in plaintext** in the `users` table — intentional.
- `GET /api/debug` leaks the JWT secret, DB path, and all env vars — intentional.
- XML body parsing is enabled (`text/xml`) for XXE testing — intentional.
- Error handler returns full stack traces — intentional.
- The `is_public` flag on projects and lack of ownership checks on most endpoints enables IDOR scenarios.
- `backend/uploads/` stores user-uploaded files with no type validation — intentional for unrestricted file upload testing.
