import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '../../components/ui/Card/Card.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Badge } from '../../components/ui/Badge/Badge.js';
import { Select, PhoneInput, Input } from '../../components/ui/index.js';
import { TactileIcon } from '../../components/ui/TactileIcon/TactileIcon.js';
import { useToast } from '../../context/ToastContext.js';
import { apiKeysApi } from '../../api/apiKeys.api.js';
import { apiClient } from '../../api/httpClient.js';
import { beneficiaryApi } from '../../api/beneficiary.api.js';
import { NetworkProvider } from '@bytebeacon/shared';
import {
  Terminal,
  Play,
  Copy,
  Check,
  Eye,
  EyeOff,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Code,
  RotateCcw,
  Sparkles,
  Radio,
  CheckCircle2,
  XCircle,
  Zap,
  Smartphone,
} from 'lucide-react';

export interface ApiRecipe {
  id: string;
  method: 'GET' | 'POST' | 'DELETE';
  path: string;
  title: string;
  subtitle: string;
  description: string;
  defaultBody?: string;
}

export const SANDBOX_RECIPES: ApiRecipe[] = [
  {
    id: 'get-me',
    method: 'GET',
    path: '/agent/me',
    title: 'GET/agent/me',
    subtitle: 'Get my agent profile',
    description: 'Smoke test that your sandbox key is wired up correctly.',
  },
  {
    id: 'get-wallet-balance',
    method: 'GET',
    path: '/agent/wallet/balance',
    title: 'GET/agent/wallet/balance',
    subtitle: 'Wallet balance',
    description: 'Check your ByteBeacon sandbox float balance without moving real money.',
  },
  {
    id: 'get-bundles',
    method: 'GET',
    path: '/agent/bundles',
    title: 'GET/agent/bundles',
    subtitle: 'List bundles (with your price)',
    description: 'List active ByteBeacon telecom catalogs with your customized agent wholesale rates.',
  },
  {
    id: 'get-orders',
    method: 'GET',
    path: '/agent/orders',
    title: 'GET/agent/orders',
    subtitle: 'List my recent orders',
    description: 'Query your recent agent order submissions and live lifecycle statuses.',
  },
  {
    id: 'post-order-success',
    method: 'POST',
    path: '/agent/orders',
    title: 'POST/agent/orders',
    subtitle: 'Place an order (will succeed)',
    description: 'Place an order to a valid Ghana number. Dispatches and simulates instant success.',
    defaultBody: JSON.stringify(
      {
        bundleId: 'bnd_mtn_1gb',
        phoneNumber: '0241234567',
        idempotencyKey: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
      },
      null,
      2
    ),
  },
  {
    id: 'post-order-fail',
    method: 'POST',
    path: '/agent/orders',
    title: 'POST/agent/orders',
    subtitle: 'Place an order (will fail)',
    description: 'Phone numbers ending in 0000 deterministically fail to fulfill for testing your error paths.',
    defaultBody: JSON.stringify(
      {
        bundleId: 'bnd_mtn_1gb',
        phoneNumber: '0240000000',
        idempotencyKey: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
      },
      null,
      2
    ),
  },
  {
    id: 'get-order-detail',
    method: 'GET',
    path: '/agent/orders/<order-id>',
    title: 'GET/agent/orders/<order-id>',
    subtitle: 'Look up one order',
    description: 'Look up the full status, timestamps, and network receipt for an individual order.',
  },
  {
    id: 'post-webhooks',
    method: 'POST',
    path: '/agent/webhooks',
    title: 'POST/agent/webhooks',
    subtitle: 'Subscribe a webhook',
    description: 'Register a webhook URL to receive real-time order callback notifications.',
    defaultBody: JSON.stringify(
      {
        url: 'https://webhook.site/sandbox-test-listener',
        events: ['order.delivered', 'order.could_not_deliver', 'order.rejected'],
      },
      null,
      2
    ),
  },
  {
    id: 'get-webhooks',
    method: 'GET',
    path: '/agent/webhooks',
    title: 'GET/agent/webhooks',
    subtitle: 'List my webhooks',
    description: 'List all active registered webhook endpoints on ByteBeacon.',
  },
  {
    id: 'post-webhook-rotate',
    method: 'POST',
    path: '/agent/webhooks/<webhook-id>/rotate-secret',
    title: 'POST/agent/webhooks/<webhook-id>/rotate-secret',
    subtitle: 'Rotate a webhook secret',
    description: 'Generate a new signing secret for a registered webhook subscription.',
    defaultBody: JSON.stringify({}, null, 2),
  },
  {
    id: 'delete-webhook',
    method: 'DELETE',
    path: '/agent/webhooks/<webhook-id>',
    title: 'DELETE/agent/webhooks/<webhook-id>',
    subtitle: 'Delete a webhook',
    description: 'Unregister and permanently delete a webhook subscription.',
  },
];

const DEFAULT_SANDBOX_BASE_URL = 'https://api.getmorepaylessdatahouse.net/api/v1';

