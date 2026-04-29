# Design Document — Jira Clone Frontend (Refactor)

## Overview

Bu doküman, kurumsal Jira benzeri proje ve talep yönetim uygulamasının React tabanlı frontend mimarisini tanımlar. Uygulama; React 18, React Router v6, React Context + useReducer (global state), Bootstrap 5 ve localStorage kalıcılığı üzerine inşa edilecektir. Harici backend yoktur; tüm veri in-memory Store'da tutulur ve localStorage ile senkronize edilir.

Bu refactor ile uygulama şu yeni yetenekleri kazanmaktadır:

- **Rol tabanlı erişim kontrolü**: System_Admin, Department_Head, Project_Manager, Worker, External_User
- **Birim (daire) yönetimi**: Unit_Code (BIGD, ODB vb.) ile tanımlanan kurumsal birimler
- **Unit_Code tabanlı issue numaralandırma**: Her issue `BIGD-123` formatında numaralandırılır
- **Aylık sprint döngüsü**: Her ayın 1'i → son iş günü (14 günlük sabit döngü yerine)
- **Talep sistemi**: External_User'ın birime yönlendirdiği destek/hizmet talepleri
- **Kimlik doğrulama**: Tek giriş paneli, role göre otomatik yönlendirme
- **Responsive sidebar**: md (768px) altında toggle butonu ile açılıp kapanır
- **Korunan rotalar**: ProtectedRoute ile oturum ve yetki kontrolü

Mevcut özellikler (drag-drop board, issue yönetimi, yorum/aktivite sistemi, backlog) korunmakta ve yeni mimariyle entegre edilmektedir.

---

## Architecture

### Teknoloji Yığını

| Katman | Teknoloji | Gerekçe |
|---|---|---|
| UI Framework | React 18 | Mevcut proje, korunuyor |
| Stil | Bootstrap 5 | Mevcut CDN bağımlılığı, hızlı geliştirme |
| Routing | React Router v6 | SPA navigasyonu, korumalı rotalar |
| State | React Context + useReducer | Harici kütüphane gerektirmez, öngörülebilir |
| Kalıcılık | localStorage | Backend yok, tarayıcı tabanlı |
| Drag & Drop | @hello-pangea/dnd | react-beautiful-dnd aktif fork'u |
| İkonlar | react-icons | Hafif, tree-shakeable |
| Tarih | date-fns | Hafif tarih yardımcı kütüphanesi |
| Test | jest-fast-check | fast-check + Jest entegrasyonu, PBT için |

### Klasör Yapısı

```
src/
├── components/
│   ├── auth/
│   │   ├── LoginForm.jsx          # Email + şifre giriş formu
│   │   └── ProtectedRoute.jsx     # Oturum ve rol bazlı rota koruması
│   ├── unit/
│   │   ├── UnitList.jsx           # Birim listesi (System_Admin)
│   │   ├── UnitForm.jsx           # Birim oluştur/düzenle formu
│   │   └── UnitCard.jsx           # Birim özet kartı
│   ├── request/
│   │   ├── RequestList.jsx        # Talep listesi
│   │   ├── RequestForm.jsx        # Talep oluşturma formu
│   │   ├── RequestCard.jsx        # Talep özet kartı
│   │   ├── RequestDetailModal.jsx # Talep detay modal sarmalayıcısı (Req 15)
│   │   └── RequestDetailContent.jsx # Talep detay içeriği (Req 15-19)
│   ├── board/
│   │   ├── Board.jsx              # DragDropContext ana bileşeni
│   │   ├── BoardColumn.jsx        # Droppable sütun
│   │   ├── IssueCard.jsx          # Draggable issue kartı
│   │   └── BoardFilters.jsx       # Atanan/öncelik filtreleri
│   ├── issue/
│   │   ├── IssueModal.jsx         # Issue detay modal
│   │   ├── IssueForm.jsx          # Issue oluştur/düzenle formu
│   │   ├── IssueDetail.jsx        # Issue detay içeriği
│   │   ├── CommentSection.jsx     # Yorum listesi + ekleme
│   │   └── ActivityFeed.jsx       # Aktivite akışı
│   ├── project/
│   │   ├── ProjectList.jsx        # Proje listesi (rol filtreli)
│   │   ├── ProjectCard.jsx        # Proje özet kartı
│   │   └── ProjectForm.jsx        # Proje oluştur/düzenle formu
│   ├── sprint/
│   │   ├── SprintList.jsx         # Sprint listesi
│   │   ├── SprintForm.jsx         # Sprint oluşturma formu (ay/yıl seçici)
│   │   └── BacklogView.jsx        # Sprint'e atanmamış issue'lar
│   ├── dashboard/
│   │   ├── Dashboard.jsx          # Rol bazlı dashboard yönlendirici
│   │   ├── StatsCard.jsx          # İstatistik kartı
│   │   ├── ProjectProgress.jsx    # Proje ilerleme çubuğu
│   │   └── RecentActivity.jsx     # Son aktiviteler listesi
│   └── common/
│       ├── Avatar.jsx
│       ├── Badge.jsx
│       ├── ConfirmDialog.jsx
│       ├── EmptyState.jsx
│       ├── Modal.jsx
│       ├── PriorityIcon.jsx
│       └── Sidebar.jsx            # Toggle desteği (md altında gizli)
├── context/
│   ├── AppContext.jsx             # Ana state provider (auth dahil)
│   └── AppReducer.js             # Tüm action handler'ları
├── hooks/
│   ├── useAuth.js                 # Oturum bilgisi ve login/logout
│   ├── usePermissions.js          # Rol bazlı yetki kontrolleri
│   ├── useLocalStorage.js         # localStorage yardımcı hook
│   └── useIssueFilters.js         # Issue filtreleme hook'u
├── pages/
│   ├── LoginPage.jsx              # Giriş sayfası (public)
│   ├── DashboardPage.jsx          # Rol bazlı dashboard
│   ├── UnitsPage.jsx              # Birim yönetimi (System_Admin)
│   ├── ProjectsPage.jsx           # Proje listesi
│   ├── BoardPage.jsx              # Kanban board
│   ├── BacklogPage.jsx            # Backlog görünümü
│   ├── RequestsPage.jsx           # Talep listesi (External_User + diğerleri)
│   └── NotFoundPage.jsx           # 404 sayfası
├── data/
│   └── seedData.js                # Örnek birim, kullanıcı, proje, issue verileri
├── utils/
│   ├── sprintUtils.js             # Aylık sprint tarih hesaplama
│   ├── permissionUtils.js         # Rol bazlı görünürlük filtreleri + canChangeAssignee (Req 17)
│   ├── authUtils.js               # Kimlik doğrulama yardımcıları
│   ├── issueUtils.js              # Issue numaralandırma, gruplama
│   └── dateUtils.js               # Tarih formatlama + formatTimeSpent (Req 19)
├── constants/
│   └── index.js                   # ACTIONS, ROLES, sabitler
├── App.js                         # Router + Provider kurulumu
└── index.js
```

