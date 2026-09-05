import React, { useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export interface BeneficiaryNotApprovedModalProps {
  isOpen: boolean;
  onClose: () => void;
  phoneNumber?: string;
  phoneNumbers?: string[];
}

export const BeneficiaryNotApprovedModal: React.FC<BeneficiaryNotApprovedModalProps> = ({
  isOpen,
  onClose,
  phoneNumber = '',
  phoneNumbers,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const phoneList: string[] =
    phoneNumbers && phoneNumbers.length > 0
      ? phoneNumbers
      : (phoneNumber || '')
          .split(/[,;\n]+/)
          .map((p) => p.trim())
          .filter(Boolean);

  const displayPhone = phoneList.length > 0 ? phoneList[0] : phoneNumber?.trim() || '';
  const isMultiple = phoneList.length > 1;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        zIndex: 300,
      }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="beneficiary-modal-title"
    >
      <div
        style={{
          backgroundColor: '#222226',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          width: '92%',
          maxWidth: isMultiple ? '460px' : '420px',
          padding: '22px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.65)',
          animation: 'beneficiaryModalFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <style>{`
          @keyframes beneficiaryModalFadeIn {
            from { opacity: 0; transform: scale(0.96) translateY(6px); }
            to { opacity: 1; transform: scale(1) translateY(0); }
          }
        `}</style>

        {/* Top Header with Warning Icon, Title, and Close Button */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Warning Circle Icon */}
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                backgroundColor: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#f59e0b',
                flexShrink: 0,
              }}
            >
              <AlertTriangle size={22} strokeWidth={2.4} />
            </div>

            {/* Modal Title */}
            <h3
              id="beneficiary-modal-title"
              style={{
                fontSize: '1.15rem',
                fontWeight: 700,
                color: '#ffffff',
                margin: 0,
                lineHeight: 1.25,
                letterSpacing: '-0.01em',
              }}
            >
              {isMultiple ? `${phoneList.length} new beneficiaries` : 'New beneficiary number'}
              <br />
              detected!
            </h3>
          </div>

          {/* Close (X) button */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#9ca3af',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '6px',
              transition: 'color 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#9ca3af')}
          >
            <X size={20} />
          </button>
        </div>

        {/* Message Content Card Box */}
        <div
          style={{
            backgroundColor: '#161619',
            border: '1px solid #382c22',
            borderRadius: '12px',
            padding: '16px 18px',
            margin: '18px 0 20px 0',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            textAlign: 'left',
          }}
        >
          {isMultiple ? (
            <>
              <p
                style={{
                  margin: 0,
                  fontSize: '14px',
                  lineHeight: 1.5,
                  color: '#d1d5db',
                }}
              >
                The following <strong style={{ color: '#ffffff', fontWeight: 700 }}>{phoneList.length} MTN numbers</strong> are not added to our beneficiary list at the moment. Numbers have been recorded and will be added to our beneficiary list. Please try again later.
              </p>

              {/* Scrollable unapproved numbers chip list */}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '6px',
                  maxHeight: '140px',
                  overflowY: 'auto',
                  padding: '8px',
                  backgroundColor: '#0e0e11',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                }}
              >
                {phoneList.map((ph, idx) => (
                  <span
                    key={idx}
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '12px',
                      fontWeight: 700,
                      color: '#fbbf24',
                      backgroundColor: 'rgba(245, 158, 11, 0.1)',
                      border: '1px solid rgba(245, 158, 11, 0.25)',
                      padding: '2px 8px',
                      borderRadius: '4px',
                    }}
                  >
                    {ph}
                  </span>
                ))}
              </div>

              <p
                style={{
                  margin: 0,
                  fontSize: '13px',
                  lineHeight: 1.4,
                  color: '#9ca3af',
                }}
              >
                Under MTN telecom compliance, unvalidated numbers cannot be charged or fulfilled immediately.{' '}
                <span style={{ color: '#f87171', fontWeight: 600 }}>
                  Orders to these numbers are held for approval.
                </span>
              </p>
            </>
          ) : (
            <>
              <p
                style={{
                  margin: 0,
                  fontSize: '14px',
                  lineHeight: 1.5,
                  color: '#d1d5db',
                }}
              >
                The phone number{' '}
                <strong style={{ color: '#ffffff', fontWeight: 700 }}>
                  {displayPhone}
                </strong>{' '}
                is not added to our beneficiary list at the moment. Number has been
                recorded and will be added to our beneficiary list. Please try again
                later.
              </p>

              <p
                style={{
                  margin: 0,
                  fontSize: '14px',
                  lineHeight: 1.5,
                  color: '#d1d5db',
                }}
              >
                This number is not on our beneficiary list and orders to it are
                currently blocked.
                <br />
                <span
                  style={{
                    color: '#f87171',
                    fontWeight: 600,
                    display: 'inline-block',
                    marginTop: '2px',
                  }}
                >
                  Please use a verified number.
                </span>
              </p>
            </>
          )}
        </div>

        {/* Action Button: Close */}
        <button
          type="button"
          onClick={onClose}
          style={{
            width: '100%',
            padding: '12px 16px',
            backgroundColor: '#3f3f46',
            color: '#ffffff',
            border: 'none',
            borderRadius: '10px',
            fontSize: '15px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'background-color 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#52525b')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#3f3f46')}
        >
          Close
        </button>
      </div>
    </div>
  );
};
