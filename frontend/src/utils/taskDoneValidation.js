/**
 * Validates the TaskDoneModal form state.
 *
 * @param {Object} formState
 * @param {string}  formState.resolutionNote      - Çözüm notu metni
 * @param {boolean} formState.usedEquipment        - Teçhizat kullanıldı mı
 * @param {string}  formState.selectedEquipmentId  - Seçilen teçhizat ID'si
 * @param {string}  formState.quantity             - Kullanılan adet (string)
 *
 * @returns {Object} errors - Alan bazlı hata mesajları (boş obje = geçerli)
 */
export function validate({ resolutionNote = '', usedEquipment = false, selectedEquipmentId = '', quantity = '' } = {}) {
  const errors = {};

  // ── Çözüm Notu ──────────────────────────────────────────────────────────────
  const trimmedNote = resolutionNote.trim();

  if (!trimmedNote) {
    errors.resolutionNote = 'Çözüm içeriği zorunludur.';
  } else if (trimmedNote.length < 10) {
    errors.resolutionNote = 'Çözüm içeriği en az 10 karakter olmalıdır.';
  } else if (trimmedNote.length > 2000) {
    errors.resolutionNote = 'Çözüm içeriği en fazla 2000 karakter olabilir.';
  }

  // ── Teçhizat Alanları (yalnızca usedEquipment: true iken) ───────────────────
  if (usedEquipment) {
    if (!selectedEquipmentId) {
      errors.selectedEquipmentId = 'Lütfen bir teçhizat seçin.';
    }

    if (!quantity && quantity !== 0) {
      errors.quantity = 'Kullanılan adet zorunludur.';
    } else {
      const parsed = Number(quantity);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        errors.quantity = 'Lütfen geçerli bir sayı girin.';
      }
    }
  }

  return errors;
}

export default validate;
