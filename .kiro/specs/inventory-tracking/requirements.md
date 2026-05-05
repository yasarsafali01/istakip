# Requirements Document

## Introduction

Stok Takip Modülü, mevcut proje yönetim uygulamasına opsiyonel bir stok takip özelliği ekler. Birim başkanları (Department_Head) proje oluştururken stok takibini etkinleştirebilir. Etkinleştirildiğinde, ilgili projenin sidebar menüsünde "Stok Takip" bölümü görünür ve kullanıcılar `/projects/{projectId}/inventory` adresindeki Stok Durumu sayfasına erişebilir.

## Glossary

- **System**: Mevcut React tabanlı proje yönetim uygulaması
- **ProjectForm**: Yeni proje oluşturma formu bileşeni (`src/components/project/ProjectForm.jsx`)
- **Project**: `id`, `name`, `unitId`, `managerId`, `description`, `createdAt` alanlarını içeren proje nesnesi
- **hasInventory**: Proje nesnesine eklenecek boolean alan; stok takibinin etkin olup olmadığını belirtir
- **Department_Head**: Birim başkanı rolü; proje oluşturma yetkisine sahip kullanıcı
- **Sidebar**: Uygulamanın sol navigasyon paneli (`src/components/common/Sidebar.jsx`)
- **InventoryPage**: `/projects/{projectId}/inventory` rotasında gösterilecek Stok Durumu sayfası
- **AppReducer**: Uygulama durum yöneticisi (`src/context/AppReducer.js`)
- **AppContext**: Uygulama genelinde durum sağlayıcısı (`src/context/AppContext.jsx`)

## Requirements

### Requirement 1: Proje Oluşturma Formuna Stok Takip Seçeneği Ekleme

**User Story:** Birim başkanı olarak, proje oluştururken stok takibini etkinleştirmek istiyorum; böylece stok yönetimi gerektiren projeler için bu özelliği açabileyim.

#### Acceptance Criteria

1. THE ProjectForm SHALL "Stok Takip İsteniyor mu?" etiketli bir checkbox/toggle alanı içermelidir.
2. WHEN ProjectForm ilk yüklendiğinde, THE System SHALL `hasInventory` alanını `false` (varsayılan: kapalı) olarak başlatmalıdır.
3. WHEN kullanıcı checkbox'ı işaretlediğinde, THE ProjectForm SHALL `hasInventory` değerini `true` olarak güncellelidir.
4. WHEN kullanıcı checkbox'ın işaretini kaldırdığında, THE ProjectForm SHALL `hasInventory` değerini `false` olarak güncellelidir.
5. WHEN proje oluşturma formu başarıyla gönderildiğinde, THE System SHALL `hasInventory` alanını proje nesnesine dahil etmelidir.

### Requirement 2: Proje Modeline `hasInventory` Alanı Ekleme

**User Story:** Geliştirici olarak, proje nesnesinin stok takip durumunu taşımasını istiyorum; böylece bu bilgi uygulama genelinde kullanılabilsin.

#### Acceptance Criteria

1. WHEN yeni bir proje oluşturulduğunda, THE AppReducer SHALL `hasInventory` alanını proje nesnesine ekleyerek state'e kaydetmelidir.
2. THE System SHALL `hasInventory` alanını boolean tipinde saklamalıdır (`true` veya `false`).
3. WHEN `hasInventory` değeri belirtilmeden proje oluşturulduğunda, THE System SHALL `hasInventory` değerini `false` olarak varsayılan kabul etmelidir.

### Requirement 3: Sidebar'da Koşullu Stok Takip Menüsü

**User Story:** Proje üyesi olarak, stok takibi etkin olan projelerde sidebar'da "Stok Takip" menüsünü görmek istiyorum; böylece stok durumuna hızlıca erişebileyim.

#### Acceptance Criteria

1. WHEN bir projenin `hasInventory` değeri `true` ise, THE Sidebar SHALL o projenin menü bölümünde "Stok Takip" başlığı altında "Stok Durumu" bağlantısını göstermelidir.
2. WHEN bir projenin `hasInventory` değeri `false` veya tanımsız ise, THE Sidebar SHALL o proje için "Stok Takip" bölümünü gizlemelidir.
3. WHEN "Stok Durumu" bağlantısına tıklandığında, THE Sidebar SHALL kullanıcıyı `/projects/{projectId}/inventory` adresine yönlendirmelidir.
4. THE Sidebar SHALL "Stok Durumu" bağlantısı için `react-icons/tb` kütüphanesinden uygun bir ikon kullanmalıdır.
5. WHILE kullanıcı `/projects/{projectId}/inventory` sayfasındayken, THE Sidebar SHALL "Stok Durumu" bağlantısını aktif (vurgulu) olarak göstermelidir.

### Requirement 4: Stok Durumu Sayfası

**User Story:** Proje üyesi olarak, stok takibi etkin bir projenin stok durumunu görebileceğim bir sayfa istiyorum; böylece stok bilgilerine erişebileyim.

#### Acceptance Criteria

1. WHEN kullanıcı `/projects/{projectId}/inventory` adresine gittiğinde, THE InventoryPage SHALL "Stok Durumu" başlığını göstermelidir.
2. WHEN kullanıcı `/projects/{projectId}/inventory` adresine gittiğinde, THE InventoryPage SHALL ilgili projenin adını göstermelidir.
3. THE InventoryPage SHALL Bootstrap 5 bileşenleri kullanarak oluşturulmalıdır (Tailwind CSS kullanılmamalıdır).
4. WHEN proje bulunamadığında, THE InventoryPage SHALL kullanıcıyı dashboard sayfasına yönlendirmelidir.
5. THE System SHALL `/projects/:projectId/inventory` rotasını `App.js` içinde tanımlamalıdır.
6. THE System SHALL `/projects/:projectId/inventory` rotasını mevcut `ProtectedRoute` pattern'i ile korumalıdır.

### Requirement 5: Rota Tanımı

**User Story:** Geliştirici olarak, stok sayfasının mevcut routing yapısına uygun şekilde eklenmesini istiyorum; böylece uygulama tutarlı kalabilsin.

#### Acceptance Criteria

1. THE System SHALL `/projects/:projectId/inventory` rotasını `App.js` içindeki mevcut proje rotalarıyla aynı `ProtectedRoute` yapısında tanımlamalıdır.
2. THE System SHALL `InventoryPage` bileşenini `React.lazy` ile lazy-load etmelidir.
3. WHEN yetkisiz bir kullanıcı `/projects/:projectId/inventory` adresine erişmeye çalıştığında, THE ProtectedRoute SHALL kullanıcıyı login sayfasına yönlendirmelidir.
