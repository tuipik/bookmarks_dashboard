.PHONY: db-up db-down test lint fmt check

db-up:
	alembic upgrade head

db-down:
	alembic downgrade -1

test:
	python -m pytest -q

lint:
	python -m ruff check .
	python -m black --check .

fmt:
	python -m ruff check . --fix
	python -m black .

check: lint test

