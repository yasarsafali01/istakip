/**
 * Export utilities for the requests list.
 * No external libraries — pure browser APIs.
 */

/**
 * Escapes a cell value for CSV: wraps in quotes if it contains comma, quote or newline.
 * @param {string|number|null|undefined} value
 * @returns {string}
 */
function csvCell(value) {
  const str = value == null ? '' : String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Converts an array of request objects to a CSV string.
 * @param {Array}  requests  - Filtered request list
 * @param {Array}  units     - All units (for unit name lookup)
 * @param {Array}  users     - All users (for assignee name lookup)
 * @returns {string}
 */
export function requestsToCsv(requests, units = [], users = []) {
  const headers = ['Numara', 'Başlık', 'Durum', 'Öncelik', 'Birim', 'Atanan Kişi', 'Oluşturulma Tarihi'];

  const rows = requests.map(r => {
    const unit = units.find(u => u.unitCode === r.unitCode);
    const assignee = users.find(u => u.id === r.assigneeId);
    const date = r.createdAt ? new Date(r.createdAt).toLocaleDateString('tr-TR') : '';
    return [
      r.number,
      r.title,
      r.status,
      r.priority,
      unit?.name ?? r.unitCode ?? '',
      assignee?.name ?? '',
      date,
    ].map(csvCell).join(',');
  });

  return [headers.map(csvCell).join(','), ...rows].join('\r\n');
}

/**
 * Triggers a CSV file download in the browser.
 * @param {string} csvContent
 * @param {string} [filename]
 */
export function downloadCsv(csvContent, filename = 'talepler.csv') {
  const bom = '\uFEFF'; // UTF-8 BOM — ensures Turkish chars display correctly in Excel
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Opens a print-friendly window with the requests rendered as an HTML table.
 * @param {Array}  requests
 * @param {Array}  units
 * @param {Array}  users
 */
export function printRequests(requests, units = [], users = []) {
  const rows = requests.map(r => {
    const unit = units.find(u => u.unitCode === r.unitCode);
    const assignee = users.find(u => u.id === r.assigneeId);
    const date = r.createdAt ? new Date(r.createdAt).toLocaleDateString('tr-TR') : '—';
    return `
      <tr>
        <td>${r.number ?? ''}</td>
        <td>${r.title ?? ''}</td>
        <td>${r.status ?? ''}</td>
        <td>${r.priority ?? ''}</td>
        <td>${unit?.name ?? r.unitCode ?? ''}</td>
        <td>${assignee?.name ?? '—'}</td>
        <td>${date}</td>
      </tr>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <title>Talepler</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 12px; margin: 24px; color: #212529; }
    h2 { margin-bottom: 12px; font-size: 16px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f1f3f5; text-align: left; padding: 6px 10px; border: 1px solid #dee2e6; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
    td { padding: 6px 10px; border: 1px solid #dee2e6; vertical-align: top; }
    tr:nth-child(even) td { background: #f8f9fa; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <h2>Talepler — ${new Date().toLocaleDateString('tr-TR')}</h2>
  <p style="color:#6c757d;font-size:11px;margin-bottom:12px;">${requests.length} talep listeleniyor</p>
  <table>
    <thead>
      <tr>
        <th>Numara</th><th>Başlık</th><th>Durum</th><th>Öncelik</th>
        <th>Birim</th><th>Atanan Kişi</th><th>Tarih</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=900,height=650');
  if (!win) return; // popup blocked
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}