### Mimari Genel Bakış

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                    React App                         │   │
│  │  ┌─────────────┐   ┌──────────────────────────────┐  │   │
│  │  │  AppContext  │   │       React Router v6        │  │   │
│  │  │  (state +   │   │  /login  /dashboard  /units  │  │   │
│  │  │  dispatch)  │   │  /projects  /requests  ...   │  │   │
│  │  └──────┬──────┘   └──────────────────────────────┘  │   │
│  │         │                                             │   │
│  │  ┌──────▼──────────────────────────────────────────┐  │   │
│  │  │              Component Tree                     │  │   │
│  │  │  Sidebar │ Pages │ Modals │ Forms               │  │   │
│  │  └──────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────┘   │
│                           │                                 │
│                    localStorage                             │
└─────────────────────────────────────────────────────────────┘
```

Veri akışı tek yönlüdür: kullanıcı eylemi → dispatch → AppReducer → yeni state → re-render + localStorage sync.

---

## Components and Interfaces

### State Modeli

```javascript
// Store shape — AppContext
{
  auth: {
    isAuthenticated: false,
    currentUser: null   // { id, role, unitId } — login sonrası dolar
  },
  users: [],
  units: [],
  projects: [],
  issues: [],
  sprints: [],
  comments: [],
  activities: []
}

// Detaylı tip tanımları:
{
  auth: {
    isAuthenticated: true,
    currentUser: {
      id: "uuid",
      role: "System_Admin | Department_Head | Project_Manager | External_User",
      unitId: "uuid | null"
    }
  },
  users: [
    {
      id: "uuid",
      name: "Ad Soyad",
      email: "email@example.com",
      role: "System_Admin | Department_Head | Project_Manager | External_User",
      unitId: "uuid | null",
      avatarColor: "#hex",
      password: "string"   // in-memory demo; production'da hash kullanılır
    }
  ],
  units: [
    {
      id: "uuid",
      name: "Bilgi İşlem Daire Başkanlığı",
      unitCode: "BIGD",              // benzersiz, büyük harf alfanümerik
      departmentHeadId: "uuid | null",
      createdAt: "ISO8601"
    }
  ],
  projects: [
    {
      id: "uuid",
      name: "Proje Adı",
      unitId: "uuid",
      managerId: "uuid",             // Project_Manager
      description: "Açıklama",
      createdAt: "ISO8601"
    }
  ],
  issues: [
    {
      id: "uuid",
      number: "BIGD-1",              // unitCode + '-' + sıra no
      unitCode: "BIGD",
      projectId: "uuid",
      sprintId: "uuid | null",
      title: "Issue başlığı",
      description: "Açıklama",
      type: "Task | Bug | Story | Epic | Request",
      priority: "Highest | High | Medium | Low | Lowest",
      status: "To Do | In Progress | In Review | Done",
      assigneeId: "uuid | null",
      reporterId: "uuid",
      isRequest: false,              // true ise External_User talebi
      visibleTo: ["uuid"],           // External_User görünürlük listesi
      resolvedAt: null,              // ISO8601 | null — çözülüş tarihi (Req 19)
      timeSpent: 0,                  // dakika cinsinden harcanan zaman (Req 19)
      createdAt: "ISO8601",
      updatedAt: "ISO8601"
    }
  ],
  sprints: [
    {
      id: "uuid",
      projectId: "uuid",
      name: "Mayıs 2025 Sprint",
      month: 5,
      year: 2025,
      startDate: "ISO8601",          // ayın 1'i
      endDate: "ISO8601",            // ayın son iş günü
      status: "Planned | Active | Completed"
    }
  ],
  comments: [
    {
      id: "uuid",
      issueId: "uuid",
      authorId: "uuid",
      text: "Yorum metni",
      createdAt: "ISO8601"
    }
  ],
  activities: [
    {
      id: "uuid",
      issueId: "uuid",
      userId: "uuid",
      type: "status_change | assignment | comment | field_update | created",
      description: "Açıklama metni",
      createdAt: "ISO8601"
    }
  ]
}
```
```

### Reducer Action Tipleri

```javascript
// constants/index.js
export const ACTIONS = {
  // Auth
  LOGIN:  'LOGIN',
  LOGOUT: 'LOGOUT',

  // Unit
  ADD_UNIT:    'ADD_UNIT',
  UPDATE_UNIT: 'UPDATE_UNIT',

  // Project
  ADD_PROJECT:    'ADD_PROJECT',
  UPDATE_PROJECT: 'UPDATE_PROJECT',

  // Issue
  ADD_ISSUE:              'ADD_ISSUE',
  UPDATE_ISSUE:           'UPDATE_ISSUE',
  DELETE_ISSUE:           'DELETE_ISSUE',
  MOVE_ISSUE:             'MOVE_ISSUE',
  ASSIGN_ISSUE_TO_SPRINT: 'ASSIGN_ISSUE_TO_SPRINT',
  ADD_VISIBLE_USER:       'ADD_VISIBLE_USER',
  CLONE_REQUEST:          'CLONE_REQUEST',          // Req 18 — talep klonlama
  UPDATE_REQUEST_ASSIGNEE:'UPDATE_REQUEST_ASSIGNEE',// Req 17 — atama yetki kontrolü ile güncelleme
  UPDATE_REQUEST_DATES:   'UPDATE_REQUEST_DATES',   // Req 19 — resolvedAt / timeSpent güncelleme

  // Sprint
  ADD_SPRINT:      'ADD_SPRINT',
  START_SPRINT:    'START_SPRINT',
  COMPLETE_SPRINT: 'COMPLETE_SPRINT',

  // Comment
  ADD_COMMENT:    'ADD_COMMENT',
  DELETE_COMMENT: 'DELETE_COMMENT',

  // Activity (otomatik tetiklenir)
  ADD_ACTIVITY: 'ADD_ACTIVITY',
};

export const ROLES = {
  SYSTEM_ADMIN:    'System_Admin',
  DEPARTMENT_HEAD: 'Department_Head',
  PROJECT_MANAGER: 'Project_Manager',
  WORKER:          'Worker',
  EXTERNAL_USER:   'External_User',
};

export const PRIORITIES = ['Highest', 'High', 'Medium', 'Low', 'Lowest'];
export const STATUSES   = ['To Do', 'In Progress', 'In Review', 'Done'];
export const ISSUE_TYPES = ['Task', 'Bug', 'Story', 'Epic', 'Request'];
export const SPRINT_STATUSES = ['Planned', 'Active', 'Completed'];

export const PRIORITY_COLORS = {
  Highest: '#FF0000',
  High:    '#FF7700',
  Medium:  '#FFAA00',
  Low:     '#2684FF',
  Lowest:  '#57D9A3',
};

export const STATUS_COLORS = {
  'To Do':       '#DFE1E6',
  'In Progress': '#0052CC',
  'In Review':   '#FF991F',
  'Done':        '#00875A',
};

// Rol bazlı yönlendirme hedefleri
export const ROLE_DEFAULT_ROUTES = {
  System_Admin:    '/admin',
  Department_Head: '/dashboard',
  Project_Manager: '/dashboard',
  External_User:   '/requests',
};

// Rol bazlı sidebar menü öğeleri
export const ROLE_NAV_ITEMS = {
  System_Admin:    ['dashboard', 'admin', 'units', 'projects'],
  Department_Head: ['dashboard', 'units', 'projects'],
  Project_Manager: ['dashboard', 'projects'],
  External_User:   ['requests'],
};
```

### Temel Bileşen Arayüzleri

#### AppContext / AppReducer

```jsx
// context/AppContext.jsx
const AppContext = createContext();

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(AppReducer, initialState, init);

  // localStorage sync — her state değişiminde
  useEffect(() => {
    localStorage.setItem('jira-clone-state', JSON.stringify(state));
  }, [state]);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

// init: localStorage'dan yükle veya seed data kullan
function init(initialState) {
  try {
    const saved = localStorage.getItem('jira-clone-state');
    return saved ? JSON.parse(saved) : initialState;
  } catch {
    return initialState;
  }
}
```

#### useAuth Hook

