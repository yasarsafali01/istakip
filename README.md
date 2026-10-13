# Mersin Üniversitesi Talep Takip Sistemi

Mersin Üniversitesi birimleri için talep takip sistemi: daire başkanlığı/müdürlük bazında talep yönetimi. Daire başkanlıkları, müdürlükler, issue/talep takibi, aylık sprint döngüsü, rol tabanlı erişim ve envanter takibi içerir.

> **Terminoloji:** Arayüzde *Daire Başkanlığı* ve *Müdürlük* olarak geçen kavramlar kodda, API'de ve veritabanında hâlâ `unit` ve `project` adıyla tutulur (`/units`, `/projects`, `units` / `projects` tabloları). Aynı şekilde *Müdür* rolünün anahtarı `Project_Manager`'dır.

## Mimari

Üç bileşenden oluşur:

- **frontend/** — React (Create React App) web uygulaması. Board (Kanban), backlog, dashboard, talep yönetimi ekranları.
- **backend/** — Go + PostgreSQL REST API. Kimlik doğrulama, rol tabanlı yetkilendirme ve tüm iş kurallarının (sprint hesaplama, issue numaralandırma, talep akışı, envanter düşümü) tek kaynağı.
- **mobile/** — React Native (Expo) mobil uygulama. Web ile aynı backend'i kullanır, aynı rol setine göre uyarlanmış ekranlar sunar (bkz. mobile/README.md — kapsam detayları).

Veri akışı: `mobile/` ve `frontend/`, `backend/`'in REST API'sine JWT ile kimlik doğrulayarak istek atar; kalıcı veri yalnızca PostgreSQL'de tutulur (frontend artık localStorage kullanmaz).

## Roller ve İzinler

Yetkilendirme sabit rol adlarına değil **izinlere** bağlıdır. Bir rol = bir *izin kümesi* + bir *veri kapsamı*:

- **Veri kapsamı** rolün neyi görebileceğini belirler: `all` (tüm sistem), `unit` (kendi daire başkanlığı), `manager` (yönettiği müdürlükler), `project` (atandığı müdürlük), `own` (yalnızca kendi talepleri).
- **İzinler** rolün neleri yapabileceğini belirler: talep aç, iş oluştur/düzenle/sil, durum değiştir, atama yap, tarih düzenle, aya taşı, aylık dönem yönet, envanter yönet/kullan, müdürlük/daire başkanlığı yönet, rol yönet (tam liste: `GET /permissions`).
- Yerleşik roller (Sistem Yöneticisi, Daire Başkanı, Müdür, Çalışan ve talep sahibi olarak Üniversite Personeli / Öğrenci) önceki davranışı birebir korur. Örnek özel roller de gelir (Daire Başkan Yardımcısı, Talep Karşılama Personeli, Envanter Sorumlusu, İzleyici); bunlar düzenlenebilir veya silinebilir.
- **Roller ve İzinler** ekranından (web: menüde *Yönetim → Roller ve İzinler*, mobil: *Roller* sekmesi) yeni rol oluşturulur, izinleri işaretlenir ve kullanıcılara atanır. Bu ekran `role.manage` iznini gerektirir; Sistem Yöneticisi rolü kilitlidir (kimse kendini dışarıda bırakamaz) ve kimse kendi rolünü değiştiremez.
- Bir kullanıcının bir **ana rolü** ve istediği kadar **ek rolü** olabilir (ör. Çalışan + Envanter Sorumlusu). Etkin yetki tüm rollerin birleşimidir: izinlerin hepsi, en geniş veri kapsamı ve en yüksek seviye. Ek roller *Yönetim → Kullanıcılar* ekranından, aynı hiyerarşi kuralıyla (yalnızca kendi seviyenizin altındaki roller) atanır.
- Rol veya izin değişikliği kullanıcının bir sonraki isteğinde geçerli olur (token yenilemeyi beklemez). Rol tanımlarını mobilde görüntüleme ve kullanıcıya atama yapılır; izin düzenleme web'dedir.

## Klasör Yapısı

```
istakip/
  frontend/   # React web app (bkz. frontend/README.md)
  backend/    # Go API (bkz. backend/README.md)
  mobile/     # React Native app (bkz. mobile/README.md)
  docs/       # Windows (geliştirme) ve Ubuntu sunucu (kalıcı yayın) kurulum rehberleri
  deploy/     # Sunucu dosyaları: nginx ayarı ve güncelleme betiği
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

Sıfırdan kurulum (programların kurulumu, veritabanı, backend testleri, web ve mobil) için:

- **Windows:** [docs/KURULUM-WINDOWS.md](docs/KURULUM-WINDOWS.md)
- **Ubuntu sunucu (kalıcı yayın, http://<SUNUCU_IP>):** [docs/KURULUM-UBUNTU.md](docs/KURULUM-UBUNTU.md)
- Kısa özet ve ortam değişkenleri: [INSTALL.md](INSTALL.md)
