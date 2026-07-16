#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/.."

dotnet restore ./ElevatorERP.sln
dotnet build ./ElevatorERP.sln -c Release --no-restore
(
  cd frontend
  npm ci
  npm run lint
  npm run build
)
[ -f .env ] || cp .env.example .env
docker compose config >/dev/null
docker compose build
printf 'Tất cả bước kiểm tra đã hoàn thành.\n'
