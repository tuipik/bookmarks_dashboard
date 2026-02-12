# Start Dashboard

A simple start-page service (dashboard with columns and cards).

Run locally:

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
python app.py
```

Open http://localhost:5001

Environment variables:

- `APP_ENV`: `development` (default), `testing`, `production`
- `SECRET_KEY`: set your own value for production
- `FLASK_APP=app.py`
- `RATELIMIT_STORAGE_URI`: backend for rate limiting (default: `memory://`)

Quality checks:

```bash
pip install -r requirements-dev.txt
pytest -q
ruff check .
black --check .
pre-commit install
```

Auto-fix:

```bash
ruff check . --fix
black .
```

Database migrations (Alembic):

```bash
alembic upgrade head
alembic downgrade -1
alembic revision -m "describe change" --autogenerate
```

For legacy DBs (tables already exist but Alembic is not initialized yet):

```bash
alembic stamp head
```

Make targets:

```bash
make db-up
make db-down
make lint
make test
make check
```

Files:

- `app.py` - Flask entrypoint
- `app/` - backend modules (config, models, repositories, routing, validation, security)
- `alembic/` - DB schema migrations
- `tests/` - baseline integration API tests
- `templates/index.html` - frontend template
- `static/*` - CSS and JS assets

