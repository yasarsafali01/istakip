# Requirements Document

## Introduction

Bu doküman, kurumsal kullanıma yönelik Jira benzeri bir proje ve talep yönetim uygulamasının React tabanlı frontend geliştirmesi için gereksinimleri tanımlar. Uygulama; rol tabanlı erişim kontrolü, birim (daire) yönetimi, proje yönetimi, talep sistemi, Kanban/Scrum board görünümü, aylık sprint döngüsü, issue/ticket yönetimi, kullanıcı atama, öncelik seviyeleri, yorum/aktivite akışı ve rol bazlı dashboard ekranı özelliklerini içerecektir. Tüm veriler tarayıcı belleğinde (in-memory state) tutulacak; harici bir backend API kullanılmayacaktır.

---

## Glossary

- **Application**: Kurumsal Jira benzeri proje ve talep yönetim React uygulaması.
- **Unit** (Birim): Öğrenci İşleri, Bilgi İşlem Daire Başkanlığı gibi kurumsal bir daire veya bölüm. Her birimin benzersiz bir birim kodu vardır (örn. BIGD, ODB).
- **Unit_Code**: Bir birimi tanımlayan kısa alfanümerik kod (örn. BIGD, ODB). Issue numaralarında önek olarak kullanılır.
- **Department_Head** (Daire Başkanı): Bir birimin yöneticisi; birime ait tüm projeleri ve iş durumlarını görüp takip edebilir, yeni proje açabilir.
- **System_Admin** (Sistem Admini): Tüm birimlere birim boardı tanımlayabilen en yetkili kullanıcı rolü.
- **Project_Manager** (Proje Yöneticisi): Kendi projesindeki işleri takip edebilen ve iş ataması yapabilen kullanıcı rolü.
- **External_User** (Dış Kullanıcı): Talep açabilen, yalnızca kendi taleplerini ve statülerini görebilen kullanıcı rolü.
- **Project**: Bir birim içinde yer alan, bir veya daha fazla Sprint ve Issue içeren iş birimi.
- **Board**: Bir projeye ait Issue'ların sütunlar halinde görselleştirildiği Kanban veya Scrum ekranı.
- **Issue**: Bir proje içindeki görev, hata veya hikaye birimi (ticket). Numarası birim kodu ile etiketlenir (örn. BIGD-123).
- **Request** (Talep): Dış kullanıcıların açtığı, ilgili birime yönlendirilen destek veya hizmet talebi. Issue'nun özel bir tipidir.
- **Request_Detail_Modal**: Bir talebin Jira benzeri tam detay görünümünü sunan modal diyalog bileşeni.
- **Assignee** (Atanan Kişi): Bir talep veya issue üzerinde çalışmakla sorumlu tutulan kullanıcı.
- **Clone** (Klonlama): Mevcut bir talebin tüm alanlarını kopyalayarak yeni bir talep oluşturma işlemi.
- **resolvedAt**: Bir talebin çözüme kavuşturulduğu tarihi tutan ISO8601 zaman damgası alanı.
- **timeSpent**: Bir talep üzerinde harcanan toplam süreyi dakika cinsinden tutan sayısal alan.
- **Sprint**: Her ayın 1'i ile son iş günü arasındaki çalışma döngüsü.
- **User**: Uygulamada tanımlı, belirli bir role sahip kişi.
- **Role**: Kullanıcının sistemdeki yetki seviyesi (System_Admin, Department_Head, Project_Manager, External_User).
- **Priority**: Issue'nun aciliyet seviyesi (Highest, High, Medium, Low, Lowest).
- **Status**: Issue'nun mevcut durumu (To Do, In Progress, In Review, Done).
- **Comment**: Bir Issue üzerinde kullanıcıların bıraktığı metin tabanlı not.
- **Activity**: Issue üzerinde gerçekleşen değişikliklerin zaman damgalı kaydı.
- **Dashboard**: Kullanıcının rolüne göre özelleştirilmiş özet istatistiklerin gösterildiği ana ekran.
- **Backlog**: Sprint'e atanmamış Issue'ların listelendiği alan.
- **Router**: Uygulama içi sayfa geçişlerini yöneten React Router bileşeni.
- **Store**: Uygulama genelinde paylaşılan in-memory state yönetim katmanı (React Context + useReducer).
- **Modal**: Kullanıcı etkileşimi için açılan katmanlı diyalog bileşeni.
- **Sidebar**: Uygulamanın sol tarafında yer alan navigasyon paneli.
- **Worker** (Çalışan): Bir birime ve projeye atanmış, issue üzerinde çalışabilen kullanıcı rolü. Birim çalışanı olarak da anılır.
- **Search_Query**: Kullanıcının talepler listesinde arama yapmak için girdiği metin dizisi.

---

## Requirements

### Requirement 1: Giriş ve Yetkilendirme

**User Story:** Bir kullanıcı olarak, tek bir giriş panelinden sisteme giriş yapmak istiyorum; böylece rolüme uygun ekrana yönlendirilerek yetkili olduğum işlemleri yapabilirim.

#### Acceptance Criteria

