# Jira Clone Frontend — Bugfix Tasarım Belgesi

## Overview

Bu belge, talep (Request) yönetim ekranında tespit edilen dört hatanın düzeltme tasarımını kapsamaktadır.

**Hata 1 — Talep düzenleme ekranında proje alanı eksik:**  
`RequestDetailModal.jsx`, talep detayını göstermek için `RequestDetailContent` yerine `IssueDetailContent` bileşenini kullanmaktadır. `IssueDetailContent`'in düzenleme modu (`editMode`) proje seçim alanı içermemektedir. Düzeltme: `IssueDetailContent.handleSave()` fonksiyonuna proje seçim alanı ve `unitCode` güncelleme mantığı eklenmeli; ya da `RequestDetailModal` doğrudan `RequestDetailContent`'i kullanacak şekilde yönlendirilmelidir.

**Hata 2 — Proje değişince talep eski birimde görünmeye devam ediyor:**  
`IssueDetailContent.handleSave()` fonksiyonu `UPDATE_ISSUE` action'ını dispatch ederken `unitCode` alanını payload'a dahil etmemektedir. `AppReducer`'daki `UPDATE_ISSUE` case'i spread operatörüyle payload'ı merge ettiğinden, `unitCode` gönderilmezse eski değer korunur. Düzeltme: `handleSave()` içinde yeni `projectId`'ye karşılık gelen `unitCode` hesaplanmalı ve payload'a eklenmeli.

**Hata 3 — Atama listesinde yanlış kişiler:**  
`IssueDetailContent`'teki `assignableUsers` hesaplaması, `Department_Head` rolü için `u.unitId === project?.unitId` koşulunu kullanmaktadır. Bu koşul, aynı birimde farklı projelerde çalışan tüm Worker'ları listeye dahil eder. Düzeltme: Worker rolü için `u.projectId === issue.projectId` koşulu uygulanmalı; `Department_Head` ve `Project_Manager` rolleri için proje bazlı filtreleme yapılmalıdır.

**Hata 4 — Worker rolünün talep düzenleme yetkisi:**  
`IssueDetailContent.jsx`'teki "Düzenle" butonu yalnızca `External_User` rolünü dışlamaktadır (`!isExternalUser`). `Worker` rolü dışlanmadığından, Worker kullanıcılar talep detay modalında "Düzenle" butonunu görebilmekte ve talebin başlık, açıklama, öncelik, durum ve proje alanlarını değiştirebilmektedir. Düzeltme: `isWorker` kontrolü eklenerek `canEdit` hesaplaması `!readonly && !isExternalUser && !isWorker` şeklinde güncellenmeli; "Düzenle", "Kaydet", "İptal" ve "Sil" butonları bu koşula bağlanmalıdır.

**Hata 5 — External_User'ın kendi açtığı talepleri düzenleyememesi:**  
`IssueDetailContent.jsx`'teki `canEdit` değişkeni `!readonly && !isExternalUser && !isWorker` olarak hesaplanmaktadır. `isExternalUser` true olduğunda `canEdit` her zaman false olur; bu nedenle dış kullanıcı kendi oluşturduğu taleplerde bile "Düzenle", "Kaydet", "İptal" ve "Sil" butonlarını göremez. Düzeltme: `isOwnRequest` türetilmiş değişkeni eklenerek `canEdit` hesaplaması `!readonly && !isWorker && (!isExternalUser || isOwnRequest)` şeklinde güncellenmeli; dış kullanıcı yalnızca kendi açtığı taleplerde (`issue.isRequest === true AND issue.reporterId === currentUser?.id`) bu butonları görebilmeli.

---

## Glossary

- **Bug_Condition (C)**: Hatanın tetiklendiği koşul — belirli bir girdi veya bileşen durumu.
- **Property (P)**: Hata koşulu sağlandığında beklenen doğru davranış.
- **Preservation**: Düzeltme sonrasında değişmemesi gereken mevcut davranışlar.
- **IssueDetailContent**: `src/components/issue/IssueDetailContent.jsx` — hem normal issue'lar hem de talepler için kullanılan birleşik detay bileşeni.
- **RequestDetailModal**: `src/components/request/RequestDetailModal.jsx` — talep detayını modal içinde gösteren sarmalayıcı; şu an `IssueDetailContent`'i render etmektedir.
- **RequestDetailContent**: `src/components/request/RequestDetailContent.jsx` — taleplere özgü detay bileşeni; proje seçim alanı içerir ancak modal tarafından kullanılmamaktadır.
- **assignableUsers**: Bir talebe atanabilecek kullanıcıların hesaplandığı türetilmiş veri.
- **unitCode**: Bir talebin hangi birime ait olduğunu belirleyen alan (örn. `BIGD`, `ODB`).
- **handleSave**: `IssueDetailContent`'te düzenleme modundaki değişiklikleri Store'a kaydeden fonksiyon.
- **UPDATE_ISSUE**: `AppReducer`'da issue alanlarını güncelleyen action tipi.
- **canEdit**: `IssueDetailContent`'te "Düzenle", "Kaydet", "İptal" ve "Sil" butonlarının görünürlüğünü kontrol eden türetilmiş boolean değer.
- **isWorker**: `usePermissions` hook'undan gelen, mevcut kullanıcının `Worker` rolünde olup olmadığını belirten boolean değer.
- **isOwnRequest**: `IssueDetailContent`'te hesaplanan türetilmiş boolean değer; `issue.isRequest === true AND issue.reporterId === currentUser?.id` koşulunu ifade eder.