```javascript
// hooks/useAuth.js
export function useAuth() {
  const { state, dispatch } = useContext(AppContext);
  const currentUser = state.currentUser
    ? state.users.find(u => u.id === state.currentUser.id)
    : null;

  function login(email, password) {
    const user = state.users.find(
      u => u.email === email && u.password === password
    );
    if (!user) throw new Error('Kullanıcı adı veya şifre hatalı');
    dispatch({ type: ACTIONS.LOGIN, payload: { id: user.id, role: user.role, unitId: user.unitId } });
    return user;
  }

  function logout() {
    dispatch({ type: ACTIONS.LOGOUT });
  }

  return { currentUser, login, logout };
}
```

#### usePermissions Hook

```javascript
// hooks/usePermissions.js
export function usePermissions() {
  const { currentUser } = useAuth();

  return {
    canManageUnits:    currentUser?.role === ROLES.SYSTEM_ADMIN,
    canCreateProject:  [ROLES.SYSTEM_ADMIN, ROLES.DEPARTMENT_HEAD].includes(currentUser?.role),
    canManageIssues:   [ROLES.SYSTEM_ADMIN, ROLES.DEPARTMENT_HEAD, ROLES.PROJECT_MANAGER].includes(currentUser?.role),
    canViewAllUnits:   currentUser?.role === ROLES.SYSTEM_ADMIN,
    canViewOwnUnit:    currentUser?.role === ROLES.DEPARTMENT_HEAD,
    isExternalUser:    currentUser?.role === ROLES.EXTERNAL_USER,
    role:              currentUser?.role,
  };
}
```

#### LoginForm

```jsx
// components/auth/LoginForm.jsx
// Props: onSuccess(user)
// State: email, password, error
// Davranış: useAuth().login() çağırır; başarıda role göre navigate eder
```

#### Sidebar (Toggle Desteği)

```jsx
// components/common/Sidebar.jsx
// Props: isOpen, onToggle
// md (768px) altında: varsayılan kapalı, toggle butonu görünür
// md üstünde: her zaman açık, toggle butonu gizli
// Aktif rota: useLocation() ile karşılaştırılır, Bootstrap 'active' sınıfı eklenir
// Menü öğeleri: ROLE_NAV_ITEMS[currentUser.role] ile filtrelenir
```

#### ProtectedRoute / AdminRoute

```jsx
// Korumalı rota sarmalayıcıları
function ProtectedRoute({ children }) {
  const { currentUser } = useAuth();
  return currentUser ? children : <Navigate to="/login" replace />;
}

function AdminRoute({ children }) {
  const { currentUser } = useAuth();
  if (!currentUser) return <Navigate to="/login" replace />;
  if (currentUser.role !== ROLES.SYSTEM_ADMIN)
    return <Navigate to="/dashboard" replace />;
  return children;
}
```

#### UnitForm

```jsx
// components/admin/UnitForm.jsx
// Props: onSubmit(unitData), existingUnits
// Alanlar: name (zorunlu), unitCode (zorunlu, benzersiz), departmentHeadId
// Doğrulama: unitCode çakışması kontrolü → "Bu birim kodu zaten kullanılıyor"
```

#### RequestForm

```jsx
// components/request/RequestForm.jsx
// Props: onSubmit(requestData), units
// Alanlar: title (zorunlu), unitId (zorunlu), description
// Doğrulama: title boş → "Talep başlığı zorunludur"
// Numara: dispatch sonrası unitCode + '-' + sıra no otomatik atanır
```

#### RequestDetailModal (Req 15)

```jsx
// components/request/RequestDetailModal.jsx
// Props: isOpen, onClose, requestId
// Davranış: Modal içinde RequestDetailContent bileşenini render eder
// Klavye: Escape tuşu ile kapatılabilir (Modal.jsx'in mevcut desteği)
// Başlık: request.number (örn. BIGD-42) modal başlığında gösterilir
function RequestDetailModal({ isOpen, onClose, requestId }) {
  const { state } = useAppContext();
  const request = state.issues.find(i => i.id === requestId);
  if (!request) return null;
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={request.number} size="xl">
      <RequestDetailContent request={request} onClose={onClose} />
    </Modal>
  );
}
```

#### RequestDetailContent (Req 15, 17, 18, 19)

```jsx
// components/request/RequestDetailContent.jsx
// Props: request, onClose
// Sol sütun: başlık, açıklama, CommentSection, ActivityFeed
// Sağ sütun: durum, tip, öncelik, atanan kişi (canChangeAssignee kontrolü),
//            raporlayan, createdAt, resolvedAt, timeSpent
// Toolbar: "Klonla" butonu (yetkili kullanıcılar için, Req 18)
// Atama: External_User için salt okunur (Req 17)
// resolvedAt / timeSpent: External_User için salt okunur (Req 19)
// Otomatik resolvedAt: durum "Done" yapılırken resolvedAt boşsa otomatik doldurulur (Req 19.8)
```

#### Board Bileşeni (Req 16 — isRequest Yönlendirme)

```jsx
// components/board/Board.jsx
// DragDropContext > Droppable (sütun) > Draggable (kart) yapısı
// @hello-pangea/dnd kullanır
// onDragEnd → dispatch({ type: ACTIONS.MOVE_ISSUE, payload: { issueId, newStatus } })
// Filtreler: assignee, priority (BoardFilters.jsx)
// Aktif sprint yoksa EmptyState gösterir
//
// isRequest Yönlendirme (Req 16):
// - IssueCard tıklandığında issue.isRequest kontrolü yapılır
// - isRequest === true  → selectedRequestId set edilir → RequestDetailModal açılır
// - isRequest === false → selectedIssueId set edilir   → IssueModal açılır
// - RequestDetailModal açıkken drag-drop devre dışı bırakılır (Req 16.5)
//
// State:
//   selectedIssueId:   string | null   (IssueModal için)
//   selectedRequestId: string | null   (RequestDetailModal için)
//
// Örnek:
function handleIssueClick(issue) {
  if (issue.isRequest) {
    setSelectedRequestId(issue.id);
  } else {
    setSelectedIssueId(issue.id);
  }
}
```

#### IssueModal

```jsx
// components/issue/IssueModal.jsx
// Issue detay görünümü: başlık, açıklama, meta alanlar, CommentSection, ActivityFeed
// Düzenleme modu: inline edit veya form toggle
// Issue numarası (örn. BIGD-1) başlık yanında gösterilir
```

#### RequestList (Req 21 — Arama ve Filtreleme)

```jsx
// components/request/RequestList.jsx
// State: searchQuery (useState(''))
// Arama input'u: placeholder "Talep ara...", Bootstrap form-control
//
// Filtreleme mantığı:
function filterRequests(requests, searchQuery) {
  if (!searchQuery.trim()) return requests;
  const q = searchQuery.toLowerCase();
  return requests.filter(r =>
    r.title.toLowerCase().includes(q) ||
    (r.description || '').toLowerCase().includes(q) ||
    r.number.toLowerCase().includes(q)
  );
}
//
// Render yapısı:
// 1. Arama input'u (her zaman görünür)
// 2. Talep sayısı: "{filteredRequests.length} talep bulundu"
// 3. filteredRequests.length === 0 && searchQuery → "Arama kriterlerine uygun talep bulunamadı"
// 4. filteredRequests.length === 0 && !searchQuery → mevcut EmptyState
// 5. Talep kartları listesi
//
// Davranış:
// - searchQuery değiştiğinde filteredRequests anında yeniden hesaplanır (useMemo veya inline)
// - Arama alanı boşaltılınca tüm talepler geri gelir (Req 21.6)
// - Büyük/küçük harf duyarsız eşleştirme (Req 21.4)
```

