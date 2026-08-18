import React, { useState } from 'react';
import { Card } from '../../components/ui/Card/Card.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Select, PhoneInput, Input } from '../../components/ui/index.js';
import { Badge } from '../../components/ui/Badge/Badge.js';
import { TactileIcon } from '../../components/ui/TactileIcon/TactileIcon.js';
import { Terminal, Play, Copy } from 'lucide-react';
import { useToast } from '../../context/ToastContext.js';

export const AgentSandboxPage: React.FC = () => {
  const { toastSuccess } = useToast();
  const [network, setNetwork] = useState('MTN');
  const [phone, setPhone] = useState('0240000000');
  const [volume, setVolume] = useState('5GB');
  const [running, setRunning] = useState(false);
  const [responseJson, setResponseJson] = useState<string | null>(null);

  const handleSimulate = (e: React.FormEvent) => {
    e.preventDefault();
    setRunning(true);
    setResponseJson(null);

    setTimeout(() => {
      setRunning(false);
      const mockResult = {
        success: true,
        environment: 'SANDBOX_SIMULATOR',
        data: {
          transactionId: `sbx_${Date.now()}`,
          network,
          recipient: phone,
          package: volume,
          status: 'DELIVERED',
          simulatedCost: 'GH₵ 25.00',
          mockCarrierResponse: 'SIM_CREDITED_SUCCESS',
          timestamp: new Date().toISOString(),
        },
      };
      setResponseJson(JSON.stringify(mockResult, null, 2));
      toastSuccess('Sandbox Simulation Passed', 'Simulated carrier delivery completed successfully.');
    }, 600);
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Sandbox Warning Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-4)',
          padding: 'var(--space-4)',
          backgroundColor: 'rgba(56, 189, 248, 0.1)',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          borderRadius: 'var(--radius-lg)',
        }}
      >
        <TactileIcon icon={Terminal} color="analytics" size="sm" />
        <div style={{ flexGrow: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, color: '#0284C7' }}>
              SANDBOX SIMULATION ENVIRONMENT
            </span>
            <Badge variant="info" size="sm">ZERO REAL MONEY CHARGED</Badge>
          </div>
          <p style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-secondary)', margin: '0.15rem 0 0 0' }}>
            Test your order fulfillment webhooks and REST API integrations without deducting from your live wallet float.
          </p>
        </div>
      </div>

      {/* Simulator Workspace */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1.4fr)', gap: 'var(--space-6)', alignItems: 'start' }}>
        {/* Form Card */}
        <Card elevated style={{ padding: 'var(--space-6)' }}>
          <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)', marginBottom: 'var(--space-4)' }}>
            Simulate Bundle Purchase
          </h2>

          <form onSubmit={handleSimulate} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <Select
              label="Carrier Network"
              value={network}
              onChange={(e) => setNetwork(e.target.value)}
              options={[
                { label: 'MTN Ghana', value: 'MTN' },
                { label: 'Telecel Ghana', value: 'TELECEL' },
                { label: 'AirtelTigo', value: 'AIRTELTIGO' },
              ]}
            />

            <PhoneInput
              label="Test Recipient Phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              hint="Use 0240000000 for instant success or 0249999999 to simulate failover."
            />

            <Input
              label="Bundle Capacity"
              value={volume}
              onChange={(e) => setVolume(e.target.value)}
            />

            <Button
              type="submit"
              variant="primary"
              size="md"
              fullWidth
              isLoading={running}
              leftIcon={<Play size={15} />}
            >
              Run Sandbox Dispatch
            </Button>
          </form>
        </Card>

        {/* Response JSON Output */}
        <Card elevated style={{ padding: 'var(--space-6)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
              Simulated API Response
            </span>
            {responseJson && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(responseJson);
                  toastSuccess('Copied', 'JSON copied to clipboard');
                }}
                leftIcon={<Copy size={12} />}
              >
                Copy JSON
              </Button>
            )}
          </div>

          <pre
            style={{
              backgroundColor: '#050914',
              color: '#38BDF8',
              padding: 'var(--space-4)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-size-xs)',
              fontFamily: 'var(--font-mono)',
              overflowX: 'auto',
              minHeight: '220px',
              border: '1px solid var(--color-border-default)',
            }}
          >
            {responseJson || '// Click "Run Sandbox Dispatch" to test mock payload'}
          </pre>
        </Card>
      </div>
    </div>
  );
};
