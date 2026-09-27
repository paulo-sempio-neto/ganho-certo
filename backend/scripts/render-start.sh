#!/usr/bin/env bash
set -euo pipefail

python -m alembic upgrade head
python -m alembic current
exec python -m app.server
