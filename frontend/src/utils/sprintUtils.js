/**
 * Verilen yıl ve ay için ayın son iş gününü hesaplar.
 * Cumartesi (6) ve Pazar (0) günleri iş günü sayılmaz.
 */
function getLastWorkingDay(year, month) {
  // new Date(year, month, 0) → ayın son günü (month 1-indexed)
  let date = new Date(year, month, 0);
  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() - 1);
  }
  return date;
}

/**
 * Verilen yıl ve ay için sprint başlangıç/bitiş tarihlerini hesaplar.
 * Başlangıç: ayın 1'i
 * Bitiş: ayın son iş günü
 * @param {number} year
 * @param {number} month - 1-12 arası
 * @returns {{ startDate: Date, endDate: Date }}
 */
export function getMonthlySprintDates(year, month) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = getLastWorkingDay(year, month);
  return { startDate, endDate };
}

/**
 * Verilen tarihin o ayın son iş günü olup olmadığını kontrol eder.
 * @param {Date|string} date
 * @returns {boolean}
 */
export function isLastWorkingDay(date) {
  const d = new Date(date);
  const { endDate } = getMonthlySprintDates(d.getFullYear(), d.getMonth() + 1);
  return d.toDateString() === endDate.toDateString();
}

/**
 * Sprint için okunabilir ad üretir.
 * Örn: getSprintName(2025, 5) → "Mayıs 2025"
 * @param {number} year
 * @param {number} month - 1-12 arası
 * @returns {string}
 */
export function getSprintName(year, month) {
  const monthNames = [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
  ];
  return `${monthNames[month - 1]} ${year}`;
}

/**
 * Sprint'leri (aylık dönemleri) "şu an içinde bulunduğumuz ay" en başta olacak
 * şekilde sıralar: önce bugünün ay/yılına en yakın olan (0 fark = tam o ay),
 * eşit uzaklıkta geçmiş/gelecek varsa geçmiş önce gelir. Listede hangi ay/yıldaysak
 * o her zaman ilk sırada görünür; kalanlar da en yakından en uzağa doğru sıralanır.
 * @param {Array} sprints
 * @returns {Array} yeni, sıralanmış dizi (girdiyi değiştirmez)
 */
export function sortSprintsByCurrentMonth(sprints) {
  const now = new Date();
  const nowKey = now.getFullYear() * 12 + (now.getMonth() + 1);

  const keyOf = (s) => {
    const year = s.year ?? new Date(s.startDate).getFullYear();
    const month = s.month ?? new Date(s.startDate).getMonth() + 1;
    return year * 12 + month;
  };

  return [...sprints].sort((a, b) => {
    const diffA = keyOf(a) - nowKey;
    const diffB = keyOf(b) - nowKey;
    const distA = Math.abs(diffA);
    const distB = Math.abs(diffB);
    if (distA !== distB) return distA - distB;
    // Eşit uzaklıktaysa (örn. bir ay önce vs bir ay sonra) geçmiş önce gelir
    return diffA - diffB;
  });
}

/**
 * Mevcut ay ve yıl için varsayılan sprint verisi döner.
 * @returns {{ year: number, month: number, name: string, startDate: string, endDate: string }}
 */
export function getCurrentMonthSprintDefaults() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const { startDate, endDate } = getMonthlySprintDates(year, month);
  return {
    year,
    month,
    name: getSprintName(year, month),
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  };
}
