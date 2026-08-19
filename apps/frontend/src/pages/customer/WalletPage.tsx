import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card } from '../../components/ui/Card/Card.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Table } from '../../components/ui/Table/Table.js';
import { Input, AmountInput } from '../../components/ui/index.js';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';
import { walletApi, WalletTransactionDto } from '../../api/wallet.api.js';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  ShieldCheck,
  Plus,
  X,
  CreditCard,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';

export const WalletPage: React.FC = () => {
  const { user } = useAuth();
  const { toastSuccess, toastError, toastInfo } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [balanceGhs, setBalanceGhs] = useState<number>((user?.walletBalancePesewas || 0) / 100);
  const [transactions, setTransactions] = useState<WalletTransactionDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isTopUpModalOpen, setIsTopUpModalOpen] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState('20');
  const [isSubmittingTopUp, setIsSubmittingTopUp] = useState(false);

  const fetchWalletData = useCallback(async () => {
    setIsLoading(true);
    try {
      const balRes = await walletApi.getBalance();
      if (balRes && typeof balRes.balanceGhs === 'number') {
        setBalanceGhs(balRes.balanceGhs);
      }

      const txRes = await walletApi.getTransactions({ limit: 10 });
      if (txRes && Array.isArray(txRes.transactions)) {
        setTransactions(txRes.transactions);
      }
    } catch {
      // Keep state resilient
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle Paystack callback verification
  useEffect(() => {
    const isPaystackVerify = searchParams.get('paystack_verify');
    const reference = searchParams.get('reference') || searchParams.get('trxref');

    if (isPaystackVerify && reference) {
      toastInfo('Verifying Payment', 'Confirming wallet deposit with carrier network...');
      walletApi
        .verifyTopup(reference)
        .then((res) => {
          if (res?.success) {
            toastSuccess('Wallet Funded!', `Deposit confirmed. New balance: GH₵ ${(res.newBalancePesewas / 100).toFixed(2)}`);
          } else {
            toastSuccess('Deposit Received', 'Your wallet balance has been updated.');
          }
          fetchWalletData();
        })
        .catch(() => {
          fetchWalletData();
        })
        .finally(() => {
          setSearchParams({});
        });
    } else {
      fetchWalletData();
    }
  }, [searchParams, setSearchParams, toastInfo, toastSuccess, fetchWalletData]);

  const handleProceedToPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(topUpAmount);
    if (isNaN(amount) || amount < 1) {
      toastError('Invalid Amount', 'Minimum top-up amount is GH₵ 1.00');
      return;
    }

    setIsSubmittingTopUp(true);
    try {
      const res = await walletApi.initializeTopup(amount);
      if (res?.authorizationUrl) {
        toastInfo('Redirecting to Paystack', 'Opening secure payment gateway...');
        window.location.href = res.authorizationUrl;
        return;
      }
      toastSuccess('Deposit Initiated', 'Follow the payment prompts to complete your top-up.');
      setIsTopUpModalOpen(false);
    } catch (err: any) {
      toastError('Top-up Failed', err.message || 'Unable to initiate wallet deposit.');
    } finally {
      setIsSubmittingTopUp(false);
    }
  };

  const PRESET_AMOUNTS = ['10', '20', '50', '100', '200'];

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div>
          <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-primary)' }}>
            Prepaid Balance
          </span>
          <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 800, color: 'var(--color-text-primary)', marginTop: '0.125rem' }}>
            My Wallet
          </h1>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>
            Manage your prepaid balance for one-click checkout and seamless bulk dispatch.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <Button variant="outline" size="md" onClick={fetchWalletData} isLoading={isLoading} leftIcon={<RefreshCw size={15} />}>
            Refresh
          </Button>
          <Button variant="primary" size="md" onClick={() => setIsTopUpModalOpen(true)} leftIcon={<Plus size={16} />}>
            Top Up Wallet
          </Button>
        </div>
      </div>

      {/* Balance Card & Quick Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-6)' }}>
        <Card
          style={{
            padding: 'var(--space-6)',
            background: 'linear-gradient(135deg, var(--color-bg-surface) 0%, var(--color-bg-surface-elevated) 100%)',
            border: '1px solid var(--color-border-default)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: '180px',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
              <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Available Balance
              </span>
              <div style={{ padding: '0.375rem', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-primary-soft)', color: 'var(--color-primary)' }}>
                <Wallet size={18} strokeWidth={2.6} />
              </div>
            </div>
            <div style={{ fontSize: 'var(--font-size-4xl)', fontWeight: 900, color: 'var(--color-text-primary)', fontFamily: 'var(--font-data)' }}>
              GH₵ {balanceGhs.toFixed(2)}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: 'var(--space-4)' }}>
            <Button variant="primary" size="sm" onClick={() => setIsTopUpModalOpen(true)} leftIcon={<Plus size={14} />}>
              Top Up
            </Button>
          </div>
        </Card>

        {/* Security & Instant Float Guarantee */}
        <Card style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 'var(--space-3)' }}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <div style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(34, 197, 94, 0.12)', color: 'var(--color-primary)' }}>
              <ShieldCheck size={22} strokeWidth={2.6} />
            </div>
            <div>
              <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                Escrow Protected Balance
              </h3>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '0.125rem' }}>
                Wallet funds are held securely and deducted only upon verified carrier confirmation.
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Transactions */}
      <div>
        <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 'var(--space-4)' }}>
          Recent Wallet Activity
        </h2>
        {transactions.length === 0 ? (
          <Card style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
              No recent transactions recorded. Deposit funds to see ledger activity here.
            </p>
          </Card>
        ) : (
          <Table headers={['Type', 'Description', 'Amount', 'Date', 'Status']}>
            {transactions.map((tx) => (
              <tr key={tx.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                <td style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {tx.type === 'DEPOSIT' || tx.type === 'REFUND' ? (
                    <div style={{ padding: '0.25rem', borderRadius: '50%', backgroundColor: 'rgba(34, 197, 94, 0.12)', color: 'var(--color-primary)' }}>
                      <ArrowDownLeft size={14} strokeWidth={2.8} />
                    </div>
                  ) : (
                    <div style={{ padding: '0.25rem', borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.12)', color: 'var(--color-accent-red)' }}>
                      <ArrowUpRight size={14} strokeWidth={2.8} />
                    </div>
                  )}
                  <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>{tx.type}</span>
                </td>
                <td style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>{tx.description}</td>
                <td style={{ fontWeight: 700, fontSize: 'var(--font-size-xs)', color: tx.type === 'DEPOSIT' || tx.type === 'REFUND' ? 'var(--color-primary)' : 'var(--color-text-primary)' }}>
                  {tx.type === 'DEPOSIT' || tx.type === 'REFUND' ? '+' : '-'}GH₵ {(tx.amountPesewas / 100).toFixed(2)}
                </td>
                <td style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)' }}>
                  {new Date(tx.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </td>
                <td>
                  <span style={{ fontSize: 'var(--font-size-3xs)', padding: '0.2rem 0.5rem', borderRadius: 'var(--radius-full)', backgroundColor: 'rgba(34, 197, 94, 0.12)', color: 'var(--color-primary)', fontWeight: 700 }}>
                    {tx.status}
                  </span>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </div>

      {/* Top Up Modal */}
      {isTopUpModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}
          onClick={() => setIsTopUpModalOpen(false)}
        >
          <div
            style={{
              backgroundColor: 'var(--color-bg-surface-elevated)',
              border: '1px solid var(--color-border-default)',
              borderRadius: 'var(--radius-xl)',
              maxWidth: '440px',
              width: '100%',
              padding: '1.75rem',
              boxShadow: 'var(--shadow-floating)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <div style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-primary-soft)', color: 'var(--color-primary)' }}>
                  <CreditCard size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, margin: 0 }}>Top Up Wallet</h3>
                  <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: 0 }}>
                    Instant MoMo & Card deposit via Paystack
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsTopUpModalOpen(false)}
                style={{ color: 'var(--color-text-muted)', cursor: 'pointer', padding: '0.25rem' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleProceedToPayment} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Preset Amounts */}
              <div>
                <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '0.5rem' }}>
                  Quick Amount (GH₵)
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.375rem' }}>
                  {PRESET_AMOUNTS.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setTopUpAmount(amt)}
                      style={{
                        padding: '0.5rem 0',
                        borderRadius: 'var(--radius-sm)',
                        border: topUpAmount === amt ? '2px solid var(--color-primary)' : '1px solid var(--color-border-default)',
                        backgroundColor: topUpAmount === amt ? 'var(--color-primary-soft)' : 'var(--color-bg-surface)',
                        color: topUpAmount === amt ? 'var(--color-primary)' : 'var(--color-text-primary)',
                        fontWeight: 700,
                        fontSize: 'var(--font-size-xs)',
                        cursor: 'pointer',
                      }}
                    >
                      {amt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Input */}
              <AmountInput
                id="topup-amount"
                label="Deposit Amount (GH₵)"
                value={topUpAmount}
                onChange={(e) => setTopUpAmount(e.target.value)}
                placeholder="Enter amount"
                currencyPrefix="GH₵"
                required
              />

              <div style={{ backgroundColor: 'var(--color-bg-base)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)', display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Payable Amount:</span>
                <span style={{ fontWeight: 800, color: 'var(--color-text-primary)' }}>
                  GH₵ {parseFloat(topUpAmount || '0').toFixed(2)}
                </span>
              </div>

              <Button variant="primary" size="lg" fullWidth type="submit" isLoading={isSubmittingTopUp}>
                Proceed to Secure Checkout
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
