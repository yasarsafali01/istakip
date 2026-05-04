# Implementation Plan

- [x] 1. Hata Koşulu Keşif Testi Yaz (Düzeltme Öncesi)
  - **Property 1: Bug Condition** - Talep Düzenleme Formu, unitCode Güncelleme ve Atama Listesi Hataları
  - **CRITICAL**: Bu test düzeltilmemiş kodda BAŞARISIZ olmalı — başarısızlık hataların var olduğunu kanıtlar
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: Bu test beklenen davranışı kodlar — düzeltme sonrası geçtiğinde hatanın çözüldüğünü doğrular
  - **GOAL**: Hataların varlığını gösteren karşı örnekleri ortaya çıkarmak
  - **Scoped PBT Approach**: Deterministik hatalar için somut başarısız durumları kapsama al
  - Test 1 — Proje Alanı Eksikliği (Hata 1):
    - `IssueDetailContent` bileşenini `isRequest: true` olan bir talep ve `editMode: true` ile render et
    - DOM'da proje seçim alanının (`select[data-testid="project-select"]` veya benzeri) var olduğunu assert et
    - Düzeltilmemiş kodda bu alan render edilmediğinden test BAŞARISIZ olacak
  - Test 2 — unitCode Güncellenmemesi (Hata 2):
    - `handleSave` fonksiyonunu farklı bir `projectId` ile çağır (örn. `project-bigd-1` → `project-odb-1`)
    - Dispatch edilen `UPDATE_ISSUE` payload'ında `unitCode` alanının yeni projenin birimiyle eşleştiğini assert et
    - Düzeltilmemiş kodda `unitCode` payload'da `undefined` olduğundan test BAŞARISIZ olacak
  - Test 3 — Atama Listesinde Yanlış Kişiler (Hata 3):
    - `project-bigd-1`'e ait bir talep için `assignableUsers` hesapla
    - Sonuçta `u.role === 'Worker' && u.projectId !== 'project-bigd-1'` koşulunu sağlayan kullanıcı olmadığını assert et
    - Düzeltilmemiş kodda `project-bigd-2`'nin Worker'ları da listede olduğundan test BAŞARISIZ olacak
  - Testleri düzeltilmemiş kod üzerinde çalıştır
  - **EXPECTED OUTCOME**: Testler BAŞARISIZ olur (bu doğrudur — hataların varlığını kanıtlar)
  - Bulunan karşı örnekleri belgele (kök neden analizini anlamak için)
  - Görev; test yazıldığında, çalıştırıldığında ve başarısızlık belgelendiğinde tamamlanmış sayılır
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 2. Koruma Özellik Testleri Yaz (Düzeltme Öncesi)
  - **Property 2: Preservation** - Proje Değiştirmeyen Düzenlemeler ve System_Admin Atama Davranışı
  - **IMPORTANT**: Gözlem-önce metodolojisini takip et
  - Gözlem 1 — Proje Değiştirmeyen Düzenleme:
    - Düzeltilmemiş kodda `editProjectId === issue.projectId` olan bir kaydetme işlemi yap
    - `UPDATE_ISSUE` payload'ında `unitCode`'un değişmediğini gözlemle ve kaydet
    - Özellik testi: proje değiştirilmediğinde `unitCode` her zaman korunmalı
  - Gözlem 2 — System_Admin Atama Davranışı:
    - Düzeltilmemiş kodda `System_Admin` rolüyle `assignableUsers` hesapla
    - `External_User` dışındaki tüm kullanıcıların listede olduğunu gözlemle
    - Özellik testi: `System_Admin` için `assignableUsers` her zaman tüm non-external kullanıcıları içermeli
  - Gözlem 3 — Başlık/Açıklama/Öncelik Güncelleme Koruması:
    - Proje değiştirmeden başlık, açıklama veya öncelik güncelle
    - Bu alanların doğru kaydedildiğini ve `unitCode`'un değişmediğini gözlemle
  - Testleri düzeltilmemiş kod üzerinde çalıştır
  - **EXPECTED OUTCOME**: Testler GEÇER (bu temel davranışı korumak için referans noktasını doğrular)
  - Görev; testler yazıldığında, çalıştırıldığında ve düzeltilmemiş kodda geçtiği doğrulandığında tamamlanmış sayılır
  - _Requirements: 3.1, 3.2, 3.5_

