# Tasks: External User Requests UI Modernization

## Task List

- [x] 1. `highlightText` yardımcı fonksiyonunu oluştur
  - [x] 1.1 `src/utils/highlightUtils.js` dosyasını oluştur
  - [x] 1.2 `highlightText(text, query)` fonksiyonunu yaz: regex escape, büyük/küçük harf duyarsız eşleşme, `<mark>` ile sarma
  - [x] 1.3 Boş query durumunda düz string döndür

- [x] 2. `useRequestFilters` hook'unu oluştur
  - [x] 2.1 `src/hooks/useRequestFilters.js` dosyasını oluştur
  - [x] 2.2 `searchQuery` ve `debouncedQuery` state'lerini ekle (300ms debounce, useEffect + setTimeout)
  - [x] 2.3 `selectedUnitId` state'ini ekle
  - [x] 2.4 `getVisibleRequests` + rol bazlı filtreleme mantığını `RequestList`'ten taşı
  - [x] 2.5 `availableUnits` hesaplamasını ekle (görünür taleplerden türet, useMemo)
  - [x] 2.6 Birim filtresi ve arama filtresini sırayla uygula
  - [x] 2.7 `{ filteredRequests, searchQuery, setSearchQuery, debouncedQuery, selectedUnitId, setSelectedUnitId, availableUnits, resultCount }` döndür

- [x] 3. `ModernSearchBar` bileşenini oluştur
  - [x] 3.1 `src/components/request/ModernSearchBar.jsx` dosyasını oluştur
  - [x] 3.2 Bootstrap `form-floating` pattern ile floating label ekle
  - [x] 3.3 Sol tarafta `TbSearch` ikonu ekle (input-group veya absolute positioning)
  - [x] 3.4 Değer doluyken sağ tarafta `TbX` clear butonu göster
  - [x] 3.5 `"{resultCount} talep bulundu"` sonuç sayacını ekle
  - [x] 3.6 Erişilebilirlik: label `htmlFor`, buton `aria-label`

- [x] 4. `UnitFilter` bileşenini oluştur
  - [x] 4.1 `src/components/request/UnitFilter.jsx` dosyasını oluştur
  - [x] 4.2 "Tümü" pill butonu + her birim için pill buton render et
  - [x] 4.3 Seçili pill: `btn-primary`; seçisiz: `btn-outline-secondary`
  - [x] 4.4 `units.length <= 1` ise `null` döndür (tek birim veya birim yok)
  - [x] 4.5 Erişilebilirlik: `role="group"`, `aria-label="Birim filtresi"`

- [x] 5. `RequestCard` bileşenini modernize et
  - [x] 5.1 Sol kenara durum renk çubuğu ekle (4px border-left, `STATUS_COLORS[request.status]`)
  - [x] 5.2 `request.number`'ı badge/pill olarak göster
  - [x] 5.3 Başlık metninde `highlightText(request.title, searchQuery)` kullan
  - [x] 5.4 Hover efekti için CSS sınıfı ekle (`request-card` class, index.css'e stil ekle)
  - [x] 5.5 `searchQuery` prop'unu kabul et (varsayılan: boş string)

- [x] 6. `RequestList` bileşenini güncelle
  - [x] 6.1 Mevcut `searchQuery`, `setSearchQuery` state'lerini `useRequestFilters` hook'u ile değiştir
  - [x] 6.2 `ModernSearchBar` bileşenini entegre et
  - [x] 6.3 `UnitFilter` bileşenini entegre et (arama alanının üstüne)
  - [x] 6.4 `RequestCard`'a `searchQuery={debouncedQuery}` prop'unu geç
  - [x] 6.5 Boş durum mesajlarını güncelle (filtre aktif vs. hiç talep yok)
  - [x] 6.6 Mevcut "Dış kullanıcıya görünür yap" (TbEye) butonu ve modal korunduğunu doğrula

- [x] 7. CSS stillerini güncelle
  - [x] 7.1 `src/index.css`'e `.request-card` hover stili ekle (`translateY(-2px)`, shadow artışı, transition)
  - [x] 7.2 `<mark>` highlight stili ekle (sarı arka plan, border-radius)