---

## Bug Details

### Hata 1: Proje Alanı Eksikliği

Talep detay modalı açıldığında "Düzenle" butonuna basılınca, düzenleme formu yalnızca başlık, açıklama, tip, öncelik ve durum alanlarını göstermektedir. Proje seçim alanı bulunmamaktadır. Bunun nedeni `RequestDetailModal`'ın `IssueDetailContent`'i kullanmasıdır; bu bileşenin düzenleme modunda proje seçimi yoktur.

**Formal Specification:**
```
FUNCTION isBugCondition_1(X)
  INPUT: X — { component: string, issueIsRequest: boolean, mode: string }
  OUTPUT: boolean

  RETURN X.component = "IssueDetailContent"
         AND X.issueIsRequest = true
         AND X.mode = "editMode"
         AND NOT rendered.contains(projectSelectField)
END FUNCTION
```

**Örnekler:**
- `BIGD-6` (VPN erişim talebi) detay modalı açılır → "Düzenle" tıklanır → Formda proje seçim alanı görünmez. **Beklenen:** Proje seçim alanı görünmeli.
- `ODB-5` (Transkript belgesi talebi) düzenleme modunda → Proje değiştirilemez. **Beklenen:** Birime ait projeler arasından seçim yapılabilmeli.
- Düzenleme modunda başlık değiştirilip kaydedilir → Proje alanı olmadığı için proje değiştirilemiyor. **Beklenen:** Proje de değiştirilebilmeli.

### Hata 2: Proje Değişince Birim Güncellenmemesi

Bir talep farklı bir projeye taşındığında (proje değiştirildiğinde), `unitCode` alanı güncellenmemektedir. `IssueDetailContent.handleSave()` fonksiyonu `UPDATE_ISSUE` dispatch ederken `unitCode` göndermemektedir.

**Formal Specification:**
```
FUNCTION isBugCondition_2(X)
  INPUT: X — { request: Issue, newProjectId: string, projects: Project[], units: Unit[] }
  OUTPUT: boolean

  newProject ← projects.find(p => p.id = X.newProjectId)
  newUnit    ← units.find(u => u.id = newProject.unitId)
  RETURN newProject.unitId ≠ units.find(u => u.unitCode = X.request.unitCode).id
         AND dispatch_payload.unitCode = undefined
END FUNCTION
```

**Örnekler:**
- `BIGD-6` talebi `project-bigd-1`'den `project-odb-1`'e taşınır → `unitCode` hâlâ `BIGD` kalır. **Beklenen:** `unitCode` → `ODB` olmalı.
- Proje değişikliği sonrası talep listesi `Department_Head` tarafından görüntülenir → Talep eski birimde görünür. **Beklenen:** Yeni birimde görünmeli.
- `unitCode` güncellenmediği için talep numarası da yanlış birimle eşleşir. **Beklenen:** Birim değişince talep doğru birimde listelenmeli.

### Hata 3: Atama Listesinde Yanlış Kişiler

`IssueDetailContent`'teki `assignableUsers` hesaplaması `u.unitId === project?.unitId` koşulunu kullanmaktadır. Bu, aynı birimde farklı projelerde çalışan tüm Worker'ları listeye dahil eder.

**Formal Specification:**
```
FUNCTION isBugCondition_3(X)
  INPUT: X — { currentUser: User, request: Issue, users: User[], projects: Project[] }
  OUTPUT: boolean

  targetProject ← projects.find(p => p.id = X.request.projectId)
  assignable    ← computeAssignableUsers(X.request, X.users, X.projects)
  wrongWorkers  ← assignable.filter(u =>
    u.role = "Worker" AND u.projectId ≠ X.request.projectId
  )
  RETURN wrongWorkers.length > 0
END FUNCTION
```

**Örnekler:**
- `project-bigd-1`'e ait bir talep için "Ata" tıklanır → `project-bigd-2`'nin Worker'ları da listede görünür. **Beklenen:** Yalnızca `project-bigd-1`'in Worker'ları görünmeli.
- `Department_Head` rolündeki kullanıcı `project-odb-1`'e ait talebi atamak ister → `project-odb-2`'nin çalışanları da listelenir. **Beklenen:** Yalnızca `project-odb-1`'e ait kişiler listelenmeli.
- `System_Admin` atama yapar → Tüm kullanıcılar listelenir. **Beklenen:** Bu davranış korunmalı (değişmemeli).

### Hata 4: Worker Rolünün Talep Düzenleme Yetkisi

`IssueDetailContent.jsx`'teki "Düzenle" butonu `!readonly && !isExternalUser` koşuluyla render edilmektedir. `Worker` rolü bu koşulda dışlanmadığından, Worker kullanıcılar talep detay modalında "Düzenle" butonunu görebilmekte ve talebin tüm alanlarını (başlık, açıklama, öncelik, durum, proje) değiştirebilmektedir.

**Formal Specification:**
```
FUNCTION isBugCondition_4(X)
  INPUT: X — { user: User, request: Issue }
  OUTPUT: boolean

  RETURN X.user.role = "Worker"
         AND X.request.isRequest = true
         AND rendered(IssueDetailContent, X).contains(editButton)
END FUNCTION
```