1. THE Application SHALL tüm kullanıcı rolleri için tek bir giriş (login) sayfası sunmalı.
2. WHEN kullanıcı geçerli kimlik bilgileriyle giriş yapar, THE Application SHALL kullanıcının rolüne göre uygun Dashboard ekranına yönlendirmeli.
3. WHEN System_Admin giriş yapar, THE Application SHALL sistem yönetim paneline yönlendirmeli.
4. WHEN Department_Head giriş yapar, THE Application SHALL kendi birimine ait proje ve iş durumlarını gösteren Dashboard'a yönlendirmeli.
5. WHEN Project_Manager giriş yapar, THE Application SHALL kendi projelerine ait Board ve Dashboard'a yönlendirmeli.
6. WHEN External_User giriş yapar, THE Application SHALL yalnızca kendi taleplerini gösteren Talep Dashboard'una yönlendirmeli.
7. IF kullanıcı adı veya şifre hatalıysa, THEN THE Application SHALL "Kullanıcı adı veya şifre hatalı" hata mesajını göstermeli.
8. WHILE kullanıcı oturumu açıkken, THE Application SHALL kullanıcının rolüne göre navigasyon menüsünü ve erişilebilir sayfaları kısıtlamalı.
9. WHEN kullanıcı çıkış yapar, THE Application SHALL oturum bilgisini temizlemeli ve giriş sayfasına yönlendirmeli.

---

### Requirement 2: Rol Tabanlı Erişim Kontrolü

**User Story:** Bir sistem yöneticisi olarak, her kullanıcının yalnızca kendi rolüne uygun işlemleri yapabilmesini istiyorum; böylece veri güvenliği ve iş akışı bütünlüğü sağlanmış olur.

#### Acceptance Criteria

1. THE System_Admin SHALL tüm birimlere birim boardı tanımlayabilmeli.
2. THE System_Admin SHALL yeni birim, kullanıcı ve rol ataması oluşturabilmeli.
3. THE Department_Head SHALL kendi birimine ait tüm projeleri ve issue durumlarını görüp takip edebilmeli.
4. THE Department_Head SHALL kendi birimi içinde yeni proje açabilmeli.
5. THE Project_Manager SHALL yalnızca kendi projesindeki issue'ları görüp takip edebilmeli.
6. THE Project_Manager SHALL kendi projesindeki issue'lara kullanıcı atayabilmeli.
7. THE External_User SHALL yalnızca talep açabilmeli ve kendi açtığı talepleri görebilmeli.
8. IF bir kullanıcı yetkisiz bir sayfaya erişmeye çalışırsa, THEN THE Application SHALL "Bu sayfaya erişim yetkiniz bulunmamaktadır" mesajını göstermeli ve kullanıcıyı yetkili olduğu sayfaya yönlendirmeli.
9. THE Application SHALL her kullanıcı için rolünü Store'da saklamalı ve her işlem öncesinde yetki kontrolü yapmalı.

---

### Requirement 3: Birim Yönetimi

**User Story:** Bir sistem yöneticisi olarak, kurumsal birimleri tanımlamak ve yönetmek istiyorum; böylece her birimin kendi proje ve iş akışlarını bağımsız olarak yürütebilmesini sağlayabilirim.

#### Acceptance Criteria

1. THE System_Admin SHALL yeni birim oluşturabilmeli; her birim için ad, benzersiz birim kodu (Unit_Code) ve daire başkanı bilgisi girilmeli.
2. IF birim kodu zaten mevcut bir birimle çakışıyorsa, THEN THE Application SHALL "Bu birim kodu zaten kullanılıyor" hata mesajını göstermeli.
3. THE Application SHALL her birim için ad, Unit_Code, Department_Head ve oluşturulma tarihi alanlarını Store'da saklamalı.
4. THE Application SHALL bir birim içinde birden fazla projenin bulunmasına izin vermeli.
5. THE Application SHALL her projenin yalnızca bir Project_Manager'a sahip olmasını zorunlu kılmalı.
6. WHEN System_Admin bir birime board tanımlar, THE Application SHALL o birimin Board yapılandırmasını Store'a kaydetmeli.
7. THE Department_Head SHALL kendi birimindeki tüm projeleri ve bu projelere ait issue özetlerini görebilmeli.

---

### Requirement 4: Proje Yönetimi

**User Story:** Bir daire başkanı olarak, birimim içinde projeler oluşturmak ve yönetmek istiyorum; böylece farklı iş akışlarını birbirinden bağımsız takip edebilirim.

#### Acceptance Criteria

1. THE Department_Head SHALL kendi birimi içinde yeni proje oluşturabilmeli.
2. WHEN kullanıcı "Proje Oluştur" formunu doldurur ve gönderir, THE Application SHALL yeni projeyi Store'a eklemeli ve proje listesini güncellemeli.
3. IF proje adı alanı boş bırakılırsa, THEN THE Application SHALL "Proje adı zorunludur" hata mesajını göstermeli.
4. THE Application SHALL her proje için ad, birim (Unit), Project_Manager, açıklama ve oluşturulma tarihi alanlarını saklamalı.
5. WHEN kullanıcı bir projeyi seçer, THE Application SHALL o projeye ait Board ekranına yönlendirmeli.
6. THE Application SHALL proje listesini yalnızca kullanıcının rolüne göre filtreleyerek göstermeli: System_Admin tüm projeleri, Department_Head kendi biriminin projelerini, Project_Manager yalnızca kendi projesini görmeli.

---

### Requirement 5: Talep Sistemi

**User Story:** Bir dış kullanıcı olarak, ilgili birime talep açmak ve taleplerimin durumunu takip etmek istiyorum; böylece ihtiyaçlarımın karşılanıp karşılanmadığını görebilirim.

#### Acceptance Criteria

