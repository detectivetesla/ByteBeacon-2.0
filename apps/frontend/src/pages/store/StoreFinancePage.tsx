import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card/Card.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Badge } from '../../components/ui/Badge/Badge.js';
import { Download, Loader2, ArrowDownToLine, Calendar, DollarSign, History } from 'lucide-react';
import { useToast } from '../../context/ToastContext.js';
import { storesApi } from '../../api/stores.api.js';

export const StoreFinancePage: React.FC = () => {
  const navigate = useNavigate();
  const { toastSuccess, toastError } = useToast();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const loadFinance = async (isPolling = false) => {
      try {
        if (!isPolling) setLoading(true);
        const result = await storesApi.getStoreFinance({ page: 1, limit: 20 });
        if (mounted) setData(result);
      } catch (err: any) {
        if (mounted && !isPolling) {
          toastError('Failed to load', err.message || 'Unable to load finance data');
        }
      } finally {
        if (mounted && !isPolling) setLoading(false);
      }
    };

    loadFinance();
    const interval = setInterval(() => {
      loadFinance(true);
    }, 10000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [toastError]);

  const handleExportStatement = () => {
    if (!data?.transactions?.length) {
      toastError('No Data', 'No transaction settlements to export.');
      return;
    }
    const header = 'Reference,Type,Amount (GHS),Entry Type,Date\n';
    const rows = data.transactions
      .map(
        (tx: any) =>
          `"${tx.referenceId}","${tx.referenceType}",${(tx.amountPesewas / 100).toFixed(2)},${tx.entryType},"${new Date(tx.createdAt).toLocaleString()}"`,
      )
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `store_settlements_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toastSuccess('Statement Exported', 'Store settlements statement downloaded.');
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#10B981' }}>
            Store Treasury
          </span>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 900, color: 'var(--color-text-primary)', margin: '0.125rem 0 0 0', letterSpacing: '-0.02em' }}>
            Store Revenue & Settlements
          </h1>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0.25rem 0 0 0' }}>
            Real-time customer sales gross receipts, markup profit, and automated payouts.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/store-console/transactions')}
            leftIcon={<History size={13} />}
          >
            Transactions Ledger
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/agent/withdrawals')}
            leftIcon={<ArrowDownToLine size={13} />}
            style={{ backgroundColor: '#10B981', color: '#000000', fontWeight: 800 }}
          >
            Withdraw Profit
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportStatement}
            leftIcon={<Download size={13} />}
            disabled={!data?.transactions?.length}
          >
            Export Statement
          </Button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-8)' }}>
          <Loader2 className="animate-spin text-gray-400" size={32} />
        </div>
      ) : (
        <>
          {/* Saturday Payout Schedule Notice */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.85rem 1.25rem',
              borderRadius: 'var(--radius-xl)',
              backgroundColor: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              color: 'var(--color-text-primary)',
              fontSize: 'var(--font-size-xs)',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'rgba(16, 185, 129, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10B981', flexShrink: 0 }}>
              <Calendar size={16} />
            </div>
            <div style={{ flex: 1, minWidth: '240px' }}>
              <strong style={{ color: '#10B981' }}>Weekly Settlement Cycle (Every Saturday):</strong>{' '}
              <span>Customer storefront payments settle into ByteBeacon Paystack. Your markup profit accumulates here in real-time. You can opt to request a payout anytime, reviewed and disbursed every Saturday.</span>
            </div>
            <Button
              variant="outline"
              size="xs"
              onClick={() => navigate('/agent/withdrawals')}
              style={{ borderColor: 'rgba(16, 185, 129, 0.4)', color: '#10B981', fontWeight: 800 }}
            >
              Request Payout
            </Button>
          </div>

          {/* 4 Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
            <Card style={{ padding: 'var(--space-5)', borderRadius: 'var(--radius-xl)' }}>
              <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                Gross Store Sales
              </span>
              <div style={{ fontSize: '1.85rem', fontWeight: 900, color: 'var(--color-text-primary)', fontFamily: 'var(--font-data)', margin: '0.25rem 0' }}>
                GH₵ {((data?.grossSalesGhs !== undefined ? data.grossSalesGhs : (data?.grossSalesPesewas || 0) / 100)).toFixed(2)}
              </div>
              <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>Customer payments processed</span>
            </Card>

            <Card style={{ padding: 'var(--space-5)', borderRadius: 'var(--radius-xl)' }}>
              <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                Wholesale Fulfillment Cost
              </span>
              <div style={{ fontSize: '1.85rem', fontWeight: 900, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-data)', margin: '0.25rem 0' }}>
                GH₵ {((data?.costGhs !== undefined ? data.costGhs : (data?.costPesewas || 0) / 100)).toFixed(2)}
              </div>
              <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>Base network cost</span>
            </Card>

            <Card style={{ padding: 'var(--space-5)', borderRadius: 'var(--radius-xl)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                  Reseller Profit Markup
                </span>
                <Badge variant="success" size="xs">Withdrawable</Badge>
              </div>
              <div style={{ fontSize: '1.85rem', fontWeight: 900, color: '#10B981', fontFamily: 'var(--font-data)', margin: '0.25rem 0' }}>
                GH₵ {((data?.profitGhs !== undefined ? data.profitGhs : (data?.profitPesewas || 0) / 100)).toFixed(2)}
              </div>
              <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-success)', fontWeight: 700 }}>Eligible for Saturday payout</span>
            </Card>

            <Card style={{ padding: 'var(--space-5)', borderRadius: 'var(--radius-xl)' }}>
              <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                Total Bundles Fulfilled
              </span>
              <div style={{ fontSize: '1.85rem', fontWeight: 900, color: 'var(--color-text-primary)', fontFamily: 'var(--font-data)', margin: '0.25rem 0' }}>
                {data?.totalFulfilledOrders || 0}
              </div>
              <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>100% automated delivery</span>
            </Card>
          </div>

          {/* Settlements Table */}
          <Card style={{ padding: 0, backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-2xl)', overflow: 'hidden' }}>
            <div style={{ padding: 'var(--space-4) var(--space-6)', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
                Recent Storefront Settlements
              </h3>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => navigate('/store-console/transactions')}
                style={{ color: '#10B981', fontWeight: 700 }}
              >
                View Full Ledger →
              </Button>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--font-size-xs)' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border-subtle)', backgroundColor: 'var(--color-bg-surface-elevated)' }}>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Reference</th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Type</th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Amount</th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Status</th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {!data?.transactions?.length ? (
                    <tr>
                      <td colSpan={5} style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                        No transactions found.
                      </td>
                    </tr>
                  ) : (
                    data.transactions.map((tx: any) => (
                      <tr key={tx.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                        <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                          {tx.referenceId}
                        </td>
                        <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-primary)' }}>
                          {tx.referenceType}
                        </td>
                        <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'var(--font-data)', fontWeight: 900, color: tx.entryType === 'CREDIT' ? '#10B981' : '#EF4444' }}>
                          {tx.entryType === 'CREDIT' ? '+' : '-'}GH₵ {(tx.amountPesewas / 100).toFixed(2)}
                        </td>
                        <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                          <Badge variant={tx.entryType === 'CREDIT' ? 'success' : 'danger'} size="sm">
                            {tx.entryType}
                          </Badge>
                        </td>
                        <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-2xs)' }}>
                          {new Date(tx.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
};