---

## Data Models

### Unit

```typescript
interface Unit {
  id: string;           // UUID
  name: string;         // "Bilgi İşlem Daire Başkanlığı"
  unitCode: string;     // "BIGD" — benzersiz, büyük harf
  departmentHeadId: string | null;
  createdAt: string;    // ISO8601
}
```

### User

```typescript
interface User {
  id: string;
  name: string;
  email: string;
  role: 'System_Admin' | 'Department_Head' | 'Project_Manager' | 'Worker' | 'External_User';
  unitId: string | null;
  avatarColor: string;  // "#hex"
  password: string;     // demo amaçlı düz metin
  projectId?: string | null;  // Worker için atandığı proje (opsiyonel)
}
```

### Project

```typescript
interface Project {
  id: string;
  name: string;
  unitId: string;
  managerId: string;    // Project_Manager kullanıcısı
  description: string;
  createdAt: string;
}
```

### Issue

```typescript
interface Issue {
  id: string;
  number: string;       // "BIGD-1" — unitCode + '-' + sıra no
  unitCode: string;     // "BIGD"
  projectId: string;
  sprintId: string | null;
  title: string;
  description: string;
  type: 'Task' | 'Bug' | 'Story' | 'Epic' | 'Request';
  priority: 'Highest' | 'High' | 'Medium' | 'Low' | 'Lowest';
  status: 'To Do' | 'In Progress' | 'In Review' | 'Done';
  assigneeId: string | null;
  reporterId: string;
  isRequest: boolean;
  visibleTo: string[];  // External_User id listesi
  resolvedAt: string | null;  // ISO8601 — talebin çözüldüğü tarih (Req 19)
  timeSpent: number;          // dakika cinsinden harcanan zaman, varsayılan: 0 (Req 19)
  createdAt: string;
  updatedAt: string;
}
```

### Sprint

```typescript
interface Sprint {
  id: string;
  projectId: string;
  name: string;         // "Mayıs 2025 Sprint"
  month: number;        // 1-12
  year: number;
  startDate: string;    // ISO8601 — ayın 1'i
  endDate: string;      // ISO8601 — ayın son iş günü
  status: 'Planned' | 'Active' | 'Completed';
}
```

### Comment

```typescript
interface Comment {
  id: string;
  issueId: string;
  authorId: string;
  text: string;
  createdAt: string;
}
```

### Activity

```typescript
interface Activity {
  id: string;
  issueId: string;
  userId: string;
  type: 'status_change' | 'assignment' | 'comment' | 'field_update' | 'created';
  description: string;
  createdAt: string;
}
```

---

## Routing

```jsx
// App.js
<BrowserRouter>
  <AppProvider>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout /> {/* Sidebar + main content */}
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route
          path="admin"
          element={
            <AdminRoute>
              <AdminPage />
            </AdminRoute>
          }
        />
        <Route path="units"                          element={<UnitPage />} />
        <Route path="projects"                       element={<ProjectsPage />} />
        <Route path="projects/:projectId/board"      element={<BoardPage />} />
        <Route path="projects/:projectId/backlog"    element={<BacklogPage />} />
        <Route path="requests"                       element={<RequestsPage />} />
        <Route path="*"                              element={<NotFoundPage />} />
      </Route>
    </Routes>
  </AppProvider>
</BrowserRouter>
```

### Rota Erişim Matrisi

| Rota | System_Admin | Department_Head | Project_Manager | External_User |
|---|---|---|---|---|
| /login | ✓ | ✓ | ✓ | ✓ |
| /dashboard | ✓ | ✓ | ✓ | ✗ |
| /admin | ✓ | ✗ | ✗ | ✗ |
| /units | ✓ | ✓ | ✗ | ✗ |
| /projects | ✓ | ✓ | ✓ | ✗ |
| /projects/:id/board | ✓ | ✓ | ✓ | ✗ |
| /projects/:id/backlog | ✓ | ✓ | ✓ | ✗ |
| /requests | ✓ | ✓ | ✓ | ✓ |

---

## Data Flow

```
User Action
    │
    ▼
Component (dispatch action)
    │
    ▼
AppReducer (pure function → yeni state)
    │
    ▼
AppContext (state güncellenir)
    │
    ├──► localStorage (useEffect ile senkronize)
    │
    └──► Re-render (ilgili bileşenler)
```

### Sprint Aylık Döngü Hesaplama

```javascript
// utils/sprintUtils.js

/**
 * Verilen yıl ve ay için sprint başlangıç/bitiş tarihlerini hesaplar.
 * Başlangıç: ayın 1'i
 * Bitiş: ayın son iş günü (Cumartesi/Pazar değil)
 */
export function getMonthlySprintDates(year, month) {
  const startDate = new Date(year, month - 1, 1);
  const endDate   = getLastWorkingDay(year, month);
  return { startDate, endDate };
}

function getLastWorkingDay(year, month) {
  // new Date(year, month, 0) → ayın son günü
  let date = new Date(year, month, 0);
  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() - 1);
  }
  return date;
}

/**
 * Verilen tarihin o ayın son iş günü olup olmadığını kontrol eder.
 */
export function isLastWorkingDay(date) {
  const d = new Date(date);
  const { endDate } = getMonthlySprintDates(d.getFullYear(), d.getMonth() + 1);
  return d.toDateString() === endDate.toDateString();
}
```

### Issue Numaralandırma

```javascript
// utils/issueUtils.js

/**
 * Bir birim için bir sonraki issue numarasını üretir.
 * Mevcut issue'lar arasında unitCode ile eşleşenlerin
 * en yüksek sıra numarasını bulur ve 1 artırır.
 */
export function getNextIssueNumber(issues, unitCode) {
  const unitIssues = issues.filter(i => i.unitCode === unitCode);
  if (unitIssues.length === 0) return `${unitCode}-1`;
  const maxSeq = Math.max(
    ...unitIssues.map(i => parseInt(i.number.split('-')[1], 10))
  );
  return `${unitCode}-${maxSeq + 1}`;
}
```

### Rol Bazlı Proje Filtreleme

```javascript
// utils/permissionUtils.js

export function getVisibleProjects(projects, currentUser) {
  switch (currentUser.role) {
    case ROLES.SYSTEM_ADMIN:
      return projects;
    case ROLES.DEPARTMENT_HEAD:
      return projects.filter(p => p.unitId === currentUser.unitId);
    case ROLES.PROJECT_MANAGER:
      return projects.filter(p => p.managerId === currentUser.id);
    case ROLES.EXTERNAL_USER:
      return [];
    default:
      return [];
  }
}

export function getVisibleIssues(issues, currentUser) {
  if (currentUser.role === ROLES.EXTERNAL_USER) {
    return issues.filter(
      i => i.reporterId === currentUser.id ||
           i.visibleTo.includes(currentUser.id)
    );
  }
  // Diğer roller proje erişimine göre filtrelenir (getVisibleProjects ile birlikte)
  return issues;
}
```

### Atama Yetki Kontrolü (Req 17)