export const AgentSandboxPage: React.FC = () => {
  const { toastSuccess, toastError, toastInfo } = useToast();

  // Top navigation tabs: blueprints vs carrier-dispatch
  const [activeTab, setActiveTab] = useState<'blueprints' | 'carrier'>('blueprints');

  // Blueprint state
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>('get-me');
  const [requestPath, setRequestPath] = useState<string>('/agent/me');
  const [apiKey, setApiKey] = useState<string>(() => {
    return localStorage.getItem('bytebeacon_sandbox_api_key') || '';
  });
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [requestBody, setRequestBody] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [baseUrl, setBaseUrl] = useState<string>(DEFAULT_SANDBOX_BASE_URL);

  // Response telemetry state for Blueprint API runner
  const [responseStatus, setResponseStatus] = useState<number | null>(null);
  const [responseStatusText, setResponseStatusText] = useState<string>('');
  const [responseData, setResponseData] = useState<string | null>(null);
  const [responseLatency, setResponseLatency] = useState<number | null>(null);
  const [hasCopiedResponse, setHasCopiedResponse] = useState<boolean>(false);
  const [hasCopiedCurl, setHasCopiedCurl] = useState<boolean>(false);

  // Carrier Simulation State
  const [simNetwork, setSimNetwork] = useState<string>('MTN');
  const [simPhone, setSimPhone] = useState<string>('0241234567');
  const [simCapacity, setSimCapacity] = useState<string>('5GB');
  const [simOutcome, setSimOutcome] = useState<'COMPLETED' | 'FAILED' | 'DELAYED'>('COMPLETED');
  const [simRunning, setSimRunning] = useState<boolean>(false);
  const [simPrechecking, setSimPrechecking] = useState<boolean>(false);
  const [simResponseJson, setSimResponseJson] = useState<string | null>(null);
  const [simPrecheckResult, setSimPrecheckResult] = useState<any | null>(null);

  // Current active recipe
  const activeRecipe = useMemo(() => {
    return SANDBOX_RECIPES.find((r) => r.id === selectedRecipeId) || SANDBOX_RECIPES[0];
  }, [selectedRecipeId]);

  // Load existing agent sandbox keys if available
  useEffect(() => {
    let isMounted = true;
    apiKeysApi
      .listKeys()
      .then((keys) => {
        if (!isMounted || !Array.isArray(keys)) return;
        const sandboxKeys = keys
          .filter((k) => k.environment === 'SANDBOX' && k.status === 'ACTIVE')
          .map((k) => k.keyPrefix);

        // Pre-fill if no key is currently set
        if (!apiKey && sandboxKeys.length > 0) {
          const sampleKey = `${sandboxKeys[0]}...`;
          setApiKey(sampleKey);
        }
      })
      .catch(() => {
        // Silently continue if not available
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Update path & body when switching recipes
  const handleSelectRecipe = (recipe: ApiRecipe) => {
    setSelectedRecipeId(recipe.id);

    let concretePath = recipe.path;
    if (concretePath.includes('<order-id>')) {
      concretePath = concretePath.replace('<order-id>', 'ord_sbx_99214a');
    }
    if (concretePath.includes('<webhook-id>')) {
      concretePath = concretePath.replace('<webhook-id>', 'wh_sbx_4812');
    }
    setRequestPath(concretePath);

    if (recipe.defaultBody && recipe.id.startsWith('post-order')) {
      try {
        const parsed = JSON.parse(recipe.defaultBody);
        parsed.idempotencyKey = generateUuidV4();
        setRequestBody(JSON.stringify(parsed, null, 2));
      } catch {
        setRequestBody(recipe.defaultBody);
      }
    } else {
      setRequestBody(recipe.defaultBody || '');
    }

    setResponseStatus(null);
    setResponseData(null);
  };

  const generateUuidV4 = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };

  const handleRegenerateUuid = () => {
    if (!requestBody) return;
    try {
      const parsed = JSON.parse(requestBody);
      parsed.idempotencyKey = generateUuidV4();
      setRequestBody(JSON.stringify(parsed, null, 2));
      toastSuccess('New Idempotency Key', 'Generated a fresh UUID v4 for this request.');
    } catch {
      toastError('Invalid JSON', 'Could not parse JSON body to update idempotencyKey.');
    }
  };

  const handleApiKeyChange = (val: string) => {
    setApiKey(val);
    try {
      localStorage.setItem('bytebeacon_sandbox_api_key', val);
    } catch {
      // Ignore
    }
  };

  const handleFormatJson = () => {
    if (!requestBody.trim()) return;
    try {
      const parsed = JSON.parse(requestBody);
      setRequestBody(JSON.stringify(parsed, null, 2));
      toastSuccess('Formatted', 'JSON body formatted cleanly.');
    } catch (e: any) {
      toastError('JSON Syntax Error', e.message || 'Malformed JSON');
    }
  };

  // Dispatch Blueprint API Call
  const handleSendRequest = async () => {
    if (!requestPath.trim()) {
      toastError('Path Required', 'Please enter a request path.');
      return;
    }

    setIsSending(true);
    setResponseStatus(null);
    setResponseData(null);
    setResponseLatency(null);

    const startTime = performance.now();

    const normalizedPath = requestPath.startsWith('/') ? requestPath : `/${requestPath}`;
    const targetUrl = `${baseUrl.replace(/\/+$/, '')}${normalizedPath}`;

    const headers: Record<string, string> = {
      Accept: 'application/json',
    };

    if (apiKey.trim()) {
      headers['x-api-key'] = apiKey.trim();
    }

    if (activeRecipe.method !== 'GET' && activeRecipe.method !== 'DELETE') {
      headers['Content-Type'] = 'application/json';
    }

    try {
      const fetchOptions: RequestInit = {
        method: activeRecipe.method,
        headers,
      };

      if (activeRecipe.method !== 'GET' && activeRecipe.method !== 'DELETE' && requestBody.trim()) {
        fetchOptions.body = requestBody.trim();
      }

      const res = await fetch(targetUrl, fetchOptions);
      const latency = Math.round(performance.now() - startTime);
      setResponseLatency(latency);
      setResponseStatus(res.status);
      setResponseStatusText(res.statusText || (res.status === 200 ? 'OK' : ''));

      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const json = await res.json();
        setResponseData(JSON.stringify(json, null, 2));
      } else {
        const text = await res.text();
        setResponseData(text || `// Empty body returned (Status ${res.status})`);
      }

      if (res.ok) {
        toastSuccess(`${res.status} ${res.statusText || 'Success'}`, `Received response in ${latency}ms`);
      } else {
        toastError(`${res.status} ${res.statusText || 'Error'}`, 'API returned error status code');
      }
    } catch (err: any) {
      const latency = Math.round(performance.now() - startTime);
      setResponseLatency(latency);
      setResponseStatus(0);
      setResponseStatusText('Network / Gateway Error');

      const failurePayload = {
        error: 'Network or gateway connection failed',
        message: err?.message || 'Failed to fetch',
        targetUrl,
        tips: [
          'Verify that your browser allows outbound requests to the target domain.',
          'Switch Host to "/api/v1" to route through your local ByteBeacon instance.',
          'Ensure your sandbox API key is active and formatted as ak_test_...',
        ],
      };
      setResponseData(JSON.stringify(failurePayload, null, 2));
      toastError('Connection Error', 'Could not complete browser fetch. See terminal details.');
    } finally {
      setIsSending(false);
    }
  };

  // Dispatch Carrier Simulation Call
  const handleSimulateCarrierDispatch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSimRunning(true);
    setSimResponseJson(null);

    const gbMatch = simCapacity.match(/(\d+)/);
    const gb = gbMatch ? parseInt(gbMatch[1], 10) : 5;
    const mb = gb * 1024;

    const isDeterministicFail = simPhone.trim().endsWith('0000') || simPhone.includes('9999');
    const outcome = isDeterministicFail ? 'FAILED' : simOutcome;

    try {
      const res: any = await apiClient.post('/developer/sandbox/simulate-fulfillment', {
        network: simNetwork,
        recipientPhone: simPhone.trim(),
        dataAmountMb: mb,
        simulateStatus: outcome,
      });

      const responsePayload = res?.data || res;
      setSimResponseJson(JSON.stringify(responsePayload, null, 2));
      if (outcome === 'FAILED') {
        toastError('Simulated Failure Dispatched', 'Simulated carrier rejection triggered deterministically.');
      } else {
        toastSuccess('Sandbox Carrier Dispatched', `Delivered ${simCapacity} ${simNetwork} bundle successfully.`);
      }
    } catch {
      // Client-side fallback if offline / standalone
      const mockResult = {
        success: outcome !== 'FAILED',
        statusCode: outcome === 'FAILED' ? 422 : 200,
        data: {
          orderId: `ord_sbx_${Date.now()}`,
          providerReference: `dh_sbx_${Math.floor(100000 + Math.random() * 900000)}`,
          network: simNetwork,
          recipientPhone: simPhone.trim(),
          dataAmountMb: mb,
          orderStatus: outcome === 'FAILED' ? 'FAILED' : 'COMPLETED',
          isSandbox: true,
          simulatedAt: new Date().toISOString(),
          failureReason: outcome === 'FAILED' ? 'SIMULATED_CARRIER_REJECTION: Number ending in 0000' : undefined,
          message: outcome === 'FAILED' ? 'Simulated carrier fulfillment failed.' : 'Sandbox telecom fulfillment simulation executed successfully.',
        },
      };
      setSimResponseJson(JSON.stringify(mockResult, null, 2));
      if (outcome === 'FAILED') {
        toastError('Simulated Failure Dispatched', 'Simulated carrier rejection triggered deterministically.');
      } else {
        toastSuccess('Sandbox Carrier Dispatched', `Delivered ${simCapacity} ${simNetwork} bundle successfully.`);
      }
    } finally {
      setSimRunning(false);
    }
  };

  // Run MTN Up2U Pre-check
  const handleRunMtnPrecheck = async () => {
    if (!simPhone.trim()) {
      toastError('Phone Required', 'Please enter a test phone number to pre-check.');
      return;
    }
    setSimPrechecking(true);
    setSimPrecheckResult(null);

    try {
      const res = await beneficiaryApi.precheckPublic({
        network: simNetwork as NetworkProvider,
        phoneNumbers: [simPhone.trim()],
      });
      const resultItem = res?.results?.[0];
      setSimPrecheckResult(resultItem || { phone: simPhone, known: !simPhone.endsWith('0000'), valid: true });
      if (resultItem?.known) {
        toastSuccess('MTN Validated', `${simPhone} is verified on Up2U list. Ready for instant delivery.`);
      } else {
        toastInfo('First-Time Number', `${simPhone} is not yet validated; would be recorded for MTN approval.`);
      }
    } catch {
      const isKnown = !simPhone.endsWith('0000') && !simPhone.includes('9999');
      const fallbackResult = {
        phone: simPhone.trim(),
        normalized: simPhone.trim(),
        valid: true,
        known: isKnown,
        accountName: isKnown ? 'Verified Subscriber' : undefined,
      };
      setSimPrecheckResult(fallbackResult);
      if (isKnown) {
        toastSuccess('MTN Validated', `${simPhone} is verified on Up2U list. Ready for instant delivery.`);
      } else {
        toastInfo('First-Time Number', `${simPhone} is recorded for MTN approval.`);
      }
    } finally {
      setSimPrechecking(false);
    }
  };

  const handleCopyResponse = () => {
    if (!responseData) return;
    navigator.clipboard.writeText(responseData);
    setHasCopiedResponse(true);
    toastSuccess('Copied', 'Response payload copied to clipboard');
    setTimeout(() => setHasCopiedResponse(false), 2000);
  };

  const handleCopyCurl = () => {
    const normalizedPath = requestPath.startsWith('/') ? requestPath : `/${requestPath}`;
    const targetUrl = `${baseUrl.replace(/\/+$/, '')}${normalizedPath}`;

    let cmd = `curl -X ${activeRecipe.method} "${targetUrl}" \
`;
    if (apiKey.trim()) {
      cmd += `  -H "x-api-key: ${apiKey.trim()}" \
`;
    }
    if (activeRecipe.method !== 'GET' && activeRecipe.method !== 'DELETE') {
      cmd += `  -H "Content-Type: application/json" \
`;
      if (requestBody.trim()) {
        cmd += `  -d '${requestBody.replace(/'/g, "'\''")}'`;
      }
    } else {
      cmd = cmd.trim().replace(/\$/, '');
    }

    navigator.clipboard.writeText(cmd);
    setHasCopiedCurl(true);
    toastSuccess('Copied as cURL', 'cURL command copied to clipboard.');
    setTimeout(() => setHasCopiedCurl(false), 2000);
  };

  const getMethodBadge = (method: string) => {
    switch (method) {
      case 'GET':
        return (
          <span
            style={{
              padding: '3px 8px',
              borderRadius: 'var(--radius-xs)',
              fontSize: '11px',
              fontWeight: 800,
              fontFamily: 'var(--font-mono)',
              color: '#0284C7',
              backgroundColor: 'rgba(56, 189, 248, 0.14)',
              border: '1px solid rgba(56, 189, 248, 0.35)',
              display: 'inline-flex',
              alignItems: 'center',
              letterSpacing: '0.04em',
            }}
          >
            GET
          </span>
        );
      case 'POST':
        return (
          <span
            style={{
              padding: '3px 8px',
              borderRadius: 'var(--radius-xs)',
              fontSize: '11px',
              fontWeight: 800,
              fontFamily: 'var(--font-mono)',
              color: '#059669',
              backgroundColor: 'rgba(16, 185, 129, 0.14)',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              display: 'inline-flex',
              alignItems: 'center',
              letterSpacing: '0.04em',
            }}
          >
            POST
          </span>
        );
      case 'DELETE':
        return (
          <span
            style={{
              padding: '3px 8px',
              borderRadius: 'var(--radius-xs)',
              fontSize: '11px',
              fontWeight: 800,
              fontFamily: 'var(--font-mono)',
              color: '#E11D48',
              backgroundColor: 'rgba(244, 63, 94, 0.14)',
              border: '1px solid rgba(244, 63, 94, 0.35)',
              display: 'inline-flex',
              alignItems: 'center',
              letterSpacing: '0.04em',
            }}
          >
            DELETE
          </span>
        );
      default:
        return <Badge variant="neutral">{method}</Badge>;
    }
  };

  const isTestKey = apiKey.trim().startsWith('ak_test_');

  return (
    <div
      style={{
        maxWidth: '1240px',
        margin: '0 auto',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-6)',
        paddingBottom: 'var(--space-12)',
      }}
    >
      {/* Top Header & Context Overview */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <h1
            style={{
              fontSize: 'var(--font-size-2xl)',
              fontWeight: 800,
              color: 'var(--color-text-primary)',
              letterSpacing: '-0.02em',
              margin: 0,
            }}
          >
            Sandbox playground
          </h1>
          <span
            style={{
              padding: '4px 12px',
              borderRadius: 'var(--radius-full)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 700,
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              color: '#059669',
              border: '1px solid rgba(16, 185, 129, 0.28)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Sparkles size={13} />
            Try the Agent API
          </span>
        </div>

        <p
          style={{
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-secondary)',
            margin: 0,
            lineHeight: 1.6,
          }}
        >
          Pick a recipe, paste a sandbox key, hit run. No wallet movement, no supplier calls, no Paystack charges.
          Need a sandbox key?{' '}
          <a
            href="https://www.getmorepaylessdatahouse.net/agent/api"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: '#059669',
              fontWeight: 700,
              textDecoration: 'underline',
              textUnderlineOffset: '3px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'color var(--transition-fast)',
            }}
          >
            Mint one →
          </a>
        </p>
      </div>

      {/* Info Callout Banner matching user spec */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 'var(--space-3)',
          padding: 'var(--space-4)',
          backgroundColor: 'rgba(56, 189, 248, 0.08)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-tactile-sm)',
        }}
      >
        <TactileIcon icon={Terminal} color="analytics" size="sm" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-text-primary)',
              margin: 0,
              lineHeight: 1.5,
              fontWeight: 500,
            }}
          >
            Requests fire from your browser straight to{' '}
            <code
              style={{
                fontFamily: 'var(--font-mono)',
                backgroundColor: 'rgba(56, 189, 248, 0.14)',
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '11px',
                color: '#0284C7',
                fontWeight: 600,
              }}
            >
              https://api.getmorepaylessdatahouse.net/api/v1
            </code>
            . Sandbox keys never reach the supplier; phone numbers ending in{' '}
            <strong style={{ color: '#0284C7' }}>0000</strong> deterministically fail to fulfill for testing your error
            paths.
          </p>
        </div>
      </div>

      {/* Mode Navigation Tabs (ByteBeacon 2.0 Tactile Segmented Control) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          padding: '4px',
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          borderRadius: 'var(--radius-xl)',
          width: 'fit-content',
          boxShadow: 'var(--shadow-tactile-sm)',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('blueprints')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 18px',
            borderRadius: 'var(--radius-lg)',
            border: activeTab === 'blueprints' ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid transparent',
            backgroundColor: activeTab === 'blueprints' ? '#FFFFFF' : 'transparent',
            color: activeTab === 'blueprints' ? '#065F46' : 'var(--color-text-secondary)',
            fontWeight: activeTab === 'blueprints' ? 800 : 600,
            fontSize: 'var(--font-size-xs)',
            cursor: 'pointer',
            boxShadow: activeTab === 'blueprints' ? '0 2px 6px rgba(0, 0, 0, 0.06)' : 'none',
            transition: 'all var(--transition-normal)',
          }}
        >
          <Code size={15} color={activeTab === 'blueprints' ? '#059669' : 'currentColor'} />
          API Blueprints & Runner
          <span
            style={{
              padding: '2px 6px',
              borderRadius: 'var(--radius-full)',
              fontSize: '10px',
              fontWeight: 800,
              backgroundColor: activeTab === 'blueprints' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(0,0,0,0.05)',
              color: activeTab === 'blueprints' ? '#059669' : 'var(--color-text-tertiary)',
            }}
          >
            11
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('carrier')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 18px',
            borderRadius: 'var(--radius-lg)',
            border: activeTab === 'carrier' ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid transparent',
            backgroundColor: activeTab === 'carrier' ? '#FFFFFF' : 'transparent',
            color: activeTab === 'carrier' ? '#065F46' : 'var(--color-text-secondary)',
            fontWeight: activeTab === 'carrier' ? 800 : 600,
            fontSize: 'var(--font-size-xs)',
            cursor: 'pointer',
            boxShadow: activeTab === 'carrier' ? '0 2px 6px rgba(0, 0, 0, 0.06)' : 'none',
            transition: 'all var(--transition-normal)',
          }}
        >
          <Radio size={15} color={activeTab === 'carrier' ? '#059669' : 'currentColor'} />
          Carrier Dispatch Simulator (MTN • Telecel • AT)
          <span
            style={{
              padding: '2px 6px',
              borderRadius: 'var(--radius-full)',
              fontSize: '10px',
              fontWeight: 800,
              backgroundColor: 'rgba(245, 158, 11, 0.15)',
              color: '#D97706',
            }}
          >
            Live Telecom
          </span>
        </button>
      </div>

      {/* TAB 1: API BLUEPRINTS WORKSPACE */}
      {activeTab === 'blueprints' && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(300px, 340px) minmax(0, 1fr)',
            gap: 'var(--space-6)',
            alignItems: 'start',
          }}
        >
          {/* Left Column: API Blueprints Directory */}
          <Card
            elevated
            style={{
              padding: 0,
              overflow: 'hidden',
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--color-border-default)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-tactile-sm)',
            }}
          >
            <div
              style={{
                padding: 'var(--space-4)',
                borderBottom: '1px solid var(--color-border-default)',
                backgroundColor: 'rgba(240, 253, 244, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Code size={16} color="var(--color-brand)" />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span
                    style={{
                      fontSize: 'var(--font-size-sm)',
                      fontWeight: 800,
                      color: 'var(--color-text-primary)',
                      letterSpacing: '-0.01em',
                    }}
                  >
                    API Blueprints
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', fontWeight: 600 }}>
                    Recipes
                  </span>
                </div>
              </div>
              <Badge variant="neutral" size="sm">
                11 Endpoints
              </Badge>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                maxHeight: '680px',
                overflowY: 'auto',
                padding: 'var(--space-2)',
                gap: '4px',
              }}
            >
              {SANDBOX_RECIPES.map((recipe) => {
                const isSelected = selectedRecipeId === recipe.id;
                return (
                  <button
                    key={recipe.id}
                    type="button"
                    onClick={() => handleSelectRecipe(recipe)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: '4px',
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: isSelected ? '1px solid rgba(16, 185, 129, 0.45)' : '1px solid transparent',
                      backgroundColor: isSelected ? 'rgba(16, 185, 129, 0.08)' : 'transparent',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all var(--transition-fast)',
                      outline: 'none',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.04)';
                        e.currentTarget.style.transform = 'translateX(2px)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.transform = 'translateX(0px)';
                      }
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        width: '100%',
                      }}
                    >
                      {getMethodBadge(recipe.method)}
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '12px',
                          fontWeight: 700,
                          color: isSelected ? '#059669' : 'var(--color-text-primary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {recipe.path}
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: '12px',
                        color: isSelected ? '#065F46' : 'var(--color-text-secondary)',
                        fontWeight: isSelected ? 700 : 500,
                        paddingLeft: '2px',
                      }}
                    >
                      {recipe.subtitle}
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Right Column: Execution Workspace & Terminal */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            <Card
              elevated
              style={{
                padding: 'var(--space-6)',
                backgroundColor: '#FFFFFF',
                border: '1px solid var(--color-border-default)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-tactile-sm)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-5)',
              }}
            >
              {/* Selected Blueprint Header Banner */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  paddingBottom: 'var(--space-4)',
                  borderBottom: '1px solid var(--color-border-default)',
                  flexWrap: 'wrap',
                  gap: 'var(--space-3)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    {getMethodBadge(activeRecipe.method)}
                    <h2
                      style={{
                        fontSize: 'var(--font-size-base)',
                        fontWeight: 800,
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--color-text-primary)',
                        margin: 0,
                      }}
                    >
                      {activeRecipe.title}
                    </h2>
                  </div>
                  <p
                    style={{
                      fontSize: 'var(--font-size-xs)',
                      color: 'var(--color-text-secondary)',
                      margin: 0,
                      lineHeight: 1.4,
                    }}
                  >
                    {activeRecipe.description}
                  </p>
                </div>

                {/* Endpoint Target Toggle */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: 'rgba(0, 0, 0, 0.03)',
                    padding: '4px 8px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border-default)',
                  }}
                >
                  <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', fontWeight: 600 }}>Host:</span>
                  <select
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    style={{
                      fontSize: '11px',
                      fontFamily: 'var(--font-mono)',
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: 'var(--color-text-secondary)',
                      outline: 'none',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    <option value={DEFAULT_SANDBOX_BASE_URL}>Gateway Sandbox (Default)</option>
                    <option value="/api/v1">Current ByteBeacon Server (/api/v1)</option>
                  </select>
                </div>
              </div>

              {/* Request Path Input */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label
                  style={{
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 700,
                    color: 'var(--color-text-primary)',
                  }}
                >
                  Request path
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      flex: 1,
                      border: '1px solid var(--color-border-default)',
                      borderRadius: 'var(--radius-md)',
                      overflow: 'hidden',
                      backgroundColor: '#FAFAFA',
                    }}
                  >
                    <span
                      style={{
                        padding: '8px 12px',
                        backgroundColor: 'rgba(0, 0, 0, 0.04)',
                        borderRight: '1px solid var(--color-border-default)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '12px',
                        color: 'var(--color-text-tertiary)',
                        fontWeight: 600,
                        userSelect: 'none',
                      }}
                    >
                      /api/v1
                    </span>
                    <input
                      type="text"
                      value={requestPath}
                      onChange={(e) => setRequestPath(e.target.value)}
                      placeholder="/agent/me"
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        border: 'none',
                        backgroundColor: 'transparent',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '13px',
                        color: 'var(--color-text-primary)',
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Sandbox API Key Input */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label
                    style={{
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 700,
                      color: 'var(--color-text-primary)',
                    }}
                  >
                    Sandbox API key
                  </label>
                  {apiKey && (
                    <span
                      style={{
                        fontSize: '11px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        color: isTestKey ? '#059669' : '#D97706',
                        fontWeight: 600,
                      }}
                    >
                      {isTestKey ? (
                        <>
                          <ShieldCheck size={12} /> Valid sandbox prefix
                        </>
                      ) : (
                        <>
                          <AlertTriangle size={12} /> Expected ak_test_... prefix
                        </>
                      )}
                    </span>
                  )}
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    border: '1px solid var(--color-border-default)',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: '#FFFFFF',
                    paddingRight: '8px',
                  }}
                >
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => handleApiKeyChange(e.target.value)}
                    placeholder="ak_test_xxxxxxxxxxxxxxxxxxxxxxxx"
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      border: 'none',
                      outline: 'none',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '13px',
                      color: 'var(--color-text-primary)',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--color-text-secondary)',
                      padding: '4px',
                    }}
                    title={showApiKey ? 'Hide key' : 'Show key'}
                  >
                    {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>
                    Stored safely in local session for testing. Never charges live GHS floats.
                  </span>
                  <a
                    href="https://www.getmorepaylessdatahouse.net/agent/api"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: '11px',
                      color: '#059669',
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '3px',
                    }}
                  >
                    Mint key <ExternalLink size={10} />
                  </a>
                </div>
              </div>

              {/* Request Body Editor (shown for POST requests) */}
              {activeRecipe.method !== 'GET' && activeRecipe.method !== 'DELETE' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label
                      style={{
                        fontSize: 'var(--font-size-xs)',
                        fontWeight: 700,
                        color: 'var(--color-text-primary)',
                      }}
                    >
                      Request Body (JSON)
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {requestBody.includes('idempotencyKey') && (
                        <button
                          type="button"
                          onClick={handleRegenerateUuid}
                          style={{
                            background: 'none',
                            border: 'none',
                            fontSize: '11px',
                            color: 'var(--color-brand)',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <RotateCcw size={11} /> New Idempotency Key
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleFormatJson}
                        style={{
                          background: 'none',
                          border: 'none',
                          fontSize: '11px',
                          color: 'var(--color-text-secondary)',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Prettify JSON
                      </button>
                    </div>
                  </div>

                  <textarea
                    value={requestBody}
                    onChange={(e) => setRequestBody(e.target.value)}
                    rows={7}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border-default)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '12px',
                      lineHeight: 1.5,
                      backgroundColor: '#FAFAFA',
                      color: '#0F172A',
                      resize: 'vertical',
                      outline: 'none',
                    }}
                  />
                </div>
              )}

              {/* Action Bar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: 'var(--space-2)',
                  flexWrap: 'wrap',
                  gap: 'var(--space-3)',
                }}
              >
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopyCurl}
                  leftIcon={hasCopiedCurl ? <Check size={14} color="#059669" /> : <Copy size={14} />}
                >
                  {hasCopiedCurl ? 'cURL Copied' : 'Copy cURL'}
                </Button>

                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  isLoading={isSending}
                  onClick={handleSendRequest}
                  leftIcon={<Play size={15} />}
                  style={{
                    minWidth: '160px',
                    backgroundColor: '#059669',
                    borderColor: '#059669',
                  }}
                >
                  Send request
                </Button>
              </div>
            </Card>

            {/* Response Output Terminal */}
            <Card
              elevated
              style={{
                padding: 0,
                backgroundColor: '#0B1325',
                border: '1px solid #1E293B',
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
                boxShadow: 'var(--shadow-tactile-md)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 16px',
                  borderBottom: '1px solid #1E293B',
                  backgroundColor: '#070D19',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#94A3B8' }}>
                    Response
                  </span>

                  {responseStatus !== null && (
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 800,
                        fontFamily: 'var(--font-mono)',
                        backgroundColor:
                          responseStatus >= 200 && responseStatus < 300
                            ? 'rgba(16, 185, 129, 0.2)'
                            : responseStatus === 0
                            ? 'rgba(239, 68, 68, 0.2)'
                            : 'rgba(245, 158, 11, 0.2)',
                        color:
                          responseStatus >= 200 && responseStatus < 300
                            ? '#34D399'
                            : responseStatus === 0
                            ? '#F87171'
                            : '#FBBF24',
                        border: `1px solid ${
                          responseStatus >= 200 && responseStatus < 300
                            ? 'rgba(16, 185, 129, 0.4)'
                            : responseStatus === 0
                            ? 'rgba(239, 68, 68, 0.4)'
                            : 'rgba(245, 158, 11, 0.4)'
                        }`,
                      }}
                    >
                      {responseStatus === 0 ? 'Network Error' : `${responseStatus} ${responseStatusText}`}
                    </span>
                  )}

                  {responseLatency !== null && (
                    <span
                      style={{
                        fontSize: '11px',
                        color: '#64748B',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      <Clock size={11} /> {responseLatency}ms
                    </span>
                  )}
                </div>

                {responseData && (
                  <button
                    type="button"
                    onClick={handleCopyResponse}
                    style={{
                      background: 'transparent',
                      border: '1px solid #334155',
                      borderRadius: 'var(--radius-sm)',
                      padding: '4px 8px',
                      color: '#94A3B8',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    {hasCopiedResponse ? <Check size={12} color="#34D399" /> : <Copy size={12} />}
                    {hasCopiedResponse ? 'Copied' : 'Copy JSON'}
                  </button>
                )}
              </div>

              <pre
                style={{
                  margin: 0,
                  padding: 'var(--space-4)',
                  color: responseData ? '#38BDF8' : '#475569',
                  fontSize: '12px',
                  fontFamily: 'var(--font-mono)',
                  lineHeight: 1.6,
                  minHeight: '260px',
                  maxHeight: '440px',
                  overflowX: 'auto',
                  overflowY: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}
              >
                {responseData ||
                  '// Ready. Select an API blueprint, paste your sandbox API key (ak_test_...), and click "Send request".'}
              </pre>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: CARRIER DISPATCH & UP2U SIMULATOR */}
      {activeTab === 'carrier' && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1.3fr)',
            gap: 'var(--space-6)',
            alignItems: 'start',
          }}
        >
          {/* Form Card */}
          <Card
            elevated
            style={{
              padding: 'var(--space-6)',
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--color-border-default)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-tactile-sm)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-5)',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <TactileIcon icon={Radio} color="analytics" size="sm" />
                <h2
                  style={{
                    fontSize: 'var(--font-size-base)',
                    fontWeight: 800,
                    color: 'var(--color-text-primary)',
                    margin: 0,
                  }}
                >
                  Simulate Carrier Bundle Purchase
                </h2>
              </div>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: 0 }}>
                Test direct telecom carrier provisioning, Up2U pre-check compliance, and error failovers.
              </p>
            </div>

            <form onSubmit={handleSimulateCarrierDispatch} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {/* Carrier Selection with colored network badges */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  Carrier Network
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {[
                    { id: 'MTN', label: 'MTN Ghana', color: '#D97706', bg: 'rgba(245, 158, 11, 0.12)' },
                    { id: 'TELECEL', label: 'Telecel Ghana', color: '#DC2626', bg: 'rgba(239, 68, 68, 0.12)' },
                    { id: 'AIRTELTIGO', label: 'AirtelTigo', color: '#2563EB', bg: 'rgba(37, 99, 235, 0.12)' },
                  ].map((net) => {
                    const isSelected = simNetwork === net.id;
                    return (
                      <button
                        key={net.id}
                        type="button"
                        onClick={() => setSimNetwork(net.id)}
                        style={{
                          padding: '10px 8px',
                          borderRadius: 'var(--radius-md)',
                          border: isSelected ? `2px solid ${net.color}` : '1px solid var(--color-border-default)',
                          backgroundColor: isSelected ? net.bg : '#FAFAFA',
                          color: isSelected ? net.color : 'var(--color-text-secondary)',
                          fontWeight: isSelected ? 800 : 600,
                          fontSize: '12px',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '4px',
                          transition: 'all var(--transition-fast)',
                        }}
                      >
                        <Smartphone size={16} />
                        {net.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* MTN Up2U Rule Callout */}
              {simNetwork === 'MTN' && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'rgba(245, 158, 11, 0.08)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertTriangle size={14} color="#D97706" />
                    <span style={{ fontSize: '11px', color: '#92400E', fontWeight: 600 }}>
                      MTN Up2U First-Time Number Validation applies
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRunMtnPrecheck}
                    disabled={simPrechecking}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#B45309',
                      fontSize: '11px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      textDecoration: 'underline',
                    }}
                  >
                    {simPrechecking ? 'Checking...' : 'Pre-check Number →'}
                  </button>
                </div>
              )}

              {/* Precheck Result Toast / Banner */}
              {simPrecheckResult && (
                <div
                  style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: simPrecheckResult.known ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    border: `1px solid ${simPrecheckResult.known ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                    fontSize: '11px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: simPrecheckResult.known ? '#065F46' : '#991B1B',
                  }}
                >
                  {simPrecheckResult.known ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                  <span>
                    <strong>{simPrecheckResult.phone}</strong>:{' '}
                    {simPrecheckResult.known
                      ? 'Approved & validated on MTN switch. Direct delivery allowed.'
                      : 'First-time number. Would be queued for MTN batch approval.'}
                  </span>
                </div>
              )}

              {/* Phone Input with Ghanaian MSISDN formatting */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <PhoneInput
                  label="Test Recipient Phone"
                  value={simPhone}
                  onChange={(e) => setSimPhone(e.target.value)}
                  hint="Use 0241234567 for instant success or 0240000000 to test deterministic failover."
                />

                {/* Quick Phone Fill Presets */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
                  <button
                    type="button"
                    onClick={() => setSimPhone('0241234567')}
                    style={{
                      fontSize: '10px',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-full)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      backgroundColor: 'rgba(16, 185, 129, 0.08)',
                      color: '#065F46',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    + MTN Valid (0241234567)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSimPhone('0240000000')}
                    style={{
                      fontSize: '10px',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-full)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      backgroundColor: 'rgba(239, 68, 68, 0.08)',
                      color: '#991B1B',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    + Failover (Ends 0000)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSimPhone('0208123456')}
                    style={{
                      fontSize: '10px',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-full)',
                      border: '1px solid rgba(37, 99, 235, 0.3)',
                      backgroundColor: 'rgba(37, 99, 235, 0.08)',
                      color: '#1E40AF',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    + Telecel (0208123456)
                  </button>
                </div>
              </div>

              {/* Bundle Capacity */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <Input
                  label="Bundle Capacity"
                  value={simCapacity}
                  onChange={(e) => setSimCapacity(e.target.value)}
                  placeholder="5GB"
                />
                <div style={{ display: 'flex', gap: '6px' }}>
                  {['1GB', '2GB', '5GB', '10GB', '20GB'].map((cap) => (
                    <button
                      key={cap}
                      type="button"
                      onClick={() => setSimCapacity(cap)}
                      style={{
                        padding: '3px 8px',
                        fontSize: '11px',
                        borderRadius: 'var(--radius-sm)',
                        border: simCapacity === cap ? '1px solid var(--color-brand)' : '1px solid var(--color-border-default)',
                        backgroundColor: simCapacity === cap ? 'rgba(16, 185, 129, 0.1)' : '#FAFAFA',
                        color: simCapacity === cap ? '#059669' : 'var(--color-text-secondary)',
                        fontWeight: simCapacity === cap ? 700 : 500,
                        cursor: 'pointer',
                      }}
                    >
                      {cap}
                    </button>
                  ))}
                </div>
              </div>

              {/* Simulation Outcome */}
              <Select
                label="Simulated Carrier Outcome"
                value={simOutcome}
                onChange={(e) => setSimOutcome(e.target.value as any)}
                options={[
                  { label: 'COMPLETED — Instant Carrier Fulfillment', value: 'COMPLETED' },
                  { label: 'FAILED — Reject & Trigger Automated Float Refund', value: 'FAILED' },
                  { label: 'DELAYED — Queue in Processing State', value: 'DELAYED' },
                ]}
                hint="Numbers ending in 0000 automatically force FAILED regardless of selection."
              />

              <Button
                type="submit"
                variant="primary"
                size="md"
                fullWidth
                isLoading={simRunning}
                leftIcon={<Play size={15} />}
                style={{
                  backgroundColor: '#059669',
                  borderColor: '#059669',
                  marginTop: 'var(--space-2)',
                }}
              >
                Run Sandbox Dispatch
              </Button>
            </form>
          </Card>

          {/* Simulated Carrier Response Output */}
          <Card
            elevated
            style={{
              padding: 'var(--space-6)',
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--color-border-default)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-tactile-sm)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-4)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Zap size={16} color="var(--color-brand)" />
                <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                  Simulated Carrier Telemetry
                </span>
              </div>
              {simResponseJson && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(simResponseJson);
                    toastSuccess('Copied', 'Carrier response copied to clipboard');
                  }}
                  leftIcon={<Copy size={12} />}
                >
                  Copy JSON
                </Button>
              )}
            </div>

            <pre
              style={{
                backgroundColor: '#0B1325',
                color: '#38BDF8',
                padding: 'var(--space-4)',
                borderRadius: 'var(--radius-md)',
                fontSize: '12px',
                fontFamily: 'var(--font-mono)',
                lineHeight: 1.6,
                overflowX: 'auto',
                minHeight: '280px',
                maxHeight: '440px',
                border: '1px solid #1E293B',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              {simResponseJson || '// Click "Run Sandbox Dispatch" to test mock telecom fulfillment'}
            </pre>
          </Card>
        </div>
      )}
    </div>
  );
};
