#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env ] || cp .env.example .env
docker compose up -d --build
docker compose ps
printf '\nUI: http://localhost:5173\nAPI: http://localhost:8000/api\n'
