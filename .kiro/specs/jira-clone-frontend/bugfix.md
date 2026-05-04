# Bugfix Requirements Document

## Introduction

Bu doküman, talep (Request) yönetim ekranında tespit edilen dört hatayı kapsamaktadır:

1. **Talep düzenleme ekranında proje alanı eksik**: "Talep düzenle" butonuna basınca açılan formda proje seçim alanı görünmüyor; kullanıcı talebin bağlı olduğu projeyi değiştiremiyor.
2. **Proje değişince talep eski birimde görünmeye devam ediyor**: Bir talep başka bir projeye taşındığında (proje değiştirildiğinde), talep eski birimde hâlâ listeleniyor; `unitCode` alanı güncellense de liste görünümü eski birim bazlı filtreyi yansıtmıyor.
3. **Atama butonunda yanlış kişiler listeleniyor**: Talebi atama butonuna tıklandığında, o talebin bağlı olduğu projedeki kişiler değil, birimin tüm üyeleri listeleniyor.
4. **Worker (Çalışan) rolündeki kullanıcı kendisine atanan talepleri düzenleyebiliyor**: `IssueDetailContent` bileşenindeki "Düzenle" butonu yalnızca `External_User` rolünü dışlıyor; `Worker` rolü dışlanmıyor. Bu nedenle Worker, talep detay modalında "Düzenle" butonunu görebiliyor ve talebin başlık, açıklama, öncelik, durum ve proje alanlarını değiştirebiliyor.

5. **Dış kullanıcı (External_User) kendi açtığı talepleri düzenleyemiyor, iptal edemiyor ve silemiyyor**: `IssueDetailContent.jsx`'teki `canEdit` değişkeni `!readonly && !isExternalUser && !isWorker` olarak hesaplanmaktadır. `isExternalUser` true olduğunda `canEdit` her zaman false olur; bu nedenle dış kullanıcı kendi oluşturduğu taleplerde bile "Düzenle", "Kaydet", "İptal" ve "Sil" butonlarını göremez. Oysa `issue.reporterId === currentUser.id` ve `issue.isRequest === true` koşulunu sağlayan taleplerde dış kullanıcı bu işlemleri yapabilmelidir.

Bu hatalar `IssueDetailContent.jsx` ve `RequestDetailModal.jsx` bileşenlerini etkiliyor.

---

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN kullanıcı bir talep detay modalında "Düzenle" butonuna tıklar THEN the system proje seçim alanını göstermiyor; düzenleme formu yalnızca başlık, açıklama ve öncelik alanlarını içeriyor

1.2 WHEN yetkili bir kullanıcı bir talebin projesini değiştirip kaydeder THEN the system talebi eski birimin talep listesinde göstermeye devam ediyor; yeni projenin birimine taşınmıyor

1.3 WHEN kullanıcı talep detay modalında "Ata" butonuna tıklar THEN the system atanabilir kullanıcı listesinde o projeye ait çalışanlar yerine birimin tüm üyelerini (farklı projelerdeki çalışanlar dahil) listeliyor

1.4 WHEN Worker rolündeki bir kullanıcı kendisine atanmış bir talebin detay modalını açar THEN the system "Düzenle" butonunu gösteriyor ve Worker talebin başlık, açıklama, öncelik, durum ve proje alanlarını değiştirebiliyor

1.5 WHEN External_User rolündeki bir kullanıcı kendi açtığı bir talebin (issue.reporterId === currentUser.id AND issue.isRequest === true) detay modalını açar THEN the system "Düzenle", "Kaydet", "İptal" ve "Sil" butonlarını göstermiyor; dış kullanıcı kendi talebini düzenleyemiyor, iptal edemiyor ve silemiyor

### Expected Behavior (Correct)

2.1 WHEN kullanıcı bir talep detay modalında "Düzenle" butonuna tıklar THEN the system SHALL düzenleme formunda proje seçim alanını göstermeli; kullanıcı mevcut birime ait projeler arasından seçim yapabilmeli

2.2 WHEN yetkili bir kullanıcı bir talebin projesini değiştirip kaydeder THEN the system SHALL talebi yeni projenin birimine taşımalı; talep artık eski birimin listesinde görünmemeli, yeni birimin listesinde görünmeli

2.3 WHEN kullanıcı talep detay modalında "Ata" butonuna tıklar THEN the system SHALL atanabilir kullanıcı listesinde yalnızca o talebin bağlı olduğu projeye ait kişileri (Worker, Project_Manager, Department_Head, System_Admin) listemeli; diğer projelerin çalışanları listelenmemeli

2.4 WHEN Worker rolündeki bir kullanıcı kendisine atanmış bir talebin detay modalını açar THEN the system SHALL "Düzenle" butonunu göstermemeli; Worker talep alanlarını (başlık, açıklama, öncelik, durum, proje) değiştiremez olmalı

2.5 WHEN External_User rolündeki bir kullanıcı kendi açtığı bir talebin (issue.reporterId === currentUser.id AND issue.isRequest === true) detay modalını açar THEN the system SHALL "Düzenle", "Kaydet", "İptal" ve "Sil" butonlarını göstermeli; dış kullanıcı kendi talebini düzenleyebilmeli, iptal edebilmeli ve silebilmeli