**Örnekler:**
- Worker rolündeki `user-bigd-w1` kullanıcısı kendisine atanmış `BIGD-6` talebini açar → "Düzenle" butonu görünür. **Beklenen:** "Düzenle" butonu görünmemeli.
- Worker, "Düzenle" butonuna tıklar → Başlık, açıklama, öncelik, durum ve proje alanları düzenlenebilir hale gelir. **Beklenen:** Bu alanlar Worker tarafından düzenlenememeli.
- Worker, "Kaydet" butonuna tıklar → Değişiklikler Store'a kaydedilir. **Beklenen:** Worker kaydetme işlemi yapamamalı.
- Worker, "Sil" butonuna tıklar → Talep silinir. **Beklenen:** Worker silme işlemi yapamamalı.
- `System_Admin` aynı talebi açar → "Düzenle" butonu görünür. **Beklenen:** Bu davranış korunmalı (değişmemeli).

### Hata 5: External_User'ın Kendi Açtığı Talepleri Düzenleyememesi

`IssueDetailContent.jsx`'teki `canEdit` değişkeni `!readonly && !isExternalUser && !isWorker` olarak hesaplanmaktadır. `isExternalUser` true olduğunda `canEdit` her zaman false olur; bu nedenle dış kullanıcı kendi oluşturduğu taleplerde bile "Düzenle", "Kaydet", "İptal" ve "Sil" butonlarını göremez.

**Formal Specification:**
```
FUNCTION isBugCondition_5(X)
  INPUT: X — { user: User, request: Issue }
  OUTPUT: boolean

  RETURN X.user.role = "External_User"
         AND X.request.isRequest = true
         AND X.request.reporterId = X.user.id
         AND NOT rendered(IssueDetailContent, X).contains(editButton)
END FUNCTION
```

**Örnekler:**
- `user-external` kullanıcısı kendi açtığı `BIGD-6` (VPN erişim talebi) detay modalını açar → "Düzenle" butonu görünmez. **Beklenen:** "Düzenle" butonu görünmeli.
- `user-external` kullanıcısı kendi talebini düzenlemek ister → Düzenleme modu açılamaz. **Beklenen:** Düzenleme modu açılabilmeli.
- `user-external` kullanıcısı kendi talebini silmek ister → "Sil" butonu görünmez. **Beklenen:** "Sil" butonu görünmeli.
- `user-external` kullanıcısı başkasının açtığı bir talebi görüntüler → "Düzenle" butonu görünmemeli. **Beklenen:** Bu davranış korunmalı (değişmemeli).

---

### Preservation Requirements

**Değişmemesi Gereken Davranışlar:**
- Başlık, açıklama, tip, öncelik ve durum alanlarının düzenlenmesi ve kaydedilmesi mevcut gibi çalışmaya devam etmeli.
- Düzenleme formunun "İptal" butonu ile kapatılması değişiklikleri kaydetmeden formu kapatmalı.
- `External_User` talep listesini görüntülediğinde yalnızca kendi açtığı veya kendisine görünür yapılan talepleri görmeli.
- `Department_Head` veya `Project_Manager` talep listesini görüntülediğinde yalnızca kendi birimine/projesine ait talepleri görmeli.
- `System_Admin` atama yaparken tüm kullanıcıları atanabilir olarak görmeli.
- Bir talebin durumu "Done" olarak değiştirildiğinde ve `resolvedAt` boşsa, `resolvedAt` otomatik doldurulmalı.
- Talep klonlama işlemi yeni talebi kaynak talebin birimiyle aynı birimde oluşturmalı.
- Talep arama alanı başlık, açıklama ve numara alanlarında büyük/küçük harf duyarsız filtreleme yapmalı.
- `Worker` rolündeki kullanıcılar için mevcut davranışlar değişmemeli.
- `System_Admin`, `Department_Head` ve `Project_Manager` rolündeki kullanıcılar talep detay modalında "Düzenle" butonunu görmeye devam etmeli; bu kullanıcıların düzenleme yetkisi etkilenmemeli.
- `Worker` rolündeki kullanıcılar durum değiştirme butonlarını görmeye devam etmeli; yalnızca talebin durumunu değiştirebilmeli.
- `External_User` rolündeki kullanıcılar başkasının açtığı taleplerde "Düzenle", "Kaydet", "İptal" ve "Sil" butonlarını görmemeye devam etmeli.

**Kapsam:**
Hata koşullarını tetiklemeyen tüm girdiler (proje değiştirmeyen düzenlemeler, `System_Admin` atamaları, `External_User` görünürlüğü vb.) bu düzeltmeden etkilenmemeli.

---

## Hypothesized Root Cause

### Hata 1 için Kök Neden Analizi

1. **Yanlış Bileşen Kullanımı**: `RequestDetailModal.jsx`, `RequestDetailContent` yerine `IssueDetailContent`'i render etmektedir. `RequestDetailContent`'te proje seçim alanı mevcuttur ancak bu bileşen modal tarafından kullanılmamaktadır.

2. **IssueDetailContent'te Proje Alanı Yok**: `IssueDetailContent`'in `editMode`'u proje seçimini desteklememektedir; bu bileşen genel amaçlı tasarlanmıştır.

