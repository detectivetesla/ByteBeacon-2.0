import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card/Card.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Badge } from '../../components/ui/Badge/Badge.js';
import { SearchInput } from '../../components/ui/index.js';
import { TactileIcon } from '../../components/ui/TactileIcon/TactileIcon.js';
import {
  BookOpen,
  Key,
  Terminal,
  Activity,
  Webhook,
  Copy,
  Check,
  ShieldCheck,
  ArrowRight,
  Code2,
  Server,
  Layers,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Send,
  Smartphone,
  CreditCard,
  Shield,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext.js';

interface SectionNavItem {
  id: string;
  title: string;
  category: string;
  badge?: string;
}

const SECTIONS: SectionNavItem[] = [
  { id: 'sec-overview', title: '1. Overview & Architecture', category: 'Getting Started' },
  { id: 'sec-auth', title: '2. Authentication', category: 'Getting Started', badge: 'Required' },
  { id: 'sec-idempotency', title: '3. Idempotency Keys', category: 'Core Concepts' },
  { id: 'sec-ratelimits', title: '4. Rate Limits & Headers', category: 'Core Concepts' },
  { id: 'sec-bundles', title: '5. Networks & Packages', category: 'Endpoints', badge: 'GET' },
  { id: 'sec-create-order', title: '6. Create Order (Dispatch)', category: 'Endpoints', badge: 'POST' },
  { id: 'sec-query-order', title: '7. Query Order Status', category: 'Endpoints', badge: 'GET' },
  { id: 'sec-wallet', title: '8. Wallet & Balance', category: 'Endpoints', badge: 'GET' },
  { id: 'sec-validation', title: '9. Number Validation', category: 'Endpoints', badge: 'POST' },
  { id: 'sec-webhooks', title: '10. Webhooks & Events', category: 'Webhooks' },
  { id: 'sec-signatures', title: '11. Signature Verification', category: 'Webhooks', badge: 'HMAC' },
  { id: 'sec-errors', title: '12. Error Codes & Envelopes', category: 'Reference' },
  { id: 'sec-sdks', title: '13. Code Examples & SDKs', category: 'Reference' },
];

export const DeveloperPortal: React.FC = () => {
  const navigate = useNavigate();
  const { toastSuccess } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [activeLang, setActiveLang] = useState<'curl' | 'nodejs' | 'python' | 'php' | 'go'>('curl');
  const [activeSectionId, setActiveSectionId] = useState('sec-overview');

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedSection(id);
    toastSuccess('Code Copied', 'Snippet copied to clipboard.');
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const scrollToSection = (id: string) => {
    setActiveSectionId(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return SECTIONS;
    const q = searchQuery.toLowerCase();
    return SECTIONS.filter(
      (s) => s.title.toLowerCase().includes(q) || s.category.toLowerCase().includes(q),
    );
  }, [searchQuery]);

  // Code Snippets
  const codeExamples = {
    curl: `curl -X POST https://api.bytebeacon.com/api/v1/agent/orders \\
  -H "Authorization: Bearer ak_live_99f82a71d0e415b3ca61" \\
  -H "Idempotency-Key: idem_01J123456789" \\
  -H "Content-Type: application/json" \\
  -d '{
    "bundleId": "mtn_10gb_promo",
    "phoneNumber": "0241112233",
    "network": "MTN"
  }'`,
    nodejs: `import axios from 'axios';

const response = await axios.post(
  'https://api.bytebeacon.com/api/v1/agent/orders',
  {
    bundleId: 'mtn_10gb_promo',
    phoneNumber: '0241112233',
    network: 'MTN',
  },
  {
    headers: {
      'Authorization': 'Bearer ak_live_99f82a71d0e415b3ca61',
      'Idempotency-Key': 'idem_' + Date.now(),
      'Content-Type': 'application/json',
    },
  }
);

console.log(response.data);`,
    python: `import requests

url = "https://api.bytebeacon.com/api/v1/agent/orders"
headers = {
    "Authorization": "Bearer ak_live_99f82a71d0e415b3ca61",
    "Idempotency-Key": "idem_unique_key_123",
    "Content-Type": "application/json",
}
payload = {
    "bundleId": "mtn_10gb_promo",
    "phoneNumber": "0241112233",
    "network": "MTN",
}

response = requests.post(url, json=payload, headers=headers)
print(response.json())`,
    php: `<?php
$ch = curl_init('https://api.bytebeacon.com/api/v1/agent/orders');
$payload = json_encode([
    'bundleId' => 'mtn_10gb_promo',
    'phoneNumber' => '0241112233',
    'network' => 'MTN'
]);

curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Authorization: Bearer ak_live_99f82a71d0e415b3ca61',
    'Idempotency-Key: idem_' . uniqid(),
    'Content-Type: application/json'
]);

$response = curl_exec($ch);
curl_close($ch);
echo $response;
?>`,
    go: `package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
)

func main() {
	payload, _ := json.Marshal(map[string]string{
		"bundleId":    "mtn_10gb_promo",
		"phoneNumber": "0241112233",
		"network":     "MTN",
	})

	req, _ := http.NewRequest("POST", "https://api.bytebeacon.com/api/v1/agent/orders", bytes.NewBuffer(payload))
	req.Header.Set("Authorization", "Bearer ak_live_99f82a71d0e415b3ca61")
	req.Header.Set("Idempotency-Key", "idem_unique_key_123")
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, _ := client.Do(req)
	defer resp.Body.Close()

	fmt.Println("Status:", resp.Status)
}`,
  };

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', padding: 'var(--space-4) 0' }}>
      {/* 1. Portal Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <TactileIcon icon={BookOpen} color="api" size="sm" />
            <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 900, color: 'var(--color-text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
              ByteBeacon Developer Portal
            </h1>
          </div>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0.25rem 0 0 0' }}>
            Official REST API documentation, webhook specifications, and integration guides for automated telecom fulfillment.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Badge variant="purple" size="md">REST API v1.0</Badge>
          <Badge variant="success" dot size="md">Production Ready</Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/agent/sandbox')}
            leftIcon={<Terminal size={14} />}
          >
            Open Sandbox
          </Button>
        </div>
      </div>

      {/* 2. Developer Hub Quick Links */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
        <div
          onClick={() => navigate('/agent/api')}
          style={{
            padding: 'var(--space-4)',
            borderRadius: 'var(--radius-xl)',
            background: 'linear-gradient(145deg, var(--color-bg-surface-elevated), var(--color-bg-surface))',
            border: '1px solid var(--color-border-default)',
            boxShadow: 'var(--shadow-tactile-sm)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            transition: 'all 120ms ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--color-primary)')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--color-border-default)')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(139, 92, 246, 0.15)', border: '1px solid rgba(139, 92, 246, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8B5CF6' }}>
              <Key size={18} strokeWidth={2.4} />
            </div>
            <div>
              <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, color: 'var(--color-text-primary)' }}>API Keys</div>
              <div style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>Generate & rotate secrets</div>
            </div>
          </div>
          <ArrowRight size={14} color="var(--color-text-muted)" />
        </div>

        <div
          onClick={() => navigate('/agent/sandbox')}
          style={{
            padding: 'var(--space-4)',
            borderRadius: 'var(--radius-xl)',
            background: 'linear-gradient(145deg, var(--color-bg-surface-elevated), var(--color-bg-surface))',
            border: '1px solid var(--color-border-default)',
            boxShadow: 'var(--shadow-tactile-sm)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            transition: 'all 120ms ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--color-info)')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--color-border-default)')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(6, 182, 212, 0.15)', border: '1px solid rgba(6, 182, 212, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#06B6D4' }}>
              <Terminal size={18} strokeWidth={2.4} />
            </div>
            <div>
              <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, color: 'var(--color-text-primary)' }}>API Sandbox</div>
              <div style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>Interactive endpoint tester</div>
            </div>
          </div>
          <ArrowRight size={14} color="var(--color-text-muted)" />
        </div>

        <div
          onClick={() => navigate('/agent/webhooks')}
          style={{
            padding: 'var(--space-4)',
            borderRadius: 'var(--radius-xl)',
            background: 'linear-gradient(145deg, var(--color-bg-surface-elevated), var(--color-bg-surface))',
            border: '1px solid var(--color-border-default)',
            boxShadow: 'var(--shadow-tactile-sm)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            transition: 'all 120ms ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#EC4899')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--color-border-default)')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(236, 72, 153, 0.15)', border: '1px solid rgba(236, 72, 153, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EC4899' }}>
              <Webhook size={18} strokeWidth={2.4} />
            </div>
            <div>
              <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, color: 'var(--color-text-primary)' }}>Webhooks</div>
              <div style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>Endpoints & HMAC signatures</div>
            </div>
          </div>
          <ArrowRight size={14} color="var(--color-text-muted)" />
        </div>

        <div
          onClick={() => navigate('/agent/api-usage')}
          style={{
            padding: 'var(--space-4)',
            borderRadius: 'var(--radius-xl)',
            background: 'linear-gradient(145deg, var(--color-bg-surface-elevated), var(--color-bg-surface))',
            border: '1px solid var(--color-border-default)',
            boxShadow: 'var(--shadow-tactile-sm)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            transition: 'all 120ms ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#10B981')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--color-border-default)')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10B981' }}>
              <Activity size={18} strokeWidth={2.4} />
            </div>
            <div>
              <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, color: 'var(--color-text-primary)' }}>Usage & Logs</div>
              <div style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>Telemetry & error diagnostics</div>
            </div>
          </div>
          <ArrowRight size={14} color="var(--color-text-muted)" />
        </div>
      </div>

      {/* 3. Main Content: 2-Column Responsive Layout with Sticky Table of Contents */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 280px) 1fr', gap: 'var(--space-6)', alignItems: 'start' }}>
        {/* Left Column: Navigation Sidebar */}
        <div style={{ position: 'sticky', top: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <SearchInput
            placeholder="Search 13 API sections..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          {/* Section Links */}
          <Card style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0.35rem 0.5rem' }}>
              Documentation Index
            </span>
            {filteredSections.map((sec) => (
              <button
                key={sec.id}
                type="button"
                onClick={() => scrollToSection(sec.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.45rem 0.65rem',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  backgroundColor: activeSectionId === sec.id ? 'var(--color-bg-surface-elevated)' : 'transparent',
                  color: activeSectionId === sec.id ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                  fontWeight: activeSectionId === sec.id ? 800 : 600,
                  fontSize: 'var(--font-size-xs)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background-color 100ms ease',
                }}
              >
                <span>{sec.title}</span>
                {sec.badge && (
                  <span
                    style={{
                      fontSize: 'var(--font-size-3xs)',
                      fontWeight: 800,
                      padding: '0.1rem 0.35rem',
                      borderRadius: 'var(--radius-xs)',
                      backgroundColor: sec.badge === 'POST' ? 'rgba(16, 185, 129, 0.15)' : sec.badge === 'GET' ? 'rgba(6, 182, 212, 0.15)' : 'var(--color-bg-base)',
                      color: sec.badge === 'POST' ? '#10B981' : sec.badge === 'GET' ? '#06B6D4' : 'var(--color-text-muted)',
                    }}
                  >
                    {sec.badge}
                  </span>
                )}
              </button>
            ))}
          </Card>
        </div>

        {/* Right Column: The 13 Complete Documentation Sections */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {/* SECTION 1: Overview & Architecture */}
          <Card id="sec-overview" style={{ padding: 'var(--space-6)', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 'var(--space-2)' }}>
              <Server size={18} color="var(--color-primary)" />
              <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 900, color: 'var(--color-text-primary)', margin: 0 }}>
                1. Overview & Base Architecture
              </h2>
            </div>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
              The ByteBeacon REST API provides programmatic access to automated telecommunications data bundle dispatch, wallet balance queries, beneficiary number validation, and real-time webhook events across Ghanaian carriers (MTN, Telecel, AirtelTigo).
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
              <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-surface-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)' }}>
                <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, color: '#10B981', textTransform: 'uppercase' }}>Production Base URL</span>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-primary)', marginTop: '2px' }}>
                  https://api.bytebeacon.com/api/v1
                </div>
              </div>
              <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-surface-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)' }}>
                <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, color: '#06B6D4', textTransform: 'uppercase' }}>Sandbox Base URL</span>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-primary)', marginTop: '2px' }}>
                  https://sandbox.bytebeacon.com/api/v1
                </div>
              </div>
            </div>

            <div style={{ marginTop: 'var(--space-4)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
              <strong>Standard JSON Envelope:</strong> All successful responses return HTTP 200/201 with standard envelope keys:
              <pre style={{ margin: 'var(--space-2) 0 0 0', padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-base)', borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-2xs)', overflowX: 'auto', border: '1px solid var(--color-border-subtle)' }}>
{`{
  "status": "SUCCESS",
  "data": { ... },
  "error": null,
  "requestId": "req_01J123456789"
}`}
              </pre>
            </div>
          </Card>

          {/* SECTION 2: Authentication */}
          <Card id="sec-auth" style={{ padding: 'var(--space-6)', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 'var(--space-2)' }}>
              <Key size={18} color="#8B5CF6" />
              <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 900, color: 'var(--color-text-primary)', margin: 0 }}>
                2. Authentication
              </h2>
            </div>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
              Authenticate your API requests using a Bearer token in the HTTP <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-primary)' }}>Authorization</code> header. Obtain your keys from the <button type="button" onClick={() => navigate('/agent/api')} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>API Keys console</button>.
            </p>

            <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-base)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)', fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)', marginTop: 'var(--space-3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Authorization: Bearer ak_live_99f82a71d0e415b3ca61</span>
              <button type="button" onClick={() => handleCopy('Authorization: Bearer ak_live_99f82a71d0e415b3ca61', 'auth_hdr')} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
                {copiedSection === 'auth_hdr' ? <Check size={14} color="var(--color-success)" /> : <Copy size={14} />}
              </button>
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-4)', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '240px', padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-surface-elevated)', borderRadius: 'var(--radius-md)' }}>
                <strong style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)', display: 'block' }}>Production Keys</strong>
                <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)' }}>Prefix: <code style={{ fontFamily: 'var(--font-mono)' }}>ak_live_...</code> (debited against live fulfillment balance)</span>
              </div>
              <div style={{ flex: 1, minWidth: '240px', padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-surface-elevated)', borderRadius: 'var(--radius-md)' }}>
                <strong style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)', display: 'block' }}>Sandbox Keys</strong>
                <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)' }}>Prefix: <code style={{ fontFamily: 'var(--font-mono)' }}>ak_test_...</code> (simulated fulfillment against test sandbox)</span>
              </div>
            </div>
          </Card>

          {/* SECTION 3: Idempotency Keys */}
          <Card id="sec-idempotency" style={{ padding: 'var(--space-6)', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 'var(--space-2)' }}>
              <ShieldCheck size={18} color="#10B981" />
              <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 900, color: 'var(--color-text-primary)', margin: 0 }}>
                3. Idempotency Keys
              </h2>
            </div>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
              To prevent accidental duplicate orders or double billing caused by network retries, all mutating endpoints (e.g. <code style={{ fontFamily: 'var(--font-mono)' }}>POST /agent/orders</code>) accept an <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-primary)' }}>Idempotency-Key</code> header.
            </p>

            <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-base)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)', fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)', marginTop: 'var(--space-3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Idempotency-Key: idem_01J123456789_unique</span>
              <button type="button" onClick={() => handleCopy('Idempotency-Key: idem_01J123456789_unique', 'idem_hdr')} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
                {copiedSection === 'idem_hdr' ? <Check size={14} color="var(--color-success)" /> : <Copy size={14} />}
              </button>
            </div>

            <div style={{ marginTop: 'var(--space-3)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
              Keys are cached for <strong>24 hours</strong>. If a request is replayed with an existing key, the original result is returned without executing a new fulfillment.
            </div>
          </Card>

          {/* SECTION 4: Rate Limits & Headers */}
          <Card id="sec-ratelimits" style={{ padding: 'var(--space-6)', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 'var(--space-2)' }}>
              <Clock size={18} color="#F59E0B" />
              <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 900, color: 'var(--color-text-primary)', margin: 0 }}>
                4. Rate Limits & Headers
              </h2>
            </div>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
              Rate limits protect gateway throughput and are enforced on a per-API-key basis over a 1-minute sliding window.
            </p>

            <div style={{ overflowX: 'auto', marginTop: 'var(--space-3)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-xs)', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border-subtle)', backgroundColor: 'var(--color-bg-surface-elevated)' }}>
                    <th style={{ padding: 'var(--space-2) var(--space-3)', fontWeight: 800, color: 'var(--color-text-muted)' }}>Header</th>
                    <th style={{ padding: 'var(--space-2) var(--space-3)', fontWeight: 800, color: 'var(--color-text-muted)' }}>Description</th>
                    <th style={{ padding: 'var(--space-2) var(--space-3)', fontWeight: 800, color: 'var(--color-text-muted)' }}>Example</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                    <td style={{ padding: 'var(--space-2) var(--space-3)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>X-RateLimit-Limit</td>
                    <td style={{ padding: 'var(--space-2) var(--space-3)', color: 'var(--color-text-secondary)' }}>Maximum requests allowed per minute</td>
                    <td style={{ padding: 'var(--space-2) var(--space-3)', fontFamily: 'var(--font-mono)' }}>100</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                    <td style={{ padding: 'var(--space-2) var(--space-3)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>X-RateLimit-Remaining</td>
                    <td style={{ padding: 'var(--space-2) var(--space-3)', color: 'var(--color-text-secondary)' }}>Remaining requests in current window</td>
                    <td style={{ padding: 'var(--space-2) var(--space-3)', fontFamily: 'var(--font-mono)' }}>87</td>
                  </tr>
                  <tr>
                    <td style={{ padding: 'var(--space-2) var(--space-3)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>X-RateLimit-Reset</td>
                    <td style={{ padding: 'var(--space-2) var(--space-3)', color: 'var(--color-text-secondary)' }}>UTC timestamp when current window resets</td>
                    <td style={{ padding: 'var(--space-2) var(--space-3)', fontFamily: 'var(--font-mono)' }}>1786934400</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>

          {/* SECTION 5: Networks & Packages */}
          <Card id="sec-bundles" style={{ padding: 'var(--space-6)', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: 'var(--space-2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Layers size={18} color="#06B6D4" />
                <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 900, color: 'var(--color-text-primary)', margin: 0 }}>
                  5. Networks & Packages
                </h2>
              </div>
              <Badge variant="info" size="sm">GET /agent/bundles</Badge>
            </div>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
              Query active data bundle packages, volume limits, and agent prices across supported telecommunication networks.
            </p>

            <pre style={{ margin: 'var(--space-3) 0 0 0', padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-base)', borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-2xs)', overflowX: 'auto', border: '1px solid var(--color-border-subtle)' }}>
{`// GET /agent/bundles?network=MTN
{
  "status": "SUCCESS",
  "data": [
    {
      "bundleId": "mtn_1gb_non_expiry",
      "network": "MTN",
      "name": "MTN 1GB Data Bundle",
      "volumeMb": 1024,
      "pricePesewas": 600,
      "validity": "NON_EXPIRING"
    },
    {
      "bundleId": "mtn_10gb_promo",
      "network": "MTN",
      "name": "MTN 10GB Executive Package",
      "volumeMb": 10240,
      "pricePesewas": 5700,
      "validity": "NON_EXPIRING"
    }
  ]
}`}
            </pre>
          </Card>

          {/* SECTION 6: Create Order (Dispatch) */}
          <Card id="sec-create-order" style={{ padding: 'var(--space-6)', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: 'var(--space-2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Send size={18} color="#10B981" />
                <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 900, color: 'var(--color-text-primary)', margin: 0 }}>
                  6. Create Order (Data Bundle Dispatch)
                </h2>
              </div>
              <Badge variant="success" size="sm">POST /agent/orders</Badge>
            </div>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
              Dispatch an automated telecom data bundle to a customer beneficiary MSISDN. Funds are debited in real time from your wallet balance.
            </p>

            <strong style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)', display: 'block', marginTop: 'var(--space-3)' }}>Request Payload:</strong>
            <pre style={{ margin: 'var(--space-2) 0', padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-base)', borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-2xs)', overflowX: 'auto', border: '1px solid var(--color-border-subtle)' }}>
{`{
  "bundleId": "mtn_10gb_promo",
  "phoneNumber": "0241112233",
  "network": "MTN"
}`}
            </pre>

            <strong style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)', display: 'block', marginTop: 'var(--space-3)' }}>Response Payload (201 Created):</strong>
            <pre style={{ margin: 'var(--space-2) 0 0 0', padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-base)', borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-2xs)', overflowX: 'auto', border: '1px solid var(--color-border-subtle)' }}>
{`{
  "status": "SUCCESS",
  "data": {
    "orderId": "ORD-99214",
    "status": "PROCESSING",
    "bundleId": "mtn_10gb_promo",
    "recipientPhone": "0241112233",
    "network": "MTN",
    "amountPesewas": 5700,
    "balanceAfterPesewas": 145000,
    "createdAt": "2026-08-17T01:00:00Z"
  }
}`}
            </pre>
          </Card>

          {/* SECTION 7: Query Order Status */}
          <Card id="sec-query-order" style={{ padding: 'var(--space-6)', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: 'var(--space-2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle2 size={18} color="#06B6D4" />
                <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 900, color: 'var(--color-text-primary)', margin: 0 }}>
                  7. Query Order Status
                </h2>
              </div>
              <Badge variant="info" size="sm">GET /agent/orders/:id</Badge>
            </div>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
              Fetch real-time fulfillment status, telecom network reference, and lifecycle state for an order.
            </p>

            <pre style={{ margin: 'var(--space-3) 0 0 0', padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-base)', borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-2xs)', overflowX: 'auto', border: '1px solid var(--color-border-subtle)' }}>
{`// GET /agent/orders/ORD-99214
{
  "status": "SUCCESS",
  "data": {
    "orderId": "ORD-99214",
    "status": "COMPLETED",
    "network": "MTN",
    "recipientPhone": "0241112233",
    "amountPesewas": 5700,
    "networkReference": "BB_TELCO_99410",
    "completedAt": "2026-08-17T01:00:12Z"
  }
}`}
            </pre>
          </Card>

          {/* SECTION 8: Wallet & Balance */}
          <Card id="sec-wallet" style={{ padding: 'var(--space-6)', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: 'var(--space-2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CreditCard size={18} color="#0EA5E9" />
                <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 900, color: 'var(--color-text-primary)', margin: 0 }}>
                  8. Wallet & Balance
                </h2>
              </div>
              <Badge variant="info" size="sm">GET /agent/wallet/balance</Badge>
            </div>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
              Programmatically query your active prepaid fulfillment float balance before initiating bulk order dispatch.
            </p>

            <pre style={{ margin: 'var(--space-3) 0 0 0', padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-base)', borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-2xs)', overflowX: 'auto', border: '1px solid var(--color-border-subtle)' }}>
{`// GET /agent/wallet/balance
{
  "status": "SUCCESS",
  "data": {
    "balancePesewas": 145000,
    "formattedBalance": "GH₵ 1,450.00",
    "currency": "GHS",
    "accountStatus": "ACTIVE"
  }
}`}
            </pre>
          </Card>

          {/* SECTION 9: Beneficiary & Number Validation */}
          <Card id="sec-validation" style={{ padding: 'var(--space-6)', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: 'var(--space-2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Smartphone size={18} color="#8B5CF6" />
                <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 900, color: 'var(--color-text-primary)', margin: 0 }}>
                  9. Beneficiary & Number Validation
                </h2>
              </div>
              <Badge variant="success" size="sm">POST /agent/validate-number</Badge>
            </div>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
              Validate Ghanaian carrier formats (e.g. MTN prefixes: 024, 054, 055, 059; Telecel prefixes: 020, 050; AT prefixes: 027, 057, 026, 056) prior to submitting orders.
            </p>

            <pre style={{ margin: 'var(--space-3) 0 0 0', padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-base)', borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-2xs)', overflowX: 'auto', border: '1px solid var(--color-border-subtle)' }}>
{`// POST /agent/validate-number
// Request: { "phoneNumber": "0241112233" }
{
  "status": "SUCCESS",
  "data": {
    "phoneNumber": "0241112233",
    "isValid": true,
    "detectedNetwork": "MTN",
    "e164Format": "+233241112233"
  }
}`}
            </pre>
          </Card>

          {/* SECTION 10: Webhooks & Event Delivery */}
          <Card id="sec-webhooks" style={{ padding: 'var(--space-6)', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 'var(--space-2)' }}>
              <Webhook size={18} color="#EC4899" />
              <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 900, color: 'var(--color-text-primary)', margin: 0 }}>
                10. Webhooks & Event Delivery
              </h2>
            </div>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
              Receive instantaneous HTTP POST webhook callbacks when order statuses update. Configure endpoints in your <button type="button" onClick={() => navigate('/agent/webhooks')} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>Webhooks console</button>.
            </p>

            <div style={{ marginTop: 'var(--space-3)' }}>
              <strong style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>Standard Webhook Payload:</strong>
              <pre style={{ margin: 'var(--space-2) 0 0 0', padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-base)', borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-2xs)', overflowX: 'auto', border: '1px solid var(--color-border-subtle)' }}>
{`{
  "event": "order.completed",
  "timestamp": "2026-08-17T01:00:15Z",
  "data": {
    "orderId": "ORD-99214",
    "bundleId": "mtn_10gb_promo",
    "network": "MTN",
    "phoneNumber": "0241112233",
    "amountPesewas": 5700,
    "status": "COMPLETED"
  }
}`}
              </pre>
            </div>
          </Card>

          {/* SECTION 11: Webhook Signatures & Security */}
          <Card id="sec-signatures" style={{ padding: 'var(--space-6)', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 'var(--space-2)' }}>
              <Shield size={18} color="#10B981" />
              <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 900, color: 'var(--color-text-primary)', margin: 0 }}>
                11. Webhook Signatures & Security
              </h2>
            </div>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
              All webhook deliveries contain an <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-primary)' }}>X-ByteBeacon-Signature</code> header generated via HMAC-SHA256 of the raw payload using your webhook secret.
            </p>

            <strong style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)', display: 'block', marginTop: 'var(--space-3)' }}>Node.js Verification Sample:</strong>
            <pre style={{ margin: 'var(--space-2) 0 0 0', padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-base)', borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-2xs)', overflowX: 'auto', border: '1px solid var(--color-border-subtle)' }}>
{`import crypto from 'crypto';

function verifyWebhook(rawBody, signatureHeader, secret) {
  const hash = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signatureHeader));
}`}
            </pre>
          </Card>

          {/* SECTION 12: Error Codes & Standard Envelope */}
          <Card id="sec-errors" style={{ padding: 'var(--space-6)', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 'var(--space-2)' }}>
              <AlertTriangle size={18} color="var(--color-danger)" />
              <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 900, color: 'var(--color-text-primary)', margin: 0 }}>
                12. Error Codes & Standard Envelope
              </h2>
            </div>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
              When an error occurs, ByteBeacon returns a standard JSON error envelope with machine-readable error codes:
            </p>

            <div style={{ overflowX: 'auto', marginTop: 'var(--space-3)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-xs)', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border-subtle)', backgroundColor: 'var(--color-bg-surface-elevated)' }}>
                    <th style={{ padding: 'var(--space-2) var(--space-3)', fontWeight: 800, color: 'var(--color-text-muted)' }}>HTTP Status</th>
                    <th style={{ padding: 'var(--space-2) var(--space-3)', fontWeight: 800, color: 'var(--color-text-muted)' }}>Error Code</th>
                    <th style={{ padding: 'var(--space-2) var(--space-3)', fontWeight: 800, color: 'var(--color-text-muted)' }}>Description</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                    <td style={{ padding: 'var(--space-2) var(--space-3)', fontFamily: 'var(--font-mono)' }}>400 Bad Request</td>
                    <td style={{ padding: 'var(--space-2) var(--space-3)', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-danger)' }}>INVALID_PHONE_NUMBER</td>
                    <td style={{ padding: 'var(--space-2) var(--space-3)', color: 'var(--color-text-secondary)' }}>Recipient MSISDN format is invalid for chosen network</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                    <td style={{ padding: 'var(--space-2) var(--space-3)', fontFamily: 'var(--font-mono)' }}>401 Unauthorized</td>
                    <td style={{ padding: 'var(--space-2) var(--space-3)', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-danger)' }}>UNAUTHORIZED</td>
                    <td style={{ padding: 'var(--space-2) var(--space-3)', color: 'var(--color-text-secondary)' }}>Missing, invalid, or revoked API key</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                    <td style={{ padding: 'var(--space-2) var(--space-3)', fontFamily: 'var(--font-mono)' }}>402 Payment Required</td>
                    <td style={{ padding: 'var(--space-2) var(--space-3)', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-danger)' }}>INSUFFICIENT_BALANCE</td>
                    <td style={{ padding: 'var(--space-2) var(--space-3)', color: 'var(--color-text-secondary)' }}>Fulfillment wallet balance is too low for this bundle</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                    <td style={{ padding: 'var(--space-2) var(--space-3)', fontFamily: 'var(--font-mono)' }}>404 Not Found</td>
                    <td style={{ padding: 'var(--space-2) var(--space-3)', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-danger)' }}>BUNDLE_NOT_FOUND</td>
                    <td style={{ padding: 'var(--space-2) var(--space-3)', color: 'var(--color-text-secondary)' }}>The requested bundle ID is inactive or non-existent</td>
                  </tr>
                  <tr>
                    <td style={{ padding: 'var(--space-2) var(--space-3)', fontFamily: 'var(--font-mono)' }}>429 Too Many Requests</td>
                    <td style={{ padding: 'var(--space-2) var(--space-3)', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-danger)' }}>RATE_LIMIT_EXCEEDED</td>
                    <td style={{ padding: 'var(--space-2) var(--space-3)', color: 'var(--color-text-secondary)' }}>Throttled due to exceeding requests per minute</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>

          {/* SECTION 13: SDKs & Code Examples */}
          <Card id="sec-sdks" style={{ padding: 'var(--space-6)', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: 'var(--space-3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Code2 size={18} color="var(--color-primary)" />
                <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 900, color: 'var(--color-text-primary)', margin: 0 }}>
                  13. Multi-Language SDKs & Code Examples
                </h2>
              </div>

              {/* Language Switcher Tabs */}
              <div style={{ display: 'flex', gap: '0.25rem', backgroundColor: 'var(--color-bg-surface-elevated)', padding: '0.2rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)' }}>
                {(['curl', 'nodejs', 'python', 'php', 'go'] as const).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setActiveLang(lang)}
                    style={{
                      padding: '0.25rem 0.55rem',
                      borderRadius: 'var(--radius-sm)',
                      border: 'none',
                      backgroundColor: activeLang === lang ? 'var(--color-primary)' : 'transparent',
                      color: activeLang === lang ? '#FFFFFF' : 'var(--color-text-secondary)',
                      fontSize: 'var(--font-size-2xs)',
                      fontWeight: 700,
                      cursor: 'pointer',
                      textTransform: 'uppercase',
                    }}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            </div>

            {/* Code Box with Copy */}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => handleCopy(codeExamples[activeLang], `snippet_${activeLang}`)}
                style={{
                  position: 'absolute',
                  top: '0.75rem',
                  right: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.35rem 0.65rem',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'rgba(255, 255, 255, 0.12)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#FFFFFF',
                  fontSize: 'var(--font-size-2xs)',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {copiedSection === `snippet_${activeLang}` ? <Check size={12} color="#10B981" /> : <Copy size={12} />}
                <span>{copiedSection === `snippet_${activeLang}` ? 'Copied' : 'Copy'}</span>
              </button>

              <pre style={{ margin: 0, padding: 'var(--space-4)', backgroundColor: '#0B1120', borderRadius: 'var(--radius-lg)', color: '#F8FAFC', fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)', lineHeight: 1.6, overflowX: 'auto', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                {codeExamples[activeLang]}
              </pre>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