```javascript
// utils/permissionUtils.js

/**
 * Kullanıcının belirli bir talep için atanan kişiyi değiştirip değiştiremeyeceğini kontrol eder.
 * - System_Admin: tüm talepler için evet
 * - Department_Head: kendi birimine ait talepler için evet
 * - Project_Manager: kendi projesine ait talepler için evet
 * - External_User: hiçbir zaman hayır
 *
 * @param {Object} user     - currentUser ({ id, role, unitId })
 * @param {Object} issue    - Talep nesnesi ({ projectId, unitCode, ... })
 * @param {Array}  projects - Tüm projeler listesi
 * @returns {boolean}
 */
export function canChangeAssignee(user, issue, projects = []) {
  if (!user || !issue) return false;
  switch (user.role) {
    case ROLES.SYSTEM_ADMIN:
      return true;
    case ROLES.DEPARTMENT_HEAD: {
      const project = projects.find(p => p.id === issue.projectId);
      return project?.unitId === user.unitId;
    }
    case ROLES.PROJECT_MANAGER: {
      const project = projects.find(p => p.id === issue.projectId);
      return project?.managerId === user.id;
    }
    case ROLES.EXTERNAL_USER:
      return false;
    default:
      return false;
  }
}
```

### Talep Klonlama Mantığı (Req 18)

```javascript
// context/AppReducer.js — CLONE_REQUEST case

case ACTIONS.CLONE_REQUEST: {
  const { sourceIssueId, newNumber, newId, clonedAt } = action.payload;
  const source = state.issues.find(i => i.id === sourceIssueId);
  if (!source) return state;

  const cloned = {
    ...source,
    id: newId,
    number: newNumber,                        // Req 18.7 — birim sıra numarası
    title: `${source.title} (Kopya)`,         // Req 18.3
    status: 'To Do',                          // Req 18.4
    resolvedAt: null,                         // Req 18.5
    timeSpent: 0,                             // Req 18.5
    createdAt: clonedAt,                      // Req 18.6
    updatedAt: clonedAt,
    visibleTo: [],                            // Yeni talep için sıfırla
    assigneeId: null,                         // Atama sıfırla
  };

  return {
    ...state,
    issues: [...state.issues, cloned],
  };
}
```

### Tarih Takibi ve Harcanan Zaman (Req 19)

```javascript
// context/AppReducer.js — UPDATE_REQUEST_DATES case

case ACTIONS.UPDATE_REQUEST_DATES: {
  const { issueId, resolvedAt, timeSpent } = action.payload;
  return {
    ...state,
    issues: state.issues.map(issue =>
      issue.id === issueId
        ? { ...issue, resolvedAt, timeSpent, updatedAt: new Date().toISOString() }
        : issue
    ),
  };
}

// MOVE_ISSUE case güncellemesi — otomatik resolvedAt (Req 19.8)
// Mevcut MOVE_ISSUE case'ine ek olarak:
// newStatus === 'Done' && !issue.resolvedAt ise resolvedAt = now
```

```javascript
// utils/dateUtils.js

/**
 * timeSpent (dakika) değerini "Xs Ydak" formatında gösterir.
 * Değer 0 veya null ise "—" döner.
 * @param {number|null} minutes
 * @returns {string}
 */
export function formatTimeSpent(minutes) {
  if (!minutes || minutes <= 0) return '—';
  const hours = Math.floor(minutes / 60);
  const mins  = minutes % 60;
  if (hours === 0) return `${mins}dk`;
  if (mins  === 0) return `${hours}s`;
  return `${hours}s ${mins}dk`;
}
```

`src/data/seedData.js` dosyası şunları içerir:
- **2 birim**: BIGD (Bilgi İşlem Daire Başkanlığı) ve ODB (Öğrenci İşleri Daire Başkanlığı)
- **22 kullanıcı** (Req 20):
  - 1 System_Admin: `admin@example.com / admin123`
  - BIGD birimi: 1 Department_Head + 1 Project_Manager + 8 Worker (4'ü `project-bigd-1`'e, 4'ü `project-bigd-2`'ye atanmış)
  - ODB birimi: 1 Department_Head + 1 Project_Manager + 8 Worker (4'ü `project-odb-1`'e, 4'ü `project-odb-2`'ye atanmış)
  - 1 External_User
- **4 proje**: BIGD'ye 2 (`project-bigd-1`, `project-bigd-2`), ODB'ye 2 (`project-odb-1`, `project-odb-2`)
- Her projede 1 aktif sprint (aylık döngü ile hesaplanmış tarihler)
- Her projede 6-8 örnek issue (farklı durum, öncelik ve tip)
- Her birim ve proje için en az 1 örnek talep (isRequest: true, External_User tarafından açılmış, resolvedAt ve timeSpent alanları dahil)
- Birkaç örnek yorum ve aktivite kaydı

**Önemli tasarım kararları (Req 20):**
- Eski 3. birim (SHS) ve ona ait kullanıcı/proje/issue'lar kaldırılmıştır.
- `ROLES` sabitine `Worker: 'Worker'` eklenmiştir.
- Worker kullanıcıları `unitId` (birim) ve `projectId` (proje) alanlarıyla tanımlanır.
- Mevcut talepler (requests) yeni kullanıcı ve proje ID'leriyle uyumlu hale getirilmiştir.

---

### Seed Data Yeniden Yapılandırması (Req 20)

Mevcut 3 birimli (BIGD, ODB, SHS) yapı 2 birimli yapıya dönüştürülmektedir. Değişiklikler:

```
Eski yapı:                          Yeni yapı:
─────────────────────────────────   ─────────────────────────────────────────
3 birim (BIGD, ODB, SHS)            2 birim (BIGD, ODB)
3 proje                             4 proje (her birime 2)
7 kullanıcı                         22 kullanıcı
  1 System_Admin                      1 System_Admin (admin@example.com)
  2 Department_Head                   2 Department_Head (1 per unit)
  3 Project_Manager                   2 Project_Manager (1 per unit)
  1 External_User                     16 Worker (8 per unit, 4 per project)
                                      1 External_User
```

**ID Şeması:**
- Birimler: `unit-bigd`, `unit-odb`
- Projeler: `project-bigd-1`, `project-bigd-2`, `project-odb-1`, `project-odb-2`
- Kullanıcılar: `user-admin`, `user-bigd-head`, `user-bigd-pm`, `user-bigd-w1` … `user-bigd-w8`, `user-odb-head`, `user-odb-pm`, `user-odb-w1` … `user-odb-w8`, `user-external`

**constants/index.js güncellemesi:**
```javascript
export const ROLES = {
  SYSTEM_ADMIN:    'System_Admin',
  DEPARTMENT_HEAD: 'Department_Head',
  PROJECT_MANAGER: 'Project_Manager',
  WORKER:          'Worker',          // YENİ — Req 20
  EXTERNAL_USER:   'External_User',
};
```

**Worker kullanıcı şeması:**
```javascript
{
  id: 'user-bigd-w1',
  name: 'Çalışan Adı',
  email: 'bigd.worker1@example.com',
  password: 'pass123',
  role: 'Worker',
  unitId: 'unit-bigd',
  projectId: 'project-bigd-1',   // hangi projeye atandığı
  avatarColor: '#hex',
}
```

---

### Talepler Arama Filtresi (Req 21)

`RequestList.jsx` bileşenine `searchQuery` state'i ve filtreleme mantığı eklenmektedir.

**State değişikliği:**
```jsx
const [searchQuery, setSearchQuery] = useState('');
```

**Filtreleme fonksiyonu (saf, test edilebilir):**
```javascript
// Bileşen içinde veya utils/requestUtils.js'e taşınabilir
export function filterRequests(requests, searchQuery) {
  if (!searchQuery.trim()) return requests;
  const q = searchQuery.toLowerCase();
  return requests.filter(r =>
    r.title.toLowerCase().includes(q) ||
    (r.description || '').toLowerCase().includes(q) ||
    r.number.toLowerCase().includes(q)
  );
}
```