3. **Olası Çözüm Yolları**:
   - `IssueDetailContent`'e `isRequest` prop'una göre koşullu proje seçim alanı eklemek.
   - `RequestDetailModal`'ı `RequestDetailContent`'i kullanacak şekilde güncellemek (ancak `RequestDetailContent` bazı özellikleri eksik içerebilir).

### Hata 2 için Kök Neden Analizi

1. **Eksik unitCode Payload**: `IssueDetailContent.handleSave()` fonksiyonu `UPDATE_ISSUE` dispatch ederken `unitCode` alanını göndermemektedir:
   ```javascript
   dispatch({
     type: ACTIONS.UPDATE_ISSUE,
     payload: {
       id: issue.id,
       title, description, type: editType,
       priority: editPriority, status: editStatus,
       assigneeId: editAssigneeId || null,
       // unitCode EKSİK!
     },
   });
   ```

2. **AppReducer Spread Davranışı**: `UPDATE_ISSUE` case'i `{ ...issue, ...action.payload }` ile merge eder. `unitCode` payload'da yoksa eski değer korunur.

3. **Proje Seçim Alanı Eksikliği**: Hata 1 çözülmeden Hata 2 de çözülemez; proje seçim alanı olmadan `projectId` değişmez, dolayısıyla `unitCode` hesaplaması da tetiklenmez.

### Hata 3 için Kök Neden Analizi

1. **Birim Bazlı Filtreleme**: `IssueDetailContent`'teki `assignableUsers` hesaplaması:
   ```javascript
   const assignableUsers = state.users.filter(
     (u) =>
       u.role !== ROLES.EXTERNAL_USER &&
       (u.unitId === project?.unitId || currentUser?.role === ROLES.SYSTEM_ADMIN)
   );
   ```
   Bu kod, `Worker` rolü için proje bazlı değil birim bazlı filtreleme yapmaktadır. Aynı birimde farklı projelerde çalışan Worker'lar da listeye dahil olur.

2. **Rol Bazlı Ayrım Eksikliği**: `Department_Head` ve `Project_Manager` için de proje bazlı filtreleme yapılmalıdır.

### Hata 4 için Kök Neden Analizi

1. **Eksik Rol Kontrolü**: `IssueDetailContent.jsx`'teki "Düzenle", "Kaydet", "İptal" ve "Sil" butonlarının görünürlük koşulu:
   ```javascript
   {!readonly && !isExternalUser && (
     editMode ? (
       <> <button>Kaydet</button> <button>İptal</button> </>
     ) : (
       <button onClick={() => setEditMode(true)}>Düzenle</button>
     )
   )}
   ```
   Bu koşul yalnızca `External_User` rolünü dışlamaktadır. `Worker` rolü için herhangi bir kısıtlama bulunmamaktadır.

2. **`isWorker` Kontrolü Eksik**: `usePermissions` hook'u `isWorker` değerini zaten döndürmektedir, ancak `IssueDetailContent` bu değeri düzenleme butonlarının görünürlüğünde kullanmamaktadır.

3. **Durum Değiştirme Butonları Etkilenmemeli**: Worker'ın durum değiştirme butonlarını (`!readonly && !editMode && !isExternalUser` koşuluyla render edilen) görmesi ve kullanması beklenen davranıştır; bu butonlar etkilenmemelidir.

### Hata 5 için Kök Neden Analizi

1. **Aşırı Kısıtlayıcı canEdit Koşulu**: `IssueDetailContent.jsx`'teki `canEdit` değişkeni:
   ```javascript
   const canEdit = !readonly && !isExternalUser && !isWorker;
   ```
   Bu koşul, `isExternalUser` true olduğunda `canEdit`'i her zaman false yapar. Dış kullanıcının kendi talebini (`issue.reporterId === currentUser?.id`) düzenleyip düzenleyemeyeceği hiç kontrol edilmemektedir.

2. **isOwnRequest Kontrolü Eksik**: `issue.isRequest && issue.reporterId === currentUser?.id` koşulunu ifade eden `isOwnRequest` türetilmiş değişkeni hesaplanmamaktadır. Bu değişken `canEdit` hesaplamasına dahil edilmelidir.

3. **Düzeltme**: `isOwnRequest` türetilmiş değişkeni eklenerek `canEdit` hesaplaması güncellenmeli:
   ```javascript
   const isOwnRequest = issue.isRequest && issue.reporterId === currentUser?.id;
   const canEdit = !readonly && !isWorker && (!isExternalUser || isOwnRequest);
   ```
   Bu sayede dış kullanıcı yalnızca kendi açtığı taleplerde düzenleme, iptal ve silme işlemlerini yapabilir; başkasının taleplerinde bu butonlar görünmez.

Property 1: Bug Condition — Talep Düzenleme Formunda Proje Alanı Görünürlüğü

_For any_ talep (`isRequest: true`) için düzenleme modu (`editMode: true`) aktifleştirildiğinde, düzeltilmiş `IssueDetailContent` bileşeni SHALL proje seçim alanını render etmeli; kullanıcı talebin bağlı olduğu birime ait projeler arasından seçim yapabilmeli.

**Validates: Requirements 2.1, 2.2**

Property 2: Bug Condition — Proje Değişince unitCode Güncellenmesi

