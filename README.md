# İstakip

Kurumsal birim/proje/talep yönetimi için Jira benzeri bir iş takip sistemi. Birimler (daireler), projeler, issue/talep takibi, aylık sprint döngüsü, rol tabanlı erişim ve envanter takibi içerir.

## Mimari

Üç bileşenden oluşur:

- **frontend/** — React (Create React App) web uygulaması. Board (Kanban), backlog, dashboard, talep yönetimi ekranları.
- **backend/** — Go + PostgreSQL REST API. Kimlik doğrulama, rol tabanlı yetkilendirme ve tüm iş kurallarının (sprint hesaplama, issue numaralandırma, talep akışı, envanter düşümü) tek kaynağı.
- **mobile/** — React Native (Expo) mobil uygulama. Web ile aynı backend'i kullanır, aynı rol setine göre uyarlanmış ekranlar sunar (bkz. mobile/README.md — kapsam detayları).

Veri akışı: `mobile/` ve `frontend/`, `backend/`'in REST API'sine JWT ile kimlik doğrulayarak istek atar; kalıcı veri yalnızca PostgreSQL'de tutulur (frontend artık localStorage kullanmaz).

## Roller ve İzinler

Yetkilendirme sabit rol adlarına değil **izinlere** bağlıdır. Bir rol = bir *izin kümesi* + bir *veri kapsamı*:

- **Veri kapsamı** rolün neyi görebileceğini belirler: `all` (tüm sistem), `unit` (kendi birimi), `manager` (yönettiği projeler), `project` (atandığı proje), `own` (yalnızca kendi talepleri).
- **İzinler** rolün neleri yapabileceğini belirler: talep aç, iş oluştur/düzenle/sil, durum değiştir, atama yap, tarih düzenle, aya taşı, aylık dönem yönet, envanter yönet/kullan, proje/birim yönet, rol yönet (tam liste: `GET /permissions`).
- 5 yerleşik rol (Sistem Yöneticisi, Daire Başkanı, Proje Yöneticisi, Çalışan, Dış Kullanıcı) önceki davranışı birebir korur. Örnek özel roller de gelir (Birim Müdürü, Talep Karşılama Personeli, Envanter Sorumlusu, İzleyici); bunlar düzenlenebilir veya silinebilir.
- **Roller ve İzinler** ekranından (web: menüde *Yönetim → Roller ve İzinler*, mobil: *Roller* sekmesi) yeni rol oluşturulur, izinleri işaretlenir ve kullanıcılara atanır. Bu ekran `role.manage` iznini gerektirir; Sistem Yöneticisi rolü kilitlidir (kimse kendini dışarıda bırakamaz) ve kimse kendi rolünü değiştiremez.
- Rol veya izin değişikliği kullanıcının bir sonraki isteğinde geçerli olur (token yenilemeyi beklemez). Rol tanımlarını mobilde görüntüleme ve kullanıcıya atama yapılır; izin düzenleme web'dedir.

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