**Render yapısı:**
```jsx
// RequestList.jsx — arama alanı ve sayaç
<div className="mb-3">
  <div className="d-flex align-items-center gap-2">
    <input
      type="text"
      className="form-control"
      placeholder="Talep ara..."
      value={searchQuery}
      onChange={e => setSearchQuery(e.target.value)}
    />
    <span className="text-muted small text-nowrap">
      {filteredRequests.length} talep bulundu
    </span>
  </div>
</div>

{filteredRequests.length === 0 && searchQuery.trim() ? (
  <EmptyState
    title="Arama kriterlerine uygun talep bulunamadı"
    description={`"${searchQuery}" için sonuç bulunamadı.`}
  />
) : filteredRequests.length === 0 ? (
  <EmptyState ... /> // mevcut boş durum
) : (
  filteredRequests.map(req => ...)
)}
```

**Birim-Proje Bağlantısı (Req 5.3):**
`RequestForm.jsx` zaten `unitId` seçilince `unitProjects` filtrelemesini doğru yapıyor. Seed data yeni ID'lere uyumlu hale getirilince bu özellik otomatik olarak çalışacaktır. Ek kod değişikliği gerekmez.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Property-based testing (PBT) bu özellik için uygundur: uygulama saf fonksiyonlar (sprint tarih hesaplama, issue numaralandırma, erişim kontrolü filtreleri, durum geçişleri) içermekte ve bu fonksiyonlar geniş bir girdi uzayında evrensel özellikler sergilemektedir. **jest-fast-check** (fast-check + Jest entegrasyonu) kullanılacaktır.

---

### Property 1: Rol Bazlı Yönlendirme

*For any* geçerli kullanıcı kimlik bilgisi çifti, giriş sonrası yönlendirilen rota kullanıcının rolüne karşılık gelen `ROLE_DEFAULT_ROUTES` değeriyle eşleşmelidir.

**Validates: Requirements 1.2, 1.3, 1.4, 1.5, 1.6**

---

### Property 2: Yetkisiz Erişim Engeli

*For any* kullanıcı ve o kullanıcının rolü için izin verilmeyen rota kombinasyonu, erişim girişimi reddedilmeli ve kullanıcı yetkili olduğu sayfaya yönlendirilmelidir.

**Validates: Requirements 2.8, 13.7**

---

### Property 3: Rol Bazlı Proje Görünürlüğü

*For any* kullanıcı ve proje koleksiyonu, `getVisibleProjects` fonksiyonunun döndürdüğü projeler şu koşulları sağlamalıdır: System_Admin tüm projeleri görür; Department_Head yalnızca kendi biriminin projelerini görür; Project_Manager yalnızca kendi projesini görür; External_User hiçbir projeyi göremez.

**Validates: Requirements 2.3, 2.5, 4.6**

---

### Property 4: External_User Talep Görünürlüğü

*For any* External_User ve issue koleksiyonu, `getVisibleIssues` fonksiyonunun döndürdüğü her issue için ya `issue.reporterId === currentUser.id` ya da `issue.visibleTo.includes(currentUser.id)` koşulunun sağlanması gerekir; başka kullanıcılara ait talepler görünmemelidir.

**Validates: Requirements 2.7, 5.5, 5.6**

---

### Property 5: Issue Numarası Birim Kodu Etiketlemesi

*For any* birim kodu ve issue koleksiyonu, `getNextIssueNumber` ile oluşturulan her issue numarası `unitCode + '-'` önekiyle başlamalı ve ardından gelen sayı mevcut en yüksek sıra numarasından büyük olmalıdır.

**Validates: Requirements 5.3, 5.4, 7.3**

---

### Property 6: Sprint Aylık Döngü Sınırları

*For any* geçerli (yıl, ay) çifti, `getMonthlySprintDates(year, month)` fonksiyonunun döndürdüğü `startDate` o ayın 1'i, `endDate` ise o ayın son iş günü (Cumartesi veya Pazar olmayan son gün) olmalıdır.

**Validates: Requirements 8.1**

---

### Property 7: Sprint Tekliği

*For any* proje ve sprint koleksiyonu, aynı `projectId` için `status === 'Active'` olan sprint sayısı en fazla 1 olmalıdır.

**Validates: Requirements 8.4**

---

### Property 8: Sprint Ay/Yıl Benzersizliği

*For any* proje ve sprint koleksiyonu, aynı `projectId` için aynı `(month, year)` çiftine sahip birden fazla sprint bulunmamalıdır.

**Validates: Requirements 8.9**

---

### Property 9: Sprint Tamamlama — Backlog Taşıma

*For any* aktif sprint ve o sprint'e ait issue koleksiyonu, sprint tamamlandığında `status !== 'Done'` olan tüm issue'ların `sprintId` değeri `null` olmalıdır.

**Validates: Requirements 8.6**

---

### Property 10: Issue Durum Geçişi Tutarlılığı

*For any* issue ve hedef durum değeri, `MOVE_ISSUE` action'ı sonrasında issue'nun `status` değeri yalnızca `STATUSES` sabitinde tanımlı dört değerden biri olmalıdır.

**Validates: Requirements 6.2, 7.8**

---

### Property 11: Issue Oluşturma Veri Bütünlüğü

*For any* geçerli issue form verisi, `ADD_ISSUE` action'ı sonrasında Store'daki yeni issue; `number`, `unitCode`, `projectId`, `title`, `type`, `priority`, `status`, `reporterId`, `createdAt` ve `updatedAt` alanlarının tamamını içermelidir.

**Validates: Requirements 7.1, 7.2**

---

### Property 12: Aktivite Sıralaması

*For any* aktivite koleksiyonu, aktiviteler en yeniden en eskiye doğru sıralandığında her ardışık çift için `activities[i].createdAt >= activities[i+1].createdAt` koşulu sağlanmalıdır.

**Validates: Requirements 11.4, 11.5**

---

### Property 13: Dashboard İstatistik Tutarlılığı

*For any* issue koleksiyonu ve kullanıcı rolü, Dashboard'da gösterilen toplam açık issue sayısı `issues.filter(i => i.status !== 'Done').length` değeriyle eşleşmelidir.

**Validates: Requirements 12.1, 12.2, 12.3**

---

### Property 14: localStorage Round-Trip

*For any* geçerli Store state nesnesi, `JSON.parse(JSON.stringify(state))` işlemi orijinal state ile derin eşit (deep equal) bir nesne üretmelidir.

**Validates: Requirements 14.1, 14.2, 14.4**

---

### Property 15: Sidebar Menü Rol Uyumu

*For any* kullanıcı rolü, Sidebar'da gösterilen navigasyon öğeleri `ROLE_NAV_ITEMS[role]` listesiyle tam olarak eşleşmeli; fazladan veya eksik öğe bulunmamalıdır.

**Validates: Requirements 1.8, 13.1**

---

### Property 16: Atama Değişikliği Yetki Kontrolü

*For any* kullanıcı ve talep kombinasyonu, `canChangeAssignee(user, issue, projects)` fonksiyonunun döndürdüğü değer şu koşulları sağlamalıdır: External_User için her zaman `false`; System_Admin için her zaman `true`; Department_Head için yalnızca kendi birimine ait talepler için `true`; Project_Manager için yalnızca kendi projesine ait talepler için `true`.

**Validates: Requirements 17.1, 17.2, 17.3, 17.4**

---

### Property 17: Talep Klonlama Veri Bütünlüğü

