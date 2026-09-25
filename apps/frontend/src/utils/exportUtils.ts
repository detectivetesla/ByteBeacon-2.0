import * as XLSX from 'xlsx';

/**
 * Triggers a browser file download from a Blob with reliable DOM attachment
 * and delayed object URL cleanup to prevent aborted downloads.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  if (typeof window === 'undefined') return;

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();

  // Remove anchor immediately from DOM
  document.body.removeChild(link);

  // Delay revoking the object URL by 15 seconds to ensure asynchronous browser download managers
  // have fully streamed the blob payload.
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 15000);
}

/**
 * Escapes a single CSV field value according to RFC 4180.
 * Handles commas, quotes, newlines, and carriage returns.
 */
export function escapeCsvField(val: string | number | boolean | null | undefined): string {
  if (val === null || val === undefined) {
    return '';
  }
  const str = String(val);
  // If string contains quotes, commas, newlines, or carriage returns, wrap in quotes and escape internal quotes
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export interface ExportCsvOptions {
  filename: string;
  headers: string[];
  rows: (string | number | boolean | null | undefined)[][];
}

/**
 * Exports tabular data as a standard RFC 4180 CSV file with UTF-8 Byte Order Mark (BOM).
 * The UTF-8 BOM (\uFEFF) ensures Microsoft Excel, Apple Numbers, and Google Sheets
 * render currency symbols (e.g. GH₵) and timestamps correctly without character corruption.
 */
export function exportToCSV({ filename, headers, rows }: ExportCsvOptions): void {
  const headerLine = headers.map(escapeCsvField).join(',');
  const rowLines = rows.map((r) => r.map(escapeCsvField).join(','));
  const csvContent = '\uFEFF' + [headerLine, ...rowLines].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const finalFilename = filename.toLowerCase().endsWith('.csv') ? filename : `${filename}.csv`;
  downloadBlob(blob, finalFilename);
}

export interface ExportExcelOptions {
  filename: string;
  sheetName?: string;
  headers: string[];
  rows: (string | number | boolean | null | undefined)[][];
}

/**
 * Exports tabular data as an authentic Microsoft Excel binary spreadsheet (.xlsx) using SheetJS.
 * Automatically computes column widths for readable viewing.
 */
export function exportToExcel({
  filename,
  sheetName = 'Sheet1',
  headers,
  rows,
}: ExportExcelOptions): void {
  const wb = XLSX.utils.book_new();

  // Combine headers and rows
  const wsData = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Auto-fit column widths (with a minimum of 10 and padding)
  const colWidths = headers.map((h, colIdx) => {
    let maxLen = String(h || '').length;
    for (let r = 0; r < rows.length; r++) {
      const cellVal = rows[r]?.[colIdx];
      const len = cellVal !== null && cellVal !== undefined ? String(cellVal).length : 0;
      if (len > maxLen) {
        maxLen = len;
      }
    }
    return { wch: Math.min(Math.max(maxLen + 2, 10), 50) };
  });
  ws['!cols'] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31)); // Excel max sheet name length is 31

  const wbOut = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbOut], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const finalFilename = filename.toLowerCase().endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  downloadBlob(blob, finalFilename);
}

export interface ExportJsonOptions {
  filename: string;
  data: any;
}

/**
 * Exports data as a formatted JSON file.
 */
export function exportToJSON({ filename, data }: ExportJsonOptions): void {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
  const finalFilename = filename.toLowerCase().endsWith('.json') ? filename : `${filename}.json`;
  downloadBlob(blob, finalFilename);
}

/**
 * Unifies download handling from backend export endpoints or responses.
 * Intelligently extracts raw text, blobs, or JSON, resolving the [object Object] bug.
 */
export function downloadFileFromResponse(
  res: any,
  fallbackFilename: string,
  defaultFormat: 'csv' | 'json' | 'xlsx' = 'csv',
): void {
  if (!res) return;

  // 1. If res is already a Blob instance
  if (res instanceof Blob) {
    downloadBlob(res, fallbackFilename);
    return;
  }

  // 2. If res has a rawText wrapper (e.g. from HttpClient when parsing non-JSON)
  if (typeof res === 'object' && 'rawText' in res && typeof res.rawText === 'string') {
    const isJson = defaultFormat === 'json';
    const mime = isJson ? 'application/json;charset=utf-8;' : 'text/csv;charset=utf-8;';
    const content = isJson ? res.rawText : '\uFEFF' + res.rawText;
    const blob = new Blob([content], { type: mime });
    downloadBlob(blob, fallbackFilename);
    return;
  }

  // 3. If res is a raw string
  if (typeof res === 'string') {
    const isJson = defaultFormat === 'json';
    const mime = isJson ? 'application/json;charset=utf-8;' : 'text/csv;charset=utf-8;';
    const content = isJson ? res : '\uFEFF' + res;
    const blob = new Blob([content], { type: mime });
    downloadBlob(blob, fallbackFilename);
    return;
  }

  // 4. If res is an object or array (JSON format)
  if (typeof res === 'object') {
    const payload = 'data' in res && res.data !== undefined ? res.data : res;
    exportToJSON({ filename: fallbackFilename, data: payload });
  }
}
