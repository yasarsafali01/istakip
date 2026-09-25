# İstakip Backend

Go + PostgreSQL REST API. İstakip web ve mobil istemcilerinin tek veri kaynağı; kimlik doğrulama, rol tabanlı yetkilendirme ve tüm iş kurallarını (sprint hesaplama, issue numaralandırma, talep akışı, envanter düşümü) barındırır.

## Mimari

Katmanlı ama sade bir yapı:

```
cmd/api/main.go      # entrypoint — config, DB pool, router
cmd/seed/main.go      # örnek veri yükleyici (idempotent)
internal/
  config/              # ortam değişkeni okuma
  db/                  # PostgreSQL bağlantı havuzu (pgxpool)
  middleware/           # JWT doğrulama, logging, recover
  handlers/            # HTTP katmanı — parse/response, iş mantığı içermez
  services/            # iş kuralları (yetki filtreleri, sprint tarihleri, issue numarası, done-flow)
  repository/          # ham SQL sorguları
  models/              # struct tanımları
migrations/            # golang-migrate SQL dosyaları
```

Akış: `handler` isteği ayrıştırır → `service` iş kuralını uygular → `repository` SQL çalıştırır. ORM kullanılmaz.

## Roller ve İzinler

Handler'lar rol adı yerine izin ve kapsam kontrol eder (`services/permissions.go` izin kataloğu, `services/role_store.go` önbellek, `services/visibility.go` kapsam kuralları). Roller `roles` / `role_permissions` tablolarında tutulur (migration 000002–000004). Uçlar: `GET /permissions`, `GET/POST /roles`, `PATCH/DELETE /roles/{key}`, `PATCH /users/{id}/role` (yazma uçları `role.manage` ister). `/auth/login` ve `/users/me` yanıtı kullanıcının `scope` ve `permissions` alanlarını içerir.

## Teknolojiler

- Router: [chi](https://github.com/go-chi/chi)
- DB: [pgx](https://github.com/jackc/pgx) (`pgxpool`)
- Migration: [golang-migrate](https://github.com/golang-migrate/migrate)
- Auth: JWT (`golang-jwt/jwt`) + bcrypt

## Çalıştırma

Kurulum adımları için kök dizindeki [INSTALL.md](../INSTALL.md) dosyasına bakın.

```bash
go run ./cmd/api
```

`/health` endpoint'i sunucu ve veritabanı bağlantı durumunu döner.