*For any* geçerli talep nesnesi, `CLONE_REQUEST` action'ı sonrasında oluşturulan yeni talebin şu özellikleri sağlaması gerekir: başlık kaynak talebin başlığını içermeli ve " (Kopya)" ile bitmeli; durum "To Do" olmalı; `resolvedAt` değeri `null` olmalı; `timeSpent` değeri `0` olmalı; numara ilgili birimin `unitCode` önekiyle başlamalı ve sıra numarası kaynak talepten büyük olmalı.

**Validates: Requirements 18.2, 18.3, 18.4, 18.5, 18.7**

---

### Property 18: Otomatik resolvedAt Doldurma

*For any* talep nesnesi, durum "Done" olarak değiştirildiğinde ve `resolvedAt` değeri `null` ise, `resolvedAt` otomatik olarak o anın zaman damgasıyla doldurulmalı ve `resolvedAt >= createdAt` koşulu her zaman sağlanmalıdır.

**Validates: Requirements 19.8**

---

### Property 19: timeSpent Negatif Olamaz

*For any* talep nesnesi, `timeSpent` alanı hiçbir zaman negatif bir değer içermemeli; değer `undefined`, `null` veya sıfır ya da pozitif bir sayı olmalıdır.

**Validates: Requirements 19.9**

---

### Property 20: Board Kart Tıklama Yönlendirme Tutarlılığı

*For any* issue kartı, karta tıklandığında açılan modal tipi `isRequest` alanıyla tutarlı olmalıdır: `isRequest === true` ise `RequestDetailModal` açılmalı; `isRequest === false` ise `IssueModal` açılmalıdır.

**Validates: Requirements 16.1, 16.2**

---

### Property 21: Seed Data Referans Bütünlüğü (Req 20)

*For any* proje seed data'sında, `managerId` alanı geçerli bir `Project_Manager` rolündeki kullanıcıya işaret etmeli; *for any* birim seed data'sında, `departmentHeadId` alanı geçerli bir `Department_Head` rolündeki kullanıcıya işaret etmeli; *for any* Worker kullanıcısı, `unitId` alanı geçerli bir birime işaret etmelidir.

**Validates: Requirements 20.3, 20.9, 20.10, 20.11**

---

### Property 22: Seed Data Her Proje İçin Talep Varlığı (Req 20)

*For any* proje seed data'sında, o projeye ait en az bir talep (`isRequest: true`) bulunmalıdır.

**Validates: Requirements 20.8**

---

### Property 23: Arama Filtresi Kapsayıcılığı (Req 21)

*For any* talep listesi ve herhangi bir arama terimi, filtrelenmiş sonuçlar yalnızca başlık, açıklama veya talep numarasında arama terimini içeren talepleri kapsamalıdır; eşleşmeyen hiçbir talep listede görünmemelidir.

**Validates: Requirements 21.2, 21.3**

---

### Property 24: Arama Büyük/Küçük Harf Duyarsızlığı (Req 21)

*For any* talep listesi ve herhangi bir arama terimi, `term.toUpperCase()` ile yapılan filtreleme sonucu `term.toLowerCase()` ile yapılan filtreleme sonucuyla özdeş olmalıdır.

**Validates: Requirements 21.4**

---

### Property 25: Boş Arama Tüm Talepleri Döndürür (Req 21)

*For any* talep listesi, boş string (`''`) ile yapılan filtreleme orijinal listeyi değiştirmeden döndürmelidir.

**Validates: Requirements 21.6**

---

### Property 26: Filtrelenmiş Sayı Tutarlılığı (Req 21)

*For any* talep listesi ve herhangi bir arama terimi, gösterilen talep sayısı (`"X talep bulundu"`) filtrelenmiş listenin gerçek uzunluğuyla eşleşmelidir.

**Validates: Requirements 21.7**

---


## Error Handling

### Form Doğrulama Hataları

| Durum | Hata Mesajı |
|---|---|
| Talep başlığı boş | "Talep başlığı zorunludur" |
| timeSpent negatif değer | "Harcanan zaman negatif olamaz" |
| Yorum metni boş | Gönderme butonu devre dışı |
| Issue başlığı boş | "Başlık zorunludur" |
| Birim kodu çakışması | "Bu birim kodu zaten kullanılıyor" |
| Arama sonucu boş | "Arama kriterlerine uygun talep bulunamadı" (Req 21.5) |

### Yetki Hataları

- **External_User atama değiştirme girişimi**: Atama alanı salt okunur olarak render edilir; dispatch çağrılmaz.
- **External_User resolvedAt/timeSpent güncelleme girişimi**: Alanlar salt okunur olarak render edilir; dispatch çağrılmaz.
- **Yetkisiz sayfa erişimi**: ProtectedRoute kullanıcıyı yetkili olduğu sayfaya yönlendirir.

### Reducer Hata Durumları

- `CLONE_REQUEST`: Kaynak talep bulunamazsa state değişmeden döner.
- `UPDATE_REQUEST_DATES`: `timeSpent < 0` ise action dispatch edilmez (bileşen seviyesinde engellenir).
- `MOVE_ISSUE`: Geçersiz status değeri STATUSES listesinde yoksa güncelleme yapılmaz.

---

## Testing Strategy

### Genel Yaklaşım

Bu uygulama saf fonksiyonlar (sprint tarih hesaplama, issue numaralandırma, erişim kontrolü filtreleri, durum geçişleri, klonlama mantığı, zaman formatlama) içerdiğinden **jest-fast-check** (fast-check + Jest entegrasyonu) ile property-based testing uygulanacaktır.

**İkili Test Yaklaşımı:**
- **Birim testleri**: Belirli örnekler, edge case'ler ve hata koşulları
- **Property testleri**: Tüm girdiler üzerinde evrensel özellikler (minimum 100 iterasyon)

### Property-Based Test Konfigürasyonu

```javascript
// Her property testi için minimum 100 iterasyon
import { fc, test } from '@fast-check/jest';

// Tag formatı: Feature: jira-clone-frontend, Property N: <property_text>
test.prop([fc.record({ ... })])('Property N: ...', (input) => {
  // test body
});
```

### Test Kapsamı (Requirements 15-21)

| Property | Test Tipi | Kapsanan Gereksinim |
|---|---|---|
| Property 16: canChangeAssignee | Property (fast-check) | Req 17.1-17.4 |
| Property 17: CLONE_REQUEST bütünlüğü | Property (fast-check) | Req 18.2-18.7 |
| Property 18: Otomatik resolvedAt | Property (fast-check) | Req 19.8 |
| Property 19: timeSpent >= 0 | Property (fast-check) | Req 19.9 |
| Property 20: isRequest modal yönlendirme | Property (fast-check) | Req 16.1-16.2 |
| Property 21: Seed data referans bütünlüğü | Property (fast-check) | Req 20.3, 20.9-20.11 |
| Property 22: Her proje için talep varlığı | Property (fast-check) | Req 20.8 |
| Property 23: Arama filtresi kapsayıcılığı | Property (fast-check) | Req 21.2-21.3 |
| Property 24: Arama büyük/küçük harf duyarsızlığı | Property (fast-check) | Req 21.4 |
| Property 25: Boş arama tüm talepleri döndürür | Property (fast-check) | Req 21.6 |
| Property 26: Filtrelenmiş sayı tutarlılığı | Property (fast-check) | Req 21.7 |
| RequestDetailModal render | Birim testi (örnek) | Req 15.2, 15.3 |
| Klonla butonu görünürlüğü | Birim testi (örnek) | Req 18.1 |
| Escape ile modal kapatma | Birim testi (örnek) | Req 15.8 |
| formatTimeSpent fonksiyonu | Property (fast-check) | Req 19.4 |
| Seed data birim/proje sayısı | Birim testi (örnek) | Req 20.1, 20.2, 20.4-20.7 |
| Arama boş sonuç mesajı | Birim testi (edge case) | Req 21.5 |

