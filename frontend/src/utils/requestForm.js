import {
  TbForms, TbAlignLeft, TbNumbers, TbCalendar, TbSelect, TbCircleDot, TbCheckbox, TbSquareCheck, TbPaperclip,
} from 'react-icons/tb';

// Mirrors backend models.Question* — order here is the order in the "add question" menu.
export const QUESTION_TYPES = [
  { type: 'text',     label: 'Kısa metin',        Icon: TbForms,       hint: 'Tek satırlık yazı alanı' },
  { type: 'textarea', label: 'Uzun metin',        Icon: TbAlignLeft,   hint: 'Çok satırlı açıklama alanı' },
  { type: 'select',   label: 'Açılır liste',      Icon: TbSelect,      hint: 'Listeden tek seçim' },
  { type: 'radio',    label: 'Tek seçim',         Icon: TbCircleDot,   hint: 'Seçenek düğmeleri, tek cevap' },
  { type: 'checkbox', label: 'Çoklu seçim',       Icon: TbCheckbox,    hint: 'Onay kutuları, birden çok cevap' },
  { type: 'boolean',  label: 'Onay kutusu',       Icon: TbSquareCheck, hint: 'Tek kutu: evet / hayır, onay' },
  { type: 'number',   label: 'Sayı',              Icon: TbNumbers,     hint: 'Yalnızca sayı girilebilir' },
  { type: 'date',     label: 'Tarih',             Icon: TbCalendar,    hint: 'Takvimden tarih seçimi' },
  { type: 'file',     label: 'Dosya yükleme',     Icon: TbPaperclip,   hint: 'Belge, görsel vb. ek dosya' },
];

