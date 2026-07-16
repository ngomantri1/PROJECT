#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/.."
[ -f .env ] || cp .env.example .env
docker compose config >/dev/null
docker compose up -d --build
docker compose ps
printf '\nWeb:     http://localhost\nSwagger: http://localhost/api/swagger\nHealth:  http://localhost/api/health\n'
