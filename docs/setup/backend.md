# Backend Setup

The FastAPI service lives in `services/backend` and drives sync for both Lynx mobile and the Vite web shell.

## Prerequisites
- Python 3.11+
- `pip` or `uv`

## Install & Run
```bash
cd services/backend
python -m venv .venv
source .venv/bin/activate
pip install -e .[test]
uvicorn enso_api.main:app --reload
```
The server listens on `http://127.0.0.1:8000`. Interactive docs are available at `/docs`.

## Database
SQLite (`enso.db`) is used by default. Override `DATABASE_URL` in `.env` to point at Postgres when sharing instances, then run:
```bash
alembic upgrade head
```
Alembic scripts live in `services/backend/alembic/`.

## Connecting Clients
- Web: create an API client in `apps/web/src` that exchanges thoughts via `/thoughts` and `/sync/thoughts`. Use the `cursor` returned from sync to schedule background delta fetches.
- Mobile: bridge the same endpoints through Lynx by adapting the data access layer in `packages/lynx` once native storage is replaced.

Persist the latest server cursor locally so both clients can resume syncing after going offline.

## Frontend Environment
Set `ENSO_API_URL` in your shell or `.env` file to point the web and Lynx shells at a non-default backend location:

```bash
echo "ENSO_API_URL=http://127.0.0.1:8000" >> .env
```

## One-Command Dev Stack
After the initial Python bootstrap, run the entire stack with:

```bash
pnpm dev
```

The helper script will create/refresh `services/backend/.venv`, launch FastAPI on `http://127.0.0.1:8000`, export `ENSO_API_URL`, and then start the Vite web shell.