1. THE External_User SHALL giriş yaptıktan sonra yeni talep açabilmeli.
2. WHEN External_User talep açar, THE Application SHALL talep formunda tüm birimleri (Unit) listeleyen bir birim seçim alanı sunmalı.
3. WHEN External_User talep formunda bir birim seçer, THE Application SHALL proje seçim alanını yalnızca seçilen birime ait projelerle doldurmalı; farklı bir birim seçildiğinde proje seçimi sıfırlanmalı.
4. WHILE talep formunda hiçbir birim seçilmemişse, THE Application SHALL proje seçim alanını gizlemeli.
5. WHEN yeni talep oluşturulur, THE Application SHALL talep numarasını seçilen birimin Unit_Code'u ile etiketlemeli (örn. BIGD-123).
6. THE Application SHALL talep numaralarını her birim için bağımsız olarak artan sırada atamalı.
7. THE External_User SHALL yalnızca kendi açtığı talepleri ve bu taleplerin statülerini görebilmeli.
8. WHILE birim çalışanı bir talebe External_User'ın kullanıcı adını eklemişse, THE External_User SHALL o talebi kendi talep listesinde görebilmeli.
9. THE Application SHALL birim çalışanlarının belirli taleplere External_User kullanıcı adı ekleyebilmesine izin vermeli.
10. IF talep başlığı boş bırakılırsa, THEN THE Application SHALL "Talep başlığı zorunludur" hata mesajını göstermeli.
11. WHEN External_User talebinin durumu değişir, THE Application SHALL güncel durumu External_User'ın talep listesinde yansıtmalı.

---

### Requirement 6: Board Görünümü (Kanban/Scrum)

**User Story:** Bir proje yöneticisi olarak, issue'ları sütunlar halinde görmek ve sürükle-bırak ile durumlarını güncellemek istiyorum; böylece iş akışının durumunu tek bakışta anlayabilirim.

#### Acceptance Criteria

1. THE Board SHALL To Do, In Progress, In Review ve Done olmak üzere dört sabit sütun göstermeli.
2. WHEN kullanıcı bir Issue kartını farklı bir sütuna sürükler, THE Board SHALL Issue'nun Status değerini hedef sütunun adıyla güncellemeli.
3. WHILE bir Sprint aktif durumdayken, THE Board SHALL yalnızca o Sprint'e ait Issue'ları göstermeli.
4. WHERE Kanban modu seçiliyse, THE Board SHALL Sprint filtresi olmaksızın tüm açık Issue'ları göstermeli.
5. THE Board SHALL her sütundaki Issue sayısını sütun başlığının yanında göstermeli.
6. WHEN kullanıcı bir Issue kartına tıklar, THE Application SHALL Issue detay Modal'ını açmalı.
7. IF aktif Sprint yoksa, THEN THE Board SHALL "Aktif sprint bulunmuyor" mesajını göstermeli.
8. THE Board SHALL yalnızca kullanıcının rolüne göre erişim yetkisi olan projelerin issue'larını göstermeli.

---

### Requirement 7: Issue Yönetimi

**User Story:** Bir proje yöneticisi veya ekip üyesi olarak, issue oluşturmak, düzenlemek, silmek ve durumunu değiştirmek istiyorum; böylece görevleri takip edebilirim.

#### Acceptance Criteria

1. WHEN kullanıcı "Issue Oluştur" formunu doldurur ve gönderir, THE Application SHALL yeni Issue'yu Store'a eklemeli ve Board'u güncellemeli.
2. THE Application SHALL her Issue için başlık, açıklama, tip (Task/Bug/Story/Epic/Request), öncelik, durum, atanan kullanıcı, sprint ve oluşturulma tarihi alanlarını saklamalı.
3. THE Application SHALL Issue numarasını ilgili birimin Unit_Code'u ile etiketlemeli (örn. BIGD-1, ODB-5).
4. IF Issue başlığı boş bırakılırsa, THEN THE Application SHALL "Başlık zorunludur" hata mesajını göstermeli.
5. WHEN kullanıcı bir Issue'yu düzenler ve kaydeder, THE Application SHALL değişiklikleri Store'a yansıtmalı ve Activity akışına bir kayıt eklemeli.
6. WHEN kullanıcı bir Issue'yu silmek istediğinde, THE Application SHALL onay diyaloğu göstermeli.
7. WHEN kullanıcı silme işlemini onaylar, THE Application SHALL Issue'yu Store'dan kaldırmalı ve Board'u güncellemeli.
8. WHEN kullanıcı Issue durumunu değiştirir, THE Application SHALL yeni durumu Store'a kaydetmeli ve Activity akışına durum değişikliği kaydı eklemeli.
9. THE Project_Manager SHALL kendi projesindeki issue'lara kullanıcı atayabilmeli.

---

### Requirement 8: Sprint Yönetimi (Aylık Döngü)

**User Story:** Bir proje yöneticisi olarak, aylık sprint döngüsüyle çalışmak istiyorum; böylece her ayın başından son iş gününe kadar olan çalışma dönemini planlayıp takip edebilirim.

#### Acceptance Criteria

