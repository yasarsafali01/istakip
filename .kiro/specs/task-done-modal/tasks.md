# Uygulama Planı: Task Done Modal

## Genel Bakış

Bu plan, bir görev "Done" statüsüne çekildiğinde açılan modal bileşenini, çözüm notu girişini, teçhizat kullanım takibini ve stok düşümünü adım adım hayata geçirir. Her görev bir öncekinin üzerine inşa edilir ve tüm bileşenler son adımda birbirine bağlanır.

## Görevler

- [x] 1. Seed data ve state altyapısını hazırla
  - [x] 1.1 `seedData.js` dosyasına `seedInventory` array'ini ekle
    - En az 5 teçhizat kalemi ekle: `id`, `projectId`, `name`, `quantity`, `unit` alanlarıyla
    - `project-bigd-1` projesinin `hasInventory: true` olarak ayarlandığından emin ol (yoksa ekle)
    - _Gereksinimler: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [x] 1.2 `constants/index.js` dosyasına `UPDATE_INVENTORY` action type'ını ekle
    - `ACTIONS` objesine `UPDATE_INVENTORY: 'UPDATE_INVENTORY'` satırını ekle
    - _Gereksinimler: 9.2_

  - [x] 1.3 `AppReducer.js` dosyasına `UPDATE_INVENTORY` handler'ını ekle
    - `inventoryId` ve `quantityChange` parametrelerini kabul eden case ekle
    - İlgili item'ın `quantity` değerini `önceki + quantityChange` olarak güncelle
    - Diğer item'ları değiştirmeden bırak
    - _Gereksinimler: 9.3, 9.4, 9.5_

  - [ ]* 1.4 `UPDATE_INVENTORY` reducer için özellik testi yaz
    - **Özellik 14: UPDATE_INVENTORY Reducer Doğru Günceller**
    - **Doğrular: Gereksinimler 9.4, 9.5**
    - `fast-check` ile herhangi bir inventory listesi ve `quantityChange` için hedef item'ın `quantity` değerinin `önceki + quantityChange` olduğunu doğrula
    - Diğer item'ların değişmediğini doğrula
    - Test dosyası: `src/context/AppReducer.test.js`

  - [x] 1.5 `AppContext.jsx` dosyasına `inventory` state'ini ekle
    - `seedInventory`'yi import et ve başlangıç state'ine `inventory` array'i olarak ekle
    - _Gereksinimler: 9.1_

- [x] 2. Validasyon fonksiyonunu oluştur
  - [x] 2.1 `src/utils/taskDoneValidation.js` dosyasını oluştur
    - `validate(formState)` fonksiyonunu yaz: `resolutionNote`, `usedEquipment`, `selectedEquipmentId`, `quantity` parametrelerini alır
    - Çözüm notu: boş olamaz, min 10, max 2000 karakter kurallarını uygula
    - `usedEquipment: true` iken teçhizat adı ve adet zorunlu kurallarını uygula
    - Adet: pozitif tam sayı olmalı, sıfır veya negatif kabul edilmemeli
    - Tüm hata mesajları Türkçe olmalı (tasarım dokümanındaki hata mesajı tablosuna uygun)
    - _Gereksinimler: 2.3, 2.4, 2.5, 2.6, 4.4, 4.5, 4.6, 4.7, 4.8, 10.1, 10.2, 10.4_

  - [ ]* 2.2 Çözüm notu uzunluk validasyonu için özellik testi yaz
    - **Özellik 4: Çözüm Notu Uzunluk Validasyonu**
    - **Doğrular: Gereksinimler 2.3, 2.4, 2.5, 2.6**
    - 0–9 karakter uzunluğundaki string'ler için `validate` hata döndürmeli
    - 2001+ karakter uzunluğundaki string'ler için `validate` hata döndürmeli
    - 10–2000 karakter arasındaki string'ler için `validate` hata döndürmemeli
    - Test dosyası: `src/utils/taskDoneValidation.test.js`

  - [ ]* 2.3 Teçhizat alanları "Evet" seçildiğinde zorunluluk özellik testi yaz
    - **Özellik 9: Teçhizat Alanları "Evet" Seçildiğinde Zorunludur**
    - **Doğrular: Gereksinimler 4.4, 4.5, 4.7, 4.8**
    - `usedEquipment: true` iken `equipmentId` boş veya `quantity` ≤ 0 ise `validate` hata döndürmeli
    - Test dosyası: `src/utils/taskDoneValidation.test.js`

  - [ ]* 2.4 Kullanılan adet pozitif tam sayı özellik testi yaz
    - **Özellik 10: Kullanılan Adet Pozitif Tam Sayı Olmalıdır**
    - **Doğrular: Gereksinimler 4.6, 4.7**
    - Herhangi bir pozitif tam sayı için `validate` hata döndürmemeli
    - Sıfır veya negatif herhangi bir sayı için `validate` hata döndürmeli
    - Test dosyası: `src/utils/taskDoneValidation.test.js`

  - [ ]* 2.5 Stok yetersiz hata mesajı format özellik testi yaz
    - **Özellik 15: Stok Yetersiz Hata Mesajı Doğru Formatlanır**
    - **Doğrular: Gereksinim 10.3**
    - Herhangi bir (mevcut stok X, talep edilen Y) çifti için mesajın "Stok miktarı yetersiz. Mevcut: X, Talep edilen: Y" formatında olduğunu doğrula
    - Test dosyası: `src/utils/taskDoneValidation.test.js`

