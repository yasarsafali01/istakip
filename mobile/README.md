# İstakip Mobile

React Native (Expo) mobil uygulaması. Web frontend ile aynı backend API'sini kullanır — ayrı bir veri kaynağı veya localStorage yok.

## Mimari

```
app/                        # Expo Router — dosya tabanlı sayfa yönlendirme
  _layout.tsx                 # Kök layout: QueryClientProvider, AuthProvider, oturum koruması (Stack.Protected)
  login.tsx                   # Giriş ekranı
  (app)/                      # Oturum açmış kullanıcı — sekme (tab) navigasyonu
    _layout.tsx                # Rol bazlı sekmeler (Panel, Projeler, Talepler)
    dashboard.tsx
    projects/
      index.tsx                 # Proje listesi
      [id]/index.tsx             # Board (aktif ay, sütun bazlı)
    requests/
      index.tsx                 # Talep listesi + arama
    issues/
      [id].tsx                   # Ortak issue/talep detay ekranı (durum değiştirme, yorum, aktivite, Done akışı)
src/
  api/                        # client.ts (JWT + fetch wrapper), auth.ts, resources.ts, types.ts
  context/AuthContext.tsx      # Oturum durumu
  hooks/usePermissions.ts       # Rol bazlı yetki kontrolleri (web ile aynı mantık)
  components/                  # Avatar, Badge, SplashGate
  utils/constants.ts            # STATUSES/PRIORITIES/ROLES (web'deki constants ile birebir senkron tutulmalı)
```

## Teknolojiler

- [Expo](https://expo.dev) (SDK 57) + [Expo Router](https://docs.expo.dev/router/introduction/) (dosya tabanlı yönlendirme, `Stack.Protected` ile oturum koruması)
- [TanStack Query](https://tanstack.com/query) — sunucu verisi önbellekleme/senkronizasyon
- `expo-secure-store` — refresh token güvenli saklama (access token yalnızca bellekte)

## Kapsam

**Faz 1 — Çekirdek:** Giriş, rol bazlı sekme navigasyonu, her ekranın üstünde çıkış butonu, Panel (aktif dönem bilgisi, önceliğe göre dağılım, bekleyen/çözülen talep sayıları, proje yöneticisi için ekip iş yükü), Proje listesi, Board (aktif ay, sütun bazlı), Talepler listesi + arama + tüm roller için "Yeni Talep Oluştur" (FAB), ortak issue/talep detay ekranı (durum değiştirme, yorum, aktivite akışı, "Görevi Tamamla" akışı).

**Faz 2 — Sprint/Backlog:** Backlog görünümü (bir aya atama), Aylık dönem (sprint) listesi + oluşturma/başlatma/kapatma, atanan kişi değiştirme, issue oluşturma. Board'da native sürükle-bırak yerine **karta uzun basarak durum seçme** kullanılır (React Native'de cross-column drag-and-drop, gesture kütüphanesi gerektiren ayrı bir iş; bu, aynı sonucu (durum değiştirme) veren daha basit ve güvenilir bir mobil desendir).

**Faz 3 — Yönetim:** "Görevi Tamamla" akışında envanter/teçhizat seçimi + stok düşümü (stok yetersizse uyarı, işlem engellenmez), Birimler ekranı (oluşturma + düzenleme, System_Admin), Proje oluşturma + düzenleme formu, talep klonlama, dış kullanıcı görünürlük (visibleTo) yönetimi, talepler listesinde birim + öncelik filtre çipleri.

**Basitleştirilenler / yapılmadı:** Envanter için ayrı bir liste/CRUD ekranı yok (yalnızca Done akışındaki seçim); board'da native sürükle-bırak yerine uzun-basma kullanılıyor (yukarı bakın).

## Çalıştırma

Kurulum için kök dizindeki [INSTALL.md](../INSTALL.md) dosyasına bakın.

```bash
npx expo start
```

Fiziksel cihazda Expo Go ile test etmek için `.env`'deki `EXPO_PUBLIC_API_URL`'i bilgisayarın yerel ağ IP adresine ayarlayın (`localhost` fiziksel cihazdan erişilemez).