// Mirrors backend services.FileCategories (the server enforces the same lists).
export const FILE_CATEGORIES = [
  { key: 'image',   label: 'Görsel',     exts: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'] },
  { key: 'pdf',     label: 'PDF',        exts: ['.pdf'] },
  { key: 'office',  label: 'Office',     exts: ['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.odt', '.ods', '.odp'] },
  { key: 'text',    label: 'Metin/CSV',  exts: ['.txt', '.csv'] },
  { key: 'archive', label: 'Arşiv',      exts: ['.zip', '.rar', '.7z'] },
];
export const MAX_UPLOAD_MB = 10;

/** Extensions a file question accepts (empty accept list = every allowed category). */
export function acceptedExtensions(settings) {
  const keys = settings?.accept?.length ? settings.accept : FILE_CATEGORIES.map((c) => c.key);
  return FILE_CATEGORIES.filter((c) => keys.includes(c.key)).flatMap((c) => c.exts);
}

export function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export const QUESTION_TYPE_BY_KEY = Object.fromEntries(QUESTION_TYPES.map((t) => [t.type, t]));

// Share of a 12-column row (backend accepts exactly these). `parts` = how many
// such questions fit side by side.
export const QUESTION_WIDTHS = [
  { width: 12, label: 'Tam satır', short: 'Tam', parts: 1 },
  { width: 6,  label: 'Yarım (yan yana 2)', short: '1/2', parts: 2 },
  { width: 4,  label: 'Üçte bir (yan yana 3)', short: '1/3', parts: 3 },
  { width: 3,  label: 'Çeyrek (yan yana 4)', short: '1/4', parts: 4 },
];

export const isChoiceType = (type) => type === 'select' || type === 'radio' || type === 'checkbox';
// Types another question's visibility can depend on (single, comparable answer).
export const isConditionSource = (type) => type === 'select' || type === 'radio' || type === 'boolean';
export const hasPlaceholder = (type) => type === 'text' || type === 'textarea' || type === 'number';

// crypto.randomUUID only exists in secure contexts (https/localhost); the app
// is also opened over plain http on the LAN, so build a v4 UUID by hand.
export function uuidv4() {
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function newQuestion(type) {
  return {
    id: uuidv4(),
    type,
    label: '',
    helpText: '',
    placeholder: '',
    required: false,
    options: isChoiceType(type) ? ['Seçenek 1', 'Seçenek 2'] : [],
    showIf: null,
    // Short fields default to half width so a new form isn't one long column.
    width: ['textarea', 'checkbox', 'radio', 'boolean', 'file'].includes(type) ? 12 : 6,
    settings: type === 'file' ? { maxFiles: 1, accept: [] } : {},
  };
}

function isEmpty(value) {
  return value === undefined || value === null || value === '' || value === false
    || (Array.isArray(value) && value.length === 0);
}

function conditionValue(value) {
  if (typeof value === 'boolean') return String(value);
  return typeof value === 'string' ? value : null;
}

/**
 * Which questions are currently shown, evaluated top-down exactly like the
 * backend's services.BuildAnswers: a question is visible when it has no
 * condition, or its (visible) parent's answer equals the condition value.
 */
export function visibleQuestions(questions, answers) {
  const shown = new Set();
  const out = [];
  for (const q of questions) {
    if (q.showIf) {
      const parentId = q.showIf.questionId;
      if (!shown.has(parentId)) continue;
      // An unticked boolean has no stored answer but still means "false".
      const parent = questions.find((p) => p.id === parentId);
      const raw = answers[parentId] ?? (parent?.type === 'boolean' ? false : undefined);
      if (conditionValue(raw) !== q.showIf.value) continue;
    }
    shown.add(q.id);
    out.push(q);
  }
  return out;
}

/** Client-side check before submit; the backend validates the same rules again. */
export function validateAnswers(questions, answers) {
  const errors = {};
  for (const q of visibleQuestions(questions, answers)) {
    const v = answers[q.id];
    if (isEmpty(typeof v === 'string' ? v.trim() : v)) {
      if (q.required) errors[q.id] = q.type === 'boolean' ? 'Devam etmek için işaretlemelisiniz.' : 'Bu soru zorunludur.';
      continue;
    }
    if (q.type === 'number' && Number.isNaN(Number(String(v).replace(',', '.')))) {
      errors[q.id] = 'Lütfen bir sayı girin.';
    }
  }
  return errors;
}

/** Only answers to visible questions are sent, so hidden branches leave no trace. */
export function buildAnswersPayload(questions, answers) {
  const payload = {};
  for (const q of visibleQuestions(questions, answers)) {
    const v = answers[q.id];
    if (isEmpty(v)) continue;
    // File answers hold uploaded file objects; the server only needs their ids.
    payload[q.id] = q.type === 'file' ? v.map((f) => f.id) : v;
  }
  return payload;
}

export function formatAnswer(answer) {
  const { type, value } = answer;
  if (type === 'boolean') return value ? 'Evet' : 'Hayır';
  if (type === 'file') return (value || []).map((f) => f.name).join(', ');
  if (Array.isArray(value)) return value.join(', ');
  if (type === 'date' && typeof value === 'string') {
    const [y, m, d] = value.split('-');
    return d && m && y ? `${d}.${m}.${y}` : value;
  }
  return String(value ?? '');
}

/**
 * Builder-side checks, mirroring backend services.NormalizeQuestions so the
 * manager sees problems next to the offending question before saving.
 */
export function validateForm(questions) {
  const errors = {};
  const before = new Map();
  for (const q of questions) {
    const msgs = [];
    if (!q.label.trim()) msgs.push('Soru metni boş olamaz.');
    if (isChoiceType(q.type) && !q.options.some((o) => o.trim())) msgs.push('En az bir seçenek ekleyin.');
    if (isChoiceType(q.type)) {
      const trimmed = q.options.map((o) => o.trim()).filter(Boolean);
      if (new Set(trimmed).size !== trimmed.length) msgs.push('Aynı seçenek birden fazla kez yazılmış.');
    }
    if (q.showIf) {
      const parent = before.get(q.showIf.questionId);
      if (!parent) msgs.push('Koşul, bu sorudan önce gelen bir soruya bağlı olmalı.');
      else if (parent.type !== 'boolean' && !parent.options.map((o) => o.trim()).includes(q.showIf.value)) {
        msgs.push('Koşul değeri artık bağlı sorunun seçenekleri arasında yok.');
      }
    }
    if (msgs.length) errors[q.id] = msgs;
    before.set(q.id, q);
  }
  return errors;
}
