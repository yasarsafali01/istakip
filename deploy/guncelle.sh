#!/usr/bin/env bash
# Sunucudaki kurulumu GitHub'daki son koda günceller:
# kodu çeker, backend'i derler, migration'ları uygular, servisi yeniden başlatır,
# web'i derleyip nginx klasörüne kopyalar.
set -euo pipefail

cd "$(dirname "$0")/.."
git pull

cd backend
go mod download
go build -o bin/istakip-api ./cmd/api
go run ./cmd/migrate up
sudo systemctl restart istakip-api

cd ../frontend
npm ci
npm run build
sudo rsync -a --delete build/ /var/www/istakip/

echo "Güncelleme tamamlandı."
