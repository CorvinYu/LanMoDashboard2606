# Project State

## Overview

This project is a personal management dashboard built with a glue-code approach:
reuse mature components, keep business code focused, and avoid vendor lock-in.

## Current Stack

- Frontend: React, Vite, TypeScript, lucide-react
- Backend: NestJS, TypeScript, Prisma
- Database: PostgreSQL
- Cache / job dependency: Redis
- Deployment: Docker Compose
- AI: OpenAI-compatible API through a replaceable provider interface
- Auth: NestJS Passport JWT, @nestjs/jwt, argon2, Prisma User table

## Docker Services

- `frontend`: serves the React app through Nginx on port `3000`
- `backend`: NestJS API on port `4000`
- `postgres`: PostgreSQL on port `5432`
- `redis`: Redis on port `6379`
- `adminer`: database UI on port `8080`

## Useful URLs

- Frontend: http://localhost:3000
- Backend health: http://localhost:4000/api/health
- Same-origin API through frontend: http://localhost:3000/api/health
- Swagger docs: http://localhost:4000/api/docs
- Adminer: http://localhost:8080

## Implemented

- Docker Compose skeleton
- Backend health endpoint
- Prisma schema for core tables:
  - users
  - tasks
  - calendar_events
  - reminders
  - daily_scores
  - ai_conversations
  - ai_messages
  - ai_suggestions
  - suggestion_applications
- Replaceable AI provider layer:
  - `AiProvider` interface
  - OpenAI-compatible provider implementation
- Chinese frontend dashboard shell
- Account login MVP:
  - register
  - login
  - current user
  - logout
  - account management page for email, display name, and password updates
  - JWT-protected task, countdown and scheduled check APIs
  - existing default local user can be claimed by registering the default email
- MVP task management:
  - create task
  - list tasks
  - mark task as complete
  - archive/delete task
  - priority and due date fields
- Same-origin `/api` proxy for Docker/Nginx and Vite dev server, so mobile devices can access the same backend through the frontend host.

## Important AI Rule

AI must only create suggestions. It must not directly modify tasks, calendar events,
or reminders. User confirmation is required before applying any AI-generated change.

## Current Verification

The following local builds passed:

```bash
cd apps/backend
npx prisma generate
npm run build

cd ../frontend
npm run build
```

Docker restart could not be performed by Codex in the previous session because the
Codex process did not have permission to access `/var/run/docker.sock`.

The latest Docker verification passed:

```bash
docker compose up --build -d backend frontend
curl http://localhost:4000/api/health
curl http://localhost:3000/api/health
```

Unauthenticated `GET /api/tasks` returns `401`, and a temporary test account was able
to register, call `/api/auth/me`, and call the protected tasks endpoint.

## Start Command

```bash
docker compose up --build -d
```

If Docker permission is not configured for the current user:

```bash
sudo docker compose up --build -d
```

## Next Recommended Step

Continue MVP features in this order:

1. Bind Microsoft To Do OAuth state to the logged-in user, preferably through Redis.
2. Calendar view and FullCalendar integration
3. Daily score recording and history view
4. Reminder CRUD and due reminder list
5. AI suggestion persistence and explicit apply/reject flow
