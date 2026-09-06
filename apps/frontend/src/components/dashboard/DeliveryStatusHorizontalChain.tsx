import React from 'react';
import { Card } from '../ui/Card/Card.js';
import { NetworkBadge } from '../ui/Badge/Badge.js';
import { NetworkProvider } from '@bytebeacon/shared';
import {
  CreditCard,
  Smartphone,
  Clock,
  CheckCircle2,
  AlertCircle,
  Zap,
  ExternalLink,
} from 'lucide-react';

export interface LastOrderSummary {
  id: string;
  orderNumber: string;
  network?: NetworkProvider | string;
  recipientPhone?: string;
  dataDisplay?: string;
  amountDisplay?: string;
  paymentStatus?: string; // 'PAID' | 'PENDING' | 'FAILED'
  orderStatus?: string;   // 'COMPLETED' | 'DELIVERED' | 'PROCESSING' | 'SUBMITTED' | 'FAILED' | 'CANCELLED'
  dateDisplay?: string;
}

export interface DeliveryStatusHorizontalChainProps {
  lastOrder?: LastOrderSummary | null;
  onViewOrderDetails?: (orderId: string) => void;
  systemHealthStatus?: 'OPERATIONAL' | 'DEGRADED' | 'MAINTENANCE';
  role?: 'customer' | 'agent';
  style?: React.CSSProperties;
}

