# Gereksinimler Belgesi

## Giriş

Bu özellik, dış kullanıcıların (External_User rolündeki kullanıcılar) talep oluştururken seçtikleri projenin backlog'una otomatik olarak bir issue düşmesini sağlar. Mevcut sistemde talepler `isRequest: true` ve `sprintId: null` ile oluşturulmakta; bu da onları teknik olarak backlog'a yerleştirmektedir. Ancak bu davranış tutarsız biçimde uygulanmakta, backlog görünümünde talep kaynaklı issue'lar için özel bir gösterim veya filtreleme bulunmamakta ve proje yöneticileri hangi taleplerin backlog'larına düştüğünü kolayca takip edememektedir. Bu özellik söz konusu davranışı garantilemek, görünür kılmak ve yönetilebilir hale getirmek için gereksinimleri tanımlar.

## Sözlük

- **Request_Form**: Dış kullanıcının talep oluşturduğu form bileşeni (`RequestForm.jsx`).
- **Backlog**: Bir projeye ait olup henüz herhangi bir sprint'e atanmamış issue'ların listesi (`sprintId: null`).
- **BacklogView**: Proje backlog'unu görüntüleyen bileşen (`BacklogView.jsx`).
- **Issue**: Sistemdeki temel iş birimi; `isRequest: true` olan issue'lar talep kaynaklıdır.
- **External_User**: Yalnızca talep oluşturma ve kendi taleplerini görüntüleme yetkisine sahip dış kullanıcı rolü.
- **Project_Manager**: Projeye ait backlog'u ve sprint'leri yöneten kullanıcı rolü.
- **AppReducer**: Uygulama durumunu yöneten saf reducer fonksiyonu.
- **AppContext**: Uygulama genelinde durum yönetimini sağlayan React context'i.

---

## Gereksinimler

### Gereksinim 1: Talep Oluşturulduğunda Backlog'a Otomatik Düşme

**Kullanıcı Hikayesi:** Dış kullanıcı olarak, talep oluştururken bir proje seçtiğimde, bu talebin otomatik olarak seçilen projenin backlog'una düşmesini istiyorum; böylece proje ekibi talebimi görebilir ve işleme alabilir.

#### Kabul Kriterleri

1. WHEN bir External_User talep formu gönderdiğinde, THE Request_Form SHALL oluşturulan issue'yu `isRequest: true`, `sprintId: null` ve seçilen `projectId` değeriyle AppContext'e kaydetmelidir.
2. WHEN bir External_User talep formu gönderdiğinde ve proje seçilmemişse, THE Request_Form SHALL formu kaydetmemeli ve kullanıcıya "Lütfen bir proje seçin." hata mesajını göstermelidir.
3. WHEN bir talep başarıyla oluşturulduğunda, THE AppReducer SHALL issue'yu `sprintId: null` olarak state'e eklemeli ve bu issue projenin backlog'unda görünür olmalıdır.
4. THE Request_Form SHALL talep oluşturma sırasında `sprintId` alanını her zaman `null` olarak ayarlamalıdır; böylece talep hiçbir sprint'e otomatik atanmaz.

---

### Gereksinim 2: Backlog Görünümünde Talep Kaynaklı Issue'ların Gösterimi

**Kullanıcı Hikayesi:** Proje yöneticisi olarak, projemin backlog'unda hangi issue'ların dış kullanıcı talebinden geldiğini görmek istiyorum; böylece talepleri normal issue'lardan ayırt edebilir ve önceliklendirebilirim.

#### Kabul Kriterleri

1. WHILE bir proje backlog'u görüntülenirken, THE BacklogView SHALL `isRequest: true` olan issue'ları diğer issue'lardan görsel olarak ayırt eden bir etiket veya rozet göstermelidir.
2. WHILE bir proje backlog'u görüntülenirken, THE BacklogView SHALL `isRequest: true` olan issue'lara tıklandığında `RequestDetailModal`'ı açmalıdır.
3. WHILE bir proje backlog'u görüntülenirken, THE BacklogView SHALL `isRequest: false` olan issue'lara tıklandığında `IssueModal`'ı açmalıdır.
4. THE BacklogView SHALL `isRequest: true` olan backlog issue'larını, `isRequest: false` olan issue'larla birlikte aynı listede göstermelidir; yani talep kaynaklı issue'lar backlog'dan gizlenmemelidir.

---

### Gereksinim 3: Proje Seçimi Zorunluluğu

**Kullanıcı Hikayesi:** Dış kullanıcı olarak, talep oluştururken hangi projeye yönlendirileceğimi seçmek istiyorum; böylece talebim doğru ekibe ulaşır.

#### Kabul Kriterleri

1. THE Request_Form SHALL birim seçilmeden proje seçim alanını göstermemelidir.
2. WHEN bir birim seçildiğinde, THE Request_Form SHALL yalnızca o birime ait projeleri proje seçim listesinde göstermelidir.
3. WHEN seçilen birime ait hiç proje yoksa, THE Request_Form SHALL kullanıcıya "Bu birime ait proje bulunamadı." uyarısını göstermelidir.
4. WHEN seçilen birime ait yalnızca bir proje varsa, THE Request_Form SHALL o projeyi otomatik olarak seçmelidir.
5. WHEN birim değiştirildiğinde, THE Request_Form SHALL önceki proje seçimini sıfırlamalıdır.

---

### Gereksinim 4: Backlog'daki Talep Issue'larının Sprint'e Atanabilmesi

**Kullanıcı Hikayesi:** Proje yöneticisi olarak, backlog'daki talep kaynaklı issue'ları diğer issue'lar gibi bir sprint'e atayabilmek istiyorum; böylece talepleri planlama sürecime dahil edebilirim.

#### Kabul Kriterleri

1. WHILE bir proje backlog'u görüntülenirken, THE BacklogView SHALL `isRequest: true` olan issue'lar için de sprint atama seçim kutusunu göstermelidir.
2. WHEN bir backlog issue'su (talep kaynaklı dahil) bir sprint'e atandığında, THE AppReducer SHALL ilgili issue'nun `sprintId` alanını seçilen sprint'in id'siyle güncellemeli ve issue backlog listesinden kaldırılmalıdır.
3. WHEN bir sprint tamamlandığında ve sprint içindeki talep kaynaklı issue'lar "Done" statüsünde değilse, THE AppReducer SHALL bu issue'ların `sprintId` alanını `null` olarak güncellemeli ve issue'lar tekrar backlog'a dönmelidir.

---

### Gereksinim 5: Talep Oluşturma Aktivite Kaydı

**Kullanıcı Hikayesi:** Proje yöneticisi olarak, backlog'a düşen bir talebin ne zaman ve kim tarafından oluşturulduğunu görmek istiyorum; böylece talep geçmişini takip edebilirim.

#### Kabul Kriterleri

1. WHEN bir External_User talep oluşturduğunda, THE Request_Form SHALL AppContext'e `type: 'created'` ve `description: 'Talep oluşturuldu'` içeren bir aktivite kaydı eklemelidir.
2. THE Request_Form SHALL aktivite kaydında `issueId`, `userId` ve `createdAt` alanlarını doğru biçimde doldurmalıdır.
