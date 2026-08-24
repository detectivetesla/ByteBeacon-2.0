import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { NetworkProvider } from '@bytebeacon/shared';
import { BundleItem } from '../../components/commerce/BundleSelector.js';
import {
  normalizeGhanaPhoneNumber,
  isValidGhanaPhoneNumber,
  matchBundleVolume,
  parseSpreadsheetFile,
  generateSpreadsheetTemplate,
} from '../spreadsheetParser.js';

const mockBundles: BundleItem[] = [
  {
    id: 'prod-mtn-1gb',
    sku: 'MTN-1GB',
    network: NetworkProvider.MTN,
    dataAmountMb: 1024,
    dataDisplay: '1 GB',
    pricePesewas: 600,
    priceDisplay: 'GH₵ 6.00',
    validityDays: 30,
    validityDisplay: 'Non-Expiry',
  },
  {
    id: 'prod-mtn-2.5gb',
    sku: 'MTN-2.5GB',
    network: NetworkProvider.MTN,
    dataAmountMb: 2560,
    dataDisplay: '2.5 GB',
    pricePesewas: 1500,
    priceDisplay: 'GH₵ 15.00',
    validityDays: 30,
    validityDisplay: 'Non-Expiry',
  },
  {
    id: 'prod-mtn-5gb',
    sku: 'MTN-5GB',
    network: NetworkProvider.MTN,
    dataAmountMb: 5120,
    dataDisplay: '5 GB',
    pricePesewas: 2800,
    priceDisplay: 'GH₵ 28.00',
    validityDays: 30,
    validityDisplay: 'Non-Expiry',
  },
  {
    id: 'prod-mtn-10gb',
    sku: 'MTN-10GB',
    network: NetworkProvider.MTN,
    dataAmountMb: 10240,
    dataDisplay: '10 GB',
    pricePesewas: 5500,
    priceDisplay: 'GH₵ 55.00',
    validityDays: 30,
    validityDisplay: 'Non-Expiry',
  },
];

describe('Spreadsheet Parser & Excel Validation', () => {
  describe('normalizeGhanaPhoneNumber', () => {
    it('normalizes 9-digit number from Excel truncation with leading 0', () => {
      expect(normalizeGhanaPhoneNumber(241234567)).toBe('0241234567');
      expect(normalizeGhanaPhoneNumber('551234567')).toBe('0551234567');
    });

    it('normalizes +233 and 233 numbers', () => {
      expect(normalizeGhanaPhoneNumber('+233241234567')).toBe('0241234567');
      expect(normalizeGhanaPhoneNumber('233551234567')).toBe('0551234567');
    });

    it('removes spaces and formatting characters', () => {
      expect(normalizeGhanaPhoneNumber('024-123-4567')).toBe('0241234567');
      expect(normalizeGhanaPhoneNumber('024 123 4567')).toBe('0241234567');
      expect(normalizeGhanaPhoneNumber('(024) 123 4567')).toBe('0241234567');
    });

    it('validates Ghana numbers accurately', () => {
      expect(isValidGhanaPhoneNumber('0241234567')).toBe(true);
      expect(isValidGhanaPhoneNumber('0551234567')).toBe(true);
      expect(isValidGhanaPhoneNumber('0201234567')).toBe(true);
      expect(isValidGhanaPhoneNumber('0123456789')).toBe(false);
      expect(isValidGhanaPhoneNumber('12345')).toBe(false);
    });
  });

  describe('matchBundleVolume', () => {
    it('matches exact strings like 5GB, 5 GB, 10GB', () => {
      const b5 = matchBundleVolume('5GB', mockBundles);
      expect(b5?.id).toBe('prod-mtn-5gb');

      const b10 = matchBundleVolume('10 GB', mockBundles);
      expect(b10?.id).toBe('prod-mtn-10gb');
    });

    it('matches numeric values e.g. 5, 2.5, 10', () => {
      const b5 = matchBundleVolume(5, mockBundles);
      expect(b5?.id).toBe('prod-mtn-5gb');

      const b25 = matchBundleVolume('2.5', mockBundles);
      expect(b25?.id).toBe('prod-mtn-2.5gb');
    });

    it('matches MB numeric values >= 100 e.g. 5120', () => {
      const b5 = matchBundleVolume(5120, mockBundles);
      expect(b5?.id).toBe('prod-mtn-5gb');
    });
  });

  describe('parseSpreadsheetFile with XLSX & CSV', () => {
    it('parses actual binary XLSX workbook buffer without corrupting data', async () => {
      const wb = XLSX.utils.book_new();
      const wsData = [
        ['Beneficiary Msisdn', 'Data (GB)'],
        ['0241234567', '5GB'],
        ['0559876543', '10GB'],
        ['241112222', '2.5'], // 9 digits numeric truncation from Excel
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, 'Orders');
      const arrayBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

      const result = await parseSpreadsheetFile(arrayBuffer, mockBundles);

      expect(result.error).toBeUndefined();
      expect(result.totalRows).toBe(3);
      expect(result.validRows).toBe(3);
      expect(result.invalidRows).toBe(0);
      expect(result.rows[0].phone).toBe('0241234567');
      expect(result.rows[0].bundleId).toBe('prod-mtn-5gb');
      expect(result.rows[1].phone).toBe('0559876543');
      expect(result.rows[1].bundleId).toBe('prod-mtn-10gb');
      expect(result.rows[2].phone).toBe('0241112222');
      expect(result.rows[2].bundleId).toBe('prod-mtn-2.5gb');
    });

    it('parses CSV data with headers and handles invalid numbers gracefully', async () => {
      const wb = XLSX.utils.book_new();
      const wsData = [
        ['Recipient', 'Volume'],
        ['0241234567', '5GB'],
        ['invalid-phone', '10GB'],
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
      const arrayBuffer = XLSX.write(wb, { bookType: 'csv', type: 'array' });

      const result = await parseSpreadsheetFile(arrayBuffer, mockBundles);

      expect(result.totalRows).toBe(2);
      expect(result.validRows).toBe(1);
      expect(result.invalidRows).toBe(1);
      expect(result.rows[0].isValid).toBe(true);
      expect(result.rows[1].isValid).toBe(false);
      expect(result.rows[1].error).toBe('Invalid Ghana mobile number');
    });
  });

  describe('generateSpreadsheetTemplate', () => {
    it('generates valid XLSX template', () => {
      const { blob, filename } = generateSpreadsheetTemplate('xlsx', 'full');
      expect(filename).toBe('bytebeacon_full_template.xlsx');
      expect(blob.size).toBeGreaterThan(0);
      expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    });

    it('generates valid CSV template', () => {
      const { blob, filename } = generateSpreadsheetTemplate('csv', 'simple');
      expect(filename).toBe('bytebeacon_simple_template.csv');
      expect(blob.size).toBeGreaterThan(0);
    });
  });
});
