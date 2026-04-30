# Bugfix Requirements Document

## Introduction

Bu doküman, talep (Request) yönetim ekranında tespit edilen üç hatayı kapsamaktadır:

1. **Talep düzenleme ekranında proje alanı eksik**: "Talep düzenle" butonuna basınca açılan formda proje seçim alanı görünmüyor; kullanıcı talebin bağlı olduğu projeyi değiştiremiyor.
2. **Proje değişince talep eski birimde görünmeye devam ediyor**: Bir talep başka bir projeye taşındığında (proje değiştirildiğinde), talep eski birimde hâlâ listeleniyor; `unitCode` alanı güncellense de liste görünümü eski birim bazlı filtreyi yansıtmıyor.
3. **Atama butonunda yanlış kişiler listeleniyor**: Talebi atama butonuna tıklandığında, o talebin bağlı olduğu projedeki kişiler değil, birimin tüm üyeleri listeleniyor.

Bu hatalar `RequestDetailContent.jsx`, `RequestList.jsx` ve `AppReducer.js` bileşenlerini etkiliyor.

---

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN kullanıcı bir talep detay modalında "Düzenle" butonuna tıklar THEN the system proje seçim alanını göstermiyor; düzenleme formu yalnızca başlık, açıklama ve öncelik alanlarını içeriyor

1.2 WHEN yetkili bir kullanıcı bir talebin projesini değiştirip kaydeder THEN the system talebi eski birimin talep listesinde göstermeye devam ediyor; yeni projenin birimine taşınmıyor

1.3 WHEN kullanıcı talep detay modalında "Ata" butonuna tıklar THEN the system atanabilir kullanıcı listesinde o projeye ait çalışanlar yerine birimin tüm üyelerini (farklı projelerdeki çalışanlar dahil) listeliyor

### Expected Behavior (Correct)

2.1 WHEN kullanıcı bir talep detay modalında "Düzenle" butonuna tıklar THEN the system SHALL düzenleme formunda proje seçim alanını göstermeli; kullanıcı mevcut birime ait projeler arasından seçim yapabilmeli

2.2 WHEN yetkili bir kullanıcı bir talebin projesini değiştirip kaydeder THEN the system SHALL talebi yeni projenin birimine taşımalı; talep artık eski birimin listesinde görünmemeli, yeni birimin listesinde görünmeli

2.3 WHEN kullanıcı talep detay modalında "Ata" butonuna tıklar THEN the system SHALL atanabilir kullanıcı listesinde yalnızca o talebin bağlı olduğu projeye ait kişileri (Worker, Project_Manager, Department_Head, System_Admin) listemeli; diğer projelerin çalışanları listelenmemeli

### Unchanged Behavior (Regression Prevention)

3.1 WHEN kullanıcı talep düzenleme formunda başlık, açıklama veya öncelik alanlarını değiştirip kaydeder THEN the system SHALL CONTINUE TO değişiklikleri Store'a kaydetmeli ve aktivite akışına kayıt eklemeli

3.2 WHEN kullanıcı talep düzenleme formunu iptal eder THEN the system SHALL CONTINUE TO değişiklikleri kaydetmeden formu kapatmalı

3.3 WHEN External_User talep listesini görüntüler THEN the system SHALL CONTINUE TO yalnızca kendi açtığı veya kendisine görünür yapılan talepleri göstermeli

3.4 WHEN Department_Head veya Project_Manager talep listesini görüntüler THEN the system SHALL CONTINUE TO yalnızca kendi birimine/projesine ait talepleri göstermeli

3.5 WHEN System_Admin atama yapar THEN the system SHALL CONTINUE TO tüm kullanıcıları atanabilir olarak listelemeli

3.6 WHEN bir talebin durumu "Done" olarak değiştirilir ve resolvedAt boşsa THEN the system SHALL CONTINUE TO resolvedAt alanını otomatik olarak o anın zaman damgasıyla doldurmalı

3.7 WHEN kullanıcı talep klonlama işlemi yapar THEN the system SHALL CONTINUE TO yeni talebi kaynak talebin birimiyle aynı birimde oluşturmalı

3.8 WHEN kullanıcı talep arama alanına metin girer THEN the system SHALL CONTINUE TO talepleri başlık, açıklama ve numara alanlarında büyük/küçük harf duyarsız olarak filtrelemeli

---

## Bug Condition Pseudocode

### Hata 1: Proje Alanı Eksikliği

```pascal
FUNCTION isBugCondition_1(X)
  INPUT: X — { component: string, mode: string }
  OUTPUT: boolean

  RETURN X.component = "RequestDetailContent" AND X.mode = "editMode"
END FUNCTION

// Property: Fix Checking — Proje Alanı Görünürlüğü
FOR ALL X WHERE isBugCondition_1(X) DO
  rendered ← render(RequestDetailContent, { editMode: true })
  ASSERT rendered.contains(projectSelectField)
END FOR

// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition_1(X) DO
  ASSERT F(X) = F'(X)
END FOR
```

### Hata 2: Proje Değişince Birim Güncellenmemesi

```pascal
FUNCTION isBugCondition_2(X)
  INPUT: X — { request: Issue, newProjectId: string }
  OUTPUT: boolean

  newProject ← projects.find(p => p.id = X.newProjectId)
  RETURN newProject.unitId ≠ X.request.unitCode'un karşılık geldiği unit.id
END FUNCTION

// Property: Fix Checking — unitCode Güncellenmesi
FOR ALL X WHERE isBugCondition_2(X) DO
  result ← dispatch(UPDATE_ISSUE, { projectId: X.newProjectId, unitCode: newUnitCode })
  updatedRequest ← store.issues.find(i => i.id = X.request.id)
  newUnit ← units.find(u => u.id = newProject.unitId)
  ASSERT updatedRequest.unitCode = newUnit.unitCode
  ASSERT requestList(oldUnit).NOT_contains(updatedRequest)
  ASSERT requestList(newUnit).contains(updatedRequest)
END FOR

// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition_2(X) DO
  ASSERT F(X) = F'(X)
END FOR
```

### Hata 3: Atama Listesinde Yanlış Kişiler

```pascal
FUNCTION isBugCondition_3(X)
  INPUT: X — { user: User, request: Issue }
  OUTPUT: boolean

  RETURN X.user.role = "Department_Head"
    AND assignableUsers(X.request).contains(workers_from_other_projects)
END FUNCTION

// Property: Fix Checking — Atanabilir Kullanıcı Filtresi
FOR ALL X WHERE isBugCondition_3(X) DO
  result ← computeAssignableUsers(X.request.projectId)
  FOR ALL u IN result WHERE u.role = "Worker" DO
    ASSERT u.projectId = X.request.projectId
  END FOR
END FOR

// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition_3(X) DO
  ASSERT F(X) = F'(X)
END FOR
```