- [x] 3. Üç Hatanın Düzeltmesi

  - [x] 3.1 `editProjectId` state'i ve `unitProjects` türetilmiş verisini ekle
    - `IssueDetailContent.jsx` dosyasında `useState` bloğuna `editProjectId` state'i ekle:
      ```javascript
      const [editProjectId, setEditProjectId] = useState(issue.projectId ?? '');
      ```
    - Türetilmiş veri bölümüne `unitProjects` hesaplamasını ekle:
      ```javascript
      const unitProjects = state.projects.filter((p) => unit ? p.unitId === unit.id : false);
      ```
    - _Bug_Condition: isBugCondition_1(X) — X.component = "IssueDetailContent" AND X.issueIsRequest = true AND X.mode = "editMode"_
    - _Expected_Behavior: editMode aktifken proje seçim alanı render edilmeli_
    - _Requirements: 2.1_

  - [x] 3.2 `handleSave` fonksiyonuna `projectId` ve `unitCode` ekle
    - `handleSave` fonksiyonunda `UPDATE_ISSUE` dispatch'inden önce yeni `unitCode` hesapla:
      ```javascript
      const newProject = state.projects.find((p) => p.id === editProjectId);
      const newUnitCode = newProject
        ? state.units?.find((u) => u.id === newProject.unitId)?.unitCode || issue.unitCode
        : issue.unitCode;
      ```
    - `UPDATE_ISSUE` payload'ına `projectId: editProjectId` ve `unitCode: newUnitCode` alanlarını ekle
    - Proje değişikliğini aktivite kaydına ekle: `editProjectId !== issue.projectId` ise `"Proje güncellendi"` aktivitesi dispatch et
    - _Bug_Condition: isBugCondition_2(X) — newProject.unitId ≠ mevcut unitCode'un karşılık geldiği unit.id AND dispatch_payload.unitCode = undefined_
    - _Expected_Behavior: dispatch edilen payload'da unitCode = yeni projenin biriminin unitCode'u_
    - _Preservation: editProjectId === issue.projectId ise unitCode değişmemeli_
    - _Requirements: 2.2, 3.1_

  - [x] 3.3 `handleCancelEdit` fonksiyonuna `editProjectId` sıfırlamasını ekle
    - `handleCancelEdit` fonksiyonuna `setEditProjectId(issue.projectId ?? '')` satırını ekle
    - _Preservation: İptal edildiğinde tüm edit state'leri orijinal değerlerine dönmeli_
    - _Requirements: 3.2_

  - [x] 3.4 Detaylar grid'ine koşullu proje seçim alanı ekle
    - Detaylar grid'inde (`row g-2` içinde) Durum alanından sonra `issue.isRequest` koşuluyla proje seçim alanı ekle:
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
    - _Bug_Condition: isBugCondition_1(X) — isRequest=true ve editMode=true iken proje alanı render edilmiyor_
    - _Expected_Behavior: isRequest=true olan tüm talepler için editMode'da proje seçim alanı görünmeli_
    - _Requirements: 2.1_

  - [x] 3.5 `assignableUsers` hesaplamasını rol bazlı proje filtresiyle güncelle
    - Mevcut `assignableUsers` hesaplamasını aşağıdaki düzeltilmiş versiyonla değiştir:
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
    - _Bug_Condition: isBugCondition_3(X) — assignableUsers içinde u.role="Worker" AND u.projectId ≠ issue.projectId olan kullanıcılar var_
    - _Expected_Behavior: Worker rolü için yalnızca u.projectId === issue.projectId koşulunu sağlayanlar listelenmeli_
    - _Preservation: System_Admin için tüm non-external kullanıcılar listelenmeli (mevcut davranış korunmalı)_
    - _Requirements: 2.3, 3.5_

  - [x] 3.6 Hata koşulu keşif testinin artık geçtiğini doğrula
    - **Property 1: Expected Behavior** - Talep Düzenleme Formu, unitCode Güncelleme ve Atama Listesi
    - **IMPORTANT**: Görev 1'deki AYNI testi yeniden çalıştır — yeni test yazma
    - Görev 1'deki test beklenen davranışı kodlar
    - Bu test geçtiğinde beklenen davranışın sağlandığı doğrulanmış olur
    - Hata koşulu keşif testini (Görev 1) düzeltilmiş kod üzerinde çalıştır
    - **EXPECTED OUTCOME**: Test GEÇER (hataların düzeltildiğini doğrular)
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.7 Koruma testlerinin hâlâ geçtiğini doğrula
    - **Property 2: Preservation** - Proje Değiştirmeyen Düzenlemeler ve System_Admin Atama Davranışı
    - **IMPORTANT**: Görev 2'deki AYNI testleri yeniden çalıştır — yeni test yazma
    - Koruma özellik testlerini (Görev 2) düzeltilmiş kod üzerinde çalıştır
    - **EXPECTED OUTCOME**: Testler GEÇER (regresyon olmadığını doğrular)
    - Tüm testlerin düzeltme sonrasında da geçtiğini onayla

