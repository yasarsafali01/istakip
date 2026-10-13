# Ubuntu Sunucuya Kalıcı Kurulum

Bu rehber, Mersin Üniversitesi Talep Takip Sistemi'ni bir **Ubuntu 22.04 / 24.04** sunucusuna kalıcı olarak kurmak içindir. Kurulum bittiğinde:

- Veritabanı, backend ve web **sunucu açıldığında kendiliğinden başlar**; terminal açık tutmak gerekmez.
- Web uygulaması **http://<SUNUCU_IP>** adresinden, API **http://<SUNUCU_IP>:8080** adresinden erişilir.

Komutları sunucuda (SSH ile bağlanarak) sırayla çalıştırın. Her adımın sonundaki "Kontrol" kısmıyla doğru gidip gitmediğinizi görebilirsiniz.

> Rehberde geçen `<SUNUCU_IP>` ifadelerini sunucunuzun IP adresiyle değiştirin.
> Kendi bilgisayarınızda geliştirme yapmak için: [KURULUM-WINDOWS.md](KURULUM-WINDOWS.md)

## İçindekiler

1. [Sistemin parçaları](#1-sistemin-parçaları)
2. [Gerekli programları kurun](#2-gerekli-programları-kurun)
3. [Projeyi indirin](#3-projeyi-indirin)
4. [Ortam dosyasını oluşturun ve veritabanını başlatın](#4-ortam-dosyasını-oluşturun-ve-veritabanını-başlatın)
5. [Backend'i kurun ve servis olarak çalıştırın](#5-backendi-kurun-ve-servis-olarak-çalıştırın)
6. [Web uygulamasını derleyin ve nginx ile yayınlayın](#6-web-uygulamasını-derleyin-ve-nginx-ile-yayınlayın)
7. [Güvenlik duvarı](#7-güvenlik-duvarı)
8. [Şifreler ve ilk giriş](#8-şifreler-ve-ilk-giriş)
9. [Mobil uygulama](#9-mobil-uygulama)
10. [Günlük işletim: güncelleme, loglar, yedek](#10-günlük-işletim-güncelleme-loglar-yedek)
11. [Sık karşılaşılan sorunlar](#11-sık-karşılaşılan-sorunlar)

---

## 1. Sistemin parçaları

| Parça | Nasıl çalışır | Adres |
|---|---|---|
| Veritabanı | PostgreSQL 16, Docker container'ı (`restart: unless-stopped`) | `127.0.0.1:5433` (yalnızca sunucunun içinden) |
| Backend (API) | Derlenmiş Go programı, `istakip-api` adlı systemd servisi | `http://<SUNUCU_IP>:8080` |
| Web | `npm run build` ile derlenen statik dosyalar, nginx sunar | `http://<SUNUCU_IP>` |
| Mobil | Telefona kurulan APK; doğrudan backend'e bağlanır | — |

Web ve mobil, verileri yalnızca backend'den alır. Backend de veritabanına bağlanır.

## 2. Gerekli programları kurun

### 2.1 Temel araçlar ve nginx

```bash
sudo apt update
sudo apt install -y git curl ca-certificates gnupg build-essential openssl rsync jq nginx
```

### 2.2 Go (1.26 veya üstü)

Ubuntu depolarındaki Go sürümü bu proje için eskidir; resmi paketi kurun. Güncel sürümü https://go.dev/dl/ adresinden kontrol edebilirsiniz (1.26 veya üstü olmalı).

```bash
GO_VERSION=1.26.0
curl -LO https://go.dev/dl/go${GO_VERSION}.linux-amd64.tar.gz
sudo rm -rf /usr/local/go
sudo tar -C /usr/local -xzf go${GO_VERSION}.linux-amd64.tar.gz
rm go${GO_VERSION}.linux-amd64.tar.gz
echo 'export PATH=$PATH:/usr/local/go/bin:$HOME/go/bin' >> ~/.bashrc
source ~/.bashrc
```

> ARM işlemcili bir sunucudaysanız (`uname -m` çıktısı `aarch64`), dosya adındaki `amd64`'ü `arm64` yapın.

### 2.3 Node.js 22 LTS

Web uygulamasını derlemek için gerekir.

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
sudo systemctl enable --now docker
```

Docker'ı `sudo` yazmadan kullanabilmek için kullanıcınızı `docker` grubuna ekleyin, sonra **SSH oturumunu kapatıp yeniden bağlanın**:

```bash
sudo usermod -aG docker $USER
exit
```

### Kontrol

Yeniden bağlandıktan sonra:

```bash
git --version          # git version 2.x
go version             # go version go1.26 veya üstü
node -v                # v22.x
docker compose version # Docker Compose version v2.x
docker run --rm hello-world   # "Hello from Docker!" yazmalı
nginx -v               # nginx version: nginx/1.x
```

## 3. Projeyi indirin

Proje ev dizininize (`/home/<kullanıcı-adınız>/istakip`) kurulur. Klasörü elle oluşturmanıza gerek yok, `git clone` oluşturur:

```bash
cd ~
git clone https://github.com/yasarsafali01/istakip.git
cd ~/istakip
```

### Kontrol

```bash
ls
# backend  deploy  docs  frontend  INSTALL.md  mobile  README.md
```

## 4. Ortam dosyasını oluşturun ve veritabanını başlatın

Sunucuya özel tüm ayarlar (IP, portlar, şifreler) Git'e gönderilmeyen `.env` dosyalarında tutulur; kodda hiçbiri yazmaz. Bu dosyaları **sunucuda**, repodaki `.env.example` şablonlarından oluşturursunuz. `git pull` bu dosyalara dokunmaz.

### 4.1 Backend ortam dosyası

İlk satırdaki `<SUNUCU_IP>` yerine sunucunuzun IP adresini yazın, sonra hepsini birlikte yapıştırın:

```bash
SUNUCU_IP=<SUNUCU_IP>
cd ~/istakip/backend
cp .env.example .env
sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$(openssl rand -hex 32)|" .env
sed -i "s|^DB_PASSWORD=.*|DB_PASSWORD=$(openssl rand -hex 16)|" .env
sed -i "s|^CORS_ORIGINS=.*|CORS_ORIGINS=http://$SUNUCU_IP|" .env
cat .env
```

Komutlar `JWT_SECRET` ve `DB_PASSWORD` için rastgele, güçlü değerler üretir ve `CORS_ORIGINS`'e sunucu adresini yazar. Dosya şöyle görünmelidir:

```env
DB_USER=istakip
DB_PASSWORD=<32 karakterlik rastgele değer>
DB_NAME=istakip
DB_PORT=5433
DATABASE_URL=postgres://${DB_USER}:${DB_PASSWORD}@localhost:${DB_PORT}/${DB_NAME}?sslmode=disable

JWT_SECRET=<64 karakterlik rastgele değer>
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=720h
PORT=8080
UPLOAD_DIR=uploads
CORS_ORIGINS=http://<SUNUCU_IP>
```

| Değişken | Açıklama |
|---|---|
| `DB_USER` / `DB_PASSWORD` / `DB_NAME` | Veritabanı kullanıcısı, şifresi ve adı. Docker veritabanını **ilk açılışta** bu değerlerle oluşturur; sonradan `DB_PASSWORD`'ü değiştirmek mevcut veritabanının şifresini değiştirmez. |
| `DB_PORT` | Veritabanının sunucu içinde dinlediği port. Yalnızca `127.0.0.1`'e açılır. |
| `DATABASE_URL` | Backend'in bağlantı adresi. Yukarıdaki değerlerden otomatik oluşur; elle değiştirmeyin. |
| `JWT_SECRET` | Giriş token'larını imzalayan gizli anahtar. Paylaşmayın; değiştirirseniz herkesin oturumu kapanır. |
| `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL` | Oturum süreleri (15 dakika / 30 gün). |
| `PORT` | Backend'in (API) dinlediği port. Değiştirirseniz web, mobil ve güvenlik duvarı adımlarında da aynı portu kullanın. |
| `UPLOAD_DIR` | Talep formlarına yüklenen dosyaların klasörü (`backend/uploads`). Yedeklerken bunu da alın. |
| `CORS_ORIGINS` | Web uygulamasının açıldığı adresler (virgülle ayrılmış). Web'i başka bir adres/porttan yayınlarsanız buraya ekleyin. |

`PORT` ya da `CORS_ORIGINS` boşsa backend başlamaz ve logda hangisinin eksik olduğunu yazar.

> `.env` dosyası gizli bilgiler içerir ve Git'e gönderilmez. Düzenlemek için: `nano .env` (kaydet: `Ctrl+O`, `Enter`; çık: `Ctrl+X`).

### 4.2 Veritabanını başlatın

```bash
docker compose up -d
```

- Docker kullanıcı adını, şifreyi, veritabanı adını ve portu `.env`'den okur. `.env` yoksa ya da bir değer eksikse hangisinin eksik olduğunu söyleyen bir hata verir.
- `restart: unless-stopped` sayesinde sunucu yeniden başladığında container da otomatik açılır.
- Veriler `istakip_pg_data` adlı Docker volume'unda saklanır.

### Kontrol

```bash
docker compose ps
# backend-postgres-1 ... Up ...   127.0.0.1:5433->5432/tcp
```

## 5. Backend'i kurun ve servis olarak çalıştırın

### 5.1 Bağımlılıklar, tablolar ve başlangıç verileri

```bash
cd ~/istakip/backend
go mod download
go run ./cmd/migrate up

ADMIN_SIFRE=$(openssl rand -hex 8)
KULLANICI_SIFRE=$(openssl rand -hex 8)
SEED_ADMIN_PASSWORD=$ADMIN_SIFRE SEED_USER_PASSWORD=$KULLANICI_SIFRE go run ./cmd/seed
echo "admin@example.com şifresi: $ADMIN_SIFRE"
echo "Diğer örnek hesapların şifresi: $KULLANICI_SIFRE"
```

- `migrate up` veritabanı tablolarını oluşturur. Tekrar çalıştırmak zararsızdır; yalnızca eksik olanları uygular.
- `seed` daire başkanlıklarını, müdürlükleri, kullanıcıları ve örnek talepleri ekler. Veritabanı boş değilse hiçbir şey yapmaz.
- **Ekrana yazılan iki şifreyi bir yere not edin.** Repodaki dokümanlarda geçen demo şifreleri (`admin123` / `pass123`) yalnızca geliştirme içindir. Sunucuda bu şifrelerle hesap oluşturulmaz, çünkü repoyu gören herkes onları bilir. Şifreler hiçbir dosyaya kaydedilmez.

> ⚠️ `go run ./cmd/migrate down` migration'ları **geri alır ve verileri siler**. Canlı sunucuda çalıştırmayın.

### 5.2 Backend'i derleyin

```bash
go build -o bin/istakip-api ./cmd/api
```

### 5.3 systemd servisini oluşturun

Aşağıdaki komut, kullanıcı adınızı ve klasör yolunu otomatik doldurarak servis dosyasını oluşturur. Olduğu gibi yapıştırın:

```bash
sudo tee /etc/systemd/system/istakip-api.service > /dev/null <<EOF
[Unit]
Description=Istakip API
After=network-online.target docker.service
Wants=network-online.target

[Service]
User=$USER
WorkingDirectory=$HOME/istakip/backend
ExecStart=$HOME/istakip/backend/bin/istakip-api
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now istakip-api
```

- `WorkingDirectory` önemlidir: backend `.env` dosyasını ve `uploads` klasörünü bu klasörde arar.
- `Restart=always`: backend çökerse ya da veritabanı henüz açılmadıysa 5 saniye sonra yeniden denenir.
- `enable`: sunucu her açıldığında servis otomatik başlar.

### Kontrol

```bash
systemctl status istakip-api --no-pager   # "active (running)" yazmalı
curl -s http://localhost:8080/health | jq
# { "database": "connected", "status": "ok" }

curl -s -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"admin@example.com\",\"password\":\"$ADMIN_SIFRE\"}" | jq -r .accessToken | cut -c1-30
# eyJhbGciOiJIUzI1NiIsInR5cCI6... gibi bir değer
```

`database` değeri `unreachable` ise veritabanı çalışmıyordur (bkz. adım 4.2).

## 6. Web uygulamasını derleyin ve nginx ile yayınlayın

### 6.1 Derleme

```bash
SUNUCU_IP=<SUNUCU_IP>
cd ~/istakip/frontend
echo "REACT_APP_API_URL=http://$SUNUCU_IP:8080" > .env
cat .env
npm ci
npm run build
```

- `frontend/.env` yalnızca backend adresini içerir. Port, `backend/.env`'deki `PORT` ile aynı olmalıdır.
- Backend adresi derleme sırasında koda gömülür. `.env`'i değiştirirseniz `npm run build`'i tekrar çalıştırmanız gerekir.
- Derleme "The build folder is ready to be deployed" ile bitmelidir.

### 6.2 Dosyaları nginx klasörüne kopyalayın

nginx ev dizinlerini okuyamadığı için derlenen dosyalar `/var/www/istakip`'e kopyalanır:

```bash
sudo mkdir -p /var/www/istakip
sudo rsync -a --delete build/ /var/www/istakip/
```

### 6.3 nginx'i ayarlayın

Hazır ayar dosyası `deploy/nginx-istakip.conf`'tadır:

```bash
sudo cp ~/istakip/deploy/nginx-istakip.conf /etc/nginx/sites-available/istakip
sudo ln -sf /etc/nginx/sites-available/istakip /etc/nginx/sites-enabled/istakip
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

Ayar, sayfa yenilendiğinde (ör. `/requests`) 404 vermemesi için tüm bilinmeyen adresleri `index.html`'e yönlendirir.

### Kontrol

```bash
sudo nginx -t                                   # "syntax is ok" ve "test is successful"
curl -s -o /dev/null -w "%{http_code}\n" http://localhost/           # 200
curl -s -o /dev/null -w "%{http_code}\n" http://localhost/requests   # 200
```

## 7. Güvenlik duvarı

Sunucuda `ufw` kullanıyorsanız web (80) ve API (8080) portlarını açın. **Önce SSH'a izin verin**, yoksa sunucuya bağlantınız kopar:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 8080/tcp
sudo ufw enable
sudo ufw status
```

Veritabanı portu (5433) zaten yalnızca sunucunun içine açık olduğu için ufw'de açmayın.

### Kontrol

Ağdaki **başka bir bilgisayardan** tarayıcıda açın:

- `http://<SUNUCU_IP>:8080/health` → `{"database":"connected","status":"ok"}`
- `http://<SUNUCU_IP>` → giriş ekranı

## 8. Şifreler ve ilk giriş

Canlı sistemde giriş ekranında demo hesap listesi **gösterilmez**. Seed'in oluşturduğu örnek hesaplar ise adım 5.1'de üretilen rastgele şifrelerle veritabanında durur. Kurulumdan hemen sonra:

1. `http://<SUNUCU_IP>` adresinde `admin@example.com` ve 5.1'de not ettiğiniz admin şifresiyle giriş yapın.
2. Sağ üstten **Profilim → Şifre Değiştir** ile kendi belirleyeceğiniz bir şifreye geçin.
3. **Kullanıcılar** sayfasından gerçek kullanıcıları ekleyin. Kullanılmayacak örnek hesapları (`...@example.com`) silin.

## 9. Mobil uygulama

Mobil uygulama sunucuda çalışmaz; telefonlara kurulur ve doğrudan `http://<SUNUCU_IP>:8080` adresindeki backend'e bağlanır. Telefonun sunucuyla aynı ağda (ya da VPN ile bu ağa bağlı) olması gerekir.

### 9.1 Android APK üretmek (önerilen)

APK, sunucuda değil **kendi bilgisayarınızda** üretilir. Expo hesabı gerekir (https://expo.dev, ücretsiz). Derleme Expo'nun bulut sunucularında yapılır ve internet gerekir.

```bash
cd mobile
npm install --legacy-peer-deps
npx eas-cli login
npx eas-cli env:create --name EXPO_PUBLIC_API_URL --value http://<SUNUCU_IP>:8080 --environment preview --visibility plaintext
npx eas-cli build -p android --profile preview
```

- `env:create` backend adresini Expo hesabınıza kaydeder; repoda yazmaz. Yalnızca ilk seferde (ya da adres değişince) gerekir. Değiştirmek için: `npx eas-cli env:update`.
- `mobile/eas.json` içindeki `preview` profili bu adresi kullanarak bir APK üretir.
- İlk derlemede Android paket adı (ör. `tr.edu.mersin.istakip`) ve imzalama anahtarı sorulur; önerilen seçenekleri kabul edebilirsiniz.
- Derleme bitince verilen bağlantıdan APK'yı indirip telefonlara kurun ("bilinmeyen kaynaklardan yüklemeye" izin vermek gerekebilir).
- Uygulama sunucuya HTTP ile bağlandığı için `app.json`'da düz HTTP'ye izin verilmiştir. Sunucuya ileride HTTPS eklenirse bu izin kaldırılmalıdır.

### 9.2 Expo Go ile hızlı deneme

Derleme yapmadan denemek için kendi bilgisayarınızda:

```bash
cd mobile
echo "EXPO_PUBLIC_API_URL=http://<SUNUCU_IP>:8080" > .env
npx expo start --clear
```

Çıkan QR kodu telefondaki Expo Go uygulamasıyla okutun.

## 10. Günlük işletim: güncelleme, loglar, yedek

### Servis komutları

```bash
systemctl status istakip-api --no-pager      # backend çalışıyor mu?
sudo systemctl restart istakip-api           # backend'i yeniden başlat
journalctl -u istakip-api -f                 # backend loglarını canlı izle (çıkış: Ctrl+C)
journalctl -u istakip-api --since today      # bugünkü loglar
cd ~/istakip/backend && docker compose ps    # veritabanı çalışıyor mu?
```

Sunucuyu yeniden başlattığınızda hiçbir şey yapmanız gerekmez; veritabanı, backend ve nginx kendiliğinden açılır.

### Yeni sürümü yüklemek

GitHub'a yeni kod gönderildikten sonra sunucuda tek komut yeterlidir:

```bash
~/istakip/deploy/guncelle.sh
```

Betik sırasıyla: kodu çeker (`git pull`), backend'i derler, yeni migration'ları uygular, backend servisini yeniden başlatır, web'i derleyip nginx klasörüne kopyalar.

### Yedek almak

Veritabanı ve yüklenen dosyalar ayrı ayrı yedeklenmelidir:

```bash
mkdir -p ~/yedek
docker exec backend-postgres-1 pg_dump -U istakip istakip | gzip > ~/yedek/istakip-$(date +%F).sql.gz
tar -czf ~/yedek/uploads-$(date +%F).tar.gz -C ~/istakip/backend uploads
```

Yedekleri sunucu dışında bir yere de kopyalayın.

Yedekten geri dönmek için (⚠️ mevcut verilerin üzerine yazar):

```bash
sudo systemctl stop istakip-api
gunzip -c ~/yedek/istakip-2026-10-13.sql.gz | docker exec -i backend-postgres-1 psql -U istakip -d istakip
sudo systemctl start istakip-api
```

Geri yükleme boş bir veritabanına yapılmalıdır. Gerekirse önce volume'u sıfırlayın: `docker compose down -v && docker compose up -d` (tüm verileri siler).

### Veritabanına doğrudan bakmak

```bash
docker exec -it backend-postgres-1 psql -U istakip -d istakip
```

`psql` içinde örnek komutlar: `\dt` (tablolar), `SELECT email, role FROM users LIMIT 10;`, `\q` (çıkış).

## 11. Sık karşılaşılan sorunlar

| Belirti | Sebep / Çözüm |
|---|---|
| `permission denied while trying to connect to the Docker daemon socket` | Kullanıcınız `docker` grubunda değil ya da oturum yenilenmedi: `sudo usermod -aG docker $USER`, sonra SSH'tan çıkıp yeniden bağlanın. |
| `port is already allocated` (5433) | Başka bir container o portu kullanıyor: `docker ps` ile bulun, durdurun. |
| `systemctl status istakip-api` → `failed` | Nedenini görmek için: `journalctl -u istakip-api -n 50 --no-pager`. |
| Backend logunda `loading roles failed (run migrations?)` | Migration'lar uygulanmamış: `cd ~/istakip/backend && go run ./cmd/migrate up`, sonra `sudo systemctl restart istakip-api`. |
| Backend logunda `connection refused` / health'te `unreachable` | Veritabanı çalışmıyor: `cd ~/istakip/backend && docker compose up -d`. |
| Backend logunda `address already in use` (8080) | 8080'i başka bir süreç kullanıyor: `sudo lsof -i :8080` ile bulup durdurun. |
| `go: command not found` | PATH ayarı yüklenmedi: `source ~/.bashrc` ya da yeniden bağlanın. |
| Tarayıcıda `http://<SUNUCU_IP>` açılmıyor | nginx kapalı (`sudo systemctl status nginx`) ya da ufw 80'i engelliyor (adım 7). |
| Sayfa açılıyor ama girişte "Failed to fetch" / ağ hatası | Backend kapalı ya da 8080 dışarıya kapalı. Başka bir bilgisayardan `http://<SUNUCU_IP>:8080/health` açılıyor mu bakın. |
| Tarayıcı konsolunda CORS hatası | Web'i `CORS_ORIGINS`'te olmayan bir adresten açıyorsunuz. Adresi `backend/.env`'e ekleyip `sudo systemctl restart istakip-api`. |
| Sayfayı yenileyince nginx 404 | nginx ayarı uygulanmamış: adım 6.3'ü tekrarlayın. |
| Güncelleme sonrası eski arayüz görünüyor | Tarayıcıda `Ctrl+F5` ile önbelleği atlayarak yenileyin. |
| `guncelle.sh: Permission denied` | `chmod +x ~/istakip/deploy/guncelle.sh` |
| Mobilde "Network request failed" | Telefon sunucuyla aynı ağda değil ya da 8080 kapalı. Telefonun tarayıcısında `http://<SUNUCU_IP>:8080/health` açılıyor mu bakın. |