1. THE Application SHALL her Sprint'in başlangıç tarihini ayın 1'i, bitiş tarihini ise o ayın son iş günü olarak otomatik hesaplamalı.
2. WHEN kullanıcı "Sprint Oluştur" formunu doldurur ve gönderir, THE Application SHALL yeni Sprint'i Store'a eklemeli.
3. THE Application SHALL her Sprint için ad, başlangıç tarihi (ayın 1'i), bitiş tarihi (ayın son iş günü), ay, yıl ve durum (Planned, Active, Completed) alanlarını saklamalı.
4. IF bir projede zaten aktif bir Sprint varsa, THEN THE Application SHALL yeni bir Sprint başlatma girişiminde "Zaten aktif bir sprint var" hata mesajını göstermeli.
5. WHEN kullanıcı bir Sprint'i başlatır, THE Application SHALL Sprint durumunu Active olarak güncellemeli.
6. WHEN kullanıcı aktif Sprint'i tamamlar, THE Application SHALL Sprint durumunu Completed olarak güncellemeli ve tamamlanmamış Issue'ları Backlog'a taşımalı.
7. THE Application SHALL Backlog ekranında Sprint'e atanmamış Issue'ları listemeli.
8. WHEN kullanıcı Backlog'daki bir Issue'yu bir Sprint'e atar, THE Application SHALL Issue'nun sprint alanını güncellemeli.
9. THE Application SHALL aynı ay ve yıl için aynı projede birden fazla Sprint oluşturulmasını engellemeli ve "Bu ay için sprint zaten mevcut" hata mesajını göstermeli.

---

### Requirement 9: Kullanıcı Atama

**User Story:** Bir proje yöneticisi olarak, issue'lara kullanıcı atamak istiyorum; böylece sorumlulukları netleştirebilirim.

#### Acceptance Criteria

1. THE Application SHALL uygulama genelinde kullanılabilecek önceden tanımlı kullanıcıları Store'da saklamalı; her kullanıcı için ad, rol, birim ve avatar bilgisi bulunmalı.
2. WHEN Project_Manager bir Issue'da atanan kişiyi değiştirmek isterse, THE Application SHALL kendi projesine erişimi olan kullanıcıların listesini bir dropdown ile göstermeli.
3. WHEN bir kullanıcı Issue'ya atanır, THE Application SHALL atanan kullanıcının adını ve avatar'ını Issue kartında göstermeli.
4. THE Board SHALL kullanıcıya göre Issue'ları filtrelemek için bir filtre seçeneği sunmalı.
5. THE Dashboard SHALL her kullanıcıya atanmış açık Issue sayısını göstermeli.

---

### Requirement 10: Öncelik Seviyeleri

**User Story:** Bir proje yöneticisi veya ekip üyesi olarak, issue'lara öncelik atamak istiyorum; böylece hangi görevin daha acil olduğunu anlayabilirim.

#### Acceptance Criteria

1. THE Application SHALL Highest, High, Medium, Low ve Lowest olmak üzere beş öncelik seviyesini desteklemeli.
2. THE Application SHALL her öncelik seviyesi için ayırt edici bir renk ve ikon göstermeli.
3. WHEN kullanıcı Issue oluştururken öncelik seçmezse, THE Application SHALL varsayılan olarak Medium önceliğini atamalı.
4. THE Board SHALL önceliğe göre Issue'ları filtrelemek için bir filtre seçeneği sunmalı.
5. THE Application SHALL Issue kartlarında öncelik ikonunu görünür şekilde göstermeli.

---

### Requirement 11: Yorum ve Aktivite Akışı

**User Story:** Bir ekip üyesi olarak, issue'lara yorum eklemek ve geçmiş değişiklikleri görmek istiyorum; böylece iletişimi ve değişiklik geçmişini takip edebilirim.

#### Acceptance Criteria

1. WHEN kullanıcı bir Issue detay Modal'ında yorum yazar ve gönderir, THE Application SHALL yorumu Store'a eklemeli ve yorum listesini güncellemeli.
2. IF yorum metni boşsa, THEN THE Application SHALL gönderme işlemini engellemeli.
3. THE Application SHALL her yorumu yazar adı, içerik ve zaman damgasıyla birlikte göstermeli.
4. WHEN bir Issue üzerinde durum değişikliği, atama değişikliği veya alan güncellemesi gerçekleşir, THE Application SHALL Activity akışına zaman damgalı bir kayıt eklemeli.
5. THE Application SHALL Activity akışını en yeniden en eskiye doğru sıralı göstermeli.
6. WHEN kullanıcı kendi yazdığı bir yorumu silmek isterse, THE Application SHALL yorumu Store'dan kaldırmalı.

---

### Requirement 12: Rol Bazlı Dashboard

**User Story:** Her rol için özelleştirilmiş bir dashboard görmek istiyorum; böylece rolüme uygun özet bilgilere hızlıca ulaşabilirim.

#### Acceptance Criteria

1. WHEN System_Admin Dashboard'u görüntüler, THE Dashboard SHALL tüm birimlerin listesini, toplam proje sayısını, toplam açık issue sayısını ve aktif sprint sayısını göstermeli.
2. WHEN Department_Head Dashboard'u görüntüler, THE Dashboard SHALL kendi birimine ait projeleri, bu projelerdeki issue dağılımını (To Do / In Progress / Done) ve son aktiviteleri göstermeli.
3. WHEN Project_Manager Dashboard'u görüntüler, THE Dashboard SHALL kendi projesine ait issue özetini, sprint ilerlemesini ve atanan kullanıcı bazlı iş yükünü göstermeli.
4. WHEN External_User Dashboard'u görüntüler, THE Dashboard SHALL yalnızca kendi açtığı talepleri ve bu taleplerin güncel statülerini göstermeli.
5. THE Dashboard SHALL her projeye ait Issue dağılımını (To Do / In Progress / Done) görsel bir ilerleme çubuğuyla göstermeli.
6. THE Dashboard SHALL son 10 aktiviteyi zaman damgasıyla birlikte listemeli (External_User için bu alan gösterilmemeli).
7. WHEN kullanıcı Dashboard'daki bir proje kartına tıklar, THE Application SHALL o projenin Board ekranına yönlendirmeli.

---

### Requirement 13: Navigasyon ve Yönlendirme

**User Story:** Bir kullanıcı olarak, uygulama içinde kolayca gezinmek istiyorum; böylece ihtiyacım olan ekrana hızlıca ulaşabilirim.

#### Acceptance Criteria

1. THE Application SHALL sol tarafta bir Sidebar göstermeli; Sidebar içeriği kullanıcının rolüne göre değişmeli.
2. WHILE ekran genişliği md (768px) veya daha küçükse, THE Sidebar SHALL varsayılan olarak gizli olmalı ve bir toggle butonu ile açılıp kapanabilmeli.
3. THE Router SHALL her ekran için benzersiz bir URL yolu sağlamalı (örn. `/dashboard`, `/units`, `/projects`, `/projects/:id/board`, `/projects/:id/backlog`, `/requests`).
4. WHEN kullanıcı tarayıcı geri tuşuna basar, THE Router SHALL önceki ekrana dönmeli.
5. THE Application SHALL aktif sayfayı Sidebar'da vurgulayarak göstermeli.
6. IF kullanıcı tanımsız bir URL'ye giderse, THEN THE Application SHALL 404 sayfası göstermeli.
7. IF kullanıcı oturum açmadan korumalı bir sayfaya erişmeye çalışırsa, THEN THE Application SHALL kullanıcıyı giriş sayfasına yönlendirmeli.

---

### Requirement 14: Veri Kalıcılığı

**User Story:** Bir kullanıcı olarak, sayfayı yenilesem bile verilerimin kaybolmamasını istiyorum; böylece çalışmalarım korunmuş olur.

#### Acceptance Criteria

1. THE Application SHALL Store'daki tüm veriyi tarayıcının localStorage'ına senkronize etmeli.
2. WHEN uygulama ilk yüklendiğinde, THE Application SHALL localStorage'da kayıtlı veri varsa Store'u bu veriyle başlatmalı.
3. IF localStorage'da veri yoksa, THEN THE Application SHALL örnek birim, proje, kullanıcı ve issue verilerini içeren varsayılan seed verisini yüklemeli.
4. THE Application SHALL her Store güncellemesinden sonra localStorage'ı otomatik olarak güncellemeli.

---

---

### Requirement 15: Talep Detay Modalı

**User Story:** Bir kullanıcı olarak, bir talebin üzerine tıkladığımda Jira benzeri tam detay görünümünü görmek istiyorum; böylece talebin tüm bilgilerine, yorumlarına ve aktivite geçmişine tek ekrandan ulaşabilirim.

#### Acceptance Criteria

1. WHEN kullanıcı bir talep kartına tıklar, THE Application SHALL Request_Detail_Modal'ı açmalı.
2. THE Request_Detail_Modal SHALL talebin başlığını, açıklamasını, numarasını (örn. BIGD-42), durumunu, önceliğini, tipini, atanan kişiyi, raporlayanı, geliş tarihini (createdAt), çözülüş tarihini (resolvedAt) ve harcanan zamanı (timeSpent) göstermeli.
3. THE Request_Detail_Modal SHALL talebin yorum listesini yazar adı, içerik ve zaman damgasıyla birlikte göstermeli.
4. THE Request_Detail_Modal SHALL talebin aktivite akışını (durum değişiklikleri, atama değişiklikleri, alan güncellemeleri) en yeniden en eskiye doğru sıralı göstermeli.
5. WHEN kullanıcı Request_Detail_Modal içinde yorum yazar ve gönderir, THE Application SHALL yorumu Store'a eklemeli ve yorum listesini güncellemeli.
6. IF yorum metni boşsa, THEN THE Application SHALL yorum gönderme işlemini engellemeli.
7. WHEN kullanıcı Request_Detail_Modal'ı kapatır, THE Application SHALL modal'ı gizlemeli ve arka plandaki listeyi güncel haliyle göstermeli.
8. THE Request_Detail_Modal SHALL klavye ile kapatılabilmeli (Escape tuşu).
9. WHEN talep üzerinde herhangi bir alan güncellenir, THE Application SHALL Activity akışına zaman damgalı bir kayıt eklemeli.

---

### Requirement 16: Board'dan Talep Detayına Erişim

**User Story:** Bir proje yöneticisi veya daire başkanı olarak, Board'daki bir talep kartına tıkladığımda o talebin detay modalının açılmasını istiyorum; böylece board görünümünden ayrılmadan talebin tüm bilgilerine erişebilirim.

#### Acceptance Criteria

1. WHEN kullanıcı Board'daki bir Issue kartına tıklar ve o Issue'nun `isRequest` değeri `true` ise, THE Application SHALL Request_Detail_Modal'ı açmalı.
2. WHEN kullanıcı Board'daki bir Issue kartına tıklar ve o Issue'nun `isRequest` değeri `false` ise, THE Application SHALL mevcut IssueModal'ı açmalı.
3. THE Board SHALL talep kartlarını (isRequest: true) diğer issue kartlarından görsel olarak ayırt edebilmek için "Request" tip rozetini göstermeli.
4. WHEN Request_Detail_Modal Board üzerinde açıkken kullanıcı modal'ı kapatır, THE Application SHALL Board görünümüne dönmeli ve Board'un sürükle-bırak işlevselliği korunmalı.
5. THE Board SHALL Request_Detail_Modal açıkken arka planda sürükle-bırak işlemlerini engellemeli.

---

### Requirement 17: Atama Yetki Kontrolü

**User Story:** Bir sistem yöneticisi olarak, taleplerde atanan kişinin yalnızca yetkili roller tarafından değiştirilebilmesini istiyorum; böylece iş akışı bütünlüğü ve sorumluluk takibi sağlanmış olur.

#### Acceptance Criteria

1. THE External_User SHALL Request_Detail_Modal içinde atanan kişi (Assignee) alanını değiştiremez; bu alan External_User için salt okunur (read-only) olarak gösterilmeli.
2. THE Department_Head SHALL kendi birimine ait taleplerde atanan kişiyi değiştirebilmeli.
3. THE Project_Manager SHALL kendi projesine ait taleplerde atanan kişiyi değiştirebilmeli.
4. THE System_Admin SHALL tüm taleplerde atanan kişiyi değiştirebilmeli.
5. WHEN yetkili bir kullanıcı atanan kişiyi değiştirir, THE Application SHALL değişikliği Store'a kaydetmeli ve Activity akışına "Atama değiştirildi: [eski kullanıcı] → [yeni kullanıcı]" kaydı eklemeli.
6. IF External_User atanan kişiyi değiştirmeye çalışırsa, THEN THE Application SHALL bu işlemi engellemeli ve atama alanını düzenlenemez olarak göstermeli.
7. WHEN atanan kişi değiştirilir, THE Application SHALL yeni atanan kişinin adını ve avatar'ını Request_Detail_Modal'da anında güncellenmeli.

---

### Requirement 18: Talep Klonlama

**User Story:** Bir kullanıcı olarak, mevcut bir talebi kopyalayarak benzer içerikli yeni bir talep oluşturmak istiyorum; böylece tekrarlayan talepleri hızlıca açabilirim.

#### Acceptance Criteria

1. THE Request_Detail_Modal SHALL yetkili kullanıcılar için bir "Klonla" butonu göstermeli.
2. WHEN kullanıcı "Klonla" butonuna tıklar, THE Application SHALL kaynak talebin başlığını, açıklamasını, tipini, önceliğini ve birimini kopyalayarak yeni bir talep oluşturmalı.
3. WHEN talep klonlanır, THE Application SHALL yeni talebin başlığını "[Kaynak Talep Başlığı] (Kopya)" olarak atamalı.
4. WHEN talep klonlanır, THE Application SHALL yeni talebin durumunu "To Do" olarak atamalı.
5. WHEN talep klonlanır, THE Application SHALL yeni talebin `resolvedAt` ve `timeSpent` alanlarını boş/sıfır olarak atamalı.
6. WHEN talep klonlanır, THE Application SHALL yeni talebin `createdAt` alanını klonlama anının zaman damgasıyla atamalı.
7. WHEN talep klonlanır, THE Application SHALL yeni talebe mevcut birimin Unit_Code'una göre bir sonraki sıra numarasını atamalı (örn. BIGD-44).
8. WHEN talep klonlama işlemi tamamlanır, THE Application SHALL yeni oluşturulan talebin Request_Detail_Modal'ını açmalı.
9. THE External_User SHALL yalnızca kendi açtığı talepleri klonlayabilmeli.

---

### Requirement 19: Tarih Takibi ve Harcanan Zaman

**User Story:** Bir proje yöneticisi veya daire başkanı olarak, taleplerin geliş tarihini, çözülüş tarihini ve üzerinde harcanan zamanı görmek ve güncellemek istiyorum; böylece iş yükünü ve çözüm sürelerini analiz edebilirim.

#### Acceptance Criteria

1. THE Application SHALL her talep için `createdAt` (geliş tarihi), `resolvedAt` (çözülüş tarihi) ve `timeSpent` (harcanan zaman, dakika cinsinden) alanlarını Store'da saklamalı.
2. THE Request_Detail_Modal SHALL geliş tarihini (createdAt) okunabilir formatta göstermeli.
3. THE Request_Detail_Modal SHALL çözülüş tarihini (resolvedAt) göstermeli; henüz çözülmemişse "—" olarak göstermeli.
4. THE Request_Detail_Modal SHALL harcanan zamanı (timeSpent) saat ve dakika formatında göstermeli (örn. "2s 30dk"); değer sıfırsa "—" olarak göstermeli.
5. WHEN yetkili bir kullanıcı (Department_Head, Project_Manager, System_Admin) `resolvedAt` alanını günceller, THE Application SHALL değişikliği Store'a kaydetmeli ve Activity akışına kayıt eklemeli.
6. WHEN yetkili bir kullanıcı `timeSpent` alanını günceller, THE Application SHALL değişikliği Store'a kaydetmeli ve Activity akışına kayıt eklemeli.
7. THE External_User SHALL `resolvedAt` ve `timeSpent` alanlarını güncelleyememeli; bu alanlar External_User için salt okunur olarak gösterilmeli.
8. WHEN bir talebin durumu "Done" olarak değiştirilir ve `resolvedAt` alanı boşsa, THE Application SHALL `resolvedAt` alanını otomatik olarak o anın zaman damgasıyla doldurmalı.
9. IF `timeSpent` alanına negatif bir değer girilirse, THEN THE Application SHALL "Harcanan zaman negatif olamaz" hata mesajını göstermeli ve değeri kaydetmemeli.

---

## Correctness Properties

### Property 1: Issue Durum Geçişi Tutarlılığı
WHEN bir Issue'nun durumu güncellenir, THE Store'daki issue.status değeri yalnızca geçerli STATUSES değerlerinden biri olmalıdır.
- **Test tipi**: Property-based (durum geçişleri için tüm kombinasyonlar)
- **Invariant**: `STATUSES.includes(issue.status)` her zaman true

### Property 2: Sprint Tekliği
WHILE bir projede aktif Sprint varken, THE Store'da aynı projectId için status='Active' olan Sprint sayısı 1'i geçmemeli.
- **Test tipi**: Property-based
- **Invariant**: `activeSprints.filter(s => s.projectId === id).length <= 1`

### Property 3: Sprint Aylık Döngü Sınırları
THE Sprint başlangıç tarihi her zaman ilgili ayın 1'i, bitiş tarihi ise o ayın son iş günü olmalıdır.
- **Test tipi**: Property-based (tüm ay/yıl kombinasyonları için)
- **Invariant**: `sprint.startDate.getDate() === 1` ve `isLastWorkingDay(sprint.endDate)`

### Property 4: Issue Numarası Birim Kodu Etiketlemesi
THE Her Issue numarası, ait olduğu birimin Unit_Code'u ile başlamalıdır.
- **Test tipi**: Property-based
- **Invariant**: `issue.number.startsWith(issue.unit.unitCode + '-')`

### Property 5: Aktivite Sıralaması
THE Activity akışı her zaman en yeniden en eskiye doğru sıralı olmalıdır.
- **Test tipi**: Property-based (sıralama invariant'ı)
- **Invariant**: `activities[i].createdAt >= activities[i+1].createdAt`

### Property 6: Dashboard İstatistik Tutarlılığı
THE Dashboard'daki toplam açık Issue sayısı, Store'daki status !== 'Done' olan Issue'ların sayısıyla eşleşmelidir.
- **Test tipi**: Property-based (metamorphic)
- **Invariant**: `dashboardOpenCount === issues.filter(i => i.status !== 'Done').length`

### Property 7: localStorage Round-Trip
THE Store verisi localStorage'a yazılıp okunduğunda orijinal veriyle eşdeğer olmalıdır.
- **Test tipi**: Property-based (round-trip)
- **Invariant**: `JSON.parse(JSON.stringify(state))` deep equal `state`

### Property 8: Sprint Tamamlama — Backlog Taşıma
WHEN bir Sprint tamamlandığında, THE tamamlanmamış (status !== 'Done') Issue'ların sprintId değeri null olmalıdır.
- **Test tipi**: Property-based
- **Invariant**: Tamamlanan sprint'e ait Done olmayan issue'ların `sprintId === null`

### Property 9: Dış Kullanıcı Talep Görünürlüğü
THE External_User yalnızca kendi userId'siyle eşleşen veya kendisinin eklendiği talepleri görebilmeli; başka kullanıcılara ait talepler görünmemeli.
- **Test tipi**: Property-based (erişim kontrolü)
- **Invariant**: `visibleRequests.every(r => r.reporterId === currentUser.id || r.visibleTo.includes(currentUser.id))`

### Property 10: Rol Bazlı Proje Erişimi
THE Her kullanıcı yalnızca kendi rolüne ve birimine göre yetkili olduğu projeleri görebilmeli.
- **Test tipi**: Property-based (erişim kontrolü)
- **Invariant**: System_Admin tüm projeleri, Department_Head kendi biriminin projelerini, Project_Manager yalnızca kendi projesini, External_User hiçbir projeyi göremez.

### Property 11: Atama Değişikliği Yetki Kontrolü
THE External_User hiçbir talep için atanan kişiyi değiştiremez; yalnızca Department_Head, Project_Manager ve System_Admin atama değişikliği yapabilir.
- **Test tipi**: Property-based (erişim kontrolü)
- **Invariant**: `canChangeAssignee(user) === (user.role !== ROLES.EXTERNAL_USER)`

### Property 12: Talep Klonlama Veri Bütünlüğü
WHEN bir talep klonlandığında, THE yeni talebin başlığı kaynak talebin başlığını içermeli, durumu "To Do" olmalı, `resolvedAt` boş olmalı, `timeSpent` sıfır olmalı ve numarası ilgili birimin Unit_Code'u ile başlamalıdır.
- **Test tipi**: Property-based (invariant)
- **Invariant**: `cloned.title.includes(source.title) && cloned.status === 'To Do' && !cloned.resolvedAt && cloned.timeSpent === 0 && cloned.number.startsWith(source.unitCode + '-')`

### Property 13: Otomatik resolvedAt Doldurma
WHEN bir talebin durumu "Done" olarak değiştirildiğinde ve `resolvedAt` boşsa, THE Application SHALL `resolvedAt` alanını o anın zaman damgasıyla doldurmalı; `resolvedAt` değeri her zaman `createdAt` değerinden büyük veya eşit olmalıdır.
- **Test tipi**: Property-based (invariant)
- **Invariant**: `resolvedAt >= createdAt` (her ikisi de dolu olduğunda)

### Property 14: timeSpent Negatif Olamaz
THE Herhangi bir talep için `timeSpent` alanı hiçbir zaman negatif bir değer içermemeli.
- **Test tipi**: Property-based (invariant)
- **Invariant**: `issue.timeSpent === undefined || issue.timeSpent === null || issue.timeSpent >= 0`

### Property 15: Board Kart Tıklama Yönlendirme Tutarlılığı
FOR ALL issue kartları, WHEN karta tıklandığında açılan modal tipi `isRequest` alanıyla tutarlı olmalıdır: `isRequest === true` ise Request_Detail_Modal, `isRequest === false` ise IssueModal açılmalıdır.
- **Test tipi**: Property-based (metamorphic)
- **Invariant**: `openedModalType(issue) === (issue.isRequest ? 'RequestDetailModal' : 'IssueModal')`

### Property 16: Birim-Proje Filtreleme Tutarlılığı
WHEN talep formunda bir birim seçildiğinde, THE proje dropdown'ında listelenen tüm projeler yalnızca seçilen birime ait olmalıdır; başka birime ait proje görünmemelidir.
- **Test tipi**: Property-based (invariant)
- **Invariant**: `unitProjects.every(p => p.unitId === selectedUnitId)`

### Property 17: Arama Filtresi Kapsayıcılığı
WHEN talepler listesinde bir arama terimi girildiğinde, THE filtrelenmiş sonuçlar yalnızca başlık, açıklama veya talep numarasında arama terimini içeren talepleri kapsamalıdır; eşleşmeyen hiçbir talep listede görünmemelidir.
- **Test tipi**: Property-based (invariant)
- **Invariant**: `filteredRequests.every(r => matchesSearch(r, term)) && originalRequests.filter(r => matchesSearch(r, term)).length === filteredRequests.length`

### Property 18: Seed Data Yapısal Bütünlüğü
THE Seed data yüklendiğinde, Store'da tam olarak 2 birim, 4 proje (her birime 2'şer), 1 System_Admin, 2 Department_Head (her birime 1), 2 Project_Manager (her birime 1), 8 Worker (her birime 4), 1 External_User bulunmalıdır; her projenin managerId'si geçerli bir kullanıcıya, her birimin departmentHeadId'si geçerli bir Department_Head'e işaret etmelidir.
- **Test tipi**: Property-based (invariant)
- **Invariant**: `units.length === 2 && projects.length === 4 && users.filter(u => u.role === 'System_Admin').length === 1 && users.filter(u => u.role === 'Worker').length === 8 && projects.every(p => users.find(u => u.id === p.managerId))`

---

### Requirement 20: Seed Data Yapısı

**User Story:** Bir sistem yöneticisi olarak, uygulamanın gerçekçi ve tutarlı örnek verilerle başlamasını istiyorum; böylece tüm roller ve birimler doğru şekilde temsil edilmiş olsun.

#### Acceptance Criteria

1. THE Application SHALL seed data olarak tam olarak 2 birim içermeli: "Öğrenci İşleri Daire Başkanlığı" (Unit_Code: ODB) ve "Bilgi İşlem Daire Başkanlığı" (Unit_Code: BIGD).
2. THE Application SHALL her birim için tam olarak 2 proje içermeli; toplamda 4 proje bulunmalı.
3. THE Application SHALL her proje için tam olarak 1 Project_Manager atamalı.
4. THE Application SHALL her birim için tam olarak 1 Department_Head kullanıcısı içermeli.
5. THE Application SHALL her birime tam olarak 8 Worker (çalışan) rolünde kullanıcı atamalı; bu 8 çalışanın 4'ü birimin birinci projesine, 4'ü ikinci projesine atanmalı.
6. THE Application SHALL seed data içinde tam olarak 1 System_Admin kullanıcısı içermeli.
7. THE Application SHALL seed data içinde tam olarak 1 External_User rolünde kullanıcı içermeli.
8. THE Application SHALL her birim ve proje için örnek talepler (isRequest: true) içermeli.
9. WHEN seed data yüklendiğinde, THE Application SHALL her projenin managerId alanının geçerli bir Project_Manager kullanıcısına işaret ettiğini doğrulamalı.
10. WHEN seed data yüklendiğinde, THE Application SHALL her birimin departmentHeadId alanının geçerli bir Department_Head kullanıcısına işaret ettiğini doğrulamalı.
11. THE Application SHALL Worker rolündeki kullanıcıların unitId alanının ait oldukları birime işaret ettiğini doğrulamalı.

---

### Requirement 21: Talepler Listesinde Arama ve Filtreleme

**User Story:** Bir kullanıcı olarak, talepler listesinde arama yapabilmek istiyorum; böylece çok sayıda talep arasından aradığımı hızlıca bulabilirim.

#### Acceptance Criteria

1. THE RequestList SHALL talepler listesinin üstünde bir metin arama alanı (search input) göstermeli.
2. WHEN kullanıcı arama alanına metin girer, THE RequestList SHALL listeyi gerçek zamanlı olarak filtrelemeli; her tuş vuruşunda liste güncellenmeli.
3. THE RequestList SHALL arama sorgusunu talebin başlığı, açıklaması ve talep numarasında (örn. BIGD-7) eşleştirmeli.
4. THE RequestList SHALL arama eşleştirmesini büyük/küçük harf duyarsız (case-insensitive) yapmalı.
5. IF arama sonucunda hiçbir talep eşleşmiyorsa, THEN THE RequestList SHALL "Arama kriterlerine uygun talep bulunamadı" mesajını göstermeli.
6. WHEN arama alanı boşaltılırsa, THE RequestList SHALL tüm talepleri tekrar göstermeli.
7. THE RequestList SHALL arama alanının yanında mevcut filtrelenmiş talep sayısını göstermeli (örn. "3 talep bulundu").
