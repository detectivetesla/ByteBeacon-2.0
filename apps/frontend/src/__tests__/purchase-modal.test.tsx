import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { NetworkProvider } from '@bytebeacon/shared';
import { PurchaseModal } from '../components/commerce/PurchaseModal.js';
import { ToastProvider } from '../context/ToastContext.js';

const renderModal = (props: React.ComponentProps<typeof PurchaseModal>) => {
  return render(
    <BrowserRouter>
      <ToastProvider>
        <PurchaseModal {...props} />
      </ToastProvider>
    </BrowserRouter>,
  );
};

describe('PurchaseModal React Hook Order and State Transitions', () => {
  it('renders correctly and does not violate rules of hooks when opening and closing repeatedly', () => {
    // 1. Start closed
    const { rerender } = renderModal({
      isOpen: false,
      onClose: () => {},
      initialNetwork: NetworkProvider.MTN,
    });

    // Modal should not render anything when closed
    expect(screen.queryByText(/Purchase Data/i)).toBeNull();

    // 2. Open with MTN
    rerender(
      <BrowserRouter>
        <ToastProvider>
          <PurchaseModal
            isOpen={true}
            onClose={() => {}}
            initialNetwork={NetworkProvider.MTN}
          />
        </ToastProvider>
      </BrowserRouter>,
    );

    expect(screen.getByText(/Purchase Data/i)).toBeTruthy();

    // 3. Close
    rerender(
      <BrowserRouter>
        <ToastProvider>
          <PurchaseModal
            isOpen={false}
            onClose={() => {}}
            initialNetwork={NetworkProvider.MTN}
          />
        </ToastProvider>
      </BrowserRouter>,
    );

    expect(screen.queryByText(/Purchase Data/i)).toBeNull();

    // 4. Reopen with Telecel and custom package
    rerender(
      <BrowserRouter>
        <ToastProvider>
          <PurchaseModal
            isOpen={true}
            onClose={() => {}}
            initialNetwork={NetworkProvider.TELECEL}
            customPackageSummary="10 GB Telecel Special"
            customAmountDisplay="GH₵ 45.00"
          />
        </ToastProvider>
      </BrowserRouter>,
    );

    expect(screen.getByText(/10 GB Telecel Special/i)).toBeTruthy();

    // 5. Stress test multiple rapid open/close transitions across all network providers
    const networks = [NetworkProvider.MTN, NetworkProvider.TELECEL, NetworkProvider.AIRTELTIGO];

    for (let i = 0; i < 10; i++) {
      const net = networks[i % networks.length];
      const isOpen = i % 2 === 0;

      rerender(
        <BrowserRouter>
          <ToastProvider>
            <PurchaseModal
              isOpen={isOpen}
              onClose={() => {}}
              initialNetwork={net}
              initialRecipientPhone={isOpen ? `024123456${i}` : undefined}
            />
          </ToastProvider>
        </BrowserRouter>,
      );

      if (isOpen) {
        expect(screen.getByText(/Step 2 of 2 · Confirm Purchase/i)).toBeTruthy();
      } else {
        expect(screen.queryByText(/Purchase Data/i)).toBeNull();
      }
    }

    cleanup();
  });
});
