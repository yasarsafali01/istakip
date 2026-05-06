# Gereksinimler Dokümanı

## Giriş

Bu doküman, bir görev (task/issue) "Done" statüsüne çekilirken açılacak modal, çözüm içeriği girişi ve teçhizat kullanımı takibi özelliğinin gereksinimlerini tanımlar. Özellik, projelerde yapılan işlerin dokümantasyonunu ve stok yönetimini iyileştirmeyi amaçlar.

## Sözlük

- **Sistem**: Task Done Modal özelliğini içeren React bileşenleri ve state yönetim katmanı
- **Kullanıcı**: Görev üzerinde çalışan ve durumunu değiştiren kişi (Worker, Project Manager, Department Head, System Admin)
- **Görev**: Issue/Task/Bug/Story/Epic/Request tiplerinden herhangi biri
- **Çözüm_İçeriği**: Görev tamamlandığında yapılan işin açıklaması veya çözüm notu
- **Teçhizat**: Projede kullanılan stok kalemleri (inventory items)
- **Modal**: Kullanıcı etkileşimi gerektiren açılır pencere bileşeni
- **Activity_Log**: Görev üzerinde yapılan değişikliklerin zaman damgalı kayıt listesi
- **IssueDetailContent**: Görev detay sayfasını render eden React bileşeni
- **RequestDetailContent**: Talep detay sayfasını render eden React bileşeni
- **AppReducer**: Uygulama state'ini yöneten reducer fonksiyonu

## Gereksinimler

### Gereksinim 1: Modal Açılması

**Kullanıcı Hikayesi:** Bir kullanıcı olarak, görev durumunu "Done"a çekerken bir modal görmek istiyorum, böylece yapılan işi dokümante edebilirim.

#### Kabul Kriterleri

1. WHEN bir Kullanıcı bir Görevin durumunu "Done"a değiştirmeye çalışır, THEN THE Sistem SHALL bir modal açar
2. THE Modal SHALL görev durumu "Done"a geçmeden önce açılır
3. THE Modal SHALL kullanıcı onaylayana kadar görev durumunu değiştirmez
4. THE Modal SHALL kullanıcı iptal ederse görev durumunu değiştirmez ve mevcut durumda kalır
5. WHEN Kullanıcı görev durumunu "Done" dışında bir duruma değiştirir, THEN THE Sistem SHALL modal açmaz

### Gereksinim 2: Çözüm İçeriği Girişi

**Kullanıcı Hikayesi:** Bir kullanıcı olarak, görev tamamlandığında çözüm notunu girmek istiyorum, böylece yapılan işin kaydı tutulur.

#### Kabul Kriterleri

1. THE Modal SHALL "Çözüm İçeriği" başlıklı bir metin alanı içerir
2. THE Çözüm_İçeriği alanı SHALL zorunlu alan olarak işaretlenir
3. WHEN Kullanıcı Çözüm_İçeriği alanını boş bırakır, THEN THE Sistem SHALL hata mesajı gösterir
4. WHEN Kullanıcı Çözüm_İçeriği alanını boş bırakır, THEN THE Sistem SHALL modal'ı kapatmaz ve görev durumunu değiştirmez
5. THE Çözüm_İçeriği alanı SHALL en az 10 karakter uzunluğunda metin kabul eder
6. THE Çözüm_İçeriği alanı SHALL en fazla 2000 karakter uzunluğunda metin kabul eder
7. WHEN Kullanıcı geçerli Çözüm_İçeriği girer ve onaylar, THEN THE Sistem SHALL bu içeriği Activity_Log'a ekler

### Gereksinim 3: Teçhizat Kullanımı Kontrolü

**Kullanıcı Hikayesi:** Bir kullanıcı olarak, görev tamamlandığında teçhizat kullanıp kullanmadığımı belirtmek istiyorum, böylece stok takibi yapılabilir.

#### Kabul Kriterleri

