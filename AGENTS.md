# Repository Guidelines

## Project Structure & Module Organization

This is a full-stack palletisation optimiser. Backend code lives in `backend/app`: API routes in `api/`, packing algorithms in `algorithms/`, Pydantic models/settings in `core/`, services in `services/`, tests in `tests/`, and sample data in `sample_data/`. Frontend code lives in `frontend/src`: App Router pages in `app/`, reusable UI in `components/`, and shared client types/API helpers in `lib/`. Docker entry points are `docker-compose.yml`, `backend/Dockerfile`, and `frontend/Dockerfile`.

## Build, Test, and Development Commands

- `cd backend && python3 -m venv .venv && source .venv/bin/activate`: create and activate the backend virtual environment.
- `cd backend && pip install -r requirements.txt`: install backend dependencies.
- `cd backend && uvicorn app.main:app --reload --port 8000`: run the API locally at `http://localhost:8000`.
- `cd backend && pytest app/tests/ -v`: run backend tests.
- `cd frontend && npm install`: install Next.js dependencies.
- `cd frontend && npm run dev`: run the frontend at `http://localhost:3000`.
- `cd frontend && npm run build`: build the frontend.
- `cd frontend && npm run lint && npm run typecheck`: run frontend linting and TypeScript checks.
- `docker-compose up --build`: start both services with Docker.

## Coding Style & Naming Conventions

Python uses 4-space indentation, type hints where helpful, and snake_case for modules, functions, and variables. Name FastAPI route modules `routes_<domain>.py` and keep business logic in `services/` or `algorithms/`.

TypeScript/React uses 2-space indentation, PascalCase component files such as `PalletViewer3D.tsx`, and camelCase helpers in `src/lib`. Prefer typed props and shared interfaces from `src/lib/types.ts`. Use TailwindCSS for styling.

## Testing Guidelines

Backend tests use pytest and FastAPI `TestClient`. Place tests in `backend/app/tests/`, name files `test_<feature>.py`, and name functions `test_<behavior>`. Add tests for new routes, parser behavior, validation rules, and algorithm edge cases. No frontend test framework is configured; validate frontend changes with `npm run lint`, `npm run typecheck`, and manual browser checks.

## Commit & Pull Request Guidelines

The current history uses short imperative commit messages, for example `Update frontend output`. Use concise, action-oriented summaries. Pull requests should include a brief description, testing performed, linked issue or task when available, and screenshots for UI changes. Do not commit generated caches such as `frontend/.next/` or Python `__pycache__/`.

## Security & Configuration Tips

Local CORS settings are controlled in `backend/app/core/config.py`; update them before deploying outside localhost. Job storage is currently in-memory, so avoid presenting it as durable persistence without changing `services/job_store.py`.
