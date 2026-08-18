import { BadRequestError } from '../../core/errors/app-error.js';

export interface ValidatedBulkRow {
  rowNumber: number;
  phone: string;
  network?: string;
  dataAmountMb?: number;
  isValid: boolean;
  error?: string;
}

export interface BulkUploadValidationResult {
  totalRows: number;
  validRows: ValidatedBulkRow[];
  invalidRows: ValidatedBulkRow[];
  isExceededLimit: boolean;
}

/**
 * File Upload & Spreadsheet Security Guard for ByteBeacon 2.0.
 * Enforces:
 * - Max file size: 5 MB (5,242,880 bytes)
 * - Max rows: 1,000 rows
 * - Formula injection neutralization (=, +, -, @, \t, \r)
 * - Per-row error isolation
 */
export class FileSecurityService {
  public static readonly MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
  public static readonly MAX_ROW_LIMIT = 1000;

  /**
   * Neutralizes formula injection attack payloads by escaping formula prefix characters.
   * Targets: =, +, -, @, \t, \r, \n
   */
  public static sanitizeCell(value: unknown): string {
    if (value === null || value === undefined) return '';
    const str = String(value).trim();

    // Check if cell starts with dangerous spreadsheet formula triggers
    const formulaPrefixes = ['=', '+', '-', '@', '\t', '\r'];
    if (formulaPrefixes.some((prefix) => str.startsWith(prefix))) {
      // Neutralize by prepending a single apostrophe '
      return `'${str}`;
    }

    return str;
  }

  /**
   * Validates file buffer size and MIME type.
   */
  public static validateFileBuffer(buffer: Buffer, mimeType: string): void {
    if (!buffer || buffer.length === 0) {
      throw new BadRequestError('Uploaded file is empty.');
    }

    if (buffer.length > this.MAX_FILE_SIZE_BYTES) {
      throw new BadRequestError(
        `Uploaded file exceeds maximum limit of 5 MB (received ${(buffer.length / (1024 * 1024)).toFixed(2)} MB).`,
      );
    }

    const allowedMimeTypes = [
      'text/csv',
      'application/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
    ];

    if (!allowedMimeTypes.includes(mimeType.toLowerCase())) {
      throw new BadRequestError(`Unsupported file format: ${mimeType}. Allowed formats are CSV and XLSX.`);
    }
  }

  /**
   * Parses and sanitizes CSV text lines with per-row error isolation and max 1,000-row limit.
   */
  public static parseAndSanitizeCsv(csvContent: string): BulkUploadValidationResult {
    const lines = csvContent
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    // Remove header row if present
    const dataLines = lines[0]?.toLowerCase().includes('phone') ? lines.slice(1) : lines;

    if (dataLines.length > this.MAX_ROW_LIMIT) {
      throw new BadRequestError(
        `Spreadsheet exceeds maximum allowed limit of ${this.MAX_ROW_LIMIT} rows (received ${dataLines.length} rows).`,
      );
    }

    const validRows: ValidatedBulkRow[] = [];
    const invalidRows: ValidatedBulkRow[] = [];

    dataLines.forEach((line, idx) => {
      const rowNumber = idx + 1;
      const rawCols = line.split(',').map((col) => this.sanitizeCell(col));
      const rawPhone = rawCols[0]?.replace(/^'/, '').trim(); // read sanitized phone

      // Validate Ghana mobile number format (e.g. 024xxxxxxx, 050xxxxxxx)
      const phoneRegex = /^0(24|25|53|54|55|59|20|50|27|57|26)\d{7}$/;
      if (!rawPhone || !phoneRegex.test(rawPhone)) {
        invalidRows.push({
          rowNumber,
          phone: rawPhone || '',
          isValid: false,
          error: 'Invalid Ghana mobile subscriber number format',
        });
      } else {
        validRows.push({
          rowNumber,
          phone: rawPhone,
          network: rawCols[1]?.replace(/^'/, '').trim() || undefined,
          dataAmountMb: rawCols[2] ? Number(rawCols[2].replace(/^'/, '')) : undefined,
          isValid: true,
        });
      }
    });

    return {
      totalRows: dataLines.length,
      validRows,
      invalidRows,
      isExceededLimit: false,
    };
  }
}
