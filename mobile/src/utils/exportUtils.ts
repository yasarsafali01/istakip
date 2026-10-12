import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { Issue, Project, Unit, User } from '../api/types';
import { PRIORITY_LABELS } from './constants';
import { formatDuration } from './durationUtils';

/* Same CSV as the web's exportUtils, handed to the share sheet instead of a download. */

function csvCell(value: unknown) {
  const str = value == null ? '' : String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function toCsv(headers: string[], rows: unknown[][]) {
  return [headers, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
}

export function requestsToCsv(requests: Issue[], projects: Project[], units: Unit[], users: User[]) {
  const unitOf = (r: Issue) => units.find((u) => u.id === projects.find((p) => p.id === r.projectId)?.unitId);
  return toCsv(
    ['Numara', 'Başlık', 'Durum', 'Öncelik', 'Daire Başkanlığı', 'Atanan Kişi', 'Oluşturulma Tarihi'],
    requests.map((r) => [
      r.key,
      r.title,
      r.status,
      PRIORITY_LABELS[r.priority] || r.priority,
      unitOf(r)?.name ?? '',
      users.find((u) => u.id === r.assigneeId)?.name ?? '',
      r.createdAt ? new Date(r.createdAt).toLocaleDateString('tr-TR') : '',
    ])
  );
}

const percent = (x?: number | null) => (x === null || x === undefined ? '—' : `%${Math.round(x * 100)}`);

/** The web report tables' CSV (DataTable statCols): one line per müdürlük / person / form / team. */
export function statRowsCsv(nameLabel: string, rows: any[], withUnit = false) {
  return toCsv(
    [nameLabel, ...(withUnit ? ['Daire Başkanlığı'] : []), 'Toplam', 'Açık', 'Onay Bek.', 'Tamamlanan', 'Geri Çevrilen',
      'Tamamlanma', 'Ort. Bekleme', 'Ort. Çözüm', 'Ort. Toplam', 'Memnuniyet'],
    [...rows].sort((a, b) => b.total - a.total).map((r) => [
      r.name, ...(withUnit ? [r.unit] : []), r.total, r.open, r.pendingApproval, r.done, r.rejected,
      percent(r.completionRate), formatDuration(r.avgWaiting), formatDuration(r.avgResolution), formatDuration(r.avgTotal),
      r.avgRating ? r.avgRating.toFixed(2) : '',
    ])
  );
}

/** İstatistikler → İndir: every record behind the current filters. */
export function recordsToCsv(issues: Issue[], projects: Project[], users: User[]) {
  const date = (d?: string | null) => (d ? new Date(d).toLocaleDateString('tr-TR') : '');
  return toCsv(
    ['Numara', 'Başlık', 'Tür', 'Talep Türü', 'Durum', 'Öncelik', 'Müdürlük', 'Atanan Kişi', 'Açılış', 'Çözülme', 'Memnuniyet'],
    issues.map((i) => [
      i.key, i.title, i.isRequest ? 'Talep' : 'İç iş', i.requestFormName || '', i.status, PRIORITY_LABELS[i.priority] || i.priority,
      projects.find((p) => p.id === i.projectId)?.name ?? '', users.find((u) => u.id === i.assigneeId)?.name ?? '',
      date(i.createdAt), date(i.resolvedAt), i.rating ?? '',
    ])
  );
}

/** Performansım / Personel Profili → İndir: the person's month-by-month numbers. */
export function personMonthlyCsv(monthly: any[]) {
  const h = (x: number) => x.toFixed(1).replace('.', ',');
  return toCsv(
    ['Ay', 'Çözülen', 'Çözüm süresi (sa)', 'Harcanan zaman (sa)', 'Ort. çözüm (sa)'],
    monthly.map((m) => [m.fullLabel || m.label, m.resolved, h(m.workHours), h(m.loggedHours), h(m.avgHours)])
  );
}

export async function shareCsv(csv: string, filename: string) {
  const file = new File(Paths.cache, filename);
  file.create({ overwrite: true });
  file.write('﻿' + csv); // BOM: Excel shows Turkish characters correctly
  await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text', dialogTitle: filename });
}
