# Kurulum

## Gereksinimler

- Node.js 18+ (frontend ve mobile için)
- Go 1.22+ (backend için)
- Docker (yerel PostgreSQL için — `backend/docker-compose.yml` ile çalıştırılır)
- Expo CLI (`npx expo` — global kurulum gerekmez)

## Backend

```bash
cd backend
cp .env.example .env   # aşağıdaki değişkenleri doldurun
go mod download
```

### Ortam Değişkenleri (`backend/.env`)

```env
DATABASE_URL=postgres://istakip:istakip@localhost:5433/istakip?sslmode=disable
JWT_SECRET=değiştir-bu-gizli-anahtarı
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=720h
PORT=8080
```

### Veritabanı Kurulumu

```bash
docker compose up -d          # yerel PostgreSQL'i başlatır (host portu: 5433)
go run ./cmd/migrate up       # şemayı uygular
go run ./cmd/seed             # örnek birim/proje/kullanıcı verisini yükler (idempotent)
```

Migration'ı geri almak için: `go run ./cmd/migrate down`

> Not: Bu proje bağımsız bir `migrate` CLI kurulumu gerektirmez — `cmd/migrate` küçük bir Go aracıdır. Migration ve seed komutları veritabanına yazar; CI/CD dışında elle çalıştırırken dikkatli olun.
>
> Not: Docker container'ı host'ta `5433` portunu kullanır (varsayılan `5432` yerine) — bu makinede zaten bir yerel PostgreSQL servisi çalıştığı için port çakışması yaşanmıştı.

### Çalıştırma

```bash
go run ./cmd/api
```

## Frontend

```bash
cd frontend
npm install
cp .env.example .env   # API adresini ayarlayın
npm start
```

### Ortam Değişkenleri (`frontend/.env`)

```env
REACT_APP_API_URL=http://localhost:8080
```

## Mobile

```bash
cd mobile
npm install
cp .env.example .env
npx expo start
```

### Ortam Değişkenleri (`mobile/.env`)

```env
EXPO_PUBLIC_API_URL=http://localhost:8080
```

### Platform Notları

- **iOS**: Simülatörde test için Xcode kurulu olmalı; fiziksel cihazda test için Expo Go uygulaması kullanılabilir.
- **Android**: Android Studio + emulator veya Expo Go ile fiziksel cihaz.
- Backend'i fiziksel cihazdan test ederken `localhost` yerine bilgisayarın yerel ağ IP adresi kullanılmalı (`EXPO_PUBLIC_API_URL=http://192.168.x.x:8080`).

### Demo Hesapları

Seed veri yüklendikten sonra tüm roller için örnek hesaplar kullanılabilir (bkz. `backend/cmd/seed/main.go`). Örnek: `admin@example.com` / `admin123` (System_Admin), `dis.kullanici@example.com` / `pass123` (External_User). Diğer hesaplar için frontend giriş ekranındaki demo hesap listesine bakın.