- [ ] 3. Kontrol noktası — Temel altyapı hazır
  - Tüm testlerin geçtiğinden emin ol, sorular varsa kullanıcıya sor.

- [x] 4. `TaskDoneModal` bileşenini oluştur
  - [x] 4.1 `src/components/common/TaskDoneModal.jsx` dosyasını oluştur
    - `isOpen`, `issue`, `onConfirm`, `onCancel` props'larını kabul eden bileşen yaz
    - İç state'leri tanımla: `resolutionNote`, `usedEquipment`, `selectedEquipmentId`, `quantity`, `errors`, `showStockWarning`
    - `AppContext`'ten `inventory` ve `dispatch`'i al
    - Projeye ait inventory item'larını filtrele (`item.projectId === issue.projectId`)
    - Mevcut `Modal` bileşenini (`src/components/common/Modal.jsx`) kullan
    - _Gereksinimler: 7.4, 7.5_

  - [x] 4.2 Modal form alanlarını render et
    - "Çözüm İçeriği" textarea'sını zorunlu alan olarak ekle (Bootstrap `is-invalid` desteğiyle)
    - `project.hasInventory === true` koşuluna göre teçhizat bölümünü koşullu render et
    - "Teçhizat kullandınız mı?" sorusunu "Evet"/"Hayır" radio butonlarıyla ekle (varsayılan: "Hayır")
    - `usedEquipment === true` koşuluna göre teçhizat adı selectbox'ını ve kullanılan adet input'unu koşullu render et
    - Teçhizat selectbox'ını proje inventory listesinden doldur
    - _Gereksinimler: 2.1, 2.2, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.1, 4.2, 4.3_

  - [x] 4.3 Hata gösterimini uygula
    - Her form alanının altında kırmızı hata mesajı göster
    - Hatalı alanlara Bootstrap `is-invalid` class'ı ekle
    - Kullanıcı alanı düzeltmeye başladığında ilgili hatayı temizle
    - _Gereksinimler: 10.1, 10.4, 10.5_

  - [x] 4.4 Stok yetersizliği uyarısını uygula
    - Seçilen teçhizatın `quantity` değeri girilen adetten az ise `showStockWarning` state'ini `true` yap
    - "Stok miktarı yetersiz. Mevcut: X, Talep edilen: Y" formatında uyarı mesajı göster
    - Kullanıcıya "Devam Et" ve "İptal" seçenekleri sun
    - _Gereksinimler: 6.3, 6.4, 6.5, 10.3_

  - [x] 4.5 "Onayla" butonunun onay akışını uygula
    - `validate` fonksiyonunu çağır; hata varsa state'e yaz ve dur
    - `usedEquipment: true` ise stok kontrolü yap; yetersizse uyarı göster
    - Validasyon ve stok kontrolü geçerse sırasıyla dispatch et:
      1. `MOVE_ISSUE` (status: "Done")
      2. `ADD_COMMENT` (çözüm notu, type: "comment")
      3. `ADD_ACTIVITY` (status_change)
      4. `UPDATE_REQUEST_DATES` (resolvedAt: yeni timestamp)
      5. `usedEquipment: true` ise `UPDATE_INVENTORY` (quantityChange: -quantity)
      6. `usedEquipment: true` ise `ADD_ACTIVITY` (stok düşümü)
    - `onConfirm()` callback'ini çağır
    - _Gereksinimler: 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2_

  - [x] 4.6 "İptal" butonunun iptal akışını uygula
    - `onCancel()` callback'ini çağır, hiçbir dispatch yapma
    - Modal kapandığında form state'ini sıfırla
    - _Gereksinimler: 1.3, 1.4, 5.6_

  - [ ]* 4.7 `hasInventory` teçhizat bölümü görünürlüğü için özellik testi yaz
    - **Özellik 6: hasInventory Teçhizat Bölümü Görünürlüğünü Belirler**
    - **Doğrular: Gereksinimler 3.1, 3.2**
    - `hasInventory: true` projeyle render edildiğinde teçhizat bölümünün göründüğünü doğrula
    - `hasInventory: false` projeyle render edildiğinde teçhizat bölümünün render edilmediğini doğrula
    - Test dosyası: `src/components/common/TaskDoneModal.test.js`

  - [ ]* 4.8 `usedEquipment` teçhizat detay alanları görünürlüğü için özellik testi yaz
    - **Özellik 7: usedEquipment Teçhizat Detay Alanlarını Kontrol Eder**
    - **Doğrular: Gereksinimler 3.5, 3.6, 4.1, 4.2**
    - `usedEquipment: true` iken teçhizat adı selectbox'ı ve adet input'unun render edildiğini doğrula
    - `usedEquipment: false` iken bu alanların render edilmediğini doğrula
    - Test dosyası: `src/components/common/TaskDoneModal.test.js`

  - [ ]* 4.9 Teçhizat selectbox proje stoğunu yansıtır özellik testi yaz
    - **Özellik 8: Teçhizat Selectbox Proje Stoğunu Yansıtır**
    - **Doğrular: Gereksinim 4.3**
    - Herhangi bir proje ve inventory listesi için selectbox seçeneklerinin tam olarak o projenin item isimlerini içerdiğini doğrula
    - Test dosyası: `src/components/common/TaskDoneModal.test.js`

  - [ ]* 4.10 Geçerli onaylama activity log'a eklenir özellik testi yaz
    - **Özellik 5: Geçerli Onaylama Activity Log'a Eklenir**
    - **Doğrular: Gereksinimler 2.7, 5.2**
    - Geçerli çözüm notu ile onaylandığında `onConfirm` callback'inin çağrıldığını doğrula
    - Test dosyası: `src/components/common/TaskDoneModal.test.js`

