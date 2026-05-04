# Requirements: External User Requests UI Modernization

## Introduction

Bu özellik, dış kullanıcının (`External_User`) gördüğü talepler ekranını modernize eder. Üç ana alan iyileştirilecek: kart tasarımı, birim filtresi ve arama deneyimi. Tüm değişiklikler mevcut React + Bootstrap 5 + react-icons/tb stack'i içinde kalacak; yeni kütüphane eklenmeyecek. Dış kullanıcının yalnızca kendi taleplerini veya `visibleTo` listesinde olduğu talepleri görmesi kuralı her koşulda korunacak.

---

## Requirements

### Requirement 1: Modern Kart Tasarımı

**User Story:** Dış kullanıcı olarak, taleplerim daha okunabilir ve görsel olarak zengin kartlar halinde gösterilsin ki önemli bilgileri hızlıca ayırt edebileyim.

#### Acceptance Criteria

1.1 Her talep kartının sol kenarında, talebin durumuna (`status`) karşılık gelen renkte 4px genişliğinde dikey bir renk çubuğu gösterilir. Renk değerleri `STATUS_COLORS` sabitinden alınır.

1.2 Kart üzerine gelindiğinde (`hover`) kart hafifçe yukarı kayar (`translateY(-2px)`) ve gölgesi artar; bu geçiş `transition: 0.15s ease` ile animasyonlu olur.

1.3 Talep numarası (`request.number`) küçük bir badge/pill olarak gösterilir; mevcut `text-muted small` düz metin yerine görsel olarak ayrışır.

1.4 Öncelik ikonu, birim adı ve oluşturulma tarihi bilgileri kart içinde korunur.

1.5 Kart bileşeni, `searchQuery` prop'u aldığında başlık metninde eşleşen kısımları `<mark>` etiketi ile vurgular.

---

### Requirement 2: Birim Filtresi

**User Story:** Dış kullanıcı olarak, taleplerim arasında belirli bir birime ait olanları görmek istediğimde birim filtresi ile hızlıca daraltabileyim.

#### Acceptance Criteria

2.1 Talep listesinin üstünde, görünür taleplerde bulunan birimlere karşılık gelen pill/chip tarzı filtre butonları gösterilir. "Tümü" butonu her zaman ilk sıradadır.

2.2 Bir birim seçildiğinde listede yalnızca o birime ait talepler gösterilir; diğer birimler gizlenir.

2.3 "Tümü" seçildiğinde birim filtresi kaldırılır ve tüm görünür talepler listelenir.

2.4 Görünür taleplerde yalnızca bir birim varsa birim filtresi gösterilmez (tek seçenek anlamsız).

2.5 Birim filtresi, `getVisibleRequests` tarafından döndürülen taleplerin birimlerinden türetilir; kullanıcının erişimi olmayan birimler listede yer almaz.

2.6 Birim filtresi ve arama filtresi birlikte çalışır: her ikisi de aktifken yalnızca her iki koşulu da sağlayan talepler gösterilir.

---

### Requirement 3: Modern Arama

**User Story:** Dış kullanıcı olarak, talepler arasında arama yaparken daha modern ve kullanışlı bir arama deneyimi yaşamak istiyorum.

#### Acceptance Criteria

3.1 Arama alanı Bootstrap `form-floating` pattern'i ile floating label içerir; input boşken label placeholder gibi görünür, odaklanıldığında veya değer girildiğinde label yukarı kayar.

3.2 Arama alanında değer varken sağ tarafta bir "temizle" (×) butonu görünür; bu butona tıklandığında arama alanı temizlenir ve tüm talepler listelenir.

3.3 Arama girişi 300ms debounce ile çalışır; kullanıcı yazmayı bıraktıktan 300ms sonra filtre uygulanır.

3.4 Arama sonuçlarında eşleşen metin kısımları `<mark>` etiketi ile vurgulanır (highlight).

3.5 Arama alanının altında veya yanında `"{n} talep bulundu"` formatında sonuç sayısı gösterilir.

3.6 Arama büyük/küçük harf duyarsızdır; talep başlığı, açıklaması ve numarası üzerinde çalışır (mevcut `filterRequests` davranışı korunur).

---

### Requirement 4: İzin ve Güvenlik Koruması

**User Story:** Sistem yöneticisi olarak, modernizasyon değişikliklerinin dış kullanıcının yalnızca yetkili talepleri görmesi kuralını bozmamasını istiyorum.

#### Acceptance Criteria

4.1 `getVisibleRequests(issues, currentUser)` fonksiyonu her zaman ilk filtre adımı olarak uygulanır; birim filtresi veya arama filtresi bu katmanı bypass edemez.

4.2 Dış kullanıcı, birim filtresi veya arama ile kendi `reporterId`'si olmayan ve `visibleTo` listesinde bulunmadığı taleplere erişemez.

4.3 `highlightText` fonksiyonu, kullanıcı girdisindeki regex özel karakterlerini (`(`, `)`, `[`, `*`, vb.) escape eder; hata fırlatılmaz.

4.4 İç kullanıcılar için mevcut rol bazlı filtreleme (Department_Head, Project_Manager, Worker) değişmeden korunur.

4.5 İç kullanıcılar için "Dış kullanıcıya görünür yap" (TbEye) butonu korunur ve işlevselliği değişmez.

---

### Requirement 5: Boş Durum Yönetimi

**User Story:** Dış kullanıcı olarak, arama veya filtre sonucunda talep bulunamadığında ne yapabileceğimi anlayan bir mesaj görmek istiyorum.

#### Acceptance Criteria

5.1 Arama veya birim filtresi aktifken sonuç bulunamazsa "Arama kriterlerine uygun talep bulunamadı" mesajı gösterilir.

5.2 Hiç filtre aktif değilken ve görünür talep yoksa "Henüz talep yok" mesajı ve dış kullanıcı için "Talep Oluştur" butonu gösterilir.

5.3 Boş durum mesajları mevcut `EmptyState` bileşeni kullanılarak gösterilir.
