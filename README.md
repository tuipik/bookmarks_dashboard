# Start Dashboard

Flask-based dashboard with columns and cards, settings UI, drag-and-drop, uploads, and Alembic migrations.

## Requirements

- Python `3.13+`
- `pip`
- Docker + Docker Compose (for containerized runs)

## Run Locally (Development)

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
python app.py
```

Open: `http://localhost:5001`

## Run in Docker (Development)

```bash
docker compose up --build
```

Open: `http://localhost:5001`

Stop:

```bash
docker compose down
```

## Run in Docker (Production-like)

```bash
docker compose -f docker-compose.prod.yml up --build -d
```

Open: `http://localhost:8888`

Stop:

```bash
docker compose -f docker-compose.prod.yml down
```

## Database and Storage

- SQLite DB file is shared between local run and Docker: `./storage/data.db`.
- In containers it is mounted as `/app/data/data.db`.
- Do not run local app and Docker app at the same time against the same SQLite file (possible file locks).
- Uploads are stored in `static/uploads/` (Docker keeps them in dedicated volumes).

## Migrations (Alembic)

Apply migrations:

```bash
alembic upgrade head
```

Create migration:

```bash
alembic revision -m "describe change" --autogenerate
```

Rollback one step:

```bash
alembic downgrade -1
```

If you already have tables and need to mark migration state:

```bash
alembic stamp head
```

## Tests and Quality Checks

Install dev dependencies:

```bash
pip install -r requirements-dev.txt
```

Run tests:

```bash
pytest -q
```

Run lint/format checks:

```bash
ruff check .
black --check .
```

Auto-fix:

```bash
ruff check . --fix
black .
```

Pre-commit hooks:

```bash
pre-commit install
```

If hook modifies files during commit, stage changes and commit again.

## Make Commands

```bash
make db-up
make db-down
make lint
make test
make check
```

## Key Environment Variables

- `APP_ENV`: `development` (default), `testing`, `production`
- `SECRET_KEY`: set custom value outside local development
- `DB_PATH`: path to sqlite file (default points to `storage/data.db`)
- `SQLALCHEMY_DATABASE_URI`: explicit DB URI override
- `UPLOAD_DIR`: upload folder override
- `RATELIMIT_STORAGE_URI`: rate-limit backend (`memory://` by default)
- `MAX_IMAGE_WIDTH`, `MAX_IMAGE_HEIGHT`: max background upload dimensions (default `8192`)

## Common Issues

- `POST /api/upload-bg` returns `image dimensions exceed allowed limit`:
  increase `MAX_IMAGE_WIDTH` / `MAX_IMAGE_HEIGHT`.
- `pre-commit` fails and says it modified files:
  run `git add -A` and commit again.
- Docker first start issues with DB schema:
  run `alembic upgrade head` and ensure app uses the same DB path as migrations.
