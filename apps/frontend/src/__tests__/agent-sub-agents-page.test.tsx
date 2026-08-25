import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AgentCustomersPage } from '../pages/agent/AgentCustomersPage.js';
import { ToastProvider } from '../context/ToastContext.js';

vi.mock('../context/ToastContext.js', () => ({
  useToast: () => ({
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
    toastInfo: vi.fn(),
  }),
  ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('Agent Sub-Agents Page (AgentCustomersPage)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders To Be Announced announcement state when feature is unannounced', async () => {
    render(
      <MemoryRouter>
        <ToastProvider>
          <AgentCustomersPage />
        </ToastProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText('Sub Agents')).toBeTruthy();
    expect(screen.getByText('To Be Announced')).toBeTruthy();
    expect(screen.getByText('Sub-Agent Multi-Tier Reseller System')).toBeTruthy();
    expect(screen.getByText('Partner Onboarding')).toBeTruthy();
    expect(screen.getByText('Automated Overrides')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Notify Me On Launch/i })).toBeTruthy();

    const notifyBtn = screen.getByRole('button', { name: /Notify Me On Launch/i });
    fireEvent.click(notifyBtn);
  });
});
