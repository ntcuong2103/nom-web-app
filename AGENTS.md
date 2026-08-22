# Repository Guidelines

## Project Structure & Module Organization

This repository contains a Next.js frontend and a FastAPI backend.

- `frontend/app/` holds App Router pages, layouts, providers, and global styles.
- `frontend/components/` contains reusable React components; annotation-specific UI lives in `components/annotation/`.
- `backend/app/api/` defines routes and dependencies. Business helpers belong in `services/`, persistence in `db/` and `models/`, request/response types in `schemas/`, and settings or authentication in `core/`.
- `backend/alembic/versions/` contains database migrations.
- `infra/docker-compose.yml` provides an optional PostgreSQL 16 service.
- Root Markdown files document product scope and requirements.

Do not commit generated directories such as `.next/`, `node_modules/`, `.venv/`, local SQLite databases, or uploaded storage.

## Build, Test, and Development Commands

Run frontend commands from `frontend/`:

- `pnpm install` installs dependencies from `pnpm-lock.yaml`.
- `pnpm dev` starts Next.js at `http://localhost:3000`.
- `pnpm build` creates a production build.
- `pnpm lint` runs ESLint across the frontend.
- `pnpm typecheck` checks strict TypeScript without emitting files.

Run backend commands from `backend/` with Python 3.12 and uv installed:

- `uv sync --extra dev` creates the environment and installs locked dependencies.
- `uv run alembic upgrade head` applies database migrations.
- `uv run uvicorn app.main:app --reload` starts the API at `http://127.0.0.1:8000`.
- `uv run pytest` runs backend tests.
- `uv run ruff check .` checks Python style.

Use `docker compose -f infra/docker-compose.yml up -d postgres` from the repository root when PostgreSQL is needed. Otherwise, the backend defaults to local SQLite.

## Coding Style & Naming Conventions

TypeScript is strict. Use two-space indentation, PascalCase for React components, camelCase for functions and variables, and route folders matching URL segments. Prefer the `@/` import alias for frontend modules. Python uses four-space indentation, snake_case names, type hints, and Ruff’s 100-character line limit. Keep API handlers thin and place reusable logic in services.

## Testing Guidelines

No test suite is currently committed. Add backend tests under `backend/tests/` as `test_<feature>.py`; use pytest and FastAPI’s HTTPX client. For frontend changes, add colocated `*.test.tsx` files once a runner is introduced. At minimum, run `pnpm lint`, `pnpm typecheck`, `pnpm build`, and `uv run pytest` before submitting.

## Commit & Pull Request Guidelines

Recent history uses short, lowercase, imperative summaries (for example, `improve front end annotation`). Keep commits focused and describe what changed. Pull requests should include a concise summary, verification commands, linked issues, migration or configuration notes, and screenshots for visible UI changes.
