import * as XLSX from 'xlsx';
import { BundleItem } from '../components/commerce/BundleSelector.js';

export type RecipientRowStatus = 'APPROVED' | 'UNAPPROVED' | 'REJECTED';

export interface ParsedSpreadsheetRow {
  phone: string;
  network?: string;
  detectedNetwork?: 'MTN' | 'TELECEL' | 'AIRTELTIGO' | 'UNKNOWN';
  isCarrierMismatch?: boolean;
  isPorted?: boolean;
  bundleId: string;
  data: string;
  dataAmountMb?: number;
  pricePesewas: number;
  isValid: boolean;
  status: RecipientRowStatus;
  statusReason?: string;
  isKnown?: boolean;
  rawPhone?: string;
  rawVolume?: string;
  error?: string;
}

export interface SpreadsheetParseResult {
  rows: ParsedSpreadsheetRow[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
  approvedRows: number;
  unapprovedRows: number;
  rejectedRows: number;
  totalPesewas: number;
  error?: string;
}

/**
 * Normalizes a phone number to standard Ghana 10-digit format (e.g. 0241234567).
 * Handles numbers parsed from Excel cells (e.g. 241234567, 233241234567, 2.4123e8, etc.)
 */
export function normalizeGhanaPhoneNumber(input: string | number | undefined | null): string {
  if (input === undefined || input === null) return '';

  let str = String(input).trim();
  // Remove non-numeric characters except leading +
  str = str.replace(/[\s\-_()[\],]/g, '');

  // Handle scientific notation e.g. 2.41234567e+8 or similar
  if (/^[0-9.]+e\+[0-9]+$/i.test(str)) {
    const num = Number(str);
    if (!isNaN(num)) {
      str = Math.floor(num).toString();
    }
  }

  // Handle +233 or 233 country codes
  if (str.startsWith('+233')) {
    str = '0' + str.slice(4);
  } else if (str.startsWith('233') && str.length >= 11) {
    str = '0' + str.slice(3);
  }

  // If 9 digits starting with 2 or 5 (typical Ghana Excel numeric truncation of leading 0)
  if (str.length === 9 && /^[25]/.test(str)) {
    str = '0' + str;
  }

  return str;
}

export function isValidGhanaPhoneNumber(phone: string): boolean {
  return /^(0|\+?233)[25][0-9]{8}$/.test(phone);
}

/**
 * Detects Ghanaian telecom network from MSISDN prefix.
 */
export function detectGhanaNetwork(phone: string): 'MTN' | 'TELECEL' | 'AIRTELTIGO' | 'UNKNOWN' {
  const norm = normalizeGhanaPhoneNumber(phone);
  if (!norm || norm.length !== 10) return 'UNKNOWN';
  const prefix = norm.slice(0, 3);
  if (['024', '054', '055', '059', '025', '053'].includes(prefix)) return 'MTN';
  if (['020', '050'].includes(prefix)) return 'TELECEL';
  if (['027', '057', '026', '056'].includes(prefix)) return 'AIRTELTIGO';
  return 'UNKNOWN';
}

export const DEFAULT_FALLBACK_BUNDLES: BundleItem[] = [
  { id: 'fallback-mtn-1gb', sku: 'MTN-1GB', network: 'MTN' as any, dataAmountMb: 1024, dataDisplay: '1 GB', pricePesewas: 600, priceDisplay: 'GH₵ 6.00', validityDays: 30, validityDisplay: '30 Days' },
  { id: 'fallback-mtn-2gb', sku: 'MTN-2GB', network: 'MTN' as any, dataAmountMb: 2048, dataDisplay: '2 GB', pricePesewas: 1200, priceDisplay: 'GH₵ 12.00', validityDays: 30, validityDisplay: '30 Days' },
  { id: 'fallback-mtn-3gb', sku: 'MTN-3GB', network: 'MTN' as any, dataAmountMb: 3072, dataDisplay: '3 GB', pricePesewas: 1700, priceDisplay: 'GH₵ 17.00', validityDays: 30, validityDisplay: '30 Days' },
  { id: 'fallback-mtn-5gb', sku: 'MTN-5GB', network: 'MTN' as any, dataAmountMb: 5120, dataDisplay: '5 GB', pricePesewas: 2500, priceDisplay: 'GH₵ 25.00', validityDays: 30, validityDisplay: '30 Days', popular: true },
  { id: 'fallback-mtn-10gb', sku: 'MTN-10GB', network: 'MTN' as any, dataAmountMb: 10240, dataDisplay: '10 GB', pricePesewas: 4800, priceDisplay: 'GH₵ 48.00', validityDays: 30, validityDisplay: '30 Days' },
  { id: 'fallback-mtn-20gb', sku: 'MTN-20GB', network: 'MTN' as any, dataAmountMb: 20480, dataDisplay: '20 GB', pricePesewas: 9500, priceDisplay: 'GH₵ 95.00', validityDays: 30, validityDisplay: '30 Days' },
  { id: 'fallback-mtn-50gb', sku: 'MTN-50GB', network: 'MTN' as any, dataAmountMb: 51200, dataDisplay: '50 GB', pricePesewas: 23000, priceDisplay: 'GH₵ 230.00', validityDays: 30, validityDisplay: '30 Days' },
];

/**
 * Match a raw volume string/number against available catalog bundles.
 */
export function matchBundleVolume(
  rawVol: string | number | undefined | null,
  availableBundles: BundleItem[],
  preferredNetwork?: string,
): BundleItem | undefined {
  const effectiveBundles =
    availableBundles && availableBundles.length > 0
      ? availableBundles
      : DEFAULT_FALLBACK_BUNDLES;

  const fallbackBundle = preferredNetwork
    ? effectiveBundles.find((b) => b.network === preferredNetwork) || effectiveBundles[0]
    : effectiveBundles[0];

  if (rawVol === undefined || rawVol === null) return fallbackBundle;

  const volStr = String(rawVol).trim();
  if (!volStr) return fallbackBundle;

  const lower = volStr.toLowerCase().replace(/\s+/g, '');

  // 1. Direct match by display string (e.g. "5gb", "5 gb", "10gb")
  if (preferredNetwork) {
    const netDisplay = effectiveBundles.find(
      (b) => b.network === preferredNetwork && b.dataDisplay.toLowerCase().replace(/\s+/g, '') === lower,
    );
    if (netDisplay) return netDisplay;
  }
  const exactDisplay = effectiveBundles.find(
    (b) => b.dataDisplay.toLowerCase().replace(/\s+/g, '') === lower,
  );
  if (exactDisplay) return exactDisplay;

  // 2. Direct match by SKU or ID
  if (preferredNetwork) {
    const netSku = effectiveBundles.find(
      (b) => b.network === preferredNetwork && (b.sku.toLowerCase() === lower || b.id.toLowerCase() === lower),
    );
    if (netSku) return netSku;
  }
  const exactSkuOrId = effectiveBundles.find(
    (b) => b.sku.toLowerCase() === lower || b.id.toLowerCase() === lower,
  );
  if (exactSkuOrId) return exactSkuOrId;

  // 3. Parse numeric volume
  let numVal = parseFloat(lower.replace(/gb$/, '').replace(/mb$/, ''));
  if (!isNaN(numVal) && numVal > 0) {
    // If unit explicitly says 'mb' or value >= 100 (e.g. 1024, 2048, 5120), convert MB to GB
    if (lower.includes('mb') || numVal >= 100) {
      numVal = numVal / 1024;
    }

    // Find bundle with dataAmountMb / 1024 matching numVal (within small tolerance)
    if (preferredNetwork) {
      const netMatchedGb = effectiveBundles.find((b) => {
        if (b.network !== preferredNetwork) return false;
        const bGb = b.dataAmountMb / 1024;
        return Math.abs(bGb - numVal) < 0.05;
      });
      if (netMatchedGb) return netMatchedGb;
    }

    const matchedGb = effectiveBundles.find((b) => {
      const bGb = b.dataAmountMb / 1024;
      return Math.abs(bGb - numVal) < 0.05;
    });

    if (matchedGb) return matchedGb;

    // Custom linear per-GB bundle fallback
    const baseMb = Math.round(numVal * 1024);
    const estPrice = Math.round(numVal * 500); // Baseline wholesale 5 GHS per GB
    return {
      id: `custom-bundle-${numVal}gb`,
      sku: `CUSTOM-${numVal}GB`,
      network: (preferredNetwork || effectiveBundles[0]?.network || 'MTN') as any,
      dataAmountMb: baseMb,
      dataDisplay: `${numVal} GB`,
      pricePesewas: estPrice,
      priceDisplay: `GH₵ ${(estPrice / 100).toFixed(2)}`,
      validityDays: 30,
      validityDisplay: '30 Days',
    };
  }

  // Fallback to default/first bundle
  return fallbackBundle;
}

/**
 * Parses an Excel (.xlsx, .xls) or CSV file or ArrayBuffer into validated batch rows.
 */
export async function parseSpreadsheetFile(
  fileOrBuffer: File | Blob | ArrayBuffer,
  availableBundles: BundleItem[],
  selectedNetwork?: string,
): Promise<SpreadsheetParseResult> {
  let arrayBuffer: ArrayBuffer;

  if (fileOrBuffer instanceof ArrayBuffer) {
    arrayBuffer = fileOrBuffer;
  } else if (typeof fileOrBuffer.arrayBuffer === 'function') {
    try {
      arrayBuffer = await fileOrBuffer.arrayBuffer();
    } catch {
      arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = reject;
        reader.readAsArrayBuffer(fileOrBuffer);
      });
    }
  } else {
    arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = reject;
      reader.readAsArrayBuffer(fileOrBuffer);
    });
  }

  if (!arrayBuffer || arrayBuffer.byteLength === 0) {
    return {
      rows: [],
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      approvedRows: 0,
      unapprovedRows: 0,
      rejectedRows: 0,
      totalPesewas: 0,
      error: 'The uploaded file is empty.',
    };
  }

  let workbook: XLSX.WorkBook;
  try {
    const u8 = new Uint8Array(arrayBuffer);
    workbook = XLSX.read(u8, {
      type: 'array',
      raw: false, // Ensures values are parsed cleanly
    });
  } catch (err: any) {
    return {
      rows: [],
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      approvedRows: 0,
      unapprovedRows: 0,
      rejectedRows: 0,
      totalPesewas: 0,
      error: `Failed to parse spreadsheet: ${err?.message || 'Invalid file format.'}`,
    };
  }

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    return {
      rows: [],
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      approvedRows: 0,
      unapprovedRows: 0,
      rejectedRows: 0,
      totalPesewas: 0,
      error: 'Spreadsheet has no worksheets.',
    };
  }

  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) {
    return {
      rows: [],
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      approvedRows: 0,
      unapprovedRows: 0,
      rejectedRows: 0,
      totalPesewas: 0,
      error: 'Worksheet is unreadable.',
    };
  }

  // Convert worksheet to 2D array of rows
  const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: '',
    blankrows: false,
  });

  if (!rawRows || rawRows.length === 0) {
    return {
      rows: [],
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      approvedRows: 0,
      unapprovedRows: 0,
      rejectedRows: 0,
      totalPesewas: 0,
      error: 'No data found in spreadsheet.',
    };
  }

  // Detect header row and column mappings
  let phoneColIdx = 0;
  let volumeColIdx = 1;
  let networkColIdx = -1;
  let startDataRowIdx = 0;

  // Search first 5 rows for header row
  for (let r = 0; r < Math.min(rawRows.length, 5); r++) {
    const row = rawRows[r];
    if (!Array.isArray(row) || row.length === 0) continue;

    // First check if this row contains actual data values instead of headers
    const rowHasPhoneData = row.some((cell) => {
      const s = String(cell || '').trim();
      return isValidGhanaPhoneNumber(normalizeGhanaPhoneNumber(s));
    });

    if (rowHasPhoneData) {
      // Row contains an actual phone number, so it is a data row, not a header row
      startDataRowIdx = r;
      break;
    }

    let foundPhone = -1;
    let foundPhoneScore = 0;
    let foundVolume = -1;
    let foundVolumeScore = 0;
    let foundNetwork = -1;

    for (let c = 0; c < row.length; c++) {
      const rawCell = String(row[c] || '').trim();
      const cell = rawCell.toLowerCase();
      if (!cell) continue;

      // Disqualifiers for phone: Serial number, Row number, Account number, S/N, No., etc.
      const isDisqualifiedAsPhone =
        cell.includes('serial') ||
        cell.includes('s/n') ||
        cell === 'sn' ||
        cell.includes('row') ||
        cell.includes('item') ||
        cell.includes('no.') ||
        cell === 'no' ||
        cell.includes('index') ||
        cell.includes('account') ||
        cell.includes('order') ||
        cell.includes('reference') ||
        cell.includes('ref') ||
        cell.includes('invoice') ||
        cell.includes('id') ||
        cell.includes('transaction');

      // Phone column detection
      if (!isDisqualifiedAsPhone) {
        if (
          cell.includes('phone') ||
          cell.includes('msisdn') ||
          cell.includes('mobile') ||
          cell.includes('recipient') ||
          cell.includes('beneficiary')
        ) {
          if (foundPhoneScore < 10) {
            foundPhone = c;
            foundPhoneScore = 10;
          }
        } else if (cell.includes('contact')) {
          if (foundPhoneScore < 5) {
            foundPhone = c;
            foundPhoneScore = 5;
          }
        } else if ((cell === 'number' || cell === 'numbers') && foundPhoneScore < 2) {
          foundPhone = c;
          foundPhoneScore = 2;
        }
      }

      // Volume column detection: avoid matching pure numeric/data strings like "5GB", "10", "2.5"
      const isDataVolumeValue = /^\d+(\.\d+)?\s*(gb|mb)?$/i.test(cell);
      if (!isDataVolumeValue) {
        if (
          cell.includes('data') ||
          cell.includes('volume') ||
          cell.includes('bundle') ||
          cell.includes('capacity') ||
          cell.includes('package') ||
          cell.includes('size') ||
          cell === 'gb' ||
          cell === 'mb' ||
          cell.includes('(gb)') ||
          cell.includes('(mb)')
        ) {
          if (foundVolumeScore < 10) {
            foundVolume = c;
            foundVolumeScore = 10;
          }
        }
      }

      // Network column detection
      if (
        cell.includes('network') ||
        cell.includes('carrier') ||
        cell.includes('telco') ||
        cell.includes('provider') ||
        cell.includes('operator')
      ) {
        foundNetwork = c;
      }
    }

    if (foundPhoneScore >= 2 || foundVolumeScore >= 10) {
      if (foundPhone !== -1) phoneColIdx = foundPhone;
      if (foundVolume !== -1) volumeColIdx = foundVolume;
      if (foundNetwork !== -1) networkColIdx = foundNetwork;
      startDataRowIdx = r + 1;
      break;
    }
  }

  // If no header found, start from row 0
  const parsedRows: ParsedSpreadsheetRow[] = [];
  let totalPesewas = 0;

  for (let r = startDataRowIdx; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!Array.isArray(row) || row.length === 0) continue;

    // Extract raw cell values
    const rawPhone = row[phoneColIdx] !== undefined ? String(row[phoneColIdx]).trim() : '';
    const rawVol = row[volumeColIdx] !== undefined ? String(row[volumeColIdx]).trim() : '';
    const rawNet = networkColIdx !== -1 && row[networkColIdx] !== undefined ? String(row[networkColIdx]).trim() : '';

    // Ignore completely empty rows
    if (!rawPhone && !rawVol && !rawNet) continue;

    const normalizedPhone = normalizeGhanaPhoneNumber(rawPhone);
    const isValidPhone = isValidGhanaPhoneNumber(normalizedPhone);
    const detected = detectGhanaNetwork(normalizedPhone);
    let isCarrierMismatch = false;

    // Resolve network: from column or inferred from phone prefix or selectedNetwork
    let rowNetwork: string = rawNet.toUpperCase();
    if (
      !rowNetwork ||
      (!rowNetwork.includes('MTN') &&
        !rowNetwork.includes('TELECEL') &&
        !rowNetwork.includes('VODAFONE') &&
        !rowNetwork.includes('AIRTEL') &&
        !rowNetwork.includes('TIGO') &&
        rowNetwork !== 'AT')
    ) {
      if (selectedNetwork) {
        rowNetwork = selectedNetwork.toUpperCase();
        if (detected !== 'UNKNOWN' && detected !== rowNetwork) {
          isCarrierMismatch = true;
        }
      } else {
        rowNetwork = detected !== 'UNKNOWN' ? detected : 'MTN';
      }
    } else if (rowNetwork.includes('MTN')) {
      rowNetwork = 'MTN';
    } else if (rowNetwork.includes('TELECEL') || rowNetwork.includes('VODAFONE')) {
      rowNetwork = 'TELECEL';
    } else if (rowNetwork.includes('AIRTEL') || rowNetwork.includes('TIGO') || rowNetwork === 'AT') {
      rowNetwork = 'AIRTELTIGO';
    }

    if (selectedNetwork && rowNetwork !== selectedNetwork.toUpperCase()) {
      isCarrierMismatch = true;
    }

    const matched = matchBundleVolume(rawVol, availableBundles, rowNetwork);

    const isValid = isValidPhone && Boolean(matched?.id);
    const price = matched?.pricePesewas || 0;
    if (isValid && !isCarrierMismatch) {
      totalPesewas += price;
    }

    const errorMsg = !isValidPhone
      ? 'Invalid Ghana mobile number'
      : !matched?.id
      ? 'No matching data bundle'
      : isCarrierMismatch
      ? `Carrier mismatch: number appears to be on ${detected || rowNetwork} rather than ${selectedNetwork || 'target network'}`
      : undefined;

    // MTN numbers require live verification; other carriers fulfill directly.
    // Carrier mismatches must be marked REJECTED until confirmed as ported.
    const isMtn = (selectedNetwork ? selectedNetwork.toUpperCase() : rowNetwork) === 'MTN';
    let status: RecipientRowStatus = 'REJECTED';
    let statusReason = errorMsg;

    if (isValid) {
      if (isCarrierMismatch) {
        status = 'REJECTED';
        statusReason = `Appears to be on ${detected} rather than ${selectedNetwork || rowNetwork}. Tick if ported.`;
      } else if (isMtn) {
        status = 'UNAPPROVED';
        statusReason = 'Pending MTN Up2U precheck';
      } else {
        status = 'APPROVED';
        statusReason = 'Direct carrier fulfillment';
      }
    }

    parsedRows.push({
      phone: normalizedPhone || rawPhone,
      network: rowNetwork,
      detectedNetwork: detected,
      isCarrierMismatch,
      bundleId: matched?.id || '',
      data: matched?.dataDisplay || String(rawVol),
      dataAmountMb: matched?.dataAmountMb,
      pricePesewas: price,
      isValid: isValid,
      status,
      statusReason,
      isKnown: isValid && !isMtn,
      rawPhone,
      rawVolume: rawVol,
      error: errorMsg,
    });
  }

  const validRows = parsedRows.filter((r) => r.isValid).length;
  const invalidRows = parsedRows.length - validRows;
  const approvedRows = parsedRows.filter((r) => r.status === 'APPROVED').length;
  const unapprovedRows = parsedRows.filter((r) => r.status === 'UNAPPROVED').length;
  const rejectedRows = parsedRows.filter((r) => r.status === 'REJECTED').length;

  return {
    rows: parsedRows,
    totalRows: parsedRows.length,
    validRows,
    invalidRows,
    approvedRows,
    unapprovedRows,
    rejectedRows,
    totalPesewas,
  };
}

