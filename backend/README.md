# Backend

FastAPI service for the v1 manual annotation workflow.

## Run locally

```bash
cd backend
uv sync --extra dev
uv run alembic upgrade head
uv run uvicorn app.main:app --reload
```

By default the API uses SQLite at `./nom_v1.db` so the app can boot without local Postgres.
Set `DATABASE_URL` to a PostgreSQL SQLAlchemy URL when you are ready.

Run `uv run pytest` and `uv run ruff check .` before submitting changes. Commit
`uv.lock` whenever dependencies change.

