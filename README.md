# Personal Dashboard

A Docker Compose based personal management dashboard skeleton.

## Services

- `frontend`: React + Vite dashboard
- `backend`: NestJS API
- `postgres`: PostgreSQL data store
- `redis`: reminder/background job dependency
- `adminer`: database admin UI

## Start

```bash
cp .env.example .env
docker compose up --build
```

Frontend: http://localhost:3000

Backend health: http://localhost:4000/api/health

Same-origin backend health through frontend: http://localhost:3000/api/health

Adminer: http://localhost:8080

## Login

Open the frontend and register an account first.

If you register with `DEFAULT_USER_EMAIL`, the app will set a real password for the
existing default local user and keep the existing tasks attached to the same user.

For phone access on the same LAN, open `http://<computer-lan-ip>:3000`. The frontend
uses same-origin `/api`, so the phone will call the backend through the same host.