export const DeliveryStatusHorizontalChain: React.FC<DeliveryStatusHorizontalChainProps> = ({
  lastOrder,
  onViewOrderDetails,
  systemHealthStatus = 'OPERATIONAL',
  role = 'customer',
  style,
}) => {
  const normPayment = String(lastOrder?.paymentStatus || '').toUpperCase();
  const normStatus = String(lastOrder?.orderStatus || '').toUpperCase();

  const hasOrder = Boolean(lastOrder && lastOrder.id);
  const isPaid = normPayment === 'PAID';
  const isDelivered = normStatus === 'DELIVERED' || normStatus === 'COMPLETED';
  const isProcessing =
    isDelivered ||
    normStatus === 'PROCESSING' ||
    normStatus === 'READY_FOR_FULFILLMENT' ||
    normStatus === 'READY_TO_PROCESS';
  const isReceived =
    isProcessing ||
    normStatus === 'ORDER_RECEIVED' ||
    normStatus === 'SUBMITTED' ||
    normStatus === 'CHECKING_ORDER' ||
    normStatus === 'VALIDATING' ||
    normStatus === 'ORDER_CREATED' ||
    normStatus === 'CREATED' ||
    normStatus === 'PENDING';
  const isFailed =
    normStatus === 'UNABLE_TO_COMPLETE' ||
    normStatus === 'FAILED' ||
    normStatus === 'CANCELLED' ||
    normPayment === 'FAILED';

  // Define the 4 stages requested by the user
  const steps = [
    {
      id: 1,
      title: 'Payment Confirmed',
      description: 'Payment authorized and verified',
      icon: CreditCard,
      status: !hasOrder
        ? 'STANDBY'
        : isFailed && !isPaid
        ? 'FAILED'
        : isPaid
        ? 'COMPLETED'
        : 'ACTIVE',
    },
    {
      id: 2,
      title: 'Order Received',
      description: 'Recipient number validated',
      icon: Smartphone,
      status: !hasOrder
        ? 'STANDBY'
        : isFailed && !isReceived
        ? 'FAILED'
        : isProcessing || isDelivered
        ? 'COMPLETED'
        : isReceived
        ? 'ACTIVE'
        : 'PENDING',
    },
    {
      id: 3,
      title: 'Processing',
      description: 'Provisioning mobile data',
      icon: Clock,
      status: !hasOrder
        ? 'STANDBY'
        : isFailed && !isDelivered
        ? 'FAILED'
        : isDelivered
        ? 'COMPLETED'
        : isProcessing
        ? 'ACTIVE'
        : 'PENDING',
    },
    {
      id: 4,
      title: 'Data Delivered',
      description: isDelivered
        ? 'Data delivered to recipient'
        : isFailed
        ? 'Delivery incomplete'
        : 'Awaiting network dispatch',
      icon: CheckCircle2,
      status: !hasOrder
        ? 'STANDBY'
        : isFailed
        ? 'FAILED'
        : isDelivered
        ? 'COMPLETED'
        : 'PENDING',
    },
  ];

  return (
    <Card
      elevated
      className={`delivery-status-chain-card role-${role}`}
      style={{
        padding: 'var(--space-5) var(--space-6)',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--color-border-default)',
        background: 'linear-gradient(145deg, var(--color-bg-surface-elevated), var(--color-bg-surface))',
        boxShadow: 'var(--shadow-tactile-md)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-5)',
        width: '100%',
        boxSizing: 'border-box',
        overflow: 'hidden',
        ...style,
      }}
    >
      <style>{`
        @keyframes pulse-subtle {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.65; transform: scale(1.08); }
        }
        @keyframes pulse-ring {
          0% { transform: scale(0.95); opacity: 0.8; }
          50% { transform: scale(1.25); opacity: 0.2; }
          100% { transform: scale(0.95); opacity: 0.8; }
        }
        .live-dot-pulse {
          animation: pulse-subtle 2s infinite ease-in-out;
        }
        .chain-horizontal-scroll {
          display: flex;
          align-items: flex-start;
          width: 100%;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          padding-bottom: var(--space-2);
        }
        .chain-step-node {
          flex: 1;
          min-width: 180px;
          display: flex;
          flex-direction: column;
          position: relative;
        }
        .chain-connector-line {
          position: absolute;
          top: 20px;
          left: 50%;
          width: 100%;
          height: 3px;
          z-index: 1;
          transition: background-color 300ms ease;
        }
      `}</style>

      {/* Top Section: Title & Order Meta on Left, Live System Health on Right */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          borderBottom: '1px solid var(--color-border-subtle)',
          paddingBottom: 'var(--space-4)',
        }}
      >
        {/* Left: Title + Last Order summary */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
            <div
              style={{
                padding: '0.35rem',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--color-primary-soft)',
                color: 'var(--color-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Zap size={16} strokeWidth={2.8} />
            </div>
            <h3
              style={{
                fontSize: 'var(--font-size-base)',
                fontWeight: 900,
                color: 'var(--color-text-primary)',
                margin: 0,
                letterSpacing: '-0.01em',
              }}
            >
              Delivery Status
            </h3>

            {hasOrder ? (
              <span
                style={{
                  fontSize: 'var(--font-size-3xs)',
                  fontWeight: 800,
                  padding: '0.15rem 0.5rem',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: isDelivered
                    ? 'rgba(34, 197, 94, 0.12)'
                    : isFailed
                    ? 'rgba(239, 68, 68, 0.12)'
                    : 'rgba(245, 158, 11, 0.12)',
                  color: isDelivered
                    ? 'var(--color-primary)'
                    : isFailed
                    ? 'var(--color-accent-red)'
                    : '#F59E0B',
                  border: `1px solid ${
                    isDelivered ? 'rgba(34, 197, 94, 0.3)' : isFailed ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.3)'
                  }`,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                ● {isDelivered ? 'Data Delivered' : isFailed ? 'Fulfillment Failed' : isProcessing ? 'Processing' : 'Received'}
              </span>
            ) : (
              <span
                style={{
                  fontSize: 'var(--font-size-3xs)',
                  fontWeight: 700,
                  padding: '0.15rem 0.5rem',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--color-bg-base)',
                  color: 'var(--color-text-muted)',
                  border: '1px solid var(--color-border-subtle)',
                }}
              >
                Standby Ready
              </span>
            )}
          </div>

          {/* Last Order Description Pill */}
          {hasOrder ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap', fontSize: 'var(--font-size-xs)' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Latest Order:</span>
              <span
                style={{
                  fontWeight: 800,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--color-text-primary)',
                  backgroundColor: 'var(--color-bg-base)',
                  padding: '0.15rem 0.45rem',
                  borderRadius: 'var(--radius-xs)',
                  border: '1px solid var(--color-border-subtle)',
                }}
              >
                #{lastOrder?.orderNumber}
              </span>
              {lastOrder?.network && <NetworkBadge network={lastOrder.network as NetworkProvider} size="sm" />}
              {lastOrder?.dataDisplay && (
                <span style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  {lastOrder.dataDisplay}
                </span>
              )}
              {lastOrder?.recipientPhone && (
                <span style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>
                  → {lastOrder.recipientPhone}
                </span>
              )}
              {lastOrder?.amountDisplay && (
                <span style={{ fontWeight: 800, color: 'var(--color-primary)', fontFamily: 'var(--font-data)' }}>
                  ({lastOrder.amountDisplay})
                </span>
              )}
              {lastOrder?.dateDisplay && (
                <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-3xs)' }}>
                  • {lastOrder.dateDisplay}
                </span>
              )}
              {onViewOrderDetails && (
                <button
                  type="button"
                  onClick={() => onViewOrderDetails(lastOrder!.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-primary)',
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.2rem',
                    padding: 0,
                    marginLeft: '0.25rem',
                  }}
                >
                  View Details <ExternalLink size={11} />
                </button>
              )}
            </div>
          ) : (
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
              No orders placed yet. Real-time carrier delivery steps will track here upon your first order.
            </span>
          )}
        </div>

        {/* Right: Live System Health Monitor */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            backgroundColor: 'var(--color-bg-base)',
            padding: '0.45rem 0.85rem',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border-subtle)',
            flexShrink: 0,
          }}
        >
          {/* Pulsing Beacon Dot */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span
              className="live-dot-pulse"
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: systemHealthStatus === 'OPERATIONAL' ? '#22C55E' : '#F59E0B',
                boxShadow: systemHealthStatus === 'OPERATIONAL' ? '0 0 10px #22C55E' : '0 0 10px #F59E0B',
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                System Health
              </span>
              <span
                style={{
                  fontSize: '9px',
                  fontWeight: 800,
                  color: systemHealthStatus === 'OPERATIONAL' ? '#22C55E' : '#F59E0B',
                  textTransform: 'uppercase',
                }}
              >
                100% Operational
              </span>
            </div>
            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
              Carrier Rails Active (MTN • Telecel • AT)
            </span>
          </div>
        </div>
      </div>

      {/* Main Feature: The Linear Horizontal Chain */}
      <div className="chain-horizontal-scroll">
        <div style={{ display: 'flex', width: '100%', minWidth: '700px', position: 'relative' }}>
          {steps.map((st, idx) => {
            const isCompleted = st.status === 'COMPLETED';
            const isActive = st.status === 'ACTIVE';
            const isStepFailed = st.status === 'FAILED';
            const isStandby = st.status === 'STANDBY';
            const hasNext = idx < steps.length - 1;

            // Connecting line styling
            const lineBg = isCompleted
              ? '#22C55E'
              : isActive
              ? 'linear-gradient(90deg, #22C55E 0%, #F59E0B 100%)'
              : 'var(--color-border-default)';

            const StepIcon = st.icon;

            return (
              <div key={st.id} className="chain-step-node">
                {/* Connecting Line to next step */}
                {hasNext && (
                  <div
                    className="chain-connector-line"
                    style={{
                      backgroundColor: isCompleted ? '#22C55E' : 'var(--color-border-subtle)',
                      background: lineBg,
                      opacity: isStandby ? 0.4 : 1,
                    }}
                  />
                )}

                {/* Node Center Icon */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2, marginBottom: 'var(--space-3)' }}>
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '50%',
                      backgroundColor: isCompleted
                        ? 'rgba(34, 197, 94, 0.18)'
                        : isActive
                        ? 'rgba(245, 158, 11, 0.18)'
                        : isStepFailed
                        ? 'rgba(239, 68, 68, 0.18)'
                        : 'var(--color-bg-surface-elevated)',
                      border: `2px solid ${
                        isCompleted
                          ? '#22C55E'
                          : isActive
                          ? '#F59E0B'
                          : isStepFailed
                          ? '#EF4444'
                          : 'var(--color-border-default)'
                      }`,
                      color: isCompleted
                        ? '#22C55E'
                        : isActive
                        ? '#F59E0B'
                        : isStepFailed
                        ? '#EF4444'
                        : 'var(--color-text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: isCompleted
                        ? '0 0 12px rgba(34, 197, 94, 0.35)'
                        : isActive
                        ? '0 0 12px rgba(245, 158, 11, 0.35)'
                        : 'none',
                      transition: 'all 200ms ease',
                    }}
                  >
                    {isCompleted ? (
                      <CheckCircle2 size={20} strokeWidth={2.8} />
                    ) : isStepFailed ? (
                      <AlertCircle size={20} strokeWidth={2.8} />
                    ) : (
                      <StepIcon size={19} strokeWidth={2.4} className={isActive ? 'animate-pulse' : ''} />
                    )}
                  </div>
                </div>

                {/* Step Text Info */}
                <div style={{ textAlign: 'center', padding: '0 0.5rem', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
                    <span
                      style={{
                        fontSize: 'var(--font-size-xs)',
                        fontWeight: isCompleted || isActive ? 800 : 700,
                        color: isCompleted
                          ? 'var(--color-text-primary)'
                          : isActive
                          ? '#F59E0B'
                          : isStepFailed
                          ? 'var(--color-accent-red)'
                          : 'var(--color-text-muted)',
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {st.title}
                    </span>
                    {isCompleted && (
                      <span style={{ fontSize: '10px', color: '#22C55E', fontWeight: 900 }}>✓</span>
                    )}
                  </div>

                  <span
                    style={{
                      fontSize: 'var(--font-size-3xs)',
                      color: isCompleted || isActive ? 'var(--color-text-secondary)' : 'var(--color-text-muted)',
                      lineHeight: 1.3,
                      maxWidth: '170px',
                      margin: '0 auto',
                    }}
                  >
                    {st.description}
                  </span>

                  {/* Active Indicator Badge */}
                  {isActive && (
                    <div style={{ marginTop: '4px' }}>
                      <span
                        style={{
                          fontSize: '8px',
                          fontWeight: 900,
                          padding: '0.1rem 0.4rem',
                          borderRadius: 'var(--radius-full)',
                          backgroundColor: 'rgba(245, 158, 11, 0.15)',
                          color: '#F59E0B',
                          border: '1px solid rgba(245, 158, 11, 0.35)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          display: 'inline-block',
                        }}
                      >
                        In Progress
                      </span>
                    </div>
                  )}

                  {isCompleted && (
                    <div style={{ marginTop: '4px' }}>
                      <span
                        style={{
                          fontSize: '8px',
                          fontWeight: 800,
                          color: '#22C55E',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}
                      >
                        Verified
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
};