- [x] 4. Kontrol Noktası — Tüm Testlerin Geçtiğini Doğrula
  - Tüm testlerin geçtiğinden emin ol; sorular çıkarsa kullanıcıya sor.
  - Görev 1 (keşif testi) düzeltilmiş kodda GEÇMELI
  - Görev 2 (koruma testleri) düzeltilmiş kodda GEÇMELI
  - Ek manuel doğrulama:
    - `isRequest: true` olan bir talep için düzenleme modunu aç → Proje seçim alanı görünmeli
    - Proje değiştirip kaydet → `unitCode` yeni projenin birimiyle eşleşmeli
    - `project-bigd-1`'e ait talep için atama listesini aç → Yalnızca `project-bigd-1`'in Worker'ları görünmeli
    - `System_Admin` olarak atama listesini aç → Tüm non-external kullanıcılar görünmeli
    - Proje değiştirmeden başlık güncelle → `unitCode` değişmemeli
    - Düzenleme formunu iptal et → Tüm alanlar orijinal değerlerine dönmeli

- [x] 5. Hata 4 — Worker Rolünün Talep Düzenleme Yetkisi

  - [x] 5.1 Hata 4 Keşif Testi Yaz (Düzeltme Öncesi)
    - **Property 6: Bug Condition** — Worker Rolü için Düzenle Butonu Gizlenmesi
    - **CRITICAL**: Bu test düzeltilmemiş kodda BAŞARISIZ olmalı — başarısızlık hatanın var olduğunu kanıtlar
    - **DO NOT attempt to fix the test or the code when it fails**
    - Test: Worker rolündeki kullanıcı ile `IssueDetailContent` render et → "Düzenle" butonunun DOM'da olmadığını assert et
    - Testi düzeltilmemiş kod üzerinde çalıştır
    - **EXPECTED OUTCOME**: Test BAŞARISIZ olur (Worker için "Düzenle" butonu görünür — hatanın kanıtı)
    - Bulunan karşı örneği belgele
    - _Requirements: 2.4_

  - [x] 5.2 Hata 4 Koruma Testi Yaz (Düzeltme Öncesi)
    - **Property 7: Preservation** — Yetkili Rollerin Düzenleme Yetkisi Korunmalı
    - Test 1: `System_Admin` rolüyle render → "Düzenle" butonunun DOM'da olduğunu assert et
    - Test 2: `Department_Head` rolüyle render → "Düzenle" butonunun DOM'da olduğunu assert et
    - Test 3: `Project_Manager` rolüyle render → "Düzenle" butonunun DOM'da olduğunu assert et
    - Test 4: Worker rolüyle render → durum değiştirme butonlarının DOM'da olduğunu assert et (korunmalı)
    - Testleri düzeltilmemiş kod üzerinde çalıştır
    - **EXPECTED OUTCOME**: Testler GEÇER (yetkili roller etkilenmemiş, Worker durum butonları mevcut)
    - _Requirements: 3.9, 3.10_

  - [x] 5.3 `IssueDetailContent.jsx`'te `isWorker` kontrolü ve `canEdit` değişkeni ekle
    - `usePermissions` hook'undan `isWorker` değerini destructure et:
      ```javascript
      const { isExternalUser, isWorker } = usePermissions();
      ```
    - `canEdit` türetilmiş değişkenini türetilmiş veri bölümüne ekle:
      ```javascript
      const canEdit = !readonly && !isExternalUser && !isWorker;
      ```
    - _Bug_Condition: isBugCondition_4(X) — X.user.role = "Worker" AND rendered.contains(editButton)_
    - _Expected_Behavior: Worker için editButton render edilmemeli_
    - _Requirements: 2.4_

  - [x] 5.4 Düzenle/Kaydet/İptal butonlarını `canEdit` koşuluna bağla
    - Action toolbar'daki `{!readonly && !isExternalUser && (` koşulunu `{canEdit && (` ile değiştir
    - Bu değişiklik "Düzenle", "Kaydet" ve "İptal" butonlarını kapsar
    - _Requirements: 2.4_

  - [x] 5.5 Sil butonunu `canEdit` koşuluna bağla
    - `{!readonly && !isExternalUser && !editMode && (` koşulunu `{canEdit && !editMode && (` ile değiştir
    - _Requirements: 2.4_

  - [x] 5.6 Hata 4 keşif testinin artık geçtiğini doğrula
    - **Property 6: Expected Behavior** — Worker için Düzenle Butonu Gizlenmesi
    - Görev 5.1'deki AYNI testi yeniden çalıştır — yeni test yazma
    - **EXPECTED OUTCOME**: Test GEÇER (Worker için "Düzenle" butonu artık görünmüyor)
    - _Requirements: 2.4_

  - [x] 5.7 Koruma testlerinin hâlâ geçtiğini doğrula
    - **Property 7: Preservation** — Yetkili Rollerin Düzenleme Yetkisi
    - Görev 5.2'deki AYNI testleri yeniden çalıştır — yeni test yazma
    - **EXPECTED OUTCOME**: Testler GEÇER (yetkili roller etkilenmemiş, Worker durum butonları mevcut)
    - _Requirements: 3.9, 3.10_

