import { describe, it, expect, vi } from 'vitest';
import { CatalogService } from '../src/core/commerce/catalog.service.js';
import { NetworkProvider } from '@bytebeacon/shared';
import type pg from 'pg';

describe('Catalog Pricing Isolation Suite', () => {
  const mockRow = {
    id: 'prod-mtn-1gb',
    sku: 'BB-MTN-1GB',
    network: NetworkProvider.MTN,
    name: 'MTN 1GB Data',
    data_amount_mb: 1024,
    validity_days: 30,
    validity_desc: '30 Days',
    base_price_pesewas: '600', // Retail GH₵ 6.00
    agent_price_pesewas: '380', // Wholesale GH₵ 3.80
    userCustomPricePesewas: null,
    agentCustomPricePesewas: '350', // Custom agent override GH₵ 3.50
    is_active: true,
    status: 'ACTIVE',
  };

  const createMockDb = () => {
    return {
      query: vi.fn().mockResolvedValue({
        rows: [mockRow],
      }),
    } as unknown as pg.Pool;
  };

  it('1. Public catalog query always returns base retail price and ignores agent wholesale & custom price', async () => {
    const mockDb = createMockDb();
    const service = new CatalogService(mockDb);

    const products = await service.listActiveProducts({
      network: NetworkProvider.MTN,
      channel: 'CUSTOMER',
      isPublic: true,
      role: 'agent',
      userId: 'usr-agent-123',
    });

    expect(products).toHaveLength(1);
    expect(products[0].basePricePesewas).toBe(600);
    expect(products[0].effectivePricePesewas).toBe(600); // Must be retail GH₵ 6.00!
  });

  it('2. Logged-in agent viewing CUSTOMER channel sees retail price, not wholesale reseller price', async () => {
    const mockDb = createMockDb();
    const service = new CatalogService(mockDb);

    const products = await service.listActiveProducts({
      network: NetworkProvider.MTN,
      channel: 'CUSTOMER',
      role: 'agent',
    });

    expect(products).toHaveLength(1);
    expect(products[0].effectivePricePesewas).toBe(600); // Must NOT be 380!
  });

  it('3. Agent viewing AGENT channel receives agent wholesale pricing', async () => {
    const mockDb = createMockDb();
    const service = new CatalogService(mockDb);

    const products = await service.listActiveProducts({
      network: NetworkProvider.MTN,
      channel: 'AGENT',
      role: 'agent',
    });

    expect(products).toHaveLength(1);
    // Custom price override for agent or default agentPricePesewas
    expect(products[0].effectivePricePesewas).toBe(350);
  });

  it('4. Public cache is isolated from agent queries', async () => {
    const mockDb = createMockDb();
    const service = new CatalogService(mockDb);

    // Fetch public
    const publicProducts = await service.listActiveProducts({
      network: NetworkProvider.MTN,
      channel: 'CUSTOMER',
      isPublic: true,
    });
    expect(publicProducts[0].effectivePricePesewas).toBe(600);

    // Fetch agent
    const agentProducts = await service.listActiveProducts({
      network: NetworkProvider.MTN,
      channel: 'AGENT',
      role: 'agent',
    });
    expect(agentProducts[0].effectivePricePesewas).toBe(350);

    // Subsequent public fetch must still return 600 from public cache, not poisoned by agent
    const publicProductsAgain = await service.listActiveProducts({
      network: NetworkProvider.MTN,
      channel: 'CUSTOMER',
      isPublic: true,
    });
    expect(publicProductsAgain[0].effectivePricePesewas).toBe(600);
  });
});
