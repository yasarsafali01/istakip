# Implementation Tasks

## Tasks

- [x] 1. Proje Altyapısı ve Bağımlılıklar
  - [x] 1.1 Gerekli npm paketlerini kur: react-router-dom, @hello-pangea/dnd, react-icons, date-fns
  - [x] 1.2 `src/constants/index.js` dosyasını oluştur: ACTIONS, PRIORITIES, STATUSES, ISSUE_TYPES, PRIORITY_COLORS, STATUS_COLORS sabitleri
  - [x] 1.3 Yeni: ROLES, ROLE_DEFAULT_ROUTES, ROLE_NAV_ITEMS sabitlerini `src/constants/index.js`'e ekle
  - [x] 1.4 `src/utils/issueUtils.js` dosyasını oluştur: generateIssueKey, generateId yardımcı fonksiyonları
  - [x] 1.5 `src/utils/dateUtils.js` dosyasını oluştur: formatDate, timeAgo yardımcı fonksiyonları
  - [x] 1.6 Yeni: `src/utils/sprintUtils.js` oluştur: getMonthlySprintDates (ayın 1'i → son iş günü), isLastWorkingDay
  - [x] 1.7 Yeni: `src/utils/permissionUtils.js` oluştur: getVisibleProjects, getVisibleIssues, getVisibleRequests
  - [x] 1.8 Yeni: `src/utils/authUtils.js` oluştur: validateCredentials, getUserByEmail kimlik doğrulama yardımcıları
  - [x] 1.9 `src/data/seedData.js` dosyasını oluştur: 2 proje, 5 kullanıcı, 2 sprint, 16 issue, yorumlar ve aktiviteler
  - [x] 1.10 Yeni: `src/data/seedData.js` güncelle: 2 birim (BIGD/ODB), 6 kullanıcı (4 farklı rol), birim kodlu issue'lar (BIGD-1, ODB-1 vb.), örnek talepler

- [ ] 2. Kimlik Doğrulama ve Yetkilendirme
  - [x] 2.1 `src/hooks/useAuth.js` oluştur: login, logout, currentUser, isAuthenticated
  - [x] 2.2 `src/hooks/usePermissions.js` oluştur: canManageUnits, canCreateProject, canViewAllProjects, isExternalUser vb.
  - [x] 2.3 `src/context/AppReducer.js` güncelle: LOGIN, LOGOUT, ADD_UNIT, UPDATE_UNIT, ADD_VISIBLE_USER action'larını ekle
  - [x] 2.4 `src/context/AppContext.jsx` güncelle: auth state (isAuthenticated, currentUser, units) ekle; localStorage'dan auth state'i restore et
  - [x] 2.5 `src/components/auth/LoginForm.jsx` oluştur: email + şifre formu, hata mesajı gösterimi
  - [x] 2.6 `src/components/auth/ProtectedRoute.jsx` oluştur: oturum kontrolü + rol bazlı rota koruması, yetkisiz erişimde yönlendirme
  - [x] 2.7 `src/pages/LoginPage.jsx` oluştur: LoginForm bileşenini içeren sayfa

- [x] 3. State Yönetimi (Context + Reducer)
  - [x] 3.1 `src/context/AppReducer.js` dosyasını oluştur: tüm ACTIONS için reducer case'leri (ADD_PROJECT, ADD_ISSUE, UPDATE_ISSUE, DELETE_ISSUE, MOVE_ISSUE, ADD_SPRINT, START_SPRINT, COMPLETE_SPRINT, ASSIGN_ISSUE_TO_SPRINT, ADD_COMMENT, DELETE_COMMENT, ADD_ACTIVITY)
  - [x] 3.2 `src/context/AppContext.jsx` dosyasını oluştur: AppProvider, useAppContext hook, localStorage init ve sync
  - [x] 3.3 `src/hooks/useLocalStorage.js` dosyasını oluştur
  - [x] 3.4 `src/hooks/useIssueFilters.js` dosyasını oluştur: assignee ve priority filtre mantığı

- [x] 4. Ortak (Common) Bileşenler
  - [x] 4.1 `src/components/common/Modal.jsx` bileşenini oluştur: portal tabanlı, aria-modal, klavye kapatma (Escape)
  - [x] 4.2 `src/components/common/ConfirmDialog.jsx` bileşenini oluştur: silme onayı için
  - [x] 4.3 `src/components/common/Avatar.jsx` bileşenini oluştur: kullanıcı baş harfi + renk
  - [x] 4.4 `src/components/common/Badge.jsx` bileşenini oluştur: durum ve tip etiketleri
  - [x] 4.5 `src/components/common/PriorityIcon.jsx` bileşenini oluştur: öncelik ikonu + renk
  - [x] 4.6 `src/components/common/EmptyState.jsx` bileşenini oluştur: boş liste durumu
  - [x] 4.7 `src/components/common/Sidebar.jsx` bileşenini oluştur: navigasyon linkleri, aktif sayfa vurgusu

- [ ] 5. Layout, Routing ve Sidebar Güncellemesi
  - [x] 5.1 `src/App.js` dosyasını güncelle: BrowserRouter, AppProvider, Routes yapısını kur
  - [x] 5.2 `src/pages/NotFoundPage.jsx` sayfasını oluştur
  - [x] 5.3 Ana layout bileşenini App.js içinde oluştur: Sidebar + main content alanı
  - [x] 5.4 `src/components/common/Sidebar.jsx` güncelle: md (768px) altında toggle button, ROLE_NAV_ITEMS ile rol bazlı menü öğeleri
  - [x] 5.5 `src/App.js` güncelle: /login rotası ekle, ProtectedRoute sarmalayıcıları uygula, /units ve /requests rotalarını ekle

- [x] 6. Dashboard (temel bileşenler tamamlandı)
  - [x] 6.1 `src/components/dashboard/StatsCard.jsx` bileşenini oluştur: istatistik kartı
  - [x] 6.2 `src/components/dashboard/ProjectProgress.jsx` bileşenini oluştur: proje ilerleme çubuğu
  - [x] 6.3 `src/components/dashboard/RecentActivity.jsx` bileşenini oluştur: son aktiviteler listesi
  - [x] 6.4 `src/components/dashboard/Dashboard.jsx` bileşenini oluştur: tüm dashboard bileşenlerini birleştir
  - [x] 6.5 `src/pages/DashboardPage.jsx` sayfasını oluştur
  - [x] 6.6 Yeni: `src/components/dashboard/Dashboard.jsx` güncelle: rol bazlı içerik (System_Admin / Department_Head / Project_Manager / External_User görünümleri)

- [ ] 7. Birim Yönetimi
  - [x] 7.1 `src/components/unit/UnitForm.jsx` oluştur: ad, unitCode, departmentHeadId alanları, benzersizlik kontrolü
  - [x] 7.2 `src/components/unit/UnitCard.jsx` oluştur: birim özet kartı (ad, kod, başkan, proje sayısı)
  - [x] 7.3 `src/components/unit/UnitList.jsx` oluştur: birim listesi + oluşturma modal'ı (yalnızca System_Admin)
  - [x] 7.4 `src/pages/UnitsPage.jsx` oluştur

- [ ] 8. Talep Sistemi
  - [x] 8.1 `src/components/request/RequestForm.jsx` oluştur: birim seçimi, başlık, açıklama; Unit_Code ile otomatik numaralandırma (örn. BIGD-123)
  - [x] 8.2 `src/components/request/RequestCard.jsx` oluştur: talep özet kartı, statü rozeti
  - [x] 8.3 `src/components/request/RequestList.jsx` oluştur: External_User için filtrelenmiş liste, kullanıcı adı ekleme arayüzü
  - [x] 8.4 `src/pages/RequestsPage.jsx` oluştur

- [x] 9. Proje Yönetimi (temel bileşenler tamamlandı)
  - [x] 9.1 `src/components/project/ProjectForm.jsx` bileşenini oluştur: proje oluşturma formu, doğrulama
  - [x] 9.2 `src/components/project/ProjectCard.jsx` bileşenini oluştur: proje özet kartı
  - [x] 9.3 `src/components/project/ProjectList.jsx` bileşenini oluştur: proje listesi + oluşturma modal'ı
  - [x] 9.4 `src/pages/ProjectsPage.jsx` sayfasını oluştur
  - [x] 9.5 Yeni: `src/components/project/ProjectForm.jsx` güncelle: birim (unitId) ve Project_Manager seçimi ekle
  - [x] 9.6 Yeni: `src/components/project/ProjectList.jsx` güncelle: rol bazlı filtreleme (getVisibleProjects kullan)

- [x] 10. Issue Yönetimi (temel bileşenler tamamlandı)
  - [x] 10.1 `src/components/issue/IssueForm.jsx` bileşenini oluştur: issue oluşturma/düzenleme formu, tüm alanlar
  - [x] 10.2 `src/components/issue/CommentSection.jsx` bileşenini oluştur: yorum listesi, ekleme, silme
  - [x] 10.3 `src/components/issue/ActivityFeed.jsx` bileşenini oluştur: aktivite akışı, zaman damgası
  - [x] 10.4 `src/components/issue/IssueDetail.jsx` bileşenini oluştur: issue detay görünümü (tüm alanlar, inline düzenleme)
  - [x] 10.5 `src/components/issue/IssueModal.jsx` bileşenini oluştur: Modal içinde IssueDetail
  - [x] 10.6 Yeni: `src/components/issue/IssueForm.jsx` güncelle: Issue tipine "Request" ekle, unitCode bazlı otomatik numaralandırma
  - [x] 10.7 Yeni: `src/components/issue/IssueDetail.jsx` güncelle: visibleTo kullanıcı ekleme arayüzü (birim çalışanları için)

- [x] 11. Board Görünümü (tamamlandı)
  - [x] 11.1 `src/components/board/BoardFilters.jsx` bileşenini oluştur: assignee ve priority filtreleri
  - [x] 11.2 `src/components/board/IssueCard.jsx` bileşenini oluştur: Draggable kart, öncelik ikonu, avatar, tip rozeti
  - [x] 11.3 `src/components/board/BoardColumn.jsx` bileşenini oluştur: Droppable sütun, issue sayısı
  - [x] 11.4 `src/components/board/Board.jsx` bileşenini oluştur: DragDropContext, sütunlar, filtre entegrasyonu
  - [x] 11.5 `src/pages/BoardPage.jsx` sayfasını oluştur: proje ve sprint seçimi, Board bileşeni

- [ ] 12. Sprint Yönetimi Güncellemesi
  - [x] 12.1 `src/components/sprint/SprintForm.jsx` oluştur/güncelle: ay/yıl seçici, sprintUtils.js kullanarak otomatik tarih hesaplama (ayın 1'i → son iş günü)
  - [x] 12.2 `src/components/sprint/SprintList.jsx` bileşenini oluştur: sprint listesi, başlat/tamamla butonları
  - [x] 12.3 `src/components/sprint/BacklogView.jsx` bileşenini oluştur: sprint'e atanmamış issue'lar, sprint'e atama
  - [x] 12.4 `src/pages/BacklogPage.jsx` sayfasını oluştur: SprintList + BacklogView
  - [x] 12.5 Yeni: `src/context/AppReducer.js` COMPLETE_SPRINT güncelle: tamamlanmamış issue'ları backlog'a taşı (sprintId=null)

- [x] 13. Genel Düzenlemeler (tamamlandı)
  - [x] 13.1 `public/index.html` başlığını "Jira Clone" olarak güncelle
  - [x] 13.2 `src/index.css` dosyasına özel CSS ekle: sidebar genişliği, kart hover efektleri, sürükleme stilleri
  - [x] 13.3 Tüm sayfalarda boş durum (EmptyState) kontrollerini doğrula
  - [x] 13.4 Tüm formlarda doğrulama mesajlarını doğrula
  - [x] 13.5 localStorage kalıcılığını test et: sayfa yenileme sonrası veri korunumu
  - [x] 13.6 Responsive tasarımı kontrol et: Bootstrap grid ile mobil uyumluluk

- [ ] 14. Entegrasyon ve Son Düzenlemeler
  - [x] 14.1 Tüm sayfalarda rol bazlı erişim kontrollerini doğrula (ProtectedRoute + permissionUtils)
  - [x] 14.2 External_User için talep görünürlük filtresini doğrula (visibleTo alanı)
  - [x] 14.3 Unit_Code bazlı issue numaralandırmayı doğrula (BIGD-1, ODB-5 formatı)
  - [x] 14.4 Sidebar toggle davranışını md (768px) ekranlarda test et
  - [x] 14.5 localStorage round-trip testini doğrula: tüm state (auth dahil) yenileme sonrası korunmalı

- [x] 15. Talep Detay Modalı
  - [x] 15.1 `src/components/request/RequestDetailModal.jsx` oluştur
    - `isOpen`, `onClose`, `requestId` prop'larını al
    - `requestId` ile issue'yu Store'dan çek (`state.issues.find`)
    - Mevcut `Modal.jsx` bileşenini sarmalayıcı olarak kullan (`size="xl"`)
    - Modal başlığında `request.number` göster (örn. BIGD-42)
    - Escape tuşu ile kapatma Modal.jsx'in mevcut desteğiyle sağlanır
    - İçerik olarak `RequestDetailContent` bileşenini render et
    - _Requirements: 15.1, 15.7, 15.8_

  - [x] 15.2 `src/components/request/RequestDetailContent.jsx` oluştur
    - `request`, `onClose` prop'larını al
    - Sol sütun (col-12 col-lg-8): başlık, açıklama, `CommentSection`, `ActivityFeed`
    - Sağ sütun (col-12 col-lg-4): durum (`Badge`), tip (`Badge`), öncelik (`PriorityIcon`), atanan kişi (`Avatar`), raporlayan (`Avatar`), `createdAt` (`formatDate`), `resolvedAt`, `timeSpent`
    - Yorum gönderme: boş metin engeli (`ADD_COMMENT` dispatch)
    - Alan güncellemelerinde `ADD_ACTIVITY` dispatch et
    - _Requirements: 15.2, 15.3, 15.4, 15.5, 15.6, 15.9_

  - [x] 15.3 `src/components/request/RequestDetailContent.jsx` güncelle: Toolbar'a "Klonla" butonu ekle
    - Toolbar'a `TbCopy` ikonlu "Klonla" butonu ekle
    - Butonu yalnızca yetkili kullanıcılara göster (Req 18 yetki kontrolü — Task 18.3 ile birlikte tamamlanır)
    - _Requirements: 15.1, 18.1_

  - [x] 15.4 `src/pages/RequestsPage.jsx` güncelle: RequestCard tıklandığında modal açılsın
    - `selectedRequestId` state ekle (`useState(null)`)
    - `RequestCard` bileşenini tıklanabilir yap (`onClick={() => setSelectedRequestId(req.id)}`)
    - `RequestDetailModal`'ı sayfaya ekle (`isOpen`, `onClose`, `requestId` prop'larıyla)
    - _Requirements: 15.1, 15.7_

- [x] 16. Board'dan Talep Detayına Erişim
  - [x] 16.1 `src/components/board/Board.jsx` güncelle: `selectedRequestId` state ve isRequest yönlendirmesi
    - `selectedRequestId` state ekle (`useState(null)`)
    - `handleIssueClick(issue)` fonksiyonu oluştur: `issue.isRequest === true` ise `setSelectedRequestId`, değilse `setSelectedIssueId`
    - `BoardColumn`'a `onIssueClick` prop'unu `handleIssueClick` olarak güncelle
    - _Requirements: 16.1, 16.2_

  - [x] 16.2 `src/components/board/Board.jsx` güncelle: `RequestDetailModal`'ı Board içine ekle
    - `RequestDetailModal` bileşenini import et
    - `selectedRequestId` ile `RequestDetailModal`'ı render et
    - Modal kapatıldığında `setSelectedRequestId(null)` çağır
    - `RequestDetailModal` açıkken `DragDropContext`'i devre dışı bırak (`readonly` prop veya koşullu render ile)
    - _Requirements: 16.1, 16.4, 16.5_

  - [x] 16.3 `src/components/board/IssueCard.jsx` güncelle: isRequest rozeti
    - `issue.isRequest === true` ise kart footer'ında "Request" tip rozetini göster
    - Mevcut `Badge` bileşenini kullan (`label="Request" type="issueType"`)
    - _Requirements: 16.3_

- [x] 17. Atama Yetki Kontrolü
  - [x] 17.1 `src/utils/permissionUtils.js` güncelle: `canChangeAssignee` fonksiyonu ekle
    - `canChangeAssignee(user, issue, projects = [])` fonksiyonunu ekle
    - System_Admin: her zaman `true`
    - Department_Head: `projects.find(p => p.id === issue.projectId)?.unitId === user.unitId`
    - Project_Manager: `projects.find(p => p.id === issue.projectId)?.managerId === user.id`
    - External_User: her zaman `false`
    - _Requirements: 17.1, 17.2, 17.3, 17.4_

  - [x] 17.2 `src/components/request/RequestDetailContent.jsx` güncelle: atama alanı yetki kontrolü
    - `canChangeAssignee(currentUser, request, state.projects)` çağır
    - `canChangeAssignee === false` ise atanan kişi alanını salt okunur göster (dropdown yerine `Avatar` + isim)
    - `canChangeAssignee === true` ise dropdown ile düzenlemeye izin ver
    - _Requirements: 17.1, 17.6, 17.7_

  - [x] 17.3 `src/context/AppReducer.js` güncelle: `UPDATE_REQUEST_ASSIGNEE` action case'i ekle
    - `case ACTIONS.UPDATE_REQUEST_ASSIGNEE`: `issueId` ve `assigneeId` payload'ı ile issue'yu güncelle
    - `updatedAt` alanını güncelle
    - Activity kaydı bileşen tarafından ayrıca dispatch edilir (reducer'da değil)
    - _Requirements: 17.5_

  - [x] 17.4 `src/constants/index.js` güncelle: yeni action tiplerini ekle
    - `ACTIONS` nesnesine `CLONE_REQUEST`, `UPDATE_REQUEST_ASSIGNEE`, `UPDATE_REQUEST_DATES` ekle
    - _Requirements: 17.5, 18.2, 19.1_

- [x] 18. Talep Klonlama
  - [x] 18.1 `src/context/AppReducer.js` güncelle: `CLONE_REQUEST` action case'i ekle
    - `case ACTIONS.CLONE_REQUEST`: `sourceIssueId`, `newId`, `newNumber`, `clonedAt` payload'ı al
    - Kaynak issue'yu bul; bulunamazsa state'i değiştirmeden döndür
    - Klonlanan issue: `title = "${source.title} (Kopya)"`, `status = 'To Do'`, `resolvedAt = null`, `timeSpent = 0`, `createdAt = clonedAt`, `updatedAt = clonedAt`, `visibleTo = []`, `assigneeId = null`
    - Yeni issue'yu `state.issues` dizisine ekle
    - _Requirements: 18.2, 18.3, 18.4, 18.5, 18.6, 18.7_

  - [x] 18.2 `src/components/request/RequestDetailContent.jsx` güncelle: Klonla butonu işlevselliği
    - "Klonla" butonuna tıklandığında `getNextIssueNumber(state.issues, request.unitCode)` ile yeni numara üret
    - `CLONE_REQUEST` action'ı dispatch et (`sourceIssueId`, `newId: generateId()`, `newNumber`, `clonedAt: new Date().toISOString()`)
    - Dispatch sonrası `onClose()` çağır ve yeni talebin `RequestDetailModal`'ını aç (parent'a `onCloneSuccess(newId)` callback ile veya state ile)
    - _Requirements: 18.2, 18.7, 18.8_

  - [x] 18.3 `src/components/request/RequestDetailContent.jsx` güncelle: External_User klonlama yetki kontrolü
    - "Klonla" butonunu yalnızca şu koşulda göster: `!isExternalUser || request.reporterId === currentUser.id`
    - External_User yalnızca kendi taleplerini klonlayabilir
    - _Requirements: 18.9_

- [x] 19. Tarih Takibi ve Harcanan Zaman
  - [x] 19.1 `src/context/AppReducer.js` güncelle: `UPDATE_REQUEST_DATES` action case'i ekle
    - `case ACTIONS.UPDATE_REQUEST_DATES`: `issueId`, `resolvedAt`, `timeSpent` payload'ı al
    - İlgili issue'yu güncelle; `updatedAt` alanını da güncelle
    - _Requirements: 19.1, 19.5, 19.6_

  - [x] 19.2 `src/context/AppReducer.js` güncelle: `MOVE_ISSUE` case'ine otomatik `resolvedAt` doldurma ekle
    - Mevcut `MOVE_ISSUE` case'ini güncelle: `newStatus === 'Done'` ve `!issue.resolvedAt` ise `resolvedAt = new Date().toISOString()` ata
    - _Requirements: 19.8_

  - [x] 19.3 `src/utils/dateUtils.js` güncelle: `formatTimeSpent` fonksiyonu ekle
    - `formatTimeSpent(minutes)` fonksiyonunu ekle
    - `minutes` null, undefined veya `<= 0` ise `'—'` döndür
    - `hours = Math.floor(minutes / 60)`, `mins = minutes % 60`
    - Yalnızca dakika varsa: `"${mins}dk"`, yalnızca saat varsa: `"${hours}s"`, ikisi de varsa: `"${hours}s ${mins}dk"`
    - _Requirements: 19.4_

  - [x] 19.4 `src/data/seedData.js` güncelle: `resolvedAt` ve `timeSpent` alanları ekle
    - Mevcut tüm issue ve request nesnelerine `resolvedAt: null` ve `timeSpent: 0` alanlarını ekle
    - Status'u "Done" olan issue'lara örnek `resolvedAt` değeri ata
    - _Requirements: 19.1_

  - [x] 19.5 `src/components/request/RequestDetailContent.jsx` güncelle: resolvedAt ve timeSpent alanları
    - Sağ sütuna `resolvedAt` alanı ekle: `formatDate(request.resolvedAt)` veya `'—'`
    - Sağ sütuna `timeSpent` alanı ekle: `formatTimeSpent(request.timeSpent)` veya `'—'`
    - Yetkili kullanıcılar (Department_Head, Project_Manager, System_Admin) için düzenlenebilir input göster
    - External_User için salt okunur göster
    - `timeSpent` için negatif değer girişini engelle: `"Harcanan zaman negatif olamaz"` hata mesajı göster, kaydetme
    - Güncelleme sonrası `UPDATE_REQUEST_DATES` dispatch et ve `ADD_ACTIVITY` ile aktivite kaydı ekle
    - _Requirements: 19.2, 19.3, 19.4, 19.5, 19.6, 19.7, 19.9_

- [x] 20. Seed Data Yeniden Yapılandırması
  - [x] 20.1 `src/constants/index.js` güncelle: `ROLES` sabitine `WORKER` ekle
    - `ROLES` nesnesine `WORKER: 'Worker'` satırını ekle
    - Mevcut diğer rol sabitleri korunmalı
    - _Requirements: 20_

  - [x] 20.2 `src/data/seedData.js` tamamen yeniden yaz: birimler ve kullanıcılar
    - Tüm eski verileri sil (3 birim, 7 kullanıcı, 3 proje ve bunlara ait tüm issue/sprint/comment/activity)
    - 2 birim tanımla:
      - `unit-bigd`: BIGD (Bilgi İşlem Daire Başkanlığı), departmentHeadId: `user-bigd-head`
      - `unit-odb`: ODB (Öğrenci İşleri Daire Başkanlığı), departmentHeadId: `user-odb-head`
    - 22 kullanıcı tanımla:
      - 1 System_Admin: `user-admin` (admin@example.com / admin123, unitId: null)
      - BIGD: `user-bigd-head` (Department_Head) + `user-bigd-pm` (Project_Manager) + 8 Worker (`user-bigd-w1`…`user-bigd-w8`)
      - ODB: `user-odb-head` (Department_Head) + `user-odb-pm` (Project_Manager) + 8 Worker (`user-odb-w1`…`user-odb-w8`)
      - 1 External_User: `user-external` (dis.kullanici@example.com / pass123, unitId: null)
    - BIGD Worker'ları: w1-w4 → `project-bigd-1`, w5-w8 → `project-bigd-2` (projectId alanı ile)
    - ODB Worker'ları: w1-w4 → `project-odb-1`, w5-w8 → `project-odb-2` (projectId alanı ile)
    - _Requirements: 20_

  - [x] 20.3 `src/data/seedData.js` güncelle: projeler ve sprintler
    - 4 proje tanımla:
      - `project-bigd-1`: BIGD birimi, managerId: `user-bigd-pm`, key: 'BIGD1'
      - `project-bigd-2`: BIGD birimi, managerId: `user-bigd-pm`, key: 'BIGD2'
      - `project-odb-1`: ODB birimi, managerId: `user-odb-pm`, key: 'ODB1'
      - `project-odb-2`: ODB birimi, managerId: `user-odb-pm`, key: 'ODB2'
    - Her proje için 1 aktif sprint tanımla (Nisan 2025, status: 'Active')
      - `sprint-bigd1-apr`, `sprint-bigd2-apr`, `sprint-odb1-apr`, `sprint-odb2-apr`
      - startDate: '2025-04-01', endDate: '2025-04-30'
    - _Requirements: 20_

  - [x] 20.4 `src/data/seedData.js` güncelle: issue'lar, talepler, yorumlar ve aktiviteler
    - Her projede en az 4 issue ekle (farklı status/priority/type kombinasyonları: To Do, In Progress, In Review, Done)
    - Her proje için en az 1 talep ekle (isRequest: true, reporterId: `user-external`)
    - Tüm issue'lara `resolvedAt: null`, `timeSpent: 0` alanları ekle; Done olanlar için örnek `resolvedAt` değeri ata
    - Issue numaralandırma: BIGD projeleri için `BIGD-` öneki, ODB projeleri için `ODB-` öneki kullan
    - Örnek yorumlar (en az 4 adet, farklı issue'lara dağıtılmış) ekle
    - Örnek aktiviteler (created, status_change, assignment türlerinde, en az 6 adet) ekle
    - _Requirements: 20_

  - [x] 20.5 `src/context/AppContext.jsx` güncelle: seed data versiyonlama mekanizması ekle
    - `SEED_VERSION` sabitini `src/data/seedData.js` dosyasına ekle (örn. `export const SEED_VERSION = 2;`)
    - `AppContext.jsx` içindeki `init` fonksiyonunu güncelle: localStorage'daki `seedVersion` değeri `SEED_VERSION` ile eşleşmiyorsa localStorage'ı temizle ve seed data'yı yeniden yükle
    - Yeni state yüklendiğinde `seedVersion: SEED_VERSION` değerini state'e ekle ve localStorage'a kaydet
    - Bu sayede seed data değiştiğinde eski localStorage verisi otomatik sıfırlanır
    - _Requirements: 20_

- [x] 21. Talepler Listesinde Arama Alanı
  - [x] 21.1 `src/components/request/RequestList.jsx` güncelle: `searchQuery` state ve arama input'u ekle
    - `const [searchQuery, setSearchQuery] = useState('')` state'i ekle
    - Talep listesinin üstüne Bootstrap `form-control` input ekle: `placeholder="Talep ara..."`, `value={searchQuery}`, `onChange={e => setSearchQuery(e.target.value)}`
    - Input'u `mb-3` margin ile `div` içine sar
    - _Requirements: 21_

  - [x] 21.2 `src/components/request/RequestList.jsx` güncelle: `filterRequests` saf fonksiyonu ve filtrelenmiş liste
    - Bileşen dışında `filterRequests(requests, searchQuery)` saf fonksiyonu tanımla:
      - `searchQuery.trim()` boşsa tüm `requests` döndür
      - `q = searchQuery.toLowerCase()` ile `r.title`, `r.description`, `r.number` alanlarında case-insensitive `includes` kontrolü yap
    - Mevcut `requests` değişkenini `filterRequests(requests, searchQuery)` ile `filteredRequests` olarak türet
    - Kart listesini `filteredRequests` üzerinden render et
    - _Requirements: 21_

  - [x] 21.3 `src/components/request/RequestList.jsx` güncelle: talep sayısı gösterimi ve boş sonuç mesajı
    - Arama input'unun altına talep sayısı satırı ekle: `"{filteredRequests.length} talep bulundu"` (küçük, muted metin)
    - Boş sonuç durumlarını ayırt et:
      - `filteredRequests.length === 0 && searchQuery.trim()` → `"Arama kriterlerine uygun talep bulunamadı"` mesajı göster (EmptyState veya basit `<p>` ile)
      - `filteredRequests.length === 0 && !searchQuery.trim()` → mevcut EmptyState bileşenini göster (değişiklik yok)
    - _Requirements: 21_

- [x] 22. Birim-Proje Bağlantısı Doğrulama
  - [x] 22.1 `src/components/request/RequestForm.jsx` doğrula: birim seçilince proje listesi filtreleniyor mu?
    - `RequestForm.jsx` içinde `unitId` state değiştiğinde `projectId` state'inin sıfırlandığını doğrula
    - `unitProjects` hesaplamasının `state.projects.filter(p => p.unitId === unitId)` şeklinde çalıştığını doğrula
    - Hiçbir birim seçilmemişken proje seçim alanının gizlendiğini (`!unitId` koşulu) doğrula
    - Gerekirse küçük düzeltmeler yap; büyük yeniden yazım gerekmiyorsa mevcut kodu koru
    - _Requirements: 5.2, 5.3, 5.4_

  - [x] 22.2 Seed data ID'lerinin `RequestForm.jsx` ile uyumunu doğrula
    - Görev 20'de oluşturulan yeni birim ID'lerinin (`unit-bigd`, `unit-odb`) `RequestForm.jsx` içindeki `state.units` listesinde doğru göründüğünü doğrula
    - Yeni proje ID'lerinin (`project-bigd-1`, `project-bigd-2`, `project-odb-1`, `project-odb-2`) birim filtrelemesinde doğru eşleştiğini doğrula
    - Talep oluşturma akışını uçtan uca test et: birim seç → proje listesi filtrele → proje seç → talep oluştur → doğru `unitCode` ile numaralandırıldığını kontrol et
    - _Requirements: 5.3, 5.5, 5.6_
