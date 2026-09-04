# İstakip

Kurumsal birim/proje/talep yönetimi için Jira benzeri bir iş takip sistemi. Birimler (daireler), projeler, issue/talep takibi, aylık sprint döngüsü, rol tabanlı erişim ve envanter takibi içerir.

## Mimari

Üç bileşenden oluşur:

- **frontend/** — React (Create React App) web uygulaması. Board (Kanban), backlog, dashboard, talep yönetimi ekranları.
- **backend/** — Go + PostgreSQL REST API. Kimlik doğrulama, rol tabanlı yetkilendirme ve tüm iş kurallarının (sprint hesaplama, issue numaralandırma, talep akışı, envanter düşümü) tek kaynağı.
- **mobile/** — React Native (Expo) mobil uygulama. Web ile aynı backend'i kullanır, aynı rol setine göre uyarlanmış ekranlar sunar (bkz. mobile/README.md — kapsam detayları).

Veri akışı: `mobile/` ve `frontend/`, `backend/`'in REST API'sine JWT ile kimlik doğrulayarak istek atar; kalıcı veri yalnızca PostgreSQL'de tutulur (frontend artık localStorage kullanmaz).

## Klasör Yapısı

```
istakip/
  frontend/   # React web app (bkz. frontend/README.md)
  backend/    # Go API (bkz. backend/README.md)
  mobile/     # React Native app (bkz. mobile/README.md)
```

## Teknolojiler

- **Frontend**: React 18, React Router, Context + useReducer, `@hello-pangea/dnd`
- **Backend**: Go, chi (router), pgx (PostgreSQL driver), golang-migrate, JWT
- **Mobile**: React Native (Expo), Expo Router, TanStack Query
- **Veritabanı**: PostgreSQL

## Hızlı Başlangıç

Her bileşen kendi klasöründen çalıştırılır:

```bash
# Backend
cd backend && go run ./cmd/api

# Frontend
cd frontend && npm start

# Mobile
cd mobile && npx expo start
```

Ortam değişkenleri, veritabanı kurulumu ve platform-spesifik notlar için **[INSTALL.md](INSTALL.md)** dosyasına bakın.
