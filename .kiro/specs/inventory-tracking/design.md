# Design Document

## Overview

Stok Takip Modülü, mevcut React + Bootstrap 5 uygulamasına minimum değişiklikle entegre edilir. Mevcut `AppContext/AppReducer` pattern'i, `ProtectedRoute` yapısı ve `react-icons/tb` ikon seti kullanılır. Yeni kütüphane eklenmez.

## Architecture

Değişiklikler dört katmanda gerçekleşir:

1. **Veri Katmanı**: `project` nesnesine `hasInventory: boolean` alanı eklenir.
2. **Form Katmanı**: `ProjectForm` bileşenine checkbox eklenir.
3. **Navigasyon Katmanı**: `Sidebar` bileşenine koşullu menü öğesi eklenir.
4. **Sayfa Katmanı**: Yeni `InventoryPage` bileşeni ve `App.js` rota tanımı eklenir.

## Components and Interfaces

### 1. ProjectForm (`src/components/project/ProjectForm.jsx`)

**Değişiklik**: `hasInventory` state değişkeni ve checkbox alanı eklenir.

```jsx
// Yeni state
const [hasInventory, setHasInventory] = useState(false);

// handleSubmit içinde newProject nesnesine eklenir
const newProject = {
  id: generateId(),
  name: name.trim(),
  unitId,
  managerId,
  description: description.trim(),
  hasInventory,          // <-- yeni alan
  createdAt: new Date().toISOString(),
};
```

**Checkbox UI** (Description alanının altına, Actions'ın üstüne eklenir):

```jsx
<div className="mb-4">
  <div className="form-check form-switch">
    <input
      className="form-check-input"
      type="checkbox"
      role="switch"
      id="proj-has-inventory"
      checked={hasInventory}
      onChange={e => setHasInventory(e.target.checked)}
    />
    <label className="form-check-label fw-semibold" htmlFor="proj-has-inventory">
      Stok Takip İsteniyor mu?
    </label>
    <div className="form-text">
      Etkinleştirilirse proje menüsünde "Stok Takip" bölümü görünür.
    </div>
  </div>
</div>
```

### 2. Sidebar (`src/components/common/Sidebar.jsx`)

**Değişiklik**: Her proje bloğuna `hasInventory` kontrolü eklenir. `TbPackage` ikonu import edilir.

```jsx
import { TbPackage } from 'react-icons/tb'; // yeni import

// Mevcut Backlog li öğesinin hemen altına eklenir:
{project.hasInventory && (
  <>
    {/* Stok Takip başlık ayırıcı */}
    <li>
      <div
        className="px-3 pt-2 pb-1"
        style={{
          fontSize: '0.68rem',
          fontWeight: 600,
          color: '#6B778C',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          userSelect: 'none',
        }}
      >
        Stok Takip
      </div>
    </li>
    {/* Stok Durumu linki */}
    <li>
      <NavLink
        to={`/projects/${project.id}/inventory`}
        className="sidebar-link d-flex align-items-center gap-2 px-3 py-2 rounded text-decoration-none"
        style={subLinkStyle}
        onClick={() => !isMd && setIsOpen(false)}
      >
        <TbPackage size={16} />
        Stok Durumu
      </NavLink>
    </li>
  </>
)}
```

### 3. InventoryPage (`src/pages/InventoryPage.jsx`)

Yeni sayfa bileşeni. Mevcut sayfa pattern'lerini (örn. `ProjectDetailPage`) takip eder.

```jsx
import React from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { TbPackage } from 'react-icons/tb';
import { useAppContext } from '../context/AppContext';

function InventoryPage() {
  const { projectId } = useParams();
  const { state } = useAppContext();

  const project = state.projects.find(p => p.id === projectId);

  if (!project) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div>
      {/* Başlık */}
      <div className="mb-4">
        <div className="d-flex align-items-center gap-2 mb-1">
          <span className="badge" style={{ backgroundColor: '#0052CC', color: '#fff', fontSize: '0.75rem' }}>
            {project.key}
          </span>
          <h4 className="fw-bold mb-0">{project.name}</h4>
          <span className="text-muted small">/ Stok Durumu</span>
        </div>
        {project.description && (
          <p className="text-muted small mb-0">{project.description}</p>
        )}
      </div>

      {/* İçerik kartı */}
      <div className="card border-0 shadow-sm">
        <div className="card-body text-center py-5">
          <TbPackage size={48} className="text-primary mb-3 opacity-75" />
          <h5 className="fw-semibold mb-2">Stok Durumu</h5>
          <p className="text-muted mb-0">Bu özellik yakında gelecek.</p>
        </div>
      </div>
    </div>
  );
}

export default InventoryPage;
```

### 4. App.js (`src/App.js`)

**Değişiklik**: `InventoryPage` lazy import ve yeni rota eklenir.

```jsx
const InventoryPage = lazy(() => import('./pages/InventoryPage'));

// Mevcut /projects/:projectId/backlog rotasının hemen altına:
<Route
  path="/projects/:projectId/inventory"
  element={
    <ProtectedRoute allowedRoles={[ROLES.SYSTEM_ADMIN, ROLES.DEPARTMENT_HEAD, ROLES.PROJECT_MANAGER, ROLES.WORKER]}>
      <InventoryPage />
    </ProtectedRoute>
  }
/>
```

## Data Models

### Project (güncellendi)

```typescript
interface Project {
  id: string;
  key: string;
  name: string;
  description: string;
  unitId: string;
  managerId: string;
  createdAt: string;
  hasInventory: boolean;  // YENİ — varsayılan: false
}
```

Mevcut seed projeleri `hasInventory` alanı içermez; bu durumda JavaScript'in falsy değerlendirmesi (`project.hasInventory === true` veya `!!project.hasInventory`) ile geriye dönük uyumluluk sağlanır.

## Error Handling

- `InventoryPage` içinde `project` bulunamazsa `<Navigate to="/dashboard" replace />` ile yönlendirme yapılır.
- `hasInventory` alanı olmayan eski proje nesneleri için Sidebar koşulu `project.hasInventory` (falsy check) ile güvenli şekilde çalışır.

## Correctness Properties

### P1 — hasInventory varsayılan değeri (Örnek test)
`ProjectForm` gönderildiğinde checkbox işaretlenmemişse oluşturulan proje nesnesinin `hasInventory` alanı `false` olmalıdır.

### P2 — Sidebar koşullu render (Örnek test)
`hasInventory: true` olan bir proje için Sidebar'da "Stok Durumu" bağlantısı render edilmeli; `hasInventory: false` veya alan yoksa render edilmemelidir.

### P3 — Rota erişim koruması (Örnek test)
Kimliği doğrulanmamış kullanıcı `/projects/x/inventory` adresine gittiğinde login sayfasına yönlendirilmelidir.

### P4 — Proje bulunamadı yönlendirmesi (Örnek test)
`InventoryPage` geçersiz `projectId` ile render edildiğinde dashboard'a yönlendirmelidir.
