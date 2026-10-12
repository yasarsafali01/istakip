# Kurulum

Adım adım, hiç bilmeyen birinin de takip edebileceği şekilde yazılmış tam kurulum rehberleri:

- **Windows 10/11:** [docs/KURULUM-WINDOWS.md](docs/KURULUM-WINDOWS.md)
- **Ubuntu 22.04 / 24.04:** [docs/KURULUM-UBUNTU.md](docs/KURULUM-UBUNTU.md)

Her iki rehber de program kurulumundan backend testlerine, web ve mobil uygulamayı çalıştırmaya ve sık karşılaşılan sorunlara kadar tüm adımları içerir. Aşağısı, ortamı zaten hazır olanlar için kısa özettir.

## Gereksinimler

| Araç | Sürüm |
|---|---|
| Go | 1.26+ |
| Node.js | 22 LTS (en az 20.19) |
| Docker + Docker Compose | güncel |
| Git | güncel |
| Expo Go (telefonda) | SDK 57 uyumlu, güncel |

## Kısa Kurulum

```bash
# 1) Veritabanı + backend
cd backend
cp .env.example .env            # JWT_SECRET'ı değiştirin
docker compose up -d            # PostgreSQL 16, host portu 5433
go mod download
go run ./cmd/migrate up         # şemayı uygular
go run ./cmd/seed               # örnek veri (tekrar çalıştırılabilir)
go run ./cmd/api                # http://localhost:8080

# 2) Web (yeni terminal)
cd frontend
cp .env.example .env
npm install
npm start                       # http://localhost:3000

# 3) Mobil (yeni terminal)
cd mobile
cp .env.example .env            # EXPO_PUBLIC_API_URL=http://<bilgisayarın-yerel-IP'si>:8080
npm install --legacy-peer-deps
npx expo start                  # QR kodu Expo Go ile okutun
```

## Ortam Değişkenleri

### `backend/.env`

```env
DATABASE_URL=postgres://istakip:istakip@localhost:5433/istakip?sslmode=disable
JWT_SECRET=değiştir-bu-gizli-anahtarı
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=720h
PORT=8080
UPLOAD_DIR=uploads
# İsteğe bağlı — varsayılan: http://localhost:3000,http://localhost:19006
# CORS_ORIGINS=http://localhost:3000
```

Talep formlarındaki dosya sorularına yüklenen dosyalar `UPLOAD_DIR` klasöründe tutulur (dosya başına en fazla 10 MB). Bu klasör `.gitignore`'dadır; üretimde kalıcı bir diske bağlanmalı ve yedeklenmelidir.

### `frontend/.env`

```env
REACT_APP_API_URL=http://localhost:8080
```

### `mobile/.env`

```env
EXPO_PUBLIC_API_URL=http://192.168.x.x:8080
```

Telefon `localhost`'a ulaşamaz; bilgisayarın yerel ağ IP adresini yazın ve telefonla aynı Wi-Fi'da olun.

## Backend Hızlı Test

```bash
curl http://localhost:8080/health
# {"database":"connected","status":"ok"}

curl -X POST http://localhost:8080/auth/login -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}'
# {"accessToken":"...","refreshToken":"...","user":{...}}

cd backend && go build ./... && go vet ./...
```

Rol bazlı görünürlük testleri ve PowerShell karşılıkları için rehberlerin 6. bölümüne bakın.

## Demo Hesapları

| Rol | E-posta | Şifre |
|---|---|---|
| Sistem Yöneticisi | `admin@example.com` | `admin123` |
| Daire Başkanı | `bigd.baskan@example.com` | `pass123` |
| Müdür | `bigd.pm@example.com` | `pass123` |
| Çalışan | `bigd.worker1@example.com` | `pass123` |
| Üniversite Personeli | `dis.kullanici@example.com` | `pass123` |
| Öğrenci | `ogrenci@example.com` | `pass123` |

Tam liste web ve mobil giriş ekranındaki demo hesap panelinde ve `backend/cmd/seed/main.go` içindedir.

## Veritabanı Notları

- `go run ./cmd/migrate down` migration'ları geri alır ve **verileri siler**.
- Veritabanını tamamen sıfırlamak: `docker compose down -v && docker compose up -d && go run ./cmd/migrate up && go run ./cmd/seed`.
- Docker container'ı host'ta `5433` portunu kullanır; makinede kurulu bir PostgreSQL ile `5432` çakışmasın diye.
