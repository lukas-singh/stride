# Stride 🏃

A mobile-first run tracking & coaching web app. Dark athletic UI, rule-based
coaching (no external AI), 8 analytics charts, race vault, and a recovery
overlay — all data scoped per user behind JWT auth.

## Tech stack

| Layer    | Choice |
|----------|--------|
| Frontend | React + Vite + Tailwind CSS, React Router v6, Recharts |
| Backend  | Node.js + Express |
| Database | SQLite via `better-sqlite3` |
| Auth     | JWT (email/password, bcrypt hashing) |

The `/coach` engine is **pure rule-based JavaScript** (`client/src/lib/coachEngine.js`)
applied to the user's own run data — there are no external AI API calls.

## Quick start

From the project root (`C:\Users\lukas\stride`):

```bash
# 1. install everything
npm run install:all

# 2. start the API (terminal 1) — seeds the demo account on first boot
npm run server          # http://localhost:4000

# 3. start the web app (terminal 2)
npm run client          # http://localhost:5173
```

Open **http://localhost:5173** on your phone or in a mobile-emulated browser
window (the layout is capped at 480px and centered on desktop).

> The Vite dev server proxies `/api/*` → `http://localhost:4000`, so the
> frontend and backend run independently with no CORS friction.

## Demo account

Seeded automatically on first server boot with ~30 days of realistic data
(runs, two races, recovery entries):

```
email:    demo@stride.app
password: stride123
```

The "Use demo account" link on the login screen pre-fills these credentials.

## Project layout

```
stride/
├── server/                  Express + SQLite API
│   ├── index.js             all REST routes + JWT middleware
│   ├── db.js                schema + connection
│   ├── auth.js              JWT sign / verify
│   └── seed.js              demo data generator (idempotent)
└── client/                  React + Vite app
    └── src/
        ├── lib/
        │   ├── coachEngine.js   rule-based prediction / plan / suggestions
        │   ├── analytics.js     chart datasets + dynamic insights
        │   ├── achievements.js  PRs, streak, milestone badges
        │   └── format.js        pace / time formatters
        ├── pages/               Dashboard, LogRun, Coach, Analytics,
        │                        RaceVault, Recovery, Profile, Auth
        ├── components/          Layout, BottomNav, Toast, cards, …
        ├── context/AuthContext  user + token state
        └── api.js               fetch wrapper (JWT + offline read cache)
```

## API

All routes require `Authorization: Bearer <jwt>` except `/auth/*`.

```
POST   /auth/signup        POST   /auth/login
GET    /runs               POST   /runs       PUT /runs/:id   DELETE /runs/:id
GET    /races              POST   /races      DELETE /races/:id
GET    /recovery           POST   /recovery
GET    /goals              POST   /goals
GET    /analytics/summary
GET/PUT /me
```

## Deployment (Railway / any PaaS)

- The API binds to `process.env.PORT` on `0.0.0.0` (Railway injects `PORT`).
- `server/index.js` registers `uncaughtException` / `unhandledRejection`
  handlers and loads its modules via guarded dynamic `import()`, so any
  **startup crash is logged with `console.error`** (including a failure to load
  the native `better-sqlite3` binding) instead of exiting silently.
- **`better-sqlite3` is pinned to `^12.10.0`** — its `engines` field is
  `20.x || 22.x || 23.x || 24.x …`, so it ships a **prebuilt binary for Node 22**
  (Railway) *and* Node 24 (local dev). Downgrading to `11.x` would lose the
  Node 24 prebuild with no benefit on Node 22, so it was intentionally kept.
- SQLite writes to `server/stride.db`. On Railway this lives on the container's
  **ephemeral** filesystem (resets on redeploy) — mount a Volume and point the
  DB path at it if you need persistence.

## Notes

- **Offline-capable viewing:** successful `GET` responses are cached in
  `localStorage`; if the network drops, previously loaded data still renders.
- **Build for production:** `npm run build` emits `client/dist`. Serve that
  static folder behind any host and point it at the API.
- The SQLite file (`server/stride.db`) is created on first run and git-ignored.