_For any_ talep için proje değişikliği yapılıp kaydedildiğinde (`newProjectId !== request.projectId`), düzeltilmiş `handleSave` fonksiyonu SHALL `UPDATE_ISSUE` action'ına yeni projenin birimine karşılık gelen `unitCode`'u dahil etmeli; Store'daki talep kaydı yeni `unitCode` ile güncellenmiş olmalı.

**Validates: Requirements 2.2**

Property 3: Bug Condition — Atanabilir Kullanıcı Listesinin Doğruluğu

_For any_ talep için atama listesi hesaplandığında, düzeltilmiş `assignableUsers` hesaplaması SHALL Worker rolündeki kullanıcılar için yalnızca `u.projectId === issue.projectId` koşulunu sağlayanları içermeli; aynı birimde farklı projelerde çalışan Worker'lar listede yer almamalı.

**Validates: Requirements 2.3**

Property 4: Preservation — Proje Değiştirmeyen Düzenlemeler

_For any_ talep düzenlemesinde proje değiştirilmediğinde (`editProjectId === request.projectId`), düzeltilmiş `handleSave` fonksiyonu SHALL mevcut `unitCode`'u koruyarak diğer alanları (başlık, açıklama, öncelik vb.) güncellemeli; `unitCode` değişmemeli.

**Validates: Requirements 3.1, 3.2**

Property 5: Preservation — System_Admin Atama Davranışı

_For any_ `System_Admin` rolündeki kullanıcı için atama listesi hesaplandığında, düzeltilmiş `assignableUsers` hesaplaması SHALL `External_User` dışındaki tüm kullanıcıları içermeli; mevcut davranış korunmalı.

**Validates: Requirements 3.5**

---

Property 6: Bug Condition — Worker Rolü için Düzenle Butonu Gizlenmesi

_For any_ `Worker` rolündeki kullanıcı bir talebin (`isRequest: true`) detay modalını açtığında, düzeltilmiş `IssueDetailContent` bileşeni SHALL "Düzenle", "Kaydet", "İptal" ve "Sil" butonlarını render etmemeli; Worker talep alanlarını değiştirememeli.

**Validates: Requirements 2.4**

Property 7: Preservation — Yetkili Rollerin Düzenleme Yetkisi Korunmalı

_For any_ `System_Admin`, `Department_Head` veya `Project_Manager` rolündeki kullanıcı bir talebin detay modalını açtığında, düzeltilmiş `IssueDetailContent` bileşeni SHALL "Düzenle" butonunu render etmeye devam etmeli; bu kullanıcıların düzenleme yetkisi etkilenmemeli.

**Validates: Requirements 3.9**

---

Property 8: Bug Condition — External_User Kendi Talebinde Düzenle Butonu Görünmeli

_For any_ `External_User` rolündeki kullanıcı kendi açtığı bir talebin (`issue.isRequest === true AND issue.reporterId === currentUser.id`) detay modalını açtığında, düzeltilmiş `IssueDetailContent` bileşeni SHALL "Düzenle", "Kaydet", "İptal" ve "Sil" butonlarını render etmeli; dış kullanıcı kendi talebini düzenleyebilmeli ve silebilmeli.

**Validates: Requirements 2.5**

Property 9: Preservation — External_User Başkasının Talebinde Butonlar Görünmemeli

_For any_ `External_User` rolündeki kullanıcı başkasının açtığı bir talebin (`issue.reporterId !== currentUser.id`) detay modalını açtığında, düzeltilmiş `IssueDetailContent` bileşeni SHALL "Düzenle", "Kaydet", "İptal" ve "Sil" butonlarını render etmemeli; mevcut davranış korunmalı.

**Validates: Requirements 2.6, 3.11**

## Fix Implementation

### Değişiklik 1: IssueDetailContent'e Proje Seçim Alanı Eklenmesi

**Dosya**: `src/components/issue/IssueDetailContent.jsx`

**Fonksiyon**: `IssueDetailContent`

**Gerekli Değişiklikler**:

1. **State Ekleme**: `editMode` için `editProjectId` state'i eklenmeli:
   ```javascript
   const [editProjectId, setEditProjectId] = useState(issue.projectId ?? '');
   ```

2. **handleSave Güncelleme**: `UPDATE_ISSUE` payload'ına `projectId` ve `unitCode` eklenmeli:
   ```javascript
   const newProject = state.projects.find((p) => p.id === editProjectId);
   const newUnitCode = newProject
     ? state.units?.find((u) => u.id === newProject.unitId)?.unitCode || issue.unitCode
     : issue.unitCode;

   dispatch({
     type: ACTIONS.UPDATE_ISSUE,
     payload: {
       id: issue.id,
       title, description,
       type: editType,
       priority: editPriority,
       status: editStatus,
       assigneeId: editAssigneeId || null,
       projectId: editProjectId,   // YENİ
       unitCode: newUnitCode,      // YENİ
     },
   });
   ```

3. **handleCancelEdit Güncelleme**: İptal edildiğinde `editProjectId` sıfırlanmalı:
   ```javascript
   setEditProjectId(issue.projectId ?? '');
   ```