### Birim Test Örnekleri

```javascript
// formatTimeSpent edge case'leri
test('formatTimeSpent(0) returns "—"', () => expect(formatTimeSpent(0)).toBe('—'));
test('formatTimeSpent(90) returns "1s 30dk"', () => expect(formatTimeSpent(90)).toBe('1s 30dk'));
test('formatTimeSpent(60) returns "1s"', () => expect(formatTimeSpent(60)).toBe('1s'));

// canChangeAssignee
test('External_User cannot change assignee', () => {
  const user = { role: 'External_User' };
  expect(canChangeAssignee(user, mockIssue, [])).toBe(false);
});
```

### Property Test Örnekleri

```javascript
// Property 17: Klonlama veri bütünlüğü
test.prop([fc.record({
  id: fc.uuid(),
  title: fc.string({ minLength: 1 }),
  status: fc.constantFrom('To Do', 'In Progress', 'Done'),
  resolvedAt: fc.option(fc.date().map(d => d.toISOString())),
  timeSpent: fc.nat(),
  unitCode: fc.string({ minLength: 2, maxLength: 6 }),
})])('CLONE_REQUEST produces valid clone', (source) => {
  const state = { issues: [source] };
  const newState = AppReducer(state, {
    type: ACTIONS.CLONE_REQUEST,
    payload: { sourceIssueId: source.id, newNumber: `${source.unitCode}-99`, newId: 'new-id', clonedAt: new Date().toISOString() }
  });
  const cloned = newState.issues.find(i => i.id === 'new-id');
  expect(cloned.title).toContain(source.title);
  expect(cloned.title).toContain('(Kopya)');
  expect(cloned.status).toBe('To Do');
  expect(cloned.resolvedAt).toBeNull();
  expect(cloned.timeSpent).toBe(0);
});
```

```javascript
// Property 23 & 24 & 25 & 26: Arama filtresi özellikleri
// filterRequests saf fonksiyonu (RequestList.jsx'ten çıkarılmış veya utils'e taşınmış)
function filterRequests(requests, searchQuery) {
  if (!searchQuery.trim()) return requests;
  const q = searchQuery.toLowerCase();
  return requests.filter(r =>
    r.title.toLowerCase().includes(q) ||
    (r.description || '').toLowerCase().includes(q) ||
    r.number.toLowerCase().includes(q)
  );
}

// Property 23: Arama filtresi kapsayıcılığı
test.prop([
  fc.array(fc.record({
    id: fc.uuid(),
    title: fc.string({ minLength: 1 }),
    description: fc.string(),
    number: fc.string({ minLength: 1 }),
  })),
  fc.string({ minLength: 1 }),
])('filtered results only contain matching requests', (requests, query) => {
  const filtered = filterRequests(requests, query);
  const q = query.toLowerCase();
  expect(filtered.every(r =>
    r.title.toLowerCase().includes(q) ||
    r.description.toLowerCase().includes(q) ||
    r.number.toLowerCase().includes(q)
  )).toBe(true);
  // No matching request is excluded
  const shouldMatch = requests.filter(r =>
    r.title.toLowerCase().includes(q) ||
    r.description.toLowerCase().includes(q) ||
    r.number.toLowerCase().includes(q)
  );
  expect(filtered.length).toBe(shouldMatch.length);
});

// Property 24: Büyük/küçük harf duyarsızlığı
test.prop([
  fc.array(fc.record({
    id: fc.uuid(),
    title: fc.string({ minLength: 1 }),
    description: fc.string(),
    number: fc.string({ minLength: 1 }),
  })),
  fc.string({ minLength: 1 }),
])('case-insensitive search produces identical results', (requests, query) => {
  const upper = filterRequests(requests, query.toUpperCase());
  const lower = filterRequests(requests, query.toLowerCase());
  expect(upper.map(r => r.id)).toEqual(lower.map(r => r.id));
});

// Property 25: Boş arama tüm talepleri döndürür
test.prop([
  fc.array(fc.record({
    id: fc.uuid(),
    title: fc.string({ minLength: 1 }),
    description: fc.string(),
    number: fc.string({ minLength: 1 }),
  })),
])('empty search query returns all requests', (requests) => {
  expect(filterRequests(requests, '')).toEqual(requests);
  expect(filterRequests(requests, '   ')).toEqual(requests);
});

// Property 21: Seed data referans bütünlüğü
import { seedUnits, seedUsers, seedProjects, seedIssues } from '../data/seedData';

test('every project managerId points to a Project_Manager', () => {
  seedProjects.forEach(project => {
    const manager = seedUsers.find(u => u.id === project.managerId);
    expect(manager).toBeDefined();
    expect(manager.role).toBe('Project_Manager');
  });
});

test('every unit departmentHeadId points to a Department_Head', () => {
  seedUnits.forEach(unit => {
    const head = seedUsers.find(u => u.id === unit.departmentHeadId);
    expect(head).toBeDefined();
    expect(head.role).toBe('Department_Head');
  });
});

test('every Worker unitId points to an existing unit', () => {
  const workers = seedUsers.filter(u => u.role === 'Worker');
  workers.forEach(worker => {
    const unit = seedUnits.find(u => u.id === worker.unitId);
    expect(unit).toBeDefined();
  });
});

// Property 22: Her proje için talep varlığı
test('every project has at least one request in seed data', () => {
  seedProjects.forEach(project => {
    const requests = seedIssues.filter(i => i.isRequest && i.projectId === project.id);
    expect(requests.length).toBeGreaterThanOrEqual(1);
  });
});
```

### Seed Data Yapısal Testler (Req 20)

```javascript
// Birim/proje/kullanıcı sayısı doğrulama (örnek tabanlı)
test('seed data has exactly 2 units', () => {
  expect(seedUnits.length).toBe(2);
  const codes = seedUnits.map(u => u.unitCode).sort();
  expect(codes).toEqual(['BIGD', 'ODB']);
});

test('seed data has exactly 4 projects (2 per unit)', () => {
  expect(seedProjects.length).toBe(4);
  seedUnits.forEach(unit => {
    const unitProjects = seedProjects.filter(p => p.unitId === unit.id);
    expect(unitProjects.length).toBe(2);
  });
});

test('seed data has exactly 1 System_Admin', () => {
  expect(seedUsers.filter(u => u.role === 'System_Admin').length).toBe(1);
});

test('seed data has exactly 1 External_User', () => {
  expect(seedUsers.filter(u => u.role === 'External_User').length).toBe(1);
});

test('each unit has exactly 1 Department_Head', () => {
  seedUnits.forEach(unit => {
    const heads = seedUsers.filter(u => u.role === 'Department_Head' && u.unitId === unit.id);
    expect(heads.length).toBe(1);
  });
});

test('each unit has exactly 8 Workers (4 per project)', () => {
  seedUnits.forEach(unit => {
    const workers = seedUsers.filter(u => u.role === 'Worker' && u.unitId === unit.id);
    expect(workers.length).toBe(8);
    const unitProjects = seedProjects.filter(p => p.unitId === unit.id);
    unitProjects.forEach(project => {
      const projectWorkers = workers.filter(w => w.projectId === project.id);
      expect(projectWorkers.length).toBe(4);
    });
  });
});
```
