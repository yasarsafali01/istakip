# Ubuntu'da Sıfırdan Kurulum

Bu rehber, bilgisayarında hiçbir geliştirme aracı olmayan birinin Mersin Üniversitesi Talep Takip Sistemi'ni (backend + web + mobil) **Ubuntu 22.04 / 24.04** üzerinde kurup çalıştırması için yazıldı. Komutları sırayla Terminal'e (`Ctrl+Alt+T`) yapıştırın; her adımın sonundaki "Kontrol" kısmıyla doğru gidip gitmediğinizi görebilirsiniz.

> Windows kullanıyorsanız: [KURULUM-WINDOWS.md](KURULUM-WINDOWS.md)

## İçindekiler

1. [Sistemin parçaları](#1-sistemin-parçaları)
2. [Gerekli programları kurun](#2-gerekli-programları-kurun)
3. [Projeyi indirin](#3-projeyi-indirin)
4. [Veritabanını başlatın](#4-veritabanını-başlatın-postgresql--docker)
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

### 2.1 Temel araçlar

```bash
sudo apt update
sudo apt install -y git curl ca-certificates gnupg build-essential openssl
```

### 2.2 Go (1.26 veya üstü)

Ubuntu depolarındaki Go sürümü bu proje için eskidir; resmi paketi kurun. Güncel sürüm numarasını https://go.dev/dl/ adresinden kontrol edip aşağıdaki `GO_VERSION` değerini ona göre değiştirebilirsiniz (1.26 veya üstü olmalı).

```bash
GO_VERSION=1.26.0
curl -LO https://go.dev/dl/go${GO_VERSION}.linux-amd64.tar.gz
sudo rm -rf /usr/local/go
sudo tar -C /usr/local -xzf go${GO_VERSION}.linux-amd64.tar.gz
rm go${GO_VERSION}.linux-amd64.tar.gz
echo 'export PATH=$PATH:/usr/local/go/bin:$HOME/go/bin' >> ~/.bashrc
source ~/.bashrc
```

> ARM işlemcili bir makinedeyseniz (`uname -m` çıktısı `aarch64`), dosya adındaki `amd64`'ü `arm64` yapın.

### 2.3 Node.js 22 LTS

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

### 2.4 Docker Engine ve Docker Compose

```bash
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

Docker'ı her seferinde `sudo` yazmadan kullanabilmek için kullanıcınızı `docker` grubuna ekleyin:

```bash
sudo usermod -aG docker $USER
newgrp docker
```

> `newgrp` sadece o terminal penceresi için geçerlidir. Kalıcı olması için oturumu kapatıp yeniden açın (ya da bilgisayarı yeniden başlatın).

### Kontrol

```bash
git --version          # git version 2.x
go version             # go version go1.26 veya üstü
node -v                # v22.x
npm -v                 # 10.x
docker --version       # Docker version 2x.x
docker compose version # Docker Compose version v2.x
docker run --rm hello-world   # "Hello from Docker!" yazmalı
```

## 3. Projeyi indirin

```bash
cd ~
git clone https://github.com/yasarsafali01/istakip.git
cd istakip
```

### Kontrol

```bash
ls
# backend  docs  frontend  INSTALL.md  mobile  README.md
```

## 4. Veritabanını başlatın (PostgreSQL + Docker)

```bash
cd ~/istakip/backend
docker compose up -d
```

Bu komut ilk seferde PostgreSQL 16 imajını indirir ve veritabanını arka planda başlatır. Bilgiler:

- Kullanıcı / şifre / veritabanı adı: `istakip` / `istakip` / `istakip`
- Port: **5433** (5432 değil; makinede kurulu başka bir PostgreSQL ile çakışmasın diye)
- Veriler `istakip_pg_data` adlı Docker volume'unda saklanır; makine yeniden başlasa da kaybolmaz.

Docker servisi Ubuntu açılışında otomatik başlar. Container'ı yeniden başlatmanız gerekirse `docker compose up -d` komutunu tekrar çalıştırın.

### Kontrol

```bash
docker compose ps
# backend-postgres-1 ... running   0.0.0.0:5433->5432/tcp
```

## 5. Backend'i kurun ve çalıştırın

Bu adımda `~/istakip/backend` klasöründe olmalısınız.

### 5.1 Ortam dosyasını oluşturun

```bash
cp .env.example .env
sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$(openssl rand -hex 32)|" .env
cat .env
```

İkinci komut `JWT_SECRET` değerini rastgele, güvenli bir anahtarla değiştirir. Dosya şöyle görünmelidir:

```env
DATABASE_URL=postgres://istakip:istakip@localhost:5433/istakip?sslmode=disable
JWT_SECRET=<64 karakterlik rastgele değer>
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=720h
PORT=8080
UPLOAD_DIR=uploads
```

| Değişken | Açıklama |
|---|---|
| `DATABASE_URL` | Veritabanı bağlantısı. Docker ayarlarını değiştirmediyseniz olduğu gibi bırakın. |
| `JWT_SECRET` | Giriş token'larını imzalayan gizli anahtar. Paylaşmayın. |
| `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL` | Oturum süreleri (15 dakika / 30 gün). |
| `PORT` | Backend'in dinlediği port. |
| `UPLOAD_DIR` | Talep formlarına yüklenen dosyaların klasörü (`backend/uploads`). |
| `CORS_ORIGINS` | *(isteğe bağlı)* API'ye tarayıcıdan erişebilecek adresler. Varsayılan: `http://localhost:3000,http://localhost:19006`. Web'i başka bir adresten açacaksanız ekleyin. |

> `.env` dosyası gizli bilgiler içerir ve `.gitignore` sayesinde Git'e gönderilmez. Asla commit etmeyin. Dosyayı düzenlemek için: `nano .env` (kaydet: `Ctrl+O`, `Enter`; çık: `Ctrl+X`).

### 5.2 Go bağımlılıklarını indirin

```bash
go mod download
```

### 5.3 Veritabanı tablolarını oluşturun (migration)

```bash
go run ./cmd/migrate up
```

`backend/migrations/` klasöründeki tüm şema değişikliklerini sırayla uygular. Tekrar çalıştırmak zararsızdır; yalnızca eksik olanları uygular.

> ⚠️ `go run ./cmd/migrate down` migration'ları **geri alır ve verileri siler**. Sadece veritabanını bilerek sıfırlamak istediğinizde kullanın.

### 5.4 Örnek verileri yükleyin (seed)

```bash
go run ./cmd/seed
```

Daire başkanlıkları, müdürlükler, kullanıcılar, roller ve örnek talepleri ekler. Birden çok kez çalıştırılabilir; var olan kayıtları çoğaltmaz.

### 5.5 Backend'i çalıştırın

```bash
go run ./cmd/api
```

Konsolda backend'in 8080 portunda dinlediğini gösteren bir log satırı görürsünüz. **Bu terminali kapatmayın**; kapatırsanız backend durur. Sonraki adımlar için yeni bir terminal sekmesi açın (`Ctrl+Shift+T`).

## 6. Backend'i test edin

Backend çalışırken yeni bir terminalde aşağıdaki adımları uygulayın. JSON çıktılarını okunaklı görmek için `jq` kurun:

```bash
sudo apt install -y jq
```

### 6.1 Sağlık kontrolü

```bash
curl -s http://localhost:8080/health | jq
```

Beklenen çıktı:

```json
{ "database": "connected", "status": "ok" }
```

`database` değeri `unreachable` ise veritabanı çalışmıyordur (bkz. adım 4).

### 6.2 Giriş yapıp token alın

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}' | jq -r .accessToken)
echo "$TOKEN" | cut -c1-30    # eyJhbGciOiJIUzI1NiIsInR5cCI6... gibi bir değer
```

Yanlış şifreyle denerseniz `401` döner; bu beklenen davranıştır:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" -d '{"email":"admin@example.com","password":"yanlis"}'
# 401
```

### 6.3 Yetkili istekler

```bash
AUTH="Authorization: Bearer $TOKEN"
curl -s http://localhost:8080/users/me    -H "$AUTH" | jq '{name, email, role}'
curl -s http://localhost:8080/units       -H "$AUTH" | jq length   # daire başkanlığı sayısı
curl -s http://localhost:8080/projects    -H "$AUTH" | jq length   # müdürlük sayısı
curl -s http://localhost:8080/issues      -H "$AUTH" | jq length   # talep / iş sayısı
curl -s http://localhost:8080/permissions -H "$AUTH" | jq          # sistemdeki tüm izinler
```

Token olmadan istek atarsanız `401` dönmelidir:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/issues
# 401
```

### 6.4 Rol bazlı görünürlüğü deneyin

Farklı rollerdeki kullanıcıların farklı veri gördüğünü kontrol edin:

```bash
count() {
  local t=$(curl -s -X POST http://localhost:8080/auth/login -H "Content-Type: application/json" \
    -d "{\"email\":\"$1\",\"password\":\"$2\"}" | jq -r .accessToken)
  echo "$1 → $(curl -s http://localhost:8080/issues -H "Authorization: Bearer $t" | jq length) kayıt"
}
count admin@example.com admin123          # sistemin tamamı
count bigd.baskan@example.com pass123     # yalnızca kendi daire başkanlığı
count bigd.pm@example.com pass123         # yalnızca yönettiği müdürlük
count dis.kullanici@example.com pass123   # yalnızca kendi açtığı talepler
```

Sayıların yukarıdan aşağıya doğru azalması beklenir.

### 6.5 Derleme ve statik kontrol

`~/istakip/backend` klasöründe:

```bash
go build ./...   # tüm paketler derleniyor mu?
go vet ./...     # yaygın hataları arar; çıktı vermemesi başarılıdır
go test ./...    # birim testler (henüz test dosyası yoksa "no test files" yazar)
```

### 6.6 Veritabanına doğrudan bakmak (isteğe bağlı)

```bash
docker exec -it backend-postgres-1 psql -U istakip -d istakip
```

`psql` içinde örnek komutlar: `\dt` (tablolar), `SELECT email, role FROM users LIMIT 10;`, `\q` (çıkış).

## 7. Web uygulamasını kurun ve çalıştırın

Yeni bir terminalde:

```bash
cd ~/istakip/frontend
cp .env.example .env
npm install
npm start
```

- `.env` içinde tek ayar vardır: `REACT_APP_API_URL=http://localhost:8080` (backend adresi).
- `npm install` ilk seferde birkaç dakika sürer.
- `npm start` tarayıcıda **http://localhost:3000** adresini açar (açmazsa adresi elle yazın). Bu terminali de açık bırakın.

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

```bash
npm run build
```

Sunucuya konacak statik dosyaları `frontend/build/` klasörüne üretir. Derleme hatasız bitmelidir.

### Web birim testleri (isteğe bağlı)

```bash
CI=true npm test
```

> Not: `IssueDetailContent.bugfix.test.js` ve `RequestDetailContent` testlerinin bir kısmı, yetki kurallarının backend'e (`allowedActions`) taşınmasından önceki davranışa göre yazılmıştır ve şu an başarısız olur. Bu, uygulamanın çalışmasını etkilemez; testlerin güncellenmesi gerekiyor.

## 8. Mobil uygulamayı kurun ve çalıştırın

### 8.1 Telefona Expo Go kurun

- Android: Google Play'den **Expo Go**
- iOS: App Store'dan **Expo Go**

Proje **Expo SDK 57** kullanır; Expo Go'nun güncel sürümünü kurun.

### 8.2 Bilgisayarın yerel IP adresini öğrenin

Telefon `localhost` adresine ulaşamaz; bilgisayarın ağdaki IP adresini kullanmanız gerekir:

```bash
hostname -I | awk '{print $1}'
# ör. 192.168.1.42
```

**Telefon ve bilgisayar aynı Wi-Fi ağında olmalıdır.**

### 8.3 Kurulum ve çalıştırma

```bash
cd ~/istakip/mobile
cp .env.example .env
echo "EXPO_PUBLIC_API_URL=http://$(hostname -I | awk '{print $1}'):8080" > .env
cat .env      # EXPO_PUBLIC_API_URL=http://192.168.1.42:8080
npm install --legacy-peer-deps
npx expo start
```

- `--legacy-peer-deps` gereklidir; bazı paketlerin React sürüm beyanlarındaki küçük uyuşmazlıklar nedeniyle düz `npm install` hata verir.
- Terminalde bir **QR kod** çıkar. Android'de Expo Go uygulamasıyla, iOS'ta telefonun kamerasıyla okutun.
- Uygulama açılınca giriş ekranındaki **Demo Giriş Bilgileri** listesinden bir hesaba dokunun.

> `.env` dosyasını değiştirdikten sonra Expo'yu durdurup (`Ctrl+C`) `npx expo start --clear` ile yeniden başlatın; aksi hâlde eski adres kullanılmaya devam eder.

### 8.4 Telefondan bağlanılamıyorsa

1. Telefonun tarayıcısında `http://192.168.1.42:8080/health` adresini açın (kendi IP'nizle). `{"database":"connected","status":"ok"}` görmelisiniz.
2. Açılmıyorsa güvenlik duvarı (ufw) portları engelliyor olabilir:

   ```bash
   sudo ufw status
   # "Status: active" ise:
   sudo ufw allow 8080/tcp
   sudo ufw allow 8081/tcp
   ```

3. Kurum/okul ağları cihazların birbirini görmesini engelleyebilir. Bu durumda `npx expo start --tunnel` deneyin; backend için ise telefon ve bilgisayarı aynı mobil hotspot'a bağlamak en kolay çözümdür.
4. Çok sayıda dosya izlenirken `ENOSPC: System limit for number of file watchers reached` hatası alırsanız:

   ```bash
   echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf && sudo sysctl -p
   ```

### 8.5 Mobil kod kontrolü (isteğe bağlı)

```bash
npx tsc --noEmit                                                  # TypeScript tip kontrolü; çıktı vermemesi başarılıdır
npx expo export --platform android --output-dir /tmp/istakip-export   # paket derleniyor mu?
```

## 9. Günlük kullanım: sistemi açıp kapatmak

Kurulum bir kez yapılır. Sonraki günlerde üç ayrı terminal sekmesinde:

```bash
# 1. sekme — veritabanı + backend
cd ~/istakip/backend && docker compose up -d && go run ./cmd/api

# 2. sekme — web
cd ~/istakip/frontend && npm start

# 3. sekme — mobil (gerekirse)
cd ~/istakip/mobile && npx expo start
```

Kapatmak için her sekmede `Ctrl+C`, ardından veritabanını durdurmak isterseniz `cd ~/istakip/backend && docker compose stop`.

### Güncellemeleri almak

```bash
cd ~/istakip
git pull
(cd backend && go mod download && go run ./cmd/migrate up)
(cd frontend && npm install)
(cd mobile && npm install --legacy-peer-deps)
```

`git pull` sonrasında yeni migration geldiyse `migrate up` onu uygular. Bunu backend'i başlatmadan önce yapın.

### Veritabanını tamamen sıfırlamak

> ⚠️ Tüm veriler silinir.

```bash
cd ~/istakip/backend
docker compose down -v      # veritabanı ve volume'u siler
docker compose up -d
go run ./cmd/migrate up
go run ./cmd/seed
```

## 10. Sık karşılaşılan sorunlar

| Belirti | Sebep / Çözüm |
|---|---|
| `permission denied while trying to connect to the Docker daemon socket` | Kullanıcınız `docker` grubunda değil ya da oturum yenilenmedi: `sudo usermod -aG docker $USER`, sonra oturumu kapatıp açın. |
| `Cannot connect to the Docker daemon` | Docker servisi kapalı: `sudo systemctl start docker` (açılışta başlasın: `sudo systemctl enable docker`). |
| `port is already allocated` (5433) | Başka bir container o portu kullanıyor: `docker ps` ile bulun, durdurun. |
| Backend: `loading roles failed (run migrations?)` | Migration'lar uygulanmamış: `go run ./cmd/migrate up`. |
| Backend: `connection refused` / health'te `unreachable` | Veritabanı çalışmıyor: `cd ~/istakip/backend && docker compose up -d`. |
| Backend: `address already in use` (8080) | Backend zaten açık: `sudo lsof -i :8080` ile süreci bulup `kill <PID>`. |
| `go: command not found` | PATH ayarı yüklenmedi: `source ~/.bashrc` ya da yeni terminal açın. |
| `go: go.mod requires go >= 1.26` | Go sürümünüz eski; adım 2.2'yi yeni sürümle tekrarlayın. |
| Web'de giriş yapınca "Failed to fetch" / ağ hatası | Backend kapalı ya da `frontend/.env` içindeki adres yanlış. `.env`'i değiştirdiyseniz `npm start`'ı yeniden başlatın. |
| Tarayıcı konsolunda CORS hatası | Web'i `localhost:3000` dışında bir adresten açıyorsunuz: backend `.env`'ine `CORS_ORIGINS=http://localhost:3000,http://<adres>` ekleyip backend'i yeniden başlatın. |
| `npm install` (mobile) `ERESOLVE` hatası | `npm install --legacy-peer-deps` kullanın. |
| Mobilde "Network request failed" | `mobile/.env` içinde `localhost` kalmış ya da IP yanlış; bkz. 8.4. |
| Expo Go "incompatible SDK version" | Expo Go uygulamasını mağazadan güncelleyin. |