4. **Proje Seçim Alanı Render**: Detaylar grid'ine `issue.isRequest` koşuluyla proje seçim alanı eklenmeli:
   ```jsx
   {issue.isRequest && (
     <>
       <div className="col-4 col-md-3 text-muted fw-medium d-flex align-items-center gap-1">
         📁 Proje
       </div>
       <div className="col-8 col-md-9">
         {editMode ? (
           <select
             className="form-select form-select-sm"
             style={{ width: 'auto', minWidth: 200 }}
             value={editProjectId}
             onChange={(e) => setEditProjectId(e.target.value)}
           >
             {unitProjects.map((p) => (
               <option key={p.id} value={p.id}>{p.name}</option>
             ))}
           </select>
         ) : (
           <span className="small">{project?.name || '—'}</span>
         )}
       </div>
     </>
   )}
   ```

5. **unitProjects Türetilmiş Veri**: Birime ait projeler hesaplanmalı:
   ```javascript
   const unitProjects = state.projects.filter((p) => {
     if (!unit) return false;
     return p.unitId === unit.id;
   });
   ```

### Değişiklik 2: assignableUsers Hesaplamasının Düzeltilmesi

**Dosya**: `src/components/issue/IssueDetailContent.jsx`

**Mevcut Kod**:
```javascript
const assignableUsers = state.users.filter(
  (u) =>
    u.role !== ROLES.EXTERNAL_USER &&
    (u.unitId === project?.unitId || currentUser?.role === ROLES.SYSTEM_ADMIN)
);
```

**Düzeltilmiş Kod**:
```javascript
const assignableUsers = state.users.filter((u) => {
  if (u.role === ROLES.EXTERNAL_USER) return false;
  if (currentUser?.role === ROLES.SYSTEM_ADMIN) return true;
  if (u.role === ROLES.WORKER) return u.projectId === issue.projectId;
  if (u.role === ROLES.PROJECT_MANAGER) return project?.managerId === u.id;
  if (u.role === ROLES.DEPARTMENT_HEAD) return u.unitId === project?.unitId;
  return false;
});
```

**Açıklama**: Worker'lar için proje bazlı (`u.projectId === issue.projectId`), `Project_Manager` için proje yöneticisi kontrolü, `Department_Head` için birim bazlı filtreleme uygulanır. `System_Admin` tüm kullanıcıları görebilir.

### Değişiklik 3: Worker Rolü için Düzenleme Butonlarının Gizlenmesi

**Dosya**: `src/components/issue/IssueDetailContent.jsx`

**Mevcut Kod**:
```javascript
const { isExternalUser } = usePermissions();
// ...
{!readonly && !isExternalUser && (
  editMode ? (
    <>
      <button className="btn btn-sm btn-primary ...">Kaydet</button>
      <button className="btn btn-sm btn-secondary ...">İptal</button>
    </>
  ) : (
    <button className="btn btn-sm btn-outline-secondary ..." onClick={() => setEditMode(true)}>
      Düzenle
    </button>
  )
)}
// ...
{!readonly && !isExternalUser && !editMode && (
  <button className="btn btn-sm btn-outline-danger ...">
    <TbTrash size={14} />
  </button>
)}
```

**Düzeltilmiş Kod**:
```javascript
const { isExternalUser, isWorker } = usePermissions();
const canEdit = !readonly && !isExternalUser && !isWorker;
// ...
{canEdit && (
  editMode ? (
    <>
      <button className="btn btn-sm btn-primary ...">Kaydet</button>
      <button className="btn btn-sm btn-secondary ...">İptal</button>
    </>
  ) : (
    <button className="btn btn-sm btn-outline-secondary ..." onClick={() => setEditMode(true)}>
      Düzenle
    </button>
  )
)}
// ...
{canEdit && !editMode && (
  <button className="btn btn-sm btn-outline-danger ...">
    <TbTrash size={14} />
  </button>
)}
```

**Açıklama**: `isWorker` değeri `usePermissions` hook'undan alınır. `canEdit` türetilmiş değişkeni `!readonly && !isExternalUser && !isWorker` koşulunu birleştirir. Durum değiştirme butonları (`!readonly && !editMode && !isExternalUser`) etkilenmez; Worker durum değişikliği yapmaya devam edebilir.

### Değişiklik 4: External_User için canEdit Hesaplamasının Güncellenmesi

**Dosya**: `src/components/issue/IssueDetailContent.jsx`

**Mevcut Kod**:
```javascript
const canEdit = !readonly && !isExternalUser && !isWorker;
```

**Düzeltilmiş Kod**:
```javascript
const isOwnRequest = issue.isRequest && issue.reporterId === currentUser?.id;
const canEdit = !readonly && !isWorker && (!isExternalUser || isOwnRequest);
```

**Açıklama**: `isOwnRequest` türetilmiş değişkeni, talebin dış kullanıcı tarafından açılıp açılmadığını kontrol eder. `canEdit` hesaplaması, dış kullanıcının kendi talebinde düzenleme yapabilmesine izin verecek şekilde güncellenir. Worker rolü hâlâ dışlanır; başkasının talebini görüntüleyen dış kullanıcı için `canEdit` false kalır.

---

### Validation Approach

Test stratejisi iki aşamalıdır: önce hataları düzeltilmemiş kodda gösteren karşı örnekler üretilir, ardından düzeltmenin doğruluğu ve mevcut davranışların korunduğu doğrulanır.

### Exploratory Bug Condition Checking