/**
 * Helper to generate downloadable XLSX or CSV file templates.
 */
export function generateSpreadsheetTemplate(
  format: 'xlsx' | 'csv',
  templateType: 'simple' | 'full' = 'full',
): { blob: Blob; filename: string } {
  const headers =
    templateType === 'full' ? ['Beneficiary Msisdn', 'Data (GB)'] : ['Recipient', 'Volume'];

  const sampleData = [
    ['0241234567', '5GB'],
    ['0551234567', '10GB'],
    ['0201234567', '2.5GB'],
  ];

  if (format === 'csv') {
    const csvContent = [headers.join(','), ...sampleData.map((row) => row.join(','))].join('\n') + '\n';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const filename = `bytebeacon_${templateType}_template.csv`;
    return { blob, filename };
  }

  // XLSX format
  const wb = XLSX.utils.book_new();
  const wsData = [headers, ...sampleData];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, 'Orders');
  const wbOut = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbOut], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const filename = `bytebeacon_${templateType}_template.xlsx`;
  return { blob, filename };
}

/**
 * Generates an exported CSV audit report of uploaded spreadsheet rows (approved vs rejected vs unapproved).
 */
export function generateSpreadsheetReport(
  rows: ParsedSpreadsheetRow[],
  filter?: RecipientRowStatus | 'ALL',
): { blob: Blob; filename: string } {
  const headers = ['Phone Number', 'Data Volume', 'Estimated Price (GH₵)', 'Status', 'Details / Reason'];

  const filteredRows =
    filter && filter !== 'ALL' ? rows.filter((r) => r.status === filter) : rows;

  const dataRows = filteredRows.map((r) => [
    `"${r.phone || r.rawPhone || ''}"`,
    `"${r.data || r.rawVolume || ''}"`,
    `"${(r.pricePesewas / 100).toFixed(2)}"`,
    `"${r.status}"`,
    `"${(r.statusReason || r.error || '').replace(/"/g, '""')}"`,
  ]);

  const csvContent = [headers.join(','), ...dataRows.map((cols) => cols.join(','))].join('\n') + '\n';
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const suffix = filter && filter !== 'ALL' ? `_${filter.toLowerCase()}` : '_report';
  const filename = `excel_validation${suffix}_${Date.now()}.csv`;

  return { blob, filename };
}

/**
 * Generates an exported XLSX file for set-aside numbers (e.g. unvalidated MTN numbers or non-ported carrier mismatch numbers).
 */
export function generateSetAsideSpreadsheet(
  rows: ParsedSpreadsheetRow[],
  filenamePrefix = 'set_aside_numbers',
): { blob: Blob; filename: string } {
  const headers = ['Beneficiary Msisdn', 'Data (GB)', 'Network', 'Reason'];
  const wsData = [
    headers,
    ...rows.map((r) => [
      r.phone || r.rawPhone || '',
      r.data || r.rawVolume || '',
      r.detectedNetwork || r.network || '',
      r.statusReason || (r.status === 'UNAPPROVED' ? 'Pending MTN Validation' : 'Set Aside'),
    ]),
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, 'SetAside');
  const wbOut = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbOut], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const filename = `${filenamePrefix}_${rows.length}.xlsx`;
  return { blob, filename };
}