- [ ] 5. Kontrol noktası — Modal bileşeni hazır
  - Tüm testlerin geçtiğinden emin ol, sorular varsa kullanıcıya sor.

- [x] 6. `IssueDetailContent` entegrasyonu
  - [x] 6.1 `IssueDetailContent.jsx` dosyasına `showDoneModal` state'ini ekle
    - `const [showDoneModal, setShowDoneModal] = useState(false);` satırını ekle
    - _Gereksinimler: 7.1, 7.3_

  - [x] 6.2 `handleStatusChange` fonksiyonunu güncelle
    - `newStatus === 'Done'` ise `setShowDoneModal(true)` çağır ve erken dön
    - "Done" dışındaki geçişler mevcut davranışını korusun
    - _Gereksinimler: 1.1, 1.2, 1.5, 7.3_

  - [x] 6.3 `TaskDoneModal` bileşenini `IssueDetailContent`'e bağla
    - `TaskDoneModal`'ı import et
    - `isOpen={showDoneModal}`, `issue={issue}`, `onConfirm` ve `onCancel` props'larını geç
    - `onConfirm`: `setShowDoneModal(false)` çağır
    - `onCancel`: `setShowDoneModal(false)` çağır
    - _Gereksinimler: 7.1, 7.5_

  - [ ]* 6.4 `IssueDetailContent` entegrasyonu için özellik testi yaz
    - **Özellik 1: "Done" Dışı Durum Geçişleri Modal Açmaz**
    - **Doğrular: Gereksinim 1.5**
    - Herhangi bir "Done" dışı hedef durum için `handleStatusChange` çağrıldığında `showDoneModal`'ın `false` kaldığını doğrula
    - Test dosyası: `src/components/issue/IssueDetailContent.bugfix.test.js` veya yeni test dosyası

  - [ ]* 6.5 Modal onaylanmadan durum değişmez özellik testi yaz
    - **Özellik 2: Modal Onaylanmadan Durum Değişmez**
    - **Doğrular: Gereksinimler 1.2, 1.3**
    - `handleStatusChange("Done")` çağrıldıktan sonra modal onaylanmadan görevin `status` alanının "Done" olmadığını doğrula
    - Test dosyası: `src/components/issue/IssueDetailContent.bugfix.test.js` veya yeni test dosyası

  - [ ]* 6.6 İptal sonrası durum korunur özellik testi yaz
    - **Özellik 3: İptal Sonrası Durum Korunur**
    - **Doğrular: Gereksinimler 1.4, 5.6**
    - Modal iptal edildiğinde görevin `status` alanının orijinal değerinde kaldığını doğrula
    - Test dosyası: `src/components/issue/IssueDetailContent.bugfix.test.js` veya yeni test dosyası

