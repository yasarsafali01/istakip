# Tasks

## Task List

- [x] 1. ProjectForm'a hasInventory checkbox alanı ekle
  - [x] 1.1 `hasInventory` state değişkenini `false` varsayılanıyla ekle
  - [x] 1.2 Form submit handler'da `newProject` nesnesine `hasInventory` alanını dahil et
  - [x] 1.3 Description alanının altına Bootstrap form-switch checkbox UI'ı ekle

- [x] 2. InventoryPage bileşenini oluştur
  - [x] 2.1 `src/pages/InventoryPage.jsx` dosyasını oluştur
  - [x] 2.2 `useParams` ile `projectId` al, `useAppContext` ile projeyi bul
  - [x] 2.3 Proje bulunamazsa `<Navigate to="/dashboard" replace />` döndür
  - [x] 2.4 Proje başlığı (key badge + proje adı + "/ Stok Durumu") render et
  - [x] 2.5 Bootstrap card içinde TbPackage ikonu ve "Bu özellik yakında gelecek." mesajı göster

- [x] 3. App.js'e InventoryPage rotasını ekle
  - [x] 3.1 `InventoryPage`'i `React.lazy` ile lazy import et
  - [x] 3.2 `/projects/:projectId/inventory` rotasını mevcut proje rotalarıyla aynı `ProtectedRoute` yapısında ekle

- [x] 4. Sidebar'a koşullu Stok Takip menüsü ekle
  - [x] 4.1 `TbPackage` ikonunu `react-icons/tb`'den import et
  - [x] 4.2 Her proje bloğunda Backlog linkinin altına `project.hasInventory` koşuluyla "Stok Takip" başlığı ve "Stok Durumu" NavLink'i ekle
