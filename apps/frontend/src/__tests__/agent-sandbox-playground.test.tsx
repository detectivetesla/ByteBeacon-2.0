import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AgentSandboxPage, SANDBOX_RECIPES } from '../pages/agent/AgentSandboxPage.js';
import { ToastProvider } from '../context/ToastContext.js';

vi.mock('../api/apiKeys.api.js', () => ({
  apiKeysApi: {
    listKeys: vi.fn().mockResolvedValue([
      {
        id: 'key-1',
        name: 'Sandbox Key',
        keyPrefix: 'ak_test_abcdef123456',
        environment: 'SANDBOX',
        status: 'ACTIVE',
      },
    ]),
  },
}));

describe('AgentSandboxPage — Sandbox Playground Spec & Interactive Runner', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const renderComponent = () => {
    return render(
      <ToastProvider>
        <AgentSandboxPage />
      </ToastProvider>
    );
  };

  it('1. renders header copy, badge, instructions and disclaimer matching specifications', async () => {
    renderComponent();

    // Top Title & Subtitle Badge
    expect(screen.getByRole('heading', { name: /sandbox playground/i })).toBeInTheDocument();
    expect(screen.getByText('Try the Agent API')).toBeInTheDocument();

    // Lead paragraph copy
    expect(
      screen.getByText(/pick a recipe, paste a sandbox key, hit run\. no wallet movement, no supplier calls, no paystack charges\./i)
    ).toBeInTheDocument();

    const mintLink = screen.getByRole('link', { name: /mint one →/i });
    expect(mintLink).toBeInTheDocument();
    expect(mintLink).toHaveAttribute('href', 'https://www.getmorepaylessdatahouse.net/agent/api');

    // Callout banner with exact target url and deterministic 0000 note
    expect(screen.getByText(/https:\/\/api\.getmorepaylessdatahouse\.net\/api\/v1/i)).toBeInTheDocument();
    expect(
      screen.getByText(/sandbox keys never reach the supplier; phone numbers ending in/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/deterministically fail to fulfill for testing your error paths/i)).toBeInTheDocument();
  });

  it('2. verifies all 11 recipes are presented in the Recipes directory', () => {
    renderComponent();

    expect(screen.getByText('Recipes')).toBeInTheDocument();
    expect(screen.getByText('11 Endpoints')).toBeInTheDocument();

    expect(SANDBOX_RECIPES).toHaveLength(11);

    // Verify all 11 recipes exist
    const expectedSubtitles = [
      'Get my agent profile',
      'Wallet balance',
      'List bundles (with your price)',
      'List my recent orders',
      'Place an order (will succeed)',
      'Place an order (will fail)',
      'Look up one order',
      'Subscribe a webhook',
      'List my webhooks',
      'Rotate a webhook secret',
      'Delete a webhook',
    ];

    expectedSubtitles.forEach((subtitle) => {
      expect(screen.getByText(subtitle)).toBeInTheDocument();
    });
  });

  it('3. displays initial recipe details (GET /agent/me) and input labels', async () => {
    renderComponent();

    // Active recipe description
    expect(screen.getByText('Smoke test that your sandbox key is wired up correctly.')).toBeInTheDocument();

    // Field labels
    expect(screen.getByText('Request path')).toBeInTheDocument();
    expect(screen.getByText('Sandbox API key')).toBeInTheDocument();

    // Send request button
    expect(screen.getByRole('button', { name: /send request/i })).toBeInTheDocument();
  });

  it('4. switches recipe to Place an order (will succeed) with payload & fresh idempotency key', async () => {
    renderComponent();

    const successBtn = screen.getByText('Place an order (will succeed)');
    fireEvent.click(successBtn);

    await waitFor(() => {
      expect(screen.getByDisplayValue('/agent/orders')).toBeInTheDocument();
    });

    const bodyTextarea = screen.getByDisplayValue(/0241234567/);
    expect(bodyTextarea).toBeInTheDocument();
    expect((bodyTextarea as HTMLTextAreaElement).value).toContain('idempotencyKey');
    expect((bodyTextarea as HTMLTextAreaElement).value).toContain('bnd_mtn_1gb');
  });

  it('5. switches recipe to Place an order (will fail) with 0000 deterministic number', async () => {
    renderComponent();

    const failBtn = screen.getByText('Place an order (will fail)');
    fireEvent.click(failBtn);

    await waitFor(() => {
      expect(screen.getByDisplayValue('/agent/orders')).toBeInTheDocument();
    });

    const bodyTextarea = screen.getByDisplayValue(/0240000000/);
    expect(bodyTextarea).toBeInTheDocument();
    expect(screen.getAllByText(/deterministically fail to fulfill/i).length).toBeGreaterThanOrEqual(2);
  });

  it('6. toggles sandbox API key visibility when eye button is clicked', () => {
    renderComponent();

    const keyInput = screen.getByPlaceholderText('ak_test_xxxxxxxxxxxxxxxxxxxxxxxx');
    expect(keyInput).toHaveAttribute('type', 'password');

    const toggleBtn = screen.getByTitle('Show key');
    fireEvent.click(toggleBtn);
    expect(keyInput).toHaveAttribute('type', 'text');

    const hideBtn = screen.getByTitle('Hide key');
    fireEvent.click(hideBtn);
    expect(keyInput).toHaveAttribute('type', 'password');
  });

  it('7. dispatches a simulated successful API request and renders status and JSON response', async () => {
    const mockHeaders = new Headers();
    mockHeaders.set('content-type', 'application/json');

    const mockResponsePayload = {
      success: true,
      statusCode: 200,
      data: {
        agent: {
          id: 'ag_98124',
          name: 'Apex Telecom Store',
          email: 'apex@bytebeacon.com',
          status: 'ACTIVE',
        },
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: mockHeaders,
      json: vi.fn().mockResolvedValue(mockResponsePayload),
    });

    renderComponent();

    const keyInput = screen.getByPlaceholderText('ak_test_xxxxxxxxxxxxxxxxxxxxxxxx');
    fireEvent.change(keyInput, { target: { value: 'ak_test_demo_secret_key_123' } });

    const sendBtn = screen.getByRole('button', { name: /send request/i });
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.getmorepaylessdatahouse.net/api/v1/agent/me',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'x-api-key': 'ak_test_demo_secret_key_123',
          }),
        })
      );
    });

    await waitFor(() => {
      expect(screen.getAllByText('200 OK').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Apex Telecom Store/)).toBeInTheDocument();
    });
  });

  it('8. handles deterministic failure response when testing error paths', async () => {
    const mockHeaders = new Headers();
    mockHeaders.set('content-type', 'application/json');

    const mockFailPayload = {
      success: false,
      statusCode: 422,
      error: 'FULFILLMENT_SIMULATED_FAILURE',
      message: 'Carrier simulated fulfillment failed deterministically on test number 0240000000.',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      statusText: 'Unprocessable Entity',
      headers: mockHeaders,
      json: vi.fn().mockResolvedValue(mockFailPayload),
    });

    renderComponent();

    // Select failing recipe
    fireEvent.click(screen.getByText('Place an order (will fail)'));

    const keyInput = screen.getByPlaceholderText('ak_test_xxxxxxxxxxxxxxxxxxxxxxxx');
    fireEvent.change(keyInput, { target: { value: 'ak_test_demo_secret_key_123' } });

    const sendBtn = screen.getByRole('button', { name: /send request/i });
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(screen.getAllByText('422 Unprocessable Entity').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Carrier simulated fulfillment failed deterministically/)).toBeInTheDocument();
    });
  });

  it('9. supports Copy as cURL command to facilitate API integration', () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn(),
      },
    });

    renderComponent();

    const copyCurlBtn = screen.getByRole('button', { name: /copy curl/i });
    fireEvent.click(copyCurlBtn);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('curl -X GET')
    );
  });

  it('10. switches to Carrier Dispatch Simulator tab and executes carrier dispatch simulation', async () => {
    renderComponent();

    // Switch tab to Carrier Dispatch Simulator
    const carrierTabBtn = screen.getByRole('button', { name: /carrier dispatch simulator/i });
    fireEvent.click(carrierTabBtn);

    expect(screen.getByText('Simulate Carrier Bundle Purchase')).toBeInTheDocument();
    expect(screen.getByText('MTN Ghana')).toBeInTheDocument();
    expect(screen.getByText('Telecel Ghana')).toBeInTheDocument();
    expect(screen.getByText('AirtelTigo')).toBeInTheDocument();

    // Fill capacity or click preset
    const dispatchBtn = screen.getByRole('button', { name: /run sandbox dispatch/i });
    fireEvent.click(dispatchBtn);

    await waitFor(() => {
      expect(screen.getByText('Simulated Carrier Telemetry')).toBeInTheDocument();
      expect(screen.getByText(/orderStatus/i)).toBeInTheDocument();
    });
  });

  it('11. triggers MTN Up2U pre-check in the carrier dispatch simulator', async () => {
    renderComponent();

    const carrierTabBtn = screen.getByRole('button', { name: /carrier dispatch simulator/i });
    fireEvent.click(carrierTabBtn);

    const precheckBtn = screen.getByText(/pre-check number →/i);
    fireEvent.click(precheckBtn);

    await waitFor(() => {
      expect(screen.getByText(/Approved & validated on MTN switch|First-time number/i)).toBeInTheDocument();
    });
  });
});