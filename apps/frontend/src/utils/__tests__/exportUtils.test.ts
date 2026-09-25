import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as XLSX from 'xlsx';
import {
  escapeCsvField,
  downloadBlob,
  exportToCSV,
  exportToExcel,
  exportToJSON,
  downloadFileFromResponse,
} from '../exportUtils.js';

function readBlobAsText(blob: any): Promise<string> {
  if (typeof blob.text === 'function') return blob.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(blob);
  });
}

function readBlobAsArrayBuffer(blob: any): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(blob);
  });
}

describe('exportUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  describe('escapeCsvField', () => {
    it('should return empty string for null and undefined', () => {
      expect(escapeCsvField(null)).toBe('');
      expect(escapeCsvField(undefined)).toBe('');
    });

    it('should return numbers and booleans as strings without quotes', () => {
      expect(escapeCsvField(123)).toBe('123');
      expect(escapeCsvField(0)).toBe('0');
      expect(escapeCsvField(true)).toBe('true');
      expect(escapeCsvField(false)).toBe('false');
    });

    it('should return simple text without quotes', () => {
      expect(escapeCsvField('ByteBeacon')).toBe('ByteBeacon');
      expect(escapeCsvField('0244123456')).toBe('0244123456');
    });

    it('should quote text containing commas', () => {
      expect(escapeCsvField('Accra, Ghana')).toBe('"Accra, Ghana"');
    });

    it('should escape double quotes by doubling them and wrapping in quotes', () => {
      expect(escapeCsvField('Hello "World"')).toBe('"Hello ""World"""');
    });

    it('should quote text containing newlines or carriage returns', () => {
      expect(escapeCsvField('Line 1\nLine 2')).toBe('"Line 1\nLine 2"');
    });

    it('should handle currency symbols and unicode correctly', () => {
      expect(escapeCsvField('GH₵ 50.00')).toBe('GH₵ 50.00');
      expect(escapeCsvField('GH₵, 50.00')).toBe('"GH₵, 50.00"');
    });
  });

  describe('downloadBlob', () => {
    it('should create object URL and trigger anchor click', () => {
      const createObjectURLMock = vi.fn().mockReturnValue('blob:http://localhost/test-uuid');
      const revokeObjectURLMock = vi.fn();
      window.URL.createObjectURL = createObjectURLMock;
      window.URL.revokeObjectURL = revokeObjectURLMock;

      const appendChildSpy = vi.spyOn(document.body, 'appendChild');
      const removeChildSpy = vi.spyOn(document.body, 'removeChild');

      const blob = new Blob(['test content'], { type: 'text/plain' });
      downloadBlob(blob, 'test-file.txt');

      expect(createObjectURLMock).toHaveBeenCalledWith(blob);
      expect(appendChildSpy).toHaveBeenCalled();
      expect(removeChildSpy).toHaveBeenCalled();
    });
  });

  describe('exportToCSV', () => {
    it('should generate CSV with UTF-8 BOM, escaped values and correct filename', async () => {
      let downloadedBlob: any = null;

      window.URL.createObjectURL = vi.fn((blob: any) => {
        downloadedBlob = blob;
        return 'blob:mock-url';
      });
      window.URL.revokeObjectURL = vi.fn();

      exportToCSV({
        filename: 'orders.csv',
        headers: ['Order ID', 'Customer, Name', 'Amount (GHS)', 'Notes'],
        rows: [
          ['ORD-001', 'Kofi Mensah', 'GH₵ 25.00', 'Paid "instantly" via MoMo'],
          ['ORD-002', 'Ama, Serwaa', 15.5, 'Normal delivery'],
        ],
      });

      expect(downloadedBlob).toBeDefined();
      expect(downloadedBlob.type).toBe('text/csv;charset=utf-8;');

      const buffer = await readBlobAsArrayBuffer(downloadedBlob);
      const bytes = new Uint8Array(buffer);
      // UTF-8 BOM is 0xEF, 0xBB, 0xBF
      expect(bytes[0]).toBe(0xEF);
      expect(bytes[1]).toBe(0xBB);
      expect(bytes[2]).toBe(0xBF);

      const text = await readBlobAsText(downloadedBlob);
      expect(text).toContain('Order ID,"Customer, Name",Amount (GHS),Notes');
      expect(text).toContain('ORD-001,Kofi Mensah,GH₵ 25.00,"Paid ""instantly"" via MoMo"');
      expect(text).toContain('ORD-002,"Ama, Serwaa",15.5,Normal delivery');
    });

    it('should auto-append .csv if extension omitted in filename', () => {
      let downloadedName = '';
      const origCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        const el = origCreateElement(tag);
        if (tag === 'a') {
          vi.spyOn(el as HTMLAnchorElement, 'setAttribute').mockImplementation((name, val) => {
            if (name === 'download') downloadedName = val;
          });
        }
        return el;
      });

      exportToCSV({
        filename: 'my_export',
        headers: ['Col 1'],
        rows: [['Val 1']],
      });

      expect(downloadedName).toBe('my_export.csv');
    });
  });

  describe('exportToExcel', () => {
    it('should create valid .xlsx spreadsheet Blob using SheetJS', async () => {
      let downloadedBlob: any = null;
      let downloadedName = '';

      window.URL.createObjectURL = vi.fn((blob: any) => {
        downloadedBlob = blob;
        return 'blob:mock-url';
      });
      window.URL.revokeObjectURL = vi.fn();

      const origCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        const el = origCreateElement(tag);
        if (tag === 'a') {
          vi.spyOn(el as HTMLAnchorElement, 'setAttribute').mockImplementation((name, val) => {
            if (name === 'download') downloadedName = val;
          });
        }
        return el;
      });

      exportToExcel({
        filename: 'payouts.xlsx',
        sheetName: 'Weekly Settlements',
        headers: ['Ref ID', 'Agent Name', 'Amount (GHS)'],
        rows: [
          ['PAY-001', 'Agent Kofi', 500.0],
          ['PAY-002', 'Agent Ama', 750.5],
        ],
      });

      expect(downloadedName).toBe('payouts.xlsx');
      expect(downloadedBlob).toBeDefined();
      expect(downloadedBlob.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

      const arrayBuffer = await readBlobAsArrayBuffer(downloadedBlob);
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });

      expect(workbook.SheetNames).toContain('Weekly Settlements');
      const sheet = workbook.Sheets['Weekly Settlements'];
      const parsedJson = XLSX.utils.sheet_to_json<any>(sheet);

      expect(parsedJson).toHaveLength(2);
      expect(parsedJson[0]['Ref ID']).toBe('PAY-001');
      expect(parsedJson[0]['Agent Name']).toBe('Agent Kofi');
      expect(parsedJson[0]['Amount (GHS)']).toBe(500);
    });
  });

  describe('exportToJSON', () => {
    it('should format and export data as indented JSON', async () => {
      let downloadedBlob: any = null;
      let downloadedName = '';

      window.URL.createObjectURL = vi.fn((blob: any) => {
        downloadedBlob = blob;
        return 'blob:mock-url';
      });
      window.URL.revokeObjectURL = vi.fn();

      const origCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        const el = origCreateElement(tag);
        if (tag === 'a') {
          vi.spyOn(el as HTMLAnchorElement, 'setAttribute').mockImplementation((name, val) => {
            if (name === 'download') downloadedName = val;
          });
        }
        return el;
      });

      const sampleData = { total: 2, items: [{ id: 1 }, { id: 2 }] };
      exportToJSON({
        filename: 'orders.json',
        data: sampleData,
      });

      expect(downloadedName).toBe('orders.json');
      expect(downloadedBlob).toBeDefined();
      expect(downloadedBlob.type).toContain('application/json');

      const text = await readBlobAsText(downloadedBlob);
      expect(JSON.parse(text)).toEqual(sampleData);
      expect(text).toContain('  "total": 2');
    });
  });

  describe('downloadFileFromResponse', () => {
    it('should handle Blob response directly', () => {
      let downloadedBlob: any = null;
      window.URL.createObjectURL = vi.fn((blob: any) => {
        downloadedBlob = blob;
        return 'blob:mock-url';
      });

      const inputBlob = new Blob(['direct blob'], { type: 'text/csv' });
      downloadFileFromResponse(inputBlob, 'exported.csv', 'csv');

      expect(downloadedBlob).toBe(inputBlob);
    });

    it('should handle raw string and add UTF-8 BOM for CSV', async () => {
      let downloadedBlob: any = null;
      window.URL.createObjectURL = vi.fn((blob: any) => {
        downloadedBlob = blob;
        return 'blob:mock-url';
      });

      const csvString = 'ID,Name\n1,Kofi\n';
      downloadFileFromResponse(csvString, 'exported.csv', 'csv');

      expect(downloadedBlob).toBeDefined();
      const buffer = await readBlobAsArrayBuffer(downloadedBlob);
      const bytes = new Uint8Array(buffer);
      expect(bytes[0]).toBe(0xEF);
      expect(bytes[1]).toBe(0xBB);
      expect(bytes[2]).toBe(0xBF);

      const text = await readBlobAsText(downloadedBlob);
      expect(text).toContain('ID,Name');
    });

    it('should handle { rawText: string } syntax error fallback without [object Object]', async () => {
      let downloadedBlob: any = null;
      window.URL.createObjectURL = vi.fn((blob: any) => {
        downloadedBlob = blob;
        return 'blob:mock-url';
      });

      const rawTextObj = { rawText: 'Col1,Col2\nVal1,Val2' };
      downloadFileFromResponse(rawTextObj, 'exported.csv', 'csv');

      expect(downloadedBlob).toBeDefined();
      const buffer = await readBlobAsArrayBuffer(downloadedBlob);
      const bytes = new Uint8Array(buffer);
      expect(bytes[0]).toBe(0xEF);
      expect(bytes[1]).toBe(0xBB);
      expect(bytes[2]).toBe(0xBF);

      const text = await readBlobAsText(downloadedBlob);
      expect(text).not.toContain('[object Object]');
      expect(text).toContain('Col1,Col2');
    });

    it('should handle JSON envelope { success: true, data: ... } when format is json', async () => {
      let downloadedBlob: any = null;
      window.URL.createObjectURL = vi.fn((blob: any) => {
        downloadedBlob = blob;
        return 'blob:mock-url';
      });

      const jsonObj = { success: true, data: { items: [1, 2, 3] } };
      downloadFileFromResponse(jsonObj, 'exported.json', 'json');

      expect(downloadedBlob).toBeDefined();
      const text = await readBlobAsText(downloadedBlob);
      expect(text).not.toContain('[object Object]');
      const parsed = JSON.parse(text);
      expect(parsed.items).toEqual([1, 2, 3]);
    });
  });
});