- [x] 6. Kontrol Noktası — Hata 4 Testlerinin Tamamı Geçiyor
  - Tüm testlerin geçtiğinden emin ol
  - Görev 5.1 (keşif testi) düzeltilmiş kodda GEÇMELI
  - Görev 5.2 (koruma testleri) düzeltilmiş kodda GEÇMELI
  - Ek manuel doğrulama:
    - Worker olarak giriş yap → Talep detay modalını aç → "Düzenle" butonu görünmemeli
    - Worker olarak giriş yap → Durum değiştirme butonları görünmeli
    - System_Admin olarak giriş yap → "Düzenle" butonu görünmeli (korunmalı)
    - Department_Head olarak giriş yap → "Düzenle" butonu görünmeli (korunmalı)
    - Project_Manager olarak giriş yap → "Düzenle" butonu görünmeli (korunmalı)

- [x] 7. Hata 5 — External_User'ın Kendi Açtığı Talepleri Düzenleyememesi

  - [x] 7.1 Hata 5 Keşif Testi Yaz (Düzeltme Öncesi)
    - **Property 8: Bug Condition** — External_User Kendi Talebinde Düzenle Butonu Görünmeli
    - **CRITICAL**: Bu test düzeltilmemiş kodda BAŞARISIZ olmalı — başarısızlık hatanın var olduğunu kanıtlar
    - **DO NOT attempt to fix the test or the code when it fails**
    - Test: `External_User` rolündeki kullanıcı kendi açtığı talep (`reporterId === currentUser.id`) ile `IssueDetailContent` render et → "Düzenle" butonunun DOM'da olduğunu assert et
    - Testi düzeltilmemiş kod üzerinde çalıştır
    - **EXPECTED OUTCOME**: Test BAŞARISIZ olur (External_User için "Düzenle" butonu görünmüyor — hatanın kanıtı)
    - Bulunan karşı örneği belgele
    - _Requirements: 2.5_

  - [x] 7.2 Hata 5 Koruma Testi Yaz (Düzeltme Öncesi)
    - **Property 9: Preservation** — External_User Başkasının Talebinde Butonlar Görünmemeli
    - Test 1: `External_User` rolüyle başkasının açtığı talep render → "Düzenle" butonunun DOM'da olmadığını assert et
    - Test 2: `System_Admin` rolüyle render → "Düzenle" butonunun DOM'da olduğunu assert et (korunmalı)
    - Test 3: `Department_Head` rolüyle render → "Düzenle" butonunun DOM'da olduğunu assert et (korunmalı)
    - Test 4: `Project_Manager` rolüyle render → "Düzenle" butonunun DOM'da olduğunu assert et (korunmalı)
    - Testleri düzeltilmemiş kod üzerinde çalıştır
    - **EXPECTED OUTCOME**: Testler GEÇER (başkasının talebi için External_User etkilenmemiş, yetkili roller etkilenmemiş)
    - _Requirements: 2.6, 3.9, 3.11_

  - [x] 7.3 `IssueDetailContent.jsx`'te `isOwnRequest` ve güncellenmiş `canEdit` değişkenini ekle
    - Türetilmiş veri bölümünde `canEdit` satırını şu şekilde güncelle:
      ```javascript
      const isOwnRequest = issue.isRequest && issue.reporterId === currentUser?.id;
      const canEdit = !readonly && !isWorker && (!isExternalUser || isOwnRequest);
      ```
    - _Bug_Condition: isBugCondition_5(X) — X.user.role = "External_User" AND X.request.reporterId = X.user.id AND NOT rendered.contains(editButton)_
    - _Expected_Behavior: External_User kendi talebinde editButton render edilmeli_
    - _Preservation: External_User başkasının talebinde editButton render edilmemeli_
    - _Requirements: 2.5, 2.6_

  - [x] 7.4 Hata 5 keşif testinin artık geçtiğini doğrula
    - **Property 8: Expected Behavior** — External_User Kendi Talebinde Düzenle Butonu Görünmeli
    - Görev 7.1'deki AYNI testi yeniden çalıştır — yeni test yazma
    - **EXPECTED OUTCOME**: Test GEÇER (External_User kendi talebinde "Düzenle" butonu artık görünüyor)
    - _Requirements: 2.5_

  - [x] 7.5 Koruma testlerinin hâlâ geçtiğini doğrula
    - **Property 9: Preservation** — External_User Başkasının Talebinde Butonlar Görünmemeli
    - Görev 7.2'deki AYNI testleri yeniden çalıştır — yeni test yazma
    - **EXPECTED OUTCOME**: Testler GEÇER (başkasının talebi için External_User etkilenmemiş, yetkili roller etkilenmemiş)
    - _Requirements: 2.6, 3.9, 3.11_

- [x] 8. Kontrol Noktası — Hata 5 Testlerinin Tamamı Geçiyor
  - Tüm testlerin geçtiğinden emin ol
  - Görev 7.1 (keşif testi) düzeltilmiş kodda GEÇMELI
  - Görev 7.2 (koruma testleri) düzeltilmiş kodda GEÇMELI
  - Ek manuel doğrulama:
    - External_User olarak giriş yap → Kendi açtığın talebi aç → "Düzenle" butonu görünmeli
    - External_User olarak giriş yap → Kendi açtığın talebi düzenle → Değişiklikler kaydedilmeli
    - External_User olarak giriş yap → Kendi açtığın talebi sil → Talep silinmeli
    - External_User olarak giriş yap → Başkasının açtığı talebi aç → "Düzenle" butonu görünmemeli
    - Worker olarak giriş yap → Talep detay modalını aç → "Düzenle" butonu görünmemeli (korunmalı)
    - System_Admin olarak giriş yap → "Düzenle" butonu görünmeli (korunmalı)
    - Department_Head olarak giriş yap → "Düzenle" butonu görünmeli (korunmalı)
    - Project_Manager olarak giriş yap → "Düzenle" butonu görünmeli (korunmalı)
