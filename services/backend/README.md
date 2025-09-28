# Enso Backend

This FastAPI service exposes the canonical data and sync endpoints for the Enso thought organization apps. It uses SQLite by default for local development and can be pointed at Postgres for production deployments.

## Features
- CRUD APIs for thoughts with tag and link management
- Offline-friendly sync protocol with last-write-wins conflict resolution
- Background migrations via Alembic
- Modular architecture so mobile and web clients can share the same endpoints

## Quickstart
```bash
python -m venv .venv
source .venv/bin/activate
pip install -e .[test]
uvicorn enso_api.main:app --reload
```

The API is served on `http://127.0.0.1:8000` by default with the interactive docs available at `/docs`.

## Project Layout
- `enso_api/` – application code
- `enso_api/domain/` – shared pydantic models and validators
- `enso_api/repositories/` – database access layer
- `enso_api/routers/` – FastAPI routers grouped by feature area
- `tests/` – integration and unit tests using `pytest`

## Environment Variables
- `DATABASE_URL` – SQLAlchemy-style URL (defaults to `sqlite:///./enso.db`)
- `API_DEBUG` – set to `true` to enable verbose logging
- `SYNC_PAGE_SIZE` – number of records returned per sync page (defaults to `100`)

## Database Migrations
Alembic migration scaffolding is in `alembic/`. To create a new migration:
```bash
alembic revision --autogenerate -m "describe change"
alembic upgrade head
```

## Testing
```bash
pytest
```

Use `pytest -k sync` or `pytest tests/test_thoughts.py::test_linking` to scope runs while iterating.
