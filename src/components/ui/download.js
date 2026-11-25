export function csvCell(value) {
  if (value === undefined || value === null) return '';
  const text = Array.isArray(value) ? value.join('; ') : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows, columns) {
  const header = columns.map((column) => csvCell(column.label)).join(',');
  const lines = rows.map((row) => columns.map((column) => csvCell(column.value(row))).join(','));
  return [header, ...lines].join('\r\n');
}

export function downloadText(filename, text, type = 'text/plain') {
  const blob = new Blob([text], { type: `${type};charset=utf-8` });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

export function downloadRows(filename, rows, columns, format = 'csv') {
  if (format === 'json') {
    const data = rows.map((row) => Object.fromEntries(columns.map((column) => [column.key, column.value(row) ?? null])));
    downloadText(`${filename}.json`, JSON.stringify(data, null, 2), 'application/json');
    return;
  }
  downloadText(`${filename}.csv`, `﻿${toCsv(rows, columns)}`, 'text/csv');
}
