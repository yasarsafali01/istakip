# Windows'ta Sıfırdan Kurulum

Bu rehber, bilgisayarında hiçbir geliştirme aracı olmayan birinin Mersin Üniversitesi Talep Takip Sistemi'ni (backend + web + mobil) Windows 10/11 üzerinde kurup çalıştırması için yazıldı. Adımları sırayla uygulayın; her adımın sonunda "Kontrol" kısmındaki komutla doğru gidip gitmediğinizi görebilirsiniz.

> Ubuntu kullanıyorsanız: [KURULUM-UBUNTU.md](KURULUM-UBUNTU.md)

## İçindekiler

1. [Sistemin parçaları](#1-sistemin-parçaları)
2. [Gerekli programları kurun](#2-gerekli-programları-kurun)
3. [Projeyi indirin](#3-projeyi-indirin)
4. [Ortam dosyasını oluşturun ve veritabanını başlatın](#4-ortam-dosyasını-oluşturun-ve-veritabanını-başlatın)
5. [Backend'i kurun ve çalıştırın](#5-backendi-kurun-ve-çalıştırın)
6. [Backend'i test edin](#6-backendi-test-edin)
7. [Web uygulamasını kurun ve çalıştırın](#7-web-uygulamasını-kurun-ve-çalıştırın)
8. [Mobil uygulamayı kurun ve çalıştırın](#8-mobil-uygulamayı-kurun-ve-çalıştırın)
9. [Günlük kullanım: sistemi açıp kapatmak](#9-günlük-kullanım-sistemi-açıp-kapatmak)
10. [Sık karşılaşılan sorunlar](#10-sık-karşılaşılan-sorunlar)

---

## 1. Sistemin parçaları

| Parça | Klasör | Ne işe yarar | Adres |
|---|---|---|---|
| Veritabanı | `backend/docker-compose.yml` | PostgreSQL 16, Docker içinde çalışır | `localhost:5433` |
| Backend (API) | `backend/` | Go ile yazılmış REST API; tüm iş kuralları burada | `http://localhost:8080` |
| Web | `frontend/` | React web uygulaması | `http://localhost:3000` |
| Mobil | `mobile/` | Expo (React Native) uygulaması; telefonda Expo Go ile açılır | Expo: `8081` |

Web ve mobil, verileri sadece backend'den alır. Bu yüzden **önce veritabanı, sonra backend** çalışıyor olmalıdır.

## 2. Gerekli programları kurun

Aşağıdaki programları sırayla kurun. Kurulumlarda varsayılan seçenekleri kabul etmeniz yeterli.

| Program | Gerekli sürüm | İndirme adresi |
|---|---|---|
| Git | herhangi güncel | https://git-scm.com/download/win |
| Go | **1.26 veya üstü** | https://go.dev/dl/ (Windows `.msi` dosyası) |
| Node.js | **22 LTS** (20.19+ da olur) | https://nodejs.org/ (LTS `.msi`) |
| Docker Desktop | güncel | https://www.docker.com/products/docker-desktop/ |

### Docker Desktop hakkında

- Kurulum sırasında **"Use WSL 2 instead of Hyper-V"** seçeneği işaretli kalsın.
- Kurulumdan sonra bilgisayarı yeniden başlatmanız istenebilir.
- Docker Desktop'ı açın ve sol altta **"Engine running"** yazana kadar bekleyin. Docker kapalıyken veritabanı çalışmaz.
- "WSL 2 installation is incomplete" uyarısı çıkarsa, **yönetici olarak** PowerShell açıp `wsl --install` çalıştırın ve bilgisayarı yeniden başlatın.

### PowerShell'i hazırlayın

Bu rehberdeki komutlar **PowerShell**'de çalıştırılır (Başlat menüsünde "PowerShell" yazın). Programları kurduktan sonra **yeni bir PowerShell penceresi** açın; eski pencere yeni kurulan programları görmez.

`npm` komutu "running scripts is disabled on this system" hatası verirse bir kez şunu çalıştırın:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

### Kontrol

```powershell
git --version       # git version 2.x
go version          # go version go1.26 veya üstü
node -v             # v22.x (en az v20.19)
npm -v              # 10.x
docker --version    # Docker version 2x.x
docker compose version
```

Komutlardan biri "tanınmıyor" hatası verirse ilgili programı yeniden kurun ve **yeni** bir PowerShell penceresi açın.

## 3. Projeyi indirin

Projeyi koymak istediğiniz klasöre gidip indirin (örnek: Masaüstü):

```powershell
cd $HOME\Desktop
git clone https://github.com/yasarsafali01/istakip.git
cd istakip
```

> Proje klasörünün tam yolunda Türkçe karakter veya boşluk olmaması önerilir (ör. `C:\projeler\istakip`). Çoğu araç sorunsuz çalışır, ancak bazı Android/Expo araçları bu tür yollarda hata verebilir.

### Kontrol

```powershell
dir
# backend, frontend, mobile, docs klasörlerini ve README.md dosyasını görmelisiniz
```

## 4. Ortam dosyasını oluşturun ve veritabanını başlatın

Adresler, portlar ve şifreler kodda değil, Git'e gönderilmeyen `.env` dosyalarında tutulur. Veritabanı da ayarlarını bu dosyadan okuduğu için önce `.env` oluşturulur.

### 4.1 Ortam dosyasını oluşturun

```powershell
cd backend
Copy-Item .env.example .env
```

`.env` dosyasını Not Defteri ile açın (`notepad .env`). İçeriği şöyle olmalı:

```env
DB_USER=istakip
DB_PASSWORD=istakip
DB_NAME=istakip
DB_PORT=5433
DATABASE_URL=postgres://${DB_USER}:${DB_PASSWORD}@localhost:${DB_PORT}/${DB_NAME}?sslmode=disable

JWT_SECRET=değiştir-bu-gizli-anahtarı
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=720h
PORT=8080
UPLOAD_DIR=uploads
CORS_ORIGINS=http://localhost:3000,http://localhost:19006
```

| Değişken | Açıklama |
|---|---|
| `DB_USER` / `DB_PASSWORD` / `DB_NAME` | Veritabanı kullanıcısı, şifresi ve adı. Docker veritabanını ilk açılışta bu değerlerle oluşturur. |
| `DB_PORT` | Veritabanı portu (5432 değil; bilgisayarda kurulu başka bir PostgreSQL ile çakışmasın diye). |
| `DATABASE_URL` | Backend'in bağlantı adresi. Yukarıdaki değerlerden otomatik oluşur; elle değiştirmeyin. |
| `JWT_SECRET` | Giriş token'larını imzalayan gizli anahtar. **Mutlaka değiştirin** (aşağıya bakın). |
| `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL` | Oturum süreleri (15 dakika / 30 gün). |
| `PORT` | Backend'in dinlediği port. Boşsa backend başlamaz. |
| `UPLOAD_DIR` | Talep formlarına yüklenen dosyaların klasörü (`backend/uploads`). |
| `CORS_ORIGINS` | API'ye tarayıcıdan erişebilecek adresler (virgülle ayrılmış). Boşsa backend başlamaz. Web'i başka bir adresten açacaksanız ekleyin. |

Rastgele bir `JWT_SECRET` üretmek için:

```powershell
-join ((1..32) | ForEach-Object { '{0:x2}' -f (Get-Random -Maximum 256) })
```

Çıkan değeri `.env` içindeki `JWT_SECRET=` satırına yapıştırıp kaydedin.

> `.env` dosyası gizli bilgiler içerir ve `.gitignore` sayesinde Git'e gönderilmez. Asla commit etmeyin.

### 4.2 Veritabanını başlatın (PostgreSQL + Docker)

Docker Desktop'ın açık olduğundan emin olun, ardından `backend` klasöründe:

```powershell
docker compose up -d
```

Bu komut ilk seferde PostgreSQL 16 imajını indirir (birkaç dakika sürebilir) ve veritabanını `.env`'deki kullanıcı, şifre ve portla arka planda başlatır. Veriler `istakip_pg_data` adlı Docker volume'unda saklanır; bilgisayarı kapatıp açtığınızda kaybolmaz.

### Kontrol

```powershell
docker compose ps
# backend-postgres-1 ... running   127.0.0.1:5433->5432/tcp
```

## 5. Backend'i kurun ve çalıştırın

Bu adımda hâlâ `backend` klasöründe olmalısınız.

### 5.1 Go bağımlılıklarını indirin

```powershell
go mod download
```

### 5.2 Veritabanı tablolarını oluşturun (migration)

```powershell
go run ./cmd/migrate up
```

`backend/migrations/` klasöründeki tüm şema değişikliklerini sırayla uygular. Tekrar çalıştırmak zararsızdır; yalnızca eksik olanları uygular.

> ⚠️ `go run ./cmd/migrate down` migration'ları **geri alır ve verileri siler**. Sadece veritabanını bilerek sıfırlamak istediğinizde kullanın.

### 5.3 Örnek verileri yükleyin (seed)

```powershell
go run ./cmd/seed
```

Daire başkanlıkları, müdürlükler, kullanıcılar, roller ve örnek talepleri ekler. Birden çok kez çalıştırılabilir; var olan kayıtları çoğaltmaz.

### 5.4 Backend'i çalıştırın

```powershell
go run ./cmd/api
```

Konsolda backend'in 8080 portunda dinlediğini gösteren bir log satırı görürsünüz. **Bu pencereyi kapatmayın**; kapatırsanız backend durur. Sonraki adımlar için **yeni bir PowerShell penceresi** açın.

> Windows Güvenlik Duvarı "ağ erişimine izin ver" diye sorarsa **Özel ağlar** için izin verin (mobil uygulamayı telefondan test etmek için gerekli).

## 6. Backend'i test edin

Backend çalışırken yeni bir PowerShell penceresinde aşağıdaki adımları uygulayın.

### 6.1 Sağlık kontrolü

```powershell
Invoke-RestMethod http://localhost:8080/health
```

Beklenen çıktı:

```
database  status
--------  ------
connected ok
```

`database` değeri `unreachable` ise veritabanı çalışmıyordur (bkz. adım 4.2). `curl.exe http://localhost:8080/health` komutu da aynı sonucu JSON olarak verir: `{"database":"connected","status":"ok"}`.

### 6.2 Giriş yapıp token alın

```powershell
$login = Invoke-RestMethod -Method Post -Uri http://localhost:8080/auth/login `
  -ContentType 'application/json' `
  -Body '{"email":"admin@example.com","password":"admin123"}'
$token = $login.accessToken
$login.user.name     # Sistem Yöneticisi
```

Yanlış şifre denerseniz `401 Unauthorized` hatası alırsınız. Bu da beklenen bir davranıştır.

### 6.3 Yetkili istekler

```powershell
$h = @{ Authorization = "Bearer $token" }
Invoke-RestMethod http://localhost:8080/users/me -Headers $h          # giriş yapan kullanıcı
(Invoke-RestMethod http://localhost:8080/units -Headers $h).Count     # daire başkanlığı sayısı
(Invoke-RestMethod http://localhost:8080/projects -Headers $h).Count  # müdürlük sayısı
(Invoke-RestMethod http://localhost:8080/issues -Headers $h).Count    # talep / iş sayısı
Invoke-RestMethod http://localhost:8080/permissions -Headers $h       # sistemdeki tüm izinler
```

Token olmadan istek atarsanız `401` dönmelidir:

```powershell
Invoke-RestMethod http://localhost:8080/issues   # 401 Unauthorized beklenir
```

### 6.4 Rol bazlı görünürlüğü deneyin

Farklı rollerdeki kullanıcıların farklı veri gördüğünü kontrol edin:

```powershell
function Get-Count($email, $password) {
  $t = (Invoke-RestMethod -Method Post -Uri http://localhost:8080/auth/login -ContentType 'application/json' `
        -Body (@{ email = $email; password = $password } | ConvertTo-Json)).accessToken
  (Invoke-RestMethod http://localhost:8080/issues -Headers @{ Authorization = "Bearer $t" }).Count
}
Get-Count 'admin@example.com' 'admin123'          # sistemin tamamı
Get-Count 'bigd.baskan@example.com' 'pass123'     # yalnızca kendi daire başkanlığı
Get-Count 'bigd.pm@example.com' 'pass123'         # yalnızca yönettiği müdürlük
Get-Count 'dis.kullanici@example.com' 'pass123'   # yalnızca kendi açtığı talepler
```

Sayıların yukarıdan aşağıya doğru azalması beklenir.

### 6.5 Derleme ve statik kontrol

`backend` klasöründe:

```powershell
go build ./...   # tüm paketler derleniyor mu?
go vet ./...     # yaygın hataları arar; çıktı vermemesi başarılıdır
gofmt -l .       # biçim kontrolü; çıktı vermemesi başarılıdır
go test ./...    # birim testler (henüz test dosyası yoksa "no test files" yazar)
```

### 6.6 Veritabanına doğrudan bakmak (isteğe bağlı)

```powershell
docker exec -it backend-postgres-1 psql -U istakip -d istakip
```

`psql` içinde örnek komutlar: `\dt` (tablolar), `SELECT email, role FROM users LIMIT 10;`, `\q` (çıkış).

## 7. Web uygulamasını kurun ve çalıştırın

Yeni bir PowerShell penceresinde, proje kök klasöründen:

```powershell
cd frontend
Copy-Item .env.example .env
npm install
npm start
```

- `.env` içinde tek ayar vardır: `REACT_APP_API_URL=http://localhost:8080` (backend adresi).
- `npm install` ilk seferde birkaç dakika sürer.
- `npm start` tarayıcıda otomatik olarak **http://localhost:3000** adresini açar. Bu pencereyi de açık bırakın.

### Giriş yapın

Giriş ekranındaki **Demo Hesapları** listesinden bir satıra tıklayın; e-posta ve şifre otomatik dolar.

| Rol | E-posta | Şifre |
|---|---|---|
| Sistem Yöneticisi | `admin@example.com` | `admin123` |
| Daire Başkanı (Bilgi İşlem) | `bigd.baskan@example.com` | `pass123` |
| Müdür (Donanım) | `bigd.pm@example.com` | `pass123` |
| Çalışan | `bigd.worker1@example.com` | `pass123` |
| Daire Başkanı (Öğrenci İşleri) | `odb.baskan@example.com` | `pass123` |
| Üniversite Personeli | `dis.kullanici@example.com` | `pass123` |
| Öğrenci | `ogrenci@example.com` | `pass123` |

### Üretim derlemesi (isteğe bağlı)

```powershell
$env:CI = 'true'; npm run build
```

Sunucuya konacak statik dosyaları `frontend/build/` klasörüne üretir. `CI=true` ile lint uyarıları da hata sayılır (GitLab CI'daki gibi); derleme "The build folder is ready to be deployed" ile bitmelidir.

### Web birim testleri (isteğe bağlı)

```powershell
$env:CI = 'true'; npm test
```

İki test paketi çalışır: uygulamanın oturum yokken giriş ekranıyla açıldığını doğrulayan duman testi ve talep detayındaki butonların backend'den gelen `allowedActions` bayraklarına göre gösterildiğini doğrulayan testler. Beklenen sonuç: `Tests: 9 passed`.

## 8. Mobil uygulamayı kurun ve çalıştırın

### 8.1 Telefona Expo Go kurun

- Android: Google Play'den **Expo Go**
- iOS: App Store'dan **Expo Go**

Proje **Expo SDK 57** kullanır; Expo Go'nun güncel sürümünü kurun.

### 8.2 Bilgisayarın yerel IP adresini öğrenin

Telefon `localhost` adresine ulaşamaz; bilgisayarın ağdaki IP adresini kullanmanız gerekir:

```powershell
ipconfig
```

"Wireless LAN adapter Wi-Fi" (ya da Ethernet) altındaki **IPv4 Address** değerini not edin (ör. `192.168.1.42`). **Telefon ve bilgisayar aynı Wi-Fi ağında olmalıdır.**

### 8.3 Kurulum ve çalıştırma

Yeni bir PowerShell penceresinde, proje kök klasöründen:

```powershell
cd mobile
Copy-Item .env.example .env
notepad .env
```

`.env` içeriğini kendi IP adresinizle değiştirin:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.42:8080
```

Sonra:

```powershell
npm install --legacy-peer-deps
npx expo start
```

- `--legacy-peer-deps` gereklidir; bazı paketlerin React sürüm beyanlarındaki küçük uyuşmazlıklar nedeniyle düz `npm install` hata verir.
- Terminalde bir **QR kod** çıkar. Android'de Expo Go uygulamasıyla, iOS'ta telefonun kamerasıyla okutun.
- Uygulama açılınca giriş ekranındaki **Demo Giriş Bilgileri** listesinden bir hesaba dokunun.

> `.env` dosyasını değiştirdikten sonra Expo'yu durdurup (`Ctrl+C`) `npx expo start --clear` ile yeniden başlatın; aksi hâlde eski adres kullanılmaya devam eder.

### 8.4 Telefondan bağlanılamıyorsa

1. Telefonun tarayıcısında `http://192.168.1.42:8080/health` adresini açın (kendi IP'nizle). `{"database":"connected","status":"ok"}` görmelisiniz.
2. Açılmıyorsa Windows Güvenlik Duvarı 8080 portunu engelliyordur. **Yönetici** PowerShell'de:

   ```powershell
   New-NetFirewallRule -DisplayName "istakip API 8080" -Direction Inbound -Protocol TCP -LocalPort 8080 -Action Allow -Profile Private
   New-NetFirewallRule -DisplayName "Expo 8081" -Direction Inbound -Protocol TCP -LocalPort 8081 -Action Allow -Profile Private
   ```

3. Wi-Fi ağınızın Windows'ta **Özel ağ** olarak ayarlı olduğundan emin olun (Ayarlar → Ağ ve İnternet → Wi-Fi → ağ adı → Ağ profili türü: Özel).
4. Kurum/okul ağları cihazların birbirini görmesini engelleyebilir. Bu durumda `npx expo start --tunnel` deneyin; backend için ise telefon ve bilgisayarı aynı mobil hotspot'a bağlamak en kolay çözümdür.

### 8.5 Mobil kod kontrolü (isteğe bağlı)

```powershell
npx tsc --noEmit                                   # TypeScript tip kontrolü; çıktı vermemesi başarılıdır
npx expo-doctor                                    # bağımlılık uyumu; "21/21 checks passed" beklenir
npx expo export --platform android --output-dir $env:TEMP\istakip-export   # paket derleniyor mu?
```

## 9. Günlük kullanım: sistemi açıp kapatmak

Kurulum bir kez yapılır. Sonraki günlerde:

1. Docker Desktop'ı açın.
2. Üç ayrı PowerShell penceresinde:

   ```powershell
   # 1. pencere — veritabanı + backend
   cd $HOME\Desktop\istakip\backend
   docker compose up -d
   go run ./cmd/api

   # 2. pencere — web
   cd $HOME\Desktop\istakip\frontend
   npm start

   # 3. pencere — mobil (gerekirse)
   cd $HOME\Desktop\istakip\mobile
   npx expo start
   ```

Kapatmak için her pencerede `Ctrl+C`, ardından veritabanını durdurmak isterseniz `backend` klasöründe `docker compose stop`.

### Güncellemeleri almak

```powershell
cd $HOME\Desktop\istakip
git pull
cd backend;  go mod download; go run ./cmd/migrate up
cd ..\frontend; npm install
cd ..\mobile;   npm install --legacy-peer-deps
```

`git pull` sonrasında yeni migration geldiyse `migrate up` onu uygular. Bunu backend'i başlatmadan önce yapın.

### Veritabanını tamamen sıfırlamak

> ⚠️ Tüm veriler silinir.

```powershell
cd backend
docker compose down -v      # veritabanı ve volume'u siler
docker compose up -d
go run ./cmd/migrate up
go run ./cmd/seed
```

## 10. Sık karşılaşılan sorunlar

| Belirti | Sebep / Çözüm |
|---|---|
| `docker: error during connect` / `cannot find the file specified` | Docker Desktop kapalı. Açın ve "Engine running" yazısını bekleyin. |
| `port is already allocated` (5433) | Başka bir container o portu kullanıyor: `docker ps` ile bulun, durdurun. |
| Backend: `loading roles failed (run migrations?)` | Migration'lar uygulanmamış: `go run ./cmd/migrate up`. |
| Backend: `connection refused` / health'te `unreachable` | Veritabanı çalışmıyor: `cd backend; docker compose up -d`. |
| Backend: `bind: Only one usage of each socket address` (8080) | Backend zaten açık. Diğer pencereyi kapatın ya da `netstat -ano \| findstr :8080` ile süreci bulup `taskkill /PID <pid> /F` yapın. |
| `go: go.mod requires go >= 1.26` | Go sürümünüz eski; go.dev/dl'den güncelini kurun. |
| Web'de giriş yapınca "Failed to fetch" / ağ hatası | Backend kapalı ya da `frontend/.env` içindeki adres yanlış. `.env`'i değiştirdiyseniz `npm start`'ı yeniden başlatın. |
| Tarayıcı konsolunda CORS hatası | Web'i `localhost:3000` dışında bir adresten açıyorsunuz: backend `.env`'ine `CORS_ORIGINS=http://localhost:3000,http://<adres>` ekleyip backend'i yeniden başlatın. |
| `npm install` (mobile) `ERESOLVE` hatası | `npm install --legacy-peer-deps` kullanın. |
| `npm : ... running scripts is disabled` | `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned` |
| Mobilde "Network request failed" | `mobile/.env` içinde `localhost` kalmış ya da IP yanlış; bkz. 8.4. |
| Expo Go "incompatible SDK version" | Expo Go uygulamasını mağazadan güncelleyin. |
