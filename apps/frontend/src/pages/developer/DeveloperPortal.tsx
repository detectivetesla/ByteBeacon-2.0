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
  CreditCard,
  Shield,
  Trash2,
  Zap,
  ExternalLink,
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
  { id: 'sec-auth', title: '2. Authentication & Keys', category: 'Getting Started', badge: 'Required' },
  { id: 'sec-precheck', title: '3. MTN Up2U Precheck', category: 'Endpoints', badge: 'POST' },
  { id: 'sec-verification-jobs', title: '4. Async Verification Jobs', category: 'Endpoints', badge: 'POST' },
  { id: 'sec-approvals', title: '5. Pending Approvals & Clear', category: 'Endpoints', badge: 'DELETE' },
  { id: 'sec-bundles', title: '6. Networks & Packages', category: 'Endpoints', badge: 'GET' },
  { id: 'sec-create-order', title: '7. Create Order & Bulk', category: 'Endpoints', badge: 'POST' },
  { id: 'sec-query-order', title: '8. Query Order Status', category: 'Endpoints', badge: 'GET' },
  { id: 'sec-wallet', title: '9. Wallet & Usage Telemetry', category: 'Endpoints', badge: 'GET' },
  { id: 'sec-webhooks', title: '10. Webhooks & Events', category: 'Webhooks' },
  { id: 'sec-signatures', title: '11. Signature Verification', category: 'Webhooks', badge: 'HMAC' },
  { id: 'sec-idempotency', title: '12. Idempotency & Rate Limits', category: 'Core Concepts' },
  { id: 'sec-errors', title: '13. Error Codes & Envelopes', category: 'Reference' },
  { id: 'sec-sdks', title: '14. Multi-Language Code Examples', category: 'Reference' },
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

  // Code Snippets in 5 Languages featuring live key and base URLs
  const codeExamples = {
    curl: `# 1. Dispatch a Single Data Order
curl -X POST https://bytebeacon-2-0.onrender.com/api/v1/agent/orders \\
  -H "X-API-Key: ak_live_G8xX0g9D98nu_oq7c9lkag7IKrZ3YDq4" \\
  -H "Idempotency-Key: a1b2c3d4-e5f6-4a7b-8c9d-0123456789ab" \\
  -H "Content-Type: application/json" \\
  -d '{
    "bundleId": "mtn_10gb_promo",
    "phoneNumber": "0241112233",
    "network": "MTN"
  }'

# 2. Fast Recipient Up2U Eligibility Precheck
curl -X POST https://bytebeacon-2-0.onrender.com/api/v1/beneficiaries/precheck \\
  -H "X-API-Key: ak_live_G8xX0g9D98nu_oq7c9lkag7IKrZ3YDq4" \\
  -H "Content-Type: application/json" \\
  -d '{
    "network": "MTN",
    "phoneNumbers": ["0241112233", "0554445566"],
    "bypassCache": true
  }'`,

    nodejs: `import axios from 'axios';

const client = axios.create({
  baseURL: 'https://bytebeacon-2-0.onrender.com/api/v1',
  headers: {
    'X-API-Key': 'ak_live_G8xX0g9D98nu_oq7c9lkag7IKrZ3YDq4',
    'Content-Type': 'application/json',
  },
});

// 1. Check Recipient Eligibility
const precheck = await client.post('/beneficiaries/precheck', {
  network: 'MTN',
  phoneNumbers: ['0241112233', '0554445566'],
  bypassCache: true,
});
console.log('Precheck Summary:', precheck.data.data.summary);

// 2. Dispatch Order with UUID Idempotency Key
const order = await client.post(
  '/agent/orders',
  {
    bundleId: 'mtn_10gb_promo',
    phoneNumber: '0241112233',
    network: 'MTN',
  },
  {
    headers: { 'Idempotency-Key': crypto.randomUUID() },
  }
);
console.log('Order Status:', order.data.data.status);`,

    python: `import requests
import uuid

BASE_URL = "https://bytebeacon-2-0.onrender.com/api/v1"
HEADERS = {
    "X-API-Key": "ak_live_G8xX0g9D98nu_oq7c9lkag7IKrZ3YDq4",
    "Content-Type": "application/json",
}

# 1. High-Speed Precheck
precheck_resp = requests.post(
    f"{BASE_URL}/beneficiaries/precheck",
    json={"network": "MTN", "phoneNumbers": ["0241112233"], "bypassCache": True},
    headers=HEADERS
)
print("Precheck:", precheck_resp.json())

# 2. Dispatch Order
order_headers = {**HEADERS, "Idempotency-Key": str(uuid.uuid4())}
order_resp = requests.post(
    f"{BASE_URL}/agent/orders",
    json={"bundleId": "mtn_10gb_promo", "phoneNumber": "0241112233", "network": "MTN"},
    headers=order_headers
)
print("Order Response:", order_resp.json())`,

    php: `<?php
$apiKey = 'ak_live_G8xX0g9D98nu_oq7c9lkag7IKrZ3YDq4';
$baseUrl = 'https://bytebeacon-2-0.onrender.com/api/v1';

// Dispatch Order via cURL
$ch = curl_init("$baseUrl/agent/orders");
$payload = json_encode([
    'bundleId' => 'mtn_10gb_promo',
    'phoneNumber' => '0241112233',
    'network' => 'MTN'
]);

curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "X-API-Key: $apiKey",
    "Idempotency-Key: " . vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex(random_bytes(16)), 4)),
    "Content-Type: application/json"
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
	baseUrl := "https://bytebeacon-2-0.onrender.com/api/v1"
	apiKey := "ak_live_G8xX0g9D98nu_oq7c9lkag7IKrZ3YDq4"

	payload, _ := json.Marshal(map[string]interface{}{
		"bundleId":    "mtn_10gb_promo",
		"phoneNumber": "0241112233",
		"network":     "MTN",
	})

	req, _ := http.NewRequest("POST", baseUrl+"/agent/orders", bytes.NewBuffer(payload))
	req.Header.Set("X-API-Key", apiKey)
	req.Header.Set("Idempotency-Key", "c8d20e79-52bb-4856-bb6b-a25e1bb60dc2")
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		panic(err)
	}
	defer resp.Body.Close()

	fmt.Println("HTTP Status:", resp.Status)
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
              ByteBeacon Developer Documentation & API Specs
            </h1>
          </div>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0.25rem 0 0 0' }}>
            Authoritative REST API documentation, OpenAPI specifications, webhook protocols, and third-party integration guides.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Badge variant="purple" size="md">REST API v2.0</Badge>
          <Badge variant="success" dot size="md">Production Ready</Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open('/docs', '_blank')}
            leftIcon={<ExternalLink size={14} />}
          >
            Open Swagger UI
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/agent/sandbox')}
            leftIcon={<Terminal size={14} />}
          >
            Developer Sandbox
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
          onClick={() => window.open('/api/v1/openapi.json', '_blank')}
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
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#06B6D4')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--color-border-default)')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(6, 182, 212, 0.15)', border: '1px solid rgba(6, 182, 212, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#06B6D4' }}>
              <Code2 size={18} strokeWidth={2.4} />
            </div>
            <div>
              <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, color: 'var(--color-text-primary)' }}>OpenAPI 3.1 Spec</div>
              <div style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>Raw JSON definition</div>
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
              <div style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>Event callbacks & HMAC</div>
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
              <div style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>Telemetry & diagnostics</div>
            </div>
          </div>
          <ArrowRight size={14} color="var(--color-text-muted)" />
        </div>
      </div>

      {/* 3. Main Content Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 280px) 1fr', gap: 'var(--space-6)', alignItems: 'start' }}>
        {/* Navigation Sidebar */}
        <div style={{ position: 'sticky', top: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <SearchInput
            placeholder="Search API sections..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

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
                      backgroundColor:
                        sec.badge === 'POST'
                          ? 'rgba(16, 185, 129, 0.15)'
                          : sec.badge === 'GET'
                            ? 'rgba(6, 182, 212, 0.15)'
                            : sec.badge === 'DELETE'
                              ? 'rgba(239, 68, 68, 0.15)'
                              : 'var(--color-bg-base)',
                      color:
                        sec.badge === 'POST'
                          ? '#10B981'
                          : sec.badge === 'GET'
                            ? '#06B6D4'
                            : sec.badge === 'DELETE'
                              ? '#EF4444'
                              : 'var(--color-text-muted)',
                    }}
                  >
                    {sec.badge}
                  </span>
                )}
              </button>
            ))}
          </Card>
        </div>

        {/* Right Column: Complete Documentation Sections */}
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
              ByteBeacon provides a carrier-grade REST API for programmatic telecom data bundle fulfillment, high-speed Up2U beneficiary verification, double-entry float management, and instant webhook callbacks across MTN, Telecel, and AirtelTigo.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
              <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-surface-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)' }}>
                <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, color: '#10B981', textTransform: 'uppercase' }}>Production Base URL (Live)</span>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-primary)', marginTop: '2px' }}>
                  https://bytebeacon-2-0.onrender.com/api/v1
                </div>
              </div>
              <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-surface-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)' }}>
                <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, color: '#06B6D4', textTransform: 'uppercase' }}>Custom Gateway URL</span>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-primary)', marginTop: '2px' }}>
                  https://api.bytebeacon.online/api/v1
                </div>
              </div>
            </div>

            <div style={{ marginTop: 'var(--space-4)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
              <strong>Interactive Documentation:</strong>
              <div style={{ marginTop: 'var(--space-2)', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <a href="/docs" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)', fontWeight: 700, textDecoration: 'underline' }}>
                  Swagger UI (/docs)
                </a>
                <span style={{ color: 'var(--color-text-muted)' }}>•</span>
                <a href="/api/v1/openapi.json" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)', fontWeight: 700, textDecoration: 'underline' }}>
                  OpenAPI 3.1 JSON (/api/v1/openapi.json)
                </a>
              </div>
            </div>
          </Card>

          {/* SECTION 2: Authentication & Third-Party Connection */}
          <Card id="sec-auth" style={{ padding: 'var(--space-6)', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 'var(--space-2)' }}>
              <Key size={18} color="#8B5CF6" />
              <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 900, color: 'var(--color-text-primary)', margin: 0 }}>
                2. Authentication & Third-Party Connection Guide
              </h2>
            </div>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
              ByteBeacon supports multiple standard authentication conventions so third-party ERPs, POS systems, ecommerce backends, and custom scripts can connect with zero friction.
            </p>

            <div style={{ marginTop: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <strong style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>Supported Authentication Headers:</strong>
              <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-base)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)', fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-2xs)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <div><span style={{ color: '#8B5CF6' }}>// 1. Standard API Key Header (Recommended):</span><br />X-API-Key: ak_live_G8xX0g9D98nu_oq7c9lkag7IKrZ3YDq4</div>
                <div><span style={{ color: '#8B5CF6' }}>// 2. Bearer Token Header:</span><br />Authorization: Bearer ak_live_G8xX0g9D98nu_oq7c9lkag7IKrZ3YDq4</div>
                <div><span style={{ color: '#8B5CF6' }}>// 3. ApiKey Scheme Header:</span><br />Authorization: ApiKey ak_live_G8xX0g9D98nu_oq7c9lkag7IKrZ3YDq4</div>
                <div><span style={{ color: '#8B5CF6' }}>// 4. Query Parameter (Webhooks/GET):</span><br />https://bytebeacon-2-0.onrender.com/api/v1/agent/bundles?api_key=ak_live_G8xX0g9D98nu_oq7c9lkag7IKrZ3YDq4</div>
              </div>
            </div>

            <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-3)', backgroundColor: 'rgba(16, 185, 129, 0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#10B981', fontWeight: 800, fontSize: 'var(--font-size-xs)' }}>
                <CheckCircle2 size={16} /> Authoritative Live API Key Verified
              </div>
              <p style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-secondary)', margin: '0.25rem 0 0 0' }}>
                Your production master key <code style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-text-primary)' }}>ak_live_G8xX0g9D98nu_oq7c9lkag7IKrZ3YDq4</code> has unrestricted full-access privileges (<code style={{ fontFamily: 'var(--font-mono)' }}>TIER_UNLIMITED</code>) across all ordering, prechecking, and reporting endpoints.
              </p>
            </div>
          </Card>

          {/* SECTION 3: MTN Up2U Recipient Precheck */}
          <Card id="sec-precheck" style={{ padding: 'var(--space-6)', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: 'var(--space-2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Zap size={18} color="#F59E0B" />
                <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 900, color: 'var(--color-text-primary)', margin: 0 }}>
                  3. MTN Up2U Beneficiary Precheck
                </h2>
              </div>
              <div style={{ display: 'flex', gap: '0.35rem' }}>
                <Badge variant="warning" size="sm">Sub-second Speed</Badge>
                <Badge variant="success" size="sm">POST /beneficiaries/precheck</Badge>
              </div>
            </div>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
              Pre-screens batches of recipient mobile numbers to verify Up2U eligibility before placing orders. Checks return <strong style={{ color: '#10B981' }}>APPROVED</strong> (ready for instant fulfillment), <strong style={{ color: '#F59E0B' }}>UNAPPROVED / NEW</strong> (requires agent approval), or <strong style={{ color: '#EF4444' }}>REJECTED</strong> (invalid or inactive MSISDN).
            </p>

            <div style={{ marginTop: 'var(--space-3)' }}>
              <strong style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>Request Payload:</strong>
              <pre style={{ margin: 'var(--space-2) 0', padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-base)', borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-2xs)', overflowX: 'auto', border: '1px solid var(--color-border-subtle)' }}>
{`// POST /api/v1/beneficiaries/precheck
{
  "network": "MTN",
  "phoneNumbers": ["0241112233", "0554445566", "0201234567"],
  "record": false,
  "bypassCache": true
}`}
              </pre>

              <strong style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>Response Payload (200 OK):</strong>
              <pre style={{ margin: 'var(--space-2) 0 0 0', padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-base)', borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-2xs)', overflowX: 'auto', border: '1px solid var(--color-border-subtle)' }}>
{`{
  "success": true,
  "statusCode": 200,
  "data": {
    "network": "MTN",
    "enforced": true,
    "summary": {
      "total": 476,
      "approved": 282,
      "unapproved": 193,
      "rejected": 1
    },
    "results": [
      {
        "phone": "0241112233",
        "normalized": "+233241112233",
        "status": "APPROVED",
        "valid": true,
        "known": true
      }
    ]
  }
}`}
              </pre>
            </div>
          </Card>

          {/* SECTION 4: High-Speed Verification Jobs */}
          <Card id="sec-verification-jobs" style={{ padding: 'var(--space-6)', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: 'var(--space-2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Clock size={18} color="#06B6D4" />
                <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 900, color: 'var(--color-text-primary)', margin: 0 }}>
                  4. Asynchronous Verification Jobs (Up to 10,000 Numbers)
                </h2>
              </div>
              <Badge variant="info" size="sm">HTTP 202 Accepted</Badge>
            </div>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
              For large spreadsheet lists and bulk audits exceeding 500 recipients, submit an asynchronous verification job. The server accepts the payload immediately and processes 500-1,000 recipients per second in the background.
            </p>

            <div style={{ marginTop: 'var(--space-3)' }}>
              <strong style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>1. Submit Job: POST /api/v1/beneficiaries/verification-jobs</strong>
              <pre style={{ margin: 'var(--space-2) 0', padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-base)', borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-2xs)', overflowX: 'auto', border: '1px solid var(--color-border-subtle)' }}>
{`// Returns 202 Accepted
{
  "network": "MTN",
  "phoneNumbers": ["0241112233", "0554445566", ...],
  "record": false
}`}
              </pre>

              <strong style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>2. Poll Job Progress: GET /api/v1/beneficiaries/verification-jobs/:jobId</strong>
              <pre style={{ margin: 'var(--space-2) 0 0 0', padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-base)', borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-2xs)', overflowX: 'auto', border: '1px solid var(--color-border-subtle)' }}>
{`{
  "success": true,
  "statusCode": 200,
  "data": {
    "id": "job_01J123456789",
    "network": "MTN",
    "status": "COMPLETED",
    "totalRows": 476,
    "processedRows": 476,
    "percent": 100,
    "approvedCount": 282,
    "unapprovedCount": 193,
    "rejectedCount": 1
  }
}`}
              </pre>
            </div>
          </Card>

          {/* SECTION 5: Pending Approvals & Clear */}
          <Card id="sec-approvals" style={{ padding: 'var(--space-6)', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: 'var(--space-2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Trash2 size={18} color="#EF4444" />
                <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 900, color: 'var(--color-text-primary)', margin: 0 }}>
                  5. Pending MTN Approvals & Bulk Clearance
                </h2>
              </div>
              <Badge variant="danger" size="sm">DELETE /beneficiaries/approvals</Badge>
            </div>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
              Manage recipients quarantined in the pending queue awaiting agent authorization or provider sync. Supports full bulk purge as well as single-record removal.
            </p>

            <div style={{ marginTop: 'var(--space-3)' }}>
              <strong style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>Purge All Pending Approvals:</strong>
              <pre style={{ margin: 'var(--space-2) 0', padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-base)', borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-2xs)', overflowX: 'auto', border: '1px solid var(--color-border-subtle)' }}>
{`// DELETE /api/v1/beneficiaries/approvals?network=MTN
// Response:
{
  "success": true,
  "data": {
    "deletedCount": 193
  }
}`}
              </pre>
            </div>
          </Card>

          {/* SECTION 6: Networks & Packages */}
          <Card id="sec-bundles" style={{ padding: 'var(--space-6)', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: 'var(--space-2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Layers size={18} color="#06B6D4" />
                <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 900, color: 'var(--color-text-primary)', margin: 0 }}>
                  6. Networks & Packages
                </h2>
              </div>
              <Badge variant="info" size="sm">GET /agent/bundles</Badge>
            </div>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
              Query active data bundle packages, volume limits, and agent prices across supported telecommunication networks.
            </p>

            <pre style={{ margin: 'var(--space-3) 0 0 0', padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-base)', borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-2xs)', overflowX: 'auto', border: '1px solid var(--color-border-subtle)' }}>
{`// GET /api/v1/agent/bundles?network=MTN
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

          {/* SECTION 7: Create Order (Dispatch) */}
          <Card id="sec-create-order" style={{ padding: 'var(--space-6)', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: 'var(--space-2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Send size={18} color="#10B981" />
                <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 900, color: 'var(--color-text-primary)', margin: 0 }}>
                  7. Create Order (Data Bundle Dispatch)
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
    "createdAt": "2026-09-10T01:00:00Z"
  }
}`}
            </pre>
          </Card>

          {/* SECTION 8: Query Order Status */}
          <Card id="sec-query-order" style={{ padding: 'var(--space-6)', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: 'var(--space-2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle2 size={18} color="#06B6D4" />
                <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 900, color: 'var(--color-text-primary)', margin: 0 }}>
                  8. Query Order Status
                </h2>
              </div>
              <Badge variant="info" size="sm">GET /agent/orders/:id</Badge>
            </div>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
              Fetch real-time fulfillment status, telecom network reference, and lifecycle state for an order.
            </p>

            <pre style={{ margin: 'var(--space-3) 0 0 0', padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-base)', borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-2xs)', overflowX: 'auto', border: '1px solid var(--color-border-subtle)' }}>
{`// GET /api/v1/agent/orders/ORD-99214
{
  "status": "SUCCESS",
  "data": {
    "orderId": "ORD-99214",
    "status": "COMPLETED",
    "network": "MTN",
    "recipientPhone": "0241112233",
    "amountPesewas": 5700,
    "networkReference": "BB_TELCO_99410",
    "completedAt": "2026-09-10T01:00:12Z"
  }
}`}
            </pre>
          </Card>

          {/* SECTION 9: Wallet & Balance */}
          <Card id="sec-wallet" style={{ padding: 'var(--space-6)', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: 'var(--space-2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CreditCard size={18} color="#0EA5E9" />
                <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 900, color: 'var(--color-text-primary)', margin: 0 }}>
                  9. Wallet Balance & API Usage Telemetry
                </h2>
              </div>
              <Badge variant="info" size="sm">GET /agent/wallet/balance</Badge>
            </div>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
              Programmatically query your active prepaid fulfillment float balance and telemetry metrics before initiating bulk order dispatch.
            </p>

            <pre style={{ margin: 'var(--space-3) 0 0 0', padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-base)', borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-2xs)', overflowX: 'auto', border: '1px solid var(--color-border-subtle)' }}>
{`// GET /api/v1/agent/wallet/balance
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

          {/* SECTION 10: Webhooks & Event Delivery */}
          <Card id="sec-webhooks" style={{ padding: 'var(--space-6)', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 'var(--space-2)' }}>
              <Webhook size={18} color="#EC4899" />
              <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 900, color: 'var(--color-text-primary)', margin: 0 }}>
                10. Webhooks & Event Delivery
              </h2>
            </div>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
              Receive instantaneous HTTP POST callbacks when order statuses update. Configure endpoints in your <button type="button" onClick={() => navigate('/agent/webhooks')} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>Webhooks console</button>.
            </p>

            <div style={{ marginTop: 'var(--space-3)' }}>
              <strong style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>Standard Webhook Payload:</strong>
              <pre style={{ margin: 'var(--space-2) 0 0 0', padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-base)', borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-2xs)', overflowX: 'auto', border: '1px solid var(--color-border-subtle)' }}>
{`{
  "event": "order.completed",
  "timestamp": "2026-09-10T01:00:15Z",
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

          {/* SECTION 12: Idempotency & Rate Limits */}
          <Card id="sec-idempotency" style={{ padding: 'var(--space-6)', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 'var(--space-2)' }}>
              <ShieldCheck size={18} color="#10B981" />
              <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 900, color: 'var(--color-text-primary)', margin: 0 }}>
                12. Idempotency Keys & Rate Limits
              </h2>
            </div>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
              To prevent accidental duplicate orders or double billing during network disconnects, all mutating endpoints require an <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-primary)' }}>Idempotency-Key</code> header containing a UUID v4. Keys are cached for 24 hours.
            </p>

            <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-base)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)', fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)', marginTop: 'var(--space-3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Idempotency-Key: a1b2c3d4-e5f6-4a7b-8c9d-0123456789ab</span>
              <button type="button" onClick={() => handleCopy('Idempotency-Key: a1b2c3d4-e5f6-4a7b-8c9d-0123456789ab', 'idem_hdr')} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
                {copiedSection === 'idem_hdr' ? <Check size={14} color="var(--color-success)" /> : <Copy size={14} />}
              </button>
            </div>
          </Card>

          {/* SECTION 13: Error Codes & Standard Envelope */}
          <Card id="sec-errors" style={{ padding: 'var(--space-6)', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 'var(--space-2)' }}>
              <AlertTriangle size={18} color="var(--color-danger)" />
              <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 900, color: 'var(--color-text-primary)', margin: 0 }}>
                13. Error Codes & Standard Envelope
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
                    <td style={{ padding: 'var(--space-2) var(--space-3)', color: 'var(--color-text-secondary)' }}>Missing, invalid, or unrecognized API key</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                    <td style={{ padding: 'var(--space-2) var(--space-3)', fontFamily: 'var(--font-mono)' }}>402 Payment Required</td>
                    <td style={{ padding: 'var(--space-2) var(--space-3)', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-danger)' }}>INSUFFICIENT_BALANCE</td>
                    <td style={{ padding: 'var(--space-2) var(--space-3)', color: 'var(--color-text-secondary)' }}>Fulfillment float balance is too low for this bundle</td>
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

          {/* SECTION 14: SDKs & Code Examples */}
          <Card id="sec-sdks" style={{ padding: 'var(--space-6)', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: 'var(--space-3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Code2 size={18} color="var(--color-primary)" />
                <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 900, color: 'var(--color-text-primary)', margin: 0 }}>
                  14. Multi-Language Code Examples
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
                  zIndex: 2,
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