**Hedef**: Düzeltme uygulanmadan önce hataları gösteren testler yazılır. Bu testler düzeltilmemiş kodda başarısız olmalıdır.

**Test Planı**: `IssueDetailContent` bileşeni `isRequest: true` olan bir issue ile render edilir; düzenleme modu aktifleştirilir ve proje seçim alanının varlığı, `assignableUsers` içeriği ve `UPDATE_ISSUE` payload'ı kontrol edilir.

**Test Senaryoları**:
1. **Proje Alanı Testi**: `isRequest: true` olan bir talep için `editMode: true` render edilir → Proje seçim alanı DOM'da aranır (düzeltilmemiş kodda başarısız olacak).
2. **unitCode Güncelleme Testi**: Proje değiştirilip kaydedilir → `UPDATE_ISSUE` payload'ında `unitCode` alanı kontrol edilir (düzeltilmemiş kodda `unitCode` eksik olacak).
3. **Atama Listesi Testi**: `project-bigd-1`'e ait talep için `assignableUsers` hesaplanır → `project-bigd-2`'nin Worker'larının listede olmadığı kontrol edilir (düzeltilmemiş kodda listede olacaklar).
4. **System_Admin Atama Testi**: `System_Admin` için `assignableUsers` hesaplanır → Tüm non-external kullanıcıların listede olduğu kontrol edilir (bu test düzeltilmemiş kodda da geçmeli).
5. **Worker Düzenle Butonu Testi**: `Worker` rolündeki kullanıcı ile talep render edilir → "Düzenle" butonunun DOM'da olmadığı kontrol edilir (düzeltilmemiş kodda buton görünür olacak).
6. **External_User Kendi Talebi Testi**: `External_User` rolündeki kullanıcı kendi açtığı talep ile render edilir → "Düzenle" butonunun DOM'da olduğu kontrol edilir (düzeltilmemiş kodda buton görünmez olacak).
7. **External_User Başkasının Talebi Testi**: `External_User` rolündeki kullanıcı başkasının açtığı talep ile render edilir → "Düzenle" butonunun DOM'da olmadığı kontrol edilir (bu test düzeltilmemiş kodda da geçmeli).

**Beklenen Karşı Örnekler**:
- Proje seçim alanı DOM'da bulunamaz.
- `UPDATE_ISSUE` payload'ında `unitCode` alanı `undefined`'dır.
- `assignableUsers` içinde `projectId !== issue.projectId` olan Worker'lar bulunur.
- Worker rolündeki kullanıcı için "Düzenle" butonu DOM'da görünür.

### Fix Checking

**Hedef**: Hata koşulunun sağlandığı tüm girdiler için düzeltilmiş fonksiyonun beklenen davranışı ürettiğini doğrula.

**Pseudocode:**
```
// Hata 1
FOR ALL issue WHERE issue.isRequest = true DO
  render(IssueDetailContent, { issue, editMode: true })
  ASSERT DOM.contains(projectSelectField)
END FOR

// Hata 2
FOR ALL (issue, newProjectId) WHERE newProjectId ≠ issue.projectId DO
  handleSave_fixed(issue, newProjectId)
  newUnit ← units.find(u => u.id = projects.find(p => p.id = newProjectId).unitId)
  ASSERT dispatched_payload.unitCode = newUnit.unitCode
  ASSERT store.issues.find(i => i.id = issue.id).unitCode = newUnit.unitCode
END FOR

// Hata 3
FOR ALL (issue, currentUser) WHERE currentUser.role ≠ "System_Admin" DO
  result ← computeAssignableUsers_fixed(issue)
  FOR ALL u IN result WHERE u.role = "Worker" DO
    ASSERT u.projectId = issue.projectId
  END FOR
END FOR

// Hata 4
FOR ALL (issue, user) WHERE user.role = "Worker" AND issue.isRequest = true DO
  rendered ← render(IssueDetailContent_fixed, { issue, currentUser: user })
  ASSERT NOT rendered.contains(editButton)
  ASSERT NOT rendered.contains(saveButton)
  ASSERT NOT rendered.contains(cancelButton)
  ASSERT NOT rendered.contains(deleteButton)
END FOR
```

### Preservation Checking

**Hedef**: Hata koşulunun sağlanmadığı tüm girdiler için düzeltilmiş fonksiyonun orijinal fonksiyonla aynı sonucu ürettiğini doğrula.

**Pseudocode:**
```
// Proje değiştirmeyen düzenlemeler
FOR ALL (issue, editData) WHERE editData.projectId = issue.projectId DO
  result_original ← handleSave_original(issue, editData)
  result_fixed    ← handleSave_fixed(issue, editData)
  ASSERT result_original.unitCode = result_fixed.unitCode
  ASSERT result_original.projectId = result_fixed.projectId
END FOR

// System_Admin atama davranışı
FOR ALL issue WHERE currentUser.role = "System_Admin" DO
  users_original ← computeAssignableUsers_original(issue)
  users_fixed    ← computeAssignableUsers_fixed(issue)
  ASSERT users_original = users_fixed
END FOR

// Yetkili rollerin düzenleme yetkisi
FOR ALL (issue, user) WHERE user.role IN ["System_Admin", "Department_Head", "Project_Manager"]
                        AND issue.isRequest = true DO
  rendered_original ← render(IssueDetailContent_original, { issue, currentUser: user })
  rendered_fixed    ← render(IssueDetailContent_fixed, { issue, currentUser: user })
  ASSERT rendered_original.contains(editButton) = rendered_fixed.contains(editButton)
END FOR
```

