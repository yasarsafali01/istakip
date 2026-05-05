# Bugfix Requirements Document

## Giriş

Backlog ve aktif işlerde "Geri Çevir" butonu yetki kontrolü ve durum kontrolü yapmadan görünmektedir. Bu durum iki temel soruna yol açmaktadır:

1. **Yetki Sorunu**: Daire başkanı (Department_Head) ve proje yöneticisi (Project_Manager) rolleri, kendi ekiplerine açılan talepleri backlog ve aktif işlerde geri çevirememektedir.

2. **Durum Kontrolü Sorunu**: Zaten "Geri Çevrildi" durumundaki işler için "Geri Çevir" butonu hala aktif olarak görünmektedir. Bu, kullanıcı deneyimini olumsuz etkilemekte ve gereksiz işlem denemelerine yol açmaktadır.

Bu hata, issue detay sayfasındaki (IssueDetailContent.jsx) `canReject` yetki kontrolünün yetersiz olmasından ve butonun issue durumunu kontrol etmemesinden kaynaklanmaktadır.

## Hata Analizi

### Mevcut Davranış (Hata)

1.1 WHEN kullanıcı Department_Head veya Project_Manager rolüne sahip olduğunda THEN sistem "Geri Çevir" butonunu gösterir ancak buton işlevsel değildir

1.2 WHEN bir issue zaten "Geri Çevrildi" durumunda olduğunda THEN sistem "Geri Çevir" butonunu hala görünür halde tutar

1.3 WHEN kullanıcı "Geri Çevrildi" durumundaki bir issue için "Geri Çevir" butonuna tıkladığında THEN sistem gereksiz bir modal açar ve tekrar geri çevirme işlemine izin verir

### Beklenen Davranış (Doğru)

2.1 WHEN kullanıcı Department_Head veya Project_Manager rolüne sahip olduğunda VE issue "Geri Çevrildi" dışında bir durumda olduğunda THEN sistem "Geri Çevir" butonunu görünür ve işlevsel hale getirmelidir

2.2 WHEN bir issue zaten "Geri Çevrildi" durumunda olduğunda THEN sistem "Geri Çevir" butonunu gizlemelidir

2.3 WHEN kullanıcı System_Admin rolüne sahip olduğunda VE issue "Geri Çevrildi" dışında bir durumda olduğunda THEN sistem "Geri Çevir" butonunu görünür ve işlevsel hale getirmelidir

### Değişmemesi Gereken Davranış (Regresyon Önleme)

3.1 WHEN kullanıcı External_User veya Worker rolüne sahip olduğunda THEN sistem "Geri Çevir" butonunu göstermemeye devam etmelidir

3.2 WHEN kullanıcı "Geri Çevir" butonuna tıkladığında VE geçerli bir geri çevirme nedeni girdiğinde THEN sistem issue'yu "Geri Çevrildi" durumuna almaya ve açan kişiye atamaya devam etmelidir

3.3 WHEN bir issue "Geri Çevrildi" durumuna alındığında THEN sistem activity log'a kayıt eklemeye ve yorum bölümüne geri çevirme nedenini yazmaya devam etmelidir

3.4 WHEN kullanıcı status dropdown'ını kullandığında THEN sistem "Geri Çevrildi" durumunu seçenek olarak göstermemeye devam etmelidir (sadece "Geri Çevir" butonu ile bu duruma geçilebilir)

3.5 WHEN kullanıcı issue'nun reporterId'si ile aynı kullanıcı olduğunda THEN sistem "Geri Çevir" butonunu göstermemeye devam etmelidir

## Hata Koşulu ve Özellik Tanımı

### Hata Koşulu Fonksiyonu

```pascal
FUNCTION isBugCondition(issue, currentUser)
  INPUT: issue of type Issue, currentUser of type User
  OUTPUT: boolean
  
  // Hata koşulu: Yetkili kullanıcı + Zaten geri çevrilmiş issue
  RETURN (
    currentUser.role IN [SYSTEM_ADMIN, DEPARTMENT_HEAD, PROJECT_MANAGER]
    AND issue.status = "Geri Çevrildi"
  )
END FUNCTION
```

### Özellik Spesifikasyonu

```pascal
// Özellik: Geri Çevir Butonu Görünürlük Kontrolü
FOR ALL issue, currentUser WHERE isBugCondition(issue, currentUser) DO
  canReject ← calculateCanReject'(issue, currentUser)
  ASSERT canReject = false
  ASSERT rejectButtonVisible = false
END FOR
```

### Koruma Hedefi

```pascal
// Özellik: Mevcut Davranışın Korunması
FOR ALL issue, currentUser WHERE NOT isBugCondition(issue, currentUser) DO
  ASSERT calculateCanReject(issue, currentUser) = calculateCanReject'(issue, currentUser)
END FOR
```

**Açıklama:**
- **F**: Orijinal `canReject` hesaplama mantığı (sadece rol kontrolü)
- **F'**: Düzeltilmiş `canReject` hesaplama mantığı (rol + durum kontrolü)
- Hata koşulu: Yetkili kullanıcı + Zaten "Geri Çevrildi" durumundaki issue
- Beklenen: Bu durumda `canReject = false` olmalı ve buton gizlenmeli
- Korunması gereken: Diğer tüm durumlarda mevcut davranış değişmemeli