1. WHEN Görevin ait olduğu projenin `hasInventory` özelliği `true` ise, THEN THE Modal SHALL "Teçhizat kullandınız mı?" sorusunu gösterir
2. WHEN Görevin ait olduğu projenin `hasInventory` özelliği `false` ise, THEN THE Modal SHALL teçhizat kullanımı bölümünü göstermez
3. THE Teçhizat kullanımı sorusu SHALL "Evet" ve "Hayır" seçeneklerini içerir
4. THE Teçhizat kullanımı sorusu SHALL varsayılan olarak "Hayır" seçili gelir
5. WHEN Kullanıcı "Hayır" seçer, THEN THE Sistem SHALL teçhizat detay alanlarını göstermez
6. WHEN Kullanıcı "Evet" seçer, THEN THE Sistem SHALL teçhizat detay alanlarını gösterir

### Gereksinim 4: Teçhizat Detay Girişi

**Kullanıcı Hikayesi:** Bir kullanıcı olarak, kullandığım teçhizatın adını ve miktarını girmek istiyorum, böylece stok düşümü yapılabilir.

#### Kabul Kriterleri

1. WHEN Kullanıcı teçhizat kullanımı için "Evet" seçer, THEN THE Sistem SHALL "Teçhizat Adı" selectbox alanını gösterir
2. WHEN Kullanıcı teçhizat kullanımı için "Evet" seçer, THEN THE Sistem SHALL "Kullanılan Adet" number input alanını gösterir
3. THE Teçhizat Adı selectbox SHALL projenin stok listesinden teçhizat isimlerini gösterir
4. THE Teçhizat Adı alanı SHALL teçhizat kullanımı "Evet" seçildiğinde zorunlu alan olur
5. THE Kullanılan Adet alanı SHALL teçhizat kullanımı "Evet" seçildiğinde zorunlu alan olur
6. THE Kullanılan Adet alanı SHALL pozitif tam sayı değeri kabul eder
7. THE Kullanılan Adet alanı SHALL sıfır veya negatif değer kabul etmez
8. WHEN Kullanıcı teçhizat kullanımı "Evet" seçer ve gerekli alanları doldurmaz, THEN THE Sistem SHALL hata mesajı gösterir ve modal'ı kapatmaz

### Gereksinim 5: Modal Onaylama ve Görev Güncelleme

**Kullanıcı Hikayesi:** Bir kullanıcı olarak, modal'daki bilgileri onayladığımda görevin "Done" durumuna geçmesini istiyorum, böylece iş akışı tamamlanır.

#### Kabul Kriterleri

1. WHEN Kullanıcı tüm zorunlu alanları doldurur ve "Onayla" butonuna tıklar, THEN THE Sistem SHALL görev durumunu "Done"a değiştirir
2. WHEN Kullanıcı modal'ı onaylar, THEN THE Sistem SHALL Çözüm_İçeriği'ni Activity_Log'a "comment" tipi aktivite olarak ekler
3. WHEN Kullanıcı modal'ı onaylar, THEN THE Sistem SHALL görevin `resolvedAt` alanını mevcut zaman damgası ile günceller
4. WHEN Kullanıcı modal'ı onaylar, THEN THE Sistem SHALL modal'ı kapatır
5. WHEN Kullanıcı modal'ı onaylar, THEN THE Sistem SHALL görev detay sayfasını güncel bilgilerle yeniden render eder
6. WHEN Kullanıcı "İptal" butonuna tıklar, THEN THE Sistem SHALL modal'ı kapatır ve hiçbir değişiklik yapmaz

### Gereksinim 6: Stok Düşümü

**Kullanıcı Hikayesi:** Bir kullanıcı olarak, kullandığım teçhizat miktarının stoktan düşülmesini istiyorum, böylece stok takibi güncel kalır.

#### Kabul Kriterleri

