import { describe, it, expect } from 'vitest';
import { FileSecurityService } from '../../src/infrastructure/security/file-security.service.js';
import { BadRequestError } from '../../src/core/errors/app-error.js';

describe('Phase 8.7: File Upload Security & Formula Injection Guard', () => {
  describe('Spreadsheet Formula Injection Neutralization', () => {
    it('should neutralize formula attack strings starting with =, +, -, @', () => {
      expect(FileSecurityService.sanitizeCell('=cmd|"/C calc"!A0')).toBe('\'=cmd|"/C calc"!A0');
      expect(FileSecurityService.sanitizeCell('+SUM(1,2)')).toBe('\'+SUM(1,2)');
      expect(FileSecurityService.sanitizeCell('-2+5')).toBe('\'-2+5');
      expect(FileSecurityService.sanitizeCell('@IMPORTDATA("http://malicious.com")')).toBe('\'@IMPORTDATA("http://malicious.com")');
    });

    it('should leave safe numbers and alphanumeric text unmodified', () => {
      expect(FileSecurityService.sanitizeCell('0241234567')).toBe('0241234567');
      expect(FileSecurityService.sanitizeCell('MTN')).toBe('MTN');
      expect(FileSecurityService.sanitizeCell('5120')).toBe('5120');
    });
  });

  describe('File Size & MIME Limits (5 MB Limit)', () => {
    it('should pass validation for 2 MB CSV file with valid MIME', () => {
      const validBuffer = Buffer.alloc(2 * 1024 * 1024); // 2 MB
      expect(() =>
        FileSecurityService.validateFileBuffer(validBuffer, 'text/csv'),
      ).not.toThrow();
    });

    it('should throw BadRequestError if file exceeds 5 MB limit', () => {
      const oversizedBuffer = Buffer.alloc(6 * 1024 * 1024); // 6 MB
      expect(() =>
        FileSecurityService.validateFileBuffer(oversizedBuffer, 'text/csv'),
      ).toThrow(BadRequestError);
    });

    it('should throw BadRequestError for unsupported executable / script formats', () => {
      const scriptBuffer = Buffer.from('console.log("hello");');
      expect(() =>
        FileSecurityService.validateFileBuffer(scriptBuffer, 'application/javascript'),
      ).toThrow(BadRequestError);
    });
  });

  describe('1,000 Row Limit & Per-Row Error Isolation', () => {
    it('should isolate invalid rows without rejecting valid rows in the same spreadsheet', () => {
      const csv = `phone,network,data_amount_mb
0244123567,MTN,1024
invalid_phone_number,MTN,2048
0501234999,TELECEL,5120
123,AIRTELTIGO,1024`;

      const result = FileSecurityService.parseAndSanitizeCsv(csv);
      expect(result.totalRows).toBe(4);
      expect(result.validRows).toHaveLength(2);
      expect(result.invalidRows).toHaveLength(2);

      expect(result.validRows[0].phone).toBe('0244123567');
      expect(result.validRows[1].phone).toBe('0501234999');

      expect(result.invalidRows[0].rowNumber).toBe(2);
      expect(result.invalidRows[1].rowNumber).toBe(4);
    });

    it('should throw BadRequestError if spreadsheet exceeds 1,000 rows', () => {
      const rows = ['phone,network,data_amount_mb'];
      for (let i = 0; i < 1005; i++) {
        rows.push(`024${String(1000000 + i).padStart(7, '0')},MTN,1024`);
      }
      const massiveCsv = rows.join('\n');

      expect(() => FileSecurityService.parseAndSanitizeCsv(massiveCsv)).toThrow(
        BadRequestError,
      );
    });
  });
});
