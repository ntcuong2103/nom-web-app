# Backend

FastAPI service for the v1 manual annotation workflow.

## Run locally

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -e .
alembic upgrade head
uvicorn app.main:app --reload
```

By default the API uses SQLite at `./nom_v1.db` so the app can boot without local Postgres.
Set `DATABASE_URL` to a PostgreSQL SQLAlchemy URL when you are ready.

