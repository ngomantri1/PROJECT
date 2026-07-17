type CsvColumn<T> = {
  header: string;
  value: (row: T) => unknown;
};

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export function exportCsv<T>(filename: string, rows: T[], columns: CsvColumn<T>[]) {
  const header = columns.map((column) => csvCell(column.header)).join(',');
  const body = rows.map((row) => columns.map((column) => csvCell(column.value(row))).join(','));
  const csv = `\uFEFF${[header, ...body].join('\r\n')}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
