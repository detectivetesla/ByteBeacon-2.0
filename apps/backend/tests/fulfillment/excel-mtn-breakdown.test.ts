import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';
import * as xlsx from 'xlsx';
import { DataHouseClient } from '../../src/core/providers/datahouse/datahouse.client.js';
import { DataHouseMapper } from '../../src/core/providers/datahouse/datahouse.mapper.js';
import { DataHouseAdapter } from '../../src/core/providers/datahouse/datahouse.adapter.js';
import { NetworkProvider } from '@bytebeacon/shared';

describe('MTN DATA FILE 7.xlsx Exact Breakdown & DataHouse Precheck', () => {
  const excelFilePath = 'C:/Users/DELL LATITUDE/Downloads/MTN DATA FILE  7.xlsx';

  it('correctly reads MTN DATA FILE 7.xlsx and identifies carrier mismatch (Telecel) and 475 MTN numbers', () => {
    if (!fs.existsSync(excelFilePath)) {
      console.warn(`Excel file not found at ${excelFilePath}, skipping file read test.`);
      return;
    }

    const workbook = xlsx.readFile(excelFilePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawData: any[] = xlsx.utils.sheet_to_json(sheet);

    expect(rawData.length).toBe(476);

    const phones: string[] = [];
    for (const row of rawData) {
      const val = row['Phone Number'] || row['phone_number'] || row['phone'] || row['MSISDN'] || Object.values(row)[0];
      if (val !== undefined && val !== null) {
        phones.push(String(val).trim());
      }
    }

    expect(phones).toHaveLength(476);

    const telecelPrefixes = ['020', '050'];
    const mtnPrefixes = ['024', '025', '053', '054', '055', '059'];

    let telecelCount = 0;
    let mtnCount = 0;
    let telecelPhone = '';

    for (const p of phones) {
      let clean = p.replace(/\s+/g, '').replace(/[-+]/g, '');
      if (clean.startsWith('233')) clean = '0' + clean.slice(3);
      if (clean.length === 9) clean = '0' + clean;
      const prefix = clean.slice(0, 3);
      if (telecelPrefixes.includes(prefix)) {
        telecelCount++;
        telecelPhone = clean;
      } else if (mtnPrefixes.includes(prefix)) {
        mtnCount++;
      }
    }

    expect(mtnCount).toBe(475);
    expect(telecelCount).toBe(1);
    expect(telecelPhone).toBe('0204138408');
  });

  it('prevents DataHouseMapper from blindly marking 464 un-enumerated blocked numbers as placeable', () => {
    // 476 phone numbers: 282 placeable, 193 blocked
    const testPhones = Array.from({ length: 476 }, (_, i) => `024${String(1000000 + i).padStart(7, '0')}`);

    // DataHouse top-level reports 282 placeable and 193 blocked, but only lists 12 sample numbers in blockedFirstTime
    const sampleBlocked = testPhones.slice(0, 12);
    const simulatedDatahouseResponse = {
      status: 'success',
      count: 476,
      placeableCount: 282,
      blockedCount: 193,
      blockedFirstTime: sampleBlocked,
    };

    const mapped = DataHouseMapper.toDataHousePrecheckResult(simulatedDatahouseResponse, NetworkProvider.MTN, testPhones);

    // Previously, 476 - 12 = 464 were marked placeable!
    // With our fix, when blockedCount (193) > sampleBlocked.length (12), un-enumerated numbers are NOT blindly approved.
    const approvedCount = mapped.results.filter((r) => r.isKnown && r.orderable).length;
    expect(approvedCount).toBeLessThan(464);
    expect(approvedCount).toBe(0); // Safely unapproved until chunked resolution confirms placeability
  });

  it('DataHouseAdapter automatically resolves exact per-recipient gating via chunked public precheck when blockedFirstTime is truncated', async () => {
    // 476 phones: 282 placeable, 193 blocked, 1 Telecel
    const unapprovedPhones = Array.from({ length: 193 }, (_, i) => `054${String(1000000 + i).padStart(7, '0')}`);
    const approvedPhones = Array.from({ length: 282 }, (_, i) => `024${String(2000000 + i).padStart(7, '0')}`);
    const telecelPhone = '0204138408';
    const allPhones = [...unapprovedPhones, ...approvedPhones, telecelPhone];
    expect(allPhones).toHaveLength(476);

    const mockClient = new DataHouseClient({
      baseUrl: 'https://api.getmorepaylessdatahouse.net/api/v1',
      apiKey: 'test-api-key',
    });
    const adapter = new DataHouseAdapter(mockClient);

    // Mock client.precheckBeneficiaries: top-level precheck returns aggregate metrics with only 12 sample blocked numbers
    vi.spyOn(mockClient, 'precheckBeneficiaries').mockResolvedValue({
      status: 'success',
      count: allPhones.length,
      placeableCount: 282,
      blockedCount: 193,
      blockedFirstTime: unapprovedPhones.slice(0, 12),
    } as any);

    // Mock chunked public precheck to return exact results for each chunk of 10
    vi.spyOn(adapter as any, 'executeChunkedPublicPrecheck').mockImplementation(async (phones: string[]) => {
      const results = phones.map((p) => {
        const isApproved = approvedPhones.includes(p);
        const isTelecel = p === telecelPhone;
        return {
          phoneNumber: p,
          normalized: p,
          network: isTelecel ? NetworkProvider.TELECEL : NetworkProvider.MTN,
          isKnown: isApproved,
          orderable: isApproved,
          status: isApproved ? 'APPROVED' : isTelecel ? 'REJECTED' : 'UNAPPROVED',
        };
      });
      return {
        network: NetworkProvider.MTN,
        enforced: true,
        sandbox: false,
        results,
      };
    });

    const result = await adapter.precheckBeneficiaries({
      network: NetworkProvider.MTN,
      phoneNumbers: allPhones,
    });

    expect(result.results).toHaveLength(476);

    const approved = result.results.filter((r) => r.isKnown && r.orderable);
    const unapproved = result.results.filter((r) => !r.isKnown && r.status === 'UNAPPROVED');
    const rejected = result.results.filter((r) => r.status === 'REJECTED');

    expect(approved).toHaveLength(282);
    expect(unapproved).toHaveLength(193);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].phoneNumber).toBe('0204138408');
  });
});