- [x] 7. `RequestDetailContent` entegrasyonu
  - [x] 7.1 `RequestDetailContent.jsx` dosyasına `showDoneModal` state'ini ekle ve `handleStatusChange` fonksiyonunu güncelle
    - `IssueDetailContent` ile aynı pattern'i uygula
    - `newStatus === 'Done'` ise `setShowDoneModal(true)` çağır ve erken dön
    - _Gereksinimler: 7.2, 7.3_

  - [x] 7.2 `TaskDoneModal` bileşenini `RequestDetailContent`'e bağla
    - `IssueDetailContent` ile aynı props yapısını kullan
    - _Gereksinimler: 7.2, 7.5_

  - [ ]* 7.3 Geçerli onaylama görevi "Done"a taşır ve `resolvedAt`'ı günceller özellik testi yaz
    - **Özellik 11: Geçerli Onaylama Görevi "Done"a Taşır ve resolvedAt'ı Günceller**
    - **Doğrular: Gereksinimler 5.1, 5.3**
    - Geçerli form verisiyle onaylandığında `MOVE_ISSUE` payload'ında `newStatus: "Done"` ve `resolvedAt`'ın null olmadığını doğrula
    - Test dosyası: `src/components/common/TaskDoneModal.test.js`

  - [ ]* 7.4 Stok düşümü doğru hesaplanır özellik testi yaz
    - **Özellik 12: Stok Düşümü Doğru Hesaplanır**
    - **Doğrular: Gereksinim 6.1**
    - Herhangi bir inventory item ve kullanılan adet için `UPDATE_INVENTORY` action'ının `quantityChange` değerinin `-(kullanılan adet)` olduğunu doğrula
    - Test dosyası: `src/components/common/TaskDoneModal.test.js`

  - [ ]* 7.5 Stok yetersizliği uyarısı tetiklenir özellik testi yaz
    - **Özellik 13: Stok Yetersizliği Uyarısı Tetiklenir**
    - **Doğrular: Gereksinim 6.3**
    - `item.quantity < requestedQuantity` koşulu sağlandığında `showStockWarning` state'inin `true` olduğunu doğrula
    - Test dosyası: `src/components/common/TaskDoneModal.test.js`

- [ ] 8. Son kontrol noktası — Tüm entegrasyonlar tamamlandı
  - Tüm testlerin geçtiğinden emin ol, sorular varsa kullanıcıya sor.

## Notlar

- `*` ile işaretli görevler isteğe bağlıdır; daha hızlı MVP için atlanabilir
- Her görev izlenebilirlik için ilgili gereksinimlere referans verir
- Özellik tabanlı testler (PBT) için `fast-check` kütüphanesi kullanılır (`npm install --save-dev fast-check`)
- Kontrol noktaları artımlı doğrulama sağlar
- Tüm bileşenler mevcut proje yapısına ve Bootstrap stiline uygun yazılmalıdır