1. WHEN Kullanıcı teçhizat kullanımı bilgilerini girer ve modal'ı onaylar, THEN THE Sistem SHALL seçilen teçhizatın stok miktarını kullanılan adet kadar azaltır
2. WHEN stok düşümü yapılır, THEN THE Sistem SHALL stok değişikliğini Activity_Log'a kaydeder
3. WHEN seçilen teçhizatın mevcut stok miktarı kullanılan adetten az ise, THEN THE Sistem SHALL uyarı mesajı gösterir
4. WHEN stok yetersiz uyarısı gösterilir, THEN THE Sistem SHALL kullanıcıya işleme devam etme veya iptal etme seçeneği sunar
5. WHEN Kullanıcı stok yetersiz uyarısına rağmen devam eder, THEN THE Sistem SHALL stok miktarını negatif değere düşürebilir

### Gereksinim 7: Modal Entegrasyonu

**Kullanıcı Hikayesi:** Bir geliştirici olarak, modal'ın mevcut görev detay bileşenlerine entegre edilmesini istiyorum, böylece kod tekrarı olmaz.

#### Kabul Kriterleri

1. THE Sistem SHALL modal bileşenini `IssueDetailContent` bileşenine entegre eder
2. THE Sistem SHALL modal bileşenini `RequestDetailContent` bileşenine entegre eder
3. WHEN durum değişikliği "Done"a yapılır, THEN THE Sistem SHALL mevcut `handleStatusChange` fonksiyonunu modal açacak şekilde günceller
4. THE Sistem SHALL modal bileşenini `src/components/common/` dizini altında yeniden kullanılabilir bileşen olarak oluşturur
5. THE Modal bileşeni SHALL `issue`, `onConfirm`, `onCancel` props'larını kabul eder

### Gereksinim 8: Seed Data Güncellemesi

**Kullanıcı Hikayesi:** Bir geliştirici olarak, test için örnek teçhizat verilerinin seed data'ya eklenmesini istiyorum, böylece özelliği test edebilirim.

#### Kabul Kriterleri

1. THE Sistem SHALL `seedData.js` dosyasına `seedInventory` array'i ekler
2. THE seedInventory SHALL en az 5 farklı teçhizat kalemi içerir
3. HER teçhizat kalemi SHALL `id`, `projectId`, `name`, `quantity`, `unit` alanlarını içerir
4. THE seedInventory SHALL `hasInventory: true` olan projeler için teçhizat kalemleri içerir
5. THE Sistem SHALL `seedProjects` array'indeki en az bir projenin `hasInventory` özelliğini `true` olarak ayarlar

### Gereksinim 9: State Yönetimi

**Kullanıcı Hikayesi:** Bir geliştirici olarak, teçhizat verilerinin global state'te yönetilmesini istiyorum, böylece uygulama genelinde erişilebilir olur.

#### Kabul Kriterleri

1. THE Sistem SHALL `AppContext` state'ine `inventory` array'i ekler
2. THE Sistem SHALL `constants/index.js` dosyasına `ACTIONS.UPDATE_INVENTORY` action type'ı ekler
3. THE Sistem SHALL `AppReducer.js` dosyasına `UPDATE_INVENTORY` action handler'ı ekler
4. WHEN `UPDATE_INVENTORY` action dispatch edilir, THEN THE AppReducer SHALL ilgili teçhizatın `quantity` değerini günceller
5. THE UPDATE_INVENTORY action SHALL `inventoryId` ve `quantityChange` parametrelerini kabul eder

### Gereksinim 10: Hata Yönetimi

**Kullanıcı Hikayesi:** Bir kullanıcı olarak, modal'da hata oluştuğunda anlaşılır mesajlar görmek istiyorum, böylece ne yapacağımı bilirim.

#### Kabul Kriterleri

1. WHEN zorunlu alan boş bırakılır, THEN THE Sistem SHALL ilgili alanın altında kırmızı hata mesajı gösterir
2. WHEN geçersiz sayı girilir, THEN THE Sistem SHALL "Lütfen geçerli bir sayı girin" mesajı gösterir
3. WHEN stok yetersiz ise, THEN THE Sistem SHALL "Stok miktarı yetersiz. Mevcut: X, Talep edilen: Y" formatında mesaj gösterir
4. THE Hata mesajları SHALL Türkçe dilinde olur
5. WHEN hata mesajı gösterilir, THEN THE Sistem SHALL ilgili form alanını kırmızı border ile vurgular