2.6 WHEN External_User rolündeki bir kullanıcı başkasının açtığı bir talebin (issue.reporterId !== currentUser.id) detay modalını açar THEN the system SHALL "Düzenle", "Kaydet", "İptal" ve "Sil" butonlarını göstermemeli

### Unchanged Behavior (Regression Prevention)

3.1 WHEN kullanıcı talep düzenleme formunda başlık, açıklama veya öncelik alanlarını değiştirip kaydeder THEN the system SHALL CONTINUE TO değişiklikleri Store'a kaydetmeli ve aktivite akışına kayıt eklemeli

3.2 WHEN kullanıcı talep düzenleme formunu iptal eder THEN the system SHALL CONTINUE TO değişiklikleri kaydetmeden formu kapatmalı

3.3 WHEN External_User talep listesini görüntüler THEN the system SHALL CONTINUE TO yalnızca kendi açtığı veya kendisine görünür yapılan talepleri göstermeli

3.4 WHEN Department_Head veya Project_Manager talep listesini görüntüler THEN the system SHALL CONTINUE TO yalnızca kendi birimine/projesine ait talepleri göstermeli

3.5 WHEN System_Admin atama yapar THEN the system SHALL CONTINUE TO tüm kullanıcıları atanabilir olarak listelemeli

3.6 WHEN bir talebin durumu "Done" olarak değiştirilir ve resolvedAt boşsa THEN the system SHALL CONTINUE TO resolvedAt alanını otomatik olarak o anın zaman damgasıyla doldurmalı

3.7 WHEN kullanıcı talep klonlama işlemi yapar THEN the system SHALL CONTINUE TO yeni talebi kaynak talebin birimiyle aynı birimde oluşturmalı

3.8 WHEN kullanıcı talep arama alanına metin girer THEN the system SHALL CONTINUE TO talepleri başlık, açıklama ve numara alanlarında büyük/küçük harf duyarsız olarak filtrelemeli

3.9 WHEN System_Admin, Department_Head veya Project_Manager rolündeki bir kullanıcı talep detay modalını açar THEN the system SHALL CONTINUE TO "Düzenle" butonunu göstermeli ve bu kullanıcıların talep alanlarını düzenleyebilmesine izin vermeli

3.10 WHEN Worker rolündeki bir kullanıcı talep detay modalını açar THEN the system SHALL CONTINUE TO durum değiştirme butonlarını göstermeli; Worker yalnızca talebin durumunu değiştirebilmeli (düzenleme yetkisi olmadan)

3.11 WHEN External_User rolündeki bir kullanıcı başkasının açtığı bir talebi görüntüler THEN the system SHALL CONTINUE TO "Düzenle", "Kaydet", "İptal" ve "Sil" butonlarını göstermemeli

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

### Hata 5: External_User'ın Kendi Talebini Düzenleyememesi

```pascal
FUNCTION isBugCondition_5(X)
  INPUT: X — { user: User, request: Issue }
  OUTPUT: boolean

  RETURN X.user.role = "External_User"
    AND X.request.isRequest = true
    AND X.request.reporterId = X.user.id
    AND NOT rendered(IssueDetailContent, X).contains(editButton)
END FUNCTION

// Property: Fix Checking — External_User kendi talebinde Düzenle Butonu Görünmeli
FOR ALL X WHERE isBugCondition_5(X) DO
  rendered ← render(IssueDetailContent_fixed, { issue: X.request, currentUser: X.user })
  ASSERT rendered.contains(editButton)
  ASSERT rendered.contains(deleteButton)
END FOR

// Property: Preservation Checking — Başkasının Talebi Etkilenmemeli
FOR ALL X WHERE X.user.role = "External_User"
             AND X.request.isRequest = true
             AND X.request.reporterId ≠ X.user.id DO
  rendered_original ← render(IssueDetailContent_original, { issue: X.request, currentUser: X.user })
  rendered_fixed    ← render(IssueDetailContent_fixed, { issue: X.request, currentUser: X.user })
  ASSERT NOT rendered_fixed.contains(editButton)
  ASSERT rendered_original.contains(editButton) = rendered_fixed.contains(editButton)
END FOR
```

```pascal
FUNCTION isBugCondition_4(X)
  INPUT: X — { user: User, request: Issue }
  OUTPUT: boolean

  RETURN X.user.role = "Worker"
    AND X.request.isRequest = true
    AND rendered(IssueDetailContent, X).contains(editButton)
END FUNCTION

// Property: Fix Checking — Worker için Düzenle Butonu Gizlenmesi
FOR ALL X WHERE isBugCondition_4(X) DO
  rendered ← render(IssueDetailContent, { issue: X.request, currentUser: X.user })
  ASSERT NOT rendered.contains(editButton)
  ASSERT NOT rendered.contains(saveButton)
END FOR

// Property: Preservation Checking — Yetkili Roller Etkilenmemeli
FOR ALL X WHERE X.user.role IN ["System_Admin", "Department_Head", "Project_Manager"]
             AND X.request.isRequest = true DO
  rendered_original ← render(IssueDetailContent_original, { issue: X.request, currentUser: X.user })
  rendered_fixed    ← render(IssueDetailContent_fixed, { issue: X.request, currentUser: X.user })
  ASSERT rendered_original.contains(editButton) = rendered_fixed.contains(editButton)
END FOR
```
