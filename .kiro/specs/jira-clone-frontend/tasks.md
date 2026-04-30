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