**Test Yaklaşımı**: Property-based testing, preservation kontrolü için önerilmektedir çünkü:
- Giriş alanı genelinde otomatik olarak çok sayıda test senaryosu üretir.
- Manuel unit testlerin kaçırabileceği sınır durumlarını yakalar.
- Tüm hata dışı girdiler için davranışın değişmediğine dair güçlü garantiler sağlar.

**Test Senaryoları**:
1. **Başlık/Açıklama/Öncelik Güncelleme Koruması**: Proje değiştirmeden başlık güncellenir → `unitCode` değişmemeli.
2. **System_Admin Atama Koruması**: `System_Admin` için atama listesi hesaplanır → Tüm non-external kullanıcılar listelenmeli.
3. **External_User Görünürlük Koruması**: `External_User` talep listesini görüntüler → Yalnızca kendi talepleri görünmeli.
4. **Klonlama Koruması**: Talep klonlanır → Yeni talep kaynak talebin `unitCode`'unu taşımalı.
5. **Yetkili Rol Düzenleme Koruması**: `System_Admin`, `Department_Head` ve `Project_Manager` için "Düzenle" butonu görünmeye devam etmeli.
6. **Worker Durum Değiştirme Koruması**: Worker rolündeki kullanıcı için durum değiştirme butonları görünmeye devam etmeli.
7. **External_User Başkasının Talebi Koruması**: `External_User` başkasının açtığı talep için "Düzenle" butonu görünmemeye devam etmeli.

### Unit Tests

- `IssueDetailContent` render testi: `isRequest: true` olan talep için düzenleme modunda proje seçim alanının varlığı.
- `handleSave` testi: Proje değiştirildiğinde `UPDATE_ISSUE` payload'ında `unitCode`'un doğru hesaplanması.
- `handleSave` testi: Proje değiştirilmediğinde `unitCode`'un korunması.
- `assignableUsers` testi: Worker rolü için yalnızca aynı projedeki kullanıcıların listelenmesi.
- `assignableUsers` testi: `System_Admin` için tüm non-external kullanıcıların listelenmesi.
- `assignableUsers` testi: `Department_Head` için birim bazlı (Worker hariç) filtrelemenin doğruluğu.
- Worker rolü testi: Worker kullanıcı için "Düzenle" butonunun DOM'da bulunmaması.
- Worker rolü testi: Worker kullanıcı için "Sil" butonunun DOM'da bulunmaması.
- Worker rolü testi: Worker kullanıcı için durum değiştirme butonlarının DOM'da bulunması (korunmalı).
- Yetkili rol testi: `System_Admin`, `Department_Head`, `Project_Manager` için "Düzenle" butonunun DOM'da bulunması.
- External_User kendi talebi testi: `External_User` kendi açtığı talep için "Düzenle" butonunun DOM'da bulunması.
- External_User başkasının talebi testi: `External_User` başkasının açtığı talep için "Düzenle" butonunun DOM'da bulunmaması.

### Property-Based Tests

- Rastgele `projectId` değişiklikleri için `unitCode`'un her zaman yeni projenin birimiyle eşleştiğini doğrula.
- Rastgele kullanıcı konfigürasyonları için `assignableUsers`'ın hiçbir zaman `projectId !== issue.projectId` olan Worker içermediğini doğrula.
- Rastgele düzenleme senaryoları için proje değişmediğinde `unitCode`'un değişmediğini doğrula.
- `System_Admin` için `assignableUsers`'ın her zaman tüm non-external kullanıcıları içerdiğini doğrula.
- Worker rolündeki kullanıcılar için "Düzenle" butonunun hiçbir zaman render edilmediğini doğrula.
- `System_Admin`, `Department_Head`, `Project_Manager` rolleri için "Düzenle" butonunun her zaman render edildiğini doğrula.
- `External_User` kendi açtığı talep için "Düzenle" butonunun her zaman render edildiğini doğrula.
- `External_User` başkasının açtığı talep için "Düzenle" butonunun hiçbir zaman render edilmediğini doğrula.

### Integration Tests

- Talep detay modalı açılır → Düzenleme moduna geçilir → Proje değiştirilir → Kaydedilir → Talep listesinde yeni birimde görünür.
- `Department_Head` olarak giriş yapılır → Talep atama butonu tıklanır → Yalnızca ilgili projenin çalışanları listelenir.
- Talep klonlanır → Yeni talep kaynak talebin birimiyle aynı birimde oluşturulur.
- Proje değiştirilerek kaydedilen talep, eski birim listesinde artık görünmez.
- Worker olarak giriş yapılır → Talep detay modalı açılır → "Düzenle" butonu görünmez → Durum değiştirme butonları görünür.
- `System_Admin` olarak giriş yapılır → Talep detay modalı açılır → "Düzenle" butonu görünür (korunmalı).
- `External_User` olarak giriş yapılır → Kendi açtığı talep detay modalı açılır → "Düzenle" butonu görünür.
- `External_User` olarak giriş yapılır → Başkasının açtığı talep detay modalı açılır → "Düzenle" butonu görünmez.
