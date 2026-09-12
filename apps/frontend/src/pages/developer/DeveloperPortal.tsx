import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card/Card.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Badge } from '../../components/ui/Badge/Badge.js';
import { SearchInput } from '../../components/ui/index.js';
import { Modal } from '../../components/ui/Modal/Modal.js';
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
  Lock,
  Globe,
  RefreshCw,
  FileCode,
  Download,
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
  { id: 'sec-base-url', title: '2. Base URLs & Environments', category: 'Getting Started', badge: 'REST' },
  { id: 'sec-auth', title: '3. Authentication & Keys', category: 'Getting Started', badge: 'x-api-key' },
  { id: 'sec-agent-me', title: '4. GET /agent/me (Profile)', category: 'Endpoints', badge: 'GET' },
  { id: 'sec-api-access', title: '5. GET /me/agent/api-access/status', category: 'Endpoints', badge: 'GET' },
  { id: 'sec-scopes', title: '6. Scopes & Adaptive Rate Limits', category: 'Core Concepts' },
  { id: 'sec-single-orders', title: '7. POST /agent/orders (Single Order)', category: 'Endpoints', badge: 'POST' },
  { id: 'sec-bundles', title: '8. GET /agent/bundles (Wholesale Catalog)', category: 'Endpoints', badge: 'GET' },
  { id: 'sec-bulk-orders', title: '9. POST /agent/orders/bulk (JSON Batch)', category: 'Endpoints', badge: 'POST' },
  { id: 'sec-bulk-xlsx', title: '10. POST /me/agent/orders/bulk (XLSX Upload)', category: 'Endpoints', badge: 'POST' },
  { id: 'sec-public-precheck', title: '11. POST /orders/beneficiaries/precheck', category: 'Endpoints', badge: 'POST' },
  { id: 'sec-agent-precheck', title: '12. POST /agent/beneficiaries/precheck', category: 'Endpoints', badge: 'POST' },
  { id: 'sec-beneficiary-status', title: '13. GET /agent/beneficiaries (Status Polling)', category: 'Endpoints', badge: 'GET' },
  { id: 'sec-list-orders', title: '14. GET /agent/orders (Listing & Tallies)', category: 'Endpoints', badge: 'GET' },
  { id: 'sec-get-order', title: '15. GET /agent/orders/:id (Order Detail)', category: 'Endpoints', badge: 'GET' },
  { id: 'sec-wallet', title: '16. GET /agent/wallet (Balance & Ledger)', category: 'Endpoints', badge: 'GET' },
  { id: 'sec-webhooks', title: '17. Webhook Subscriptions Management', category: 'Webhooks', badge: 'CRUD' },
  { id: 'sec-signatures', title: '18. Cryptographic Signature Verification', category: 'Webhooks', badge: 'HMAC' },
  { id: 'sec-outbound-events', title: '19. Outbound Event Delivery Payloads', category: 'Webhooks', badge: 'Events' },
  { id: 'sec-errors', title: '20. Error Envelopes & Reference', category: 'Reference', badge: 'Errors' },
  { id: 'sec-idempotency-lifecycle', title: '21. Idempotency & Order State Machine', category: 'Reference', badge: 'FSM' },
];

export const DeveloperPortal: React.FC = () => {
  const navigate = useNavigate();
  const { toastSuccess } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeSectionId, setActiveSectionId] = useState('sec-overview');

  // In-System Modals for Swagger UI and OpenAPI JSON to prevent kicking out of the dashboard
  const [swaggerModalOpen, setSwaggerModalOpen] = useState(false);
  const [openapiModalOpen, setOpenapiModalOpen] = useState(false);

  const sidebarRef = useRef<HTMLDivElement>(null);
  const isProgrammaticScrollRef = useRef(false);
  const programmaticScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Authoritative Backend Base URL detection
  const backendBase = useMemo(() => {
    const envUrl =
      import.meta.env.VITE_API_BASE_URL ||
      import.meta.env.VITE_API_URL ||
      import.meta.env.VITE_BACKEND_URL ||
      import.meta.env.VITE_SERVER_URL;
    if (envUrl && typeof envUrl === 'string' && envUrl.trim() !== '') {
      return envUrl.trim().replace(/\/+$/, '').replace(/\/api\/v1$/, '');
    }
    return 'https://bytebeacon-2-0.onrender.com';
  }, []);

  const swaggerUrl = `${backendBase}/docs`;
  const openapiUrl = `${backendBase}/api/v1/openapi.json`;

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedKey(id);
    toastSuccess('Code Copied', 'Snippet copied to clipboard.');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Safely scroll ONLY the sidebar container without touching or locking window/page scroll
  const scrollSidebarToActive = (sectionId: string) => {
    const container = sidebarRef.current;
    if (!container) return;
    const activeBtn = container.querySelector(`[data-section-id="${sectionId}"]`) as HTMLElement | null;
    if (!activeBtn) return;

    const containerRect = container.getBoundingClientRect();
    const btnRect = activeBtn.getBoundingClientRect();

    if (btnRect.top < containerRect.top + 16) {
      const delta = btnRect.top - containerRect.top - 20;
      container.scrollBy({ top: delta, behavior: 'smooth' });
    } else if (btnRect.bottom > containerRect.bottom - 16) {
      const delta = btnRect.bottom - containerRect.bottom + 20;
      container.scrollBy({ top: delta, behavior: 'smooth' });
    }
  };

  const scrollToSection = (id: string) => {
    setActiveSectionId(id);
    const element = document.getElementById(id);
    if (!element) return;

    isProgrammaticScrollRef.current = true;
    if (programmaticScrollTimerRef.current) {
      clearTimeout(programmaticScrollTimerRef.current);
    }

    scrollSidebarToActive(id);
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });

    programmaticScrollTimerRef.current = setTimeout(() => {
      isProgrammaticScrollRef.current = false;
    }, 850);
  };

  // Auto-scroll Documentation Index along with user scroll using IntersectionObserver
  useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: '-80px 0px -60% 0px',
      threshold: 0,
    };

    const sectionElements = SECTIONS.map((s) => document.getElementById(s.id)).filter(Boolean) as HTMLElement[];

    const observer = new IntersectionObserver((entries) => {
      if (isProgrammaticScrollRef.current) return;

      const intersecting = entries.filter((e) => e.isIntersecting);
      if (intersecting.length > 0) {
        // Find the section whose top boundary is closest to the 80px topbar margin
        intersecting.sort(
          (a, b) => Math.abs(a.boundingClientRect.top - 80) - Math.abs(b.boundingClientRect.top - 80)
        );
        const matchedId = intersecting[0].target.id;
        setActiveSectionId(matchedId);
        scrollSidebarToActive(matchedId);
      }
    }, observerOptions);

    sectionElements.forEach((el) => observer.observe(el));

    return () => {
      if (programmaticScrollTimerRef.current) {
        clearTimeout(programmaticScrollTimerRef.current);
      }
      sectionElements.forEach((el) => observer.unobserve(el));
      observer.disconnect();
    };
  }, []);

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return SECTIONS;
    const q = searchQuery.toLowerCase();
    return SECTIONS.filter(
      (s) => s.title.toLowerCase().includes(q) || s.category.toLowerCase().includes(q),
    );
  }, [searchQuery]);

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', padding: 'var(--space-4) var(--space-2)' }}>
      <style>{`
        section[id^="sec-"] {
          scroll-margin-top: 84px;
        }
      `}</style>
      {/* 1. Header & Hero */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <TactileIcon icon={BookOpen} color="api" size="sm" />
            <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 900, color: 'var(--color-text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
              ByteBeacon Agent Developer Documentation & Authoritative API Specifications
            </h1>
          </div>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0.35rem 0 0 0', maxWidth: '850px', lineHeight: 1.5 }}>
            Production REST API surface for telecom agents, wholesale pricing engines, automated order dispatch, Up2U beneficiary prechecking, and cryptographic webhook delivery.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Badge variant="purple" size="md">REST API v2.0</Badge>
          <Badge variant="success" dot size="md">Authoritative Backend</Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSwaggerModalOpen(true)}
            leftIcon={<ExternalLink size={14} />}
          >
            Swagger UI (/docs)
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOpenapiModalOpen(true)}
            leftIcon={<Code2 size={14} />}
          >
            OpenAPI 3.1 JSON
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/agent/sandbox')}
            leftIcon={<Terminal size={14} />}
          >
            API Sandbox
          </Button>
        </div>
      </div>

      {/* 2. Quick Action Hub */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-4)' }}>
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
            <div style={{ width: '38px', height: '38px', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(139, 92, 246, 0.15)', border: '1px solid rgba(139, 92, 246, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8B5CF6' }}>
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
          onClick={() => setSwaggerModalOpen(true)}
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
            <div style={{ width: '38px', height: '38px', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10B981' }}>
              <Server size={18} strokeWidth={2.4} />
            </div>
            <div>
              <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, color: 'var(--color-text-primary)' }}>Interactive Swagger UI</div>
              <div style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>Explore in-system docs</div>
            </div>
          </div>
          <ArrowRight size={14} color="var(--color-text-muted)" />
        </div>

        <div
          onClick={() => setOpenapiModalOpen(true)}
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
            <div style={{ width: '38px', height: '38px', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(6, 182, 212, 0.15)', border: '1px solid rgba(6, 182, 212, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#06B6D4' }}>
              <Code2 size={18} strokeWidth={2.4} />
            </div>
            <div>
              <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, color: 'var(--color-text-primary)' }}>OpenAPI 3.1 Spec</div>
              <div style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>Raw machine-readable JSON</div>
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
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#F59E0B')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--color-border-default)')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F59E0B' }}>
              <Webhook size={18} strokeWidth={2.4} />
            </div>
            <div>
              <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, color: 'var(--color-text-primary)' }}>Webhooks</div>
              <div style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>Live webhook endpoints</div>
            </div>
          </div>
          <ArrowRight size={14} color="var(--color-text-muted)" />
        </div>
      </div>

      {/* 3. Main Workspace: Sticky Auto-Scrolling Sidebar + Ultra-Detailed Content */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 'var(--space-6)', alignItems: 'start' }}>
        {/* Sticky Sidebar Documentation Index with Auto-Scroll */}
        <div
          ref={sidebarRef}
          style={{
            position: 'sticky',
            top: '80px',
            maxHeight: 'calc(100vh - 100px)',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-3)',
            padding: 'var(--space-3)',
            borderRadius: 'var(--radius-xl)',
            backgroundColor: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border-default)',
            boxShadow: 'var(--shadow-tactile-sm)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-muted)', letterSpacing: '0.05em' }}>
              Documentation Index
            </span>
            <Badge variant="neutral" size="sm">{SECTIONS.length} Sections</Badge>
          </div>

          <SearchInput
            placeholder="Filter documentation..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {filteredSections.map((item) => {
              const isActive = activeSectionId === item.id;
              return (
                <button
                  key={item.id}
                  data-section-id={item.id}
                  onClick={() => scrollToSection(item.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-md)',
                    border: 'none',
                    background: isActive ? 'var(--color-primary-light, rgba(99, 102, 241, 0.12))' : 'transparent',
                    color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                    fontWeight: isActive ? 700 : 500,
                    fontSize: '11.5px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 100ms ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.backgroundColor = 'var(--color-bg-hover, rgba(255, 255, 255, 0.05))';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.title}
                  </span>
                  {item.badge && (
                    <span
                      style={{
                        fontSize: '9px',
                        padding: '1px 5px',
                        borderRadius: '4px',
                        backgroundColor: isActive ? 'var(--color-primary)' : 'var(--color-border-default)',
                        color: isActive ? '#fff' : 'var(--color-text-muted)',
                        fontWeight: 700,
                        marginLeft: '4px',
                      }}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Ultra-Detailed Documentation Content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', minWidth: 0 }}>

          {/* Section 1: Overview & Envelope */}
          <section id="sec-overview">
            <Card variant="elevated" padding="lg">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <Activity size={20} color="var(--color-primary)" />
                <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, margin: 0, color: 'var(--color-text-primary)' }}>
                  1. Overview & Architectural Envelope
                </h2>
              </div>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                The ByteBeacon Agent API is a high-performance REST surface authenticated by API key via the <code>x-api-key</code> header. Every successful transformed endpoint returns the exact authoritative success envelope:
              </p>
              <pre style={{ margin: '0.75rem 0', padding: '1rem', borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--color-bg-base)', border: '1px solid var(--color-border-default)', fontSize: '12px', overflowX: 'auto', color: '#10B981' }}>
{`{
  "success": true,
  "statusCode": 200,
  "message": "Success",
  "data": { /* the payload */ }
}`}
              </pre>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                Failures flip <code>success</code> to <code>false</code> and replace <code>data</code> with an <code>error</code> object containing an application error code, human-readable message, and a <code>meta.correlationId</code> for distributed tracing across telecom switches. List endpoints wrap rows in a <code>meta.page/limit/total</code> pagination envelope.
              </p>
            </Card>
          </section>

          {/* Section 2: Base URLs */}
          <section id="sec-base-url">
            <Card variant="elevated" padding="lg">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <Globe size={20} color="#06B6D4" />
                <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, margin: 0, color: 'var(--color-text-primary)' }}>
                  2. Base URLs & Environments
                </h2>
              </div>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                All API paths documented below are relative to the authoritative root. Always send the API key on every request except for the public precheck endpoint.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-3)', margin: '1rem 0' }}>
                <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-base)', border: '1px solid var(--color-border-default)' }}>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#10B981' }}>AUTHORITATIVE PRODUCTION (PRIMARY)</div>
                  <code style={{ fontSize: '12px', color: 'var(--color-text-primary)' }}>https://bytebeacon-2-0.onrender.com/api/v1</code>
                </div>
                <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-base)', border: '1px solid var(--color-border-default)' }}>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#8B5CF6' }}>CUSTOM DOMAIN ROUTE</div>
                  <code style={{ fontSize: '12px', color: 'var(--color-text-primary)' }}>https://api.bytebeacon.online/api/v1</code>
                </div>
              </div>
              <p style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>
                * Note: All connections require TLS 1.3 encryption. HTTP calls are rejected with 301 Permanent Redirect to HTTPS.
              </p>
            </Card>
          </section>

          {/* Section 3: Authentication & Key Management */}
          <section id="sec-auth">
            <Card variant="elevated" padding="lg">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <Key size={20} color="#8B5CF6" />
                <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, margin: 0, color: 'var(--color-text-primary)' }}>
                  3. Authentication & Key Management
                </h2>
              </div>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                Send your API key in the <code>x-api-key</code> HTTP header on every authenticated request. Two distinct key prefixes exist:
              </p>
              <ul style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.8, paddingLeft: '1.25rem' }}>
                <li><code>ak_live_...</code> — <strong>Production</strong>. Charges your agent wallet. Real orders, processed and delivered by our automated fulfillment engine.</li>
                <li><code>ak_test_...</code> — <strong>Sandbox</strong>. Never touches your wallet, never enters the real carrier queue, never charges Paystack. Safe for testing and automated CI/CD pipelines.</li>
              </ul>
              <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#EF4444', fontSize: '12px', margin: '1rem 0' }}>
                <strong>Store keys carefully:</strong> The plaintext key is shown exactly once upon creation. If you lose it, revoke and re-issue a new key from the Agent Dashboard. Treat your API keys like passwords.
              </div>
            </Card>
          </section>

          {/* Section 4: GET /agent/me */}
          <section id="sec-agent-me">
            <Card variant="elevated" padding="lg">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Badge variant="success" size="sm">GET</Badge>
                  <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 800, margin: 0, color: 'var(--color-text-primary)' }}>
                    /agent/me — Agent Profile Verification
                  </h3>
                </div>
                <Badge variant="neutral" size="sm">Scope: None Required</Badge>
              </div>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                The quickest way to confirm a key works is to fetch your own agent profile. Returns the agent record and loaded user relation.
              </p>
              <div style={{ margin: '0.75rem 0' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Headers</div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginTop: '4px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--color-border-default)', textAlign: 'left', color: 'var(--color-text-muted)' }}>
                        <th style={{ padding: '6px' }}>Header</th>
                        <th style={{ padding: '6px' }}>Example</th>
                        <th style={{ padding: '6px' }}>Required</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid var(--color-border-default)' }}>
                        <td style={{ padding: '6px' }}><code>x-api-key</code></td>
                        <td style={{ padding: '6px' }}><code>ak_live_8f3c...</code></td>
                        <td style={{ padding: '6px', color: '#EF4444', fontWeight: 700 }}>required</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ marginTop: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)' }}>REQUEST (cURL)</span>
                  <button onClick={() => handleCopy(`curl https://bytebeacon-2-0.onrender.com/api/v1/agent/me \\\n  -H "x-api-key: ak_live_8f3c..."`, 'c-agent-me')} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
                    <Copy size={12} /> Copy
                  </button>
                </div>
                <pre style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-base)', border: '1px solid var(--color-border-default)', fontSize: '12px', overflowX: 'auto', color: 'var(--color-text-primary)' }}>
curl https://bytebeacon-2-0.onrender.com/api/v1/agent/me \
  -H "x-api-key: ak_live_8f3c..."
                </pre>
              </div>

              <div style={{ marginTop: '0.75rem' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '4px' }}>RESPONSE (200 OK)</div>
                <pre style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-base)', border: '1px solid var(--color-border-default)', fontSize: '12px', overflowX: 'auto', color: '#10B981' }}>
{`{
  "success": true,
  "statusCode": 200,
  "message": "Success",
  "data": {
    "id": "9b2e5d1a-6c54-4b01-90e6-d701748f0851",
    "publicId": "agt_01J8K9P2X4",
    "businessName": "ByteBeacon Enterprise Partner",
    "businessPhone": "+233241234567",
    "address": "Accra, Ghana",
    "tier": "gold",
    "status": "approved",
    "pricePerGb": "4.20",
    "apiAccessStatus": "paid",
    "apiAccessPaidAt": "2026-06-01T10:00:00.000Z",
    "registrationFeePaidAt": "2026-05-20T09:00:00.000Z",
    "userId": "5f0c1122-3344-5566-7788-99aabbccddeeff",
    "user": {
      "id": "5f0c1122-3344-5566-7788-99aabbccddeeff",
      "name": "Kwame Mensah",
      "email": "kwame@example.com",
      "phone": "+233241234567"
    },
    "createdAt": "2026-05-20T09:00:00.000Z"
  }
}`}
                </pre>
              </div>
            </Card>
          </section>

          {/* Section 5: GET /me/agent/api-access/status */}
          <section id="sec-api-access">
            <Card variant="elevated" padding="lg">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Badge variant="success" size="sm">GET</Badge>
                  <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 800, margin: 0, color: 'var(--color-text-primary)' }}>
                    /me/agent/api-access/status — Live Key Fee & Paywall Status
                  </h3>
                </div>
                <Badge variant="purple" size="sm">Bearer JWT (Role: AGENT)</Badge>
              </div>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                Generating a live key (<code>ak_live_...</code>) may require a one-time API access fee paid securely via Paystack. This fee gates only live-key creation — everything else works without it: placing orders, funding wallet, webhooks, and <code>ak_test_...</code> sandbox keys are always free.
              </p>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                When active and unpaid, live-key creation returns 403 <code>live_access_not_paid</code>. Companion <code>POST /me/agent/api-access/initiate-payment</code> returns <code>{'{ access_granted }'}</code> or a Paystack <code>authorizationUrl</code>.
              </p>
              <pre style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-base)', border: '1px solid var(--color-border-default)', fontSize: '12px', overflowX: 'auto', color: '#10B981', marginTop: '0.75rem' }}>
{`{
  "success": true,
  "statusCode": 200,
  "message": "Success",
  "data": {
    "access_granted": true,
    "paid_at": "2026-06-01T10:00:00.000Z",
    "fee_required": false,
    "fee_amount": null,
    "fee_label": "Live API access",
    "fee_description": null
  }
}`}
              </pre>
            </Card>
          </section>

          {/* Section 6: Scopes & Rate Limits */}
          <section id="sec-scopes">
            <Card variant="elevated" padding="lg">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <ShieldCheck size={20} color="#10B981" />
                <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, margin: 0, color: 'var(--color-text-primary)' }}>
                  6. Scopes & Adaptive Rate Limits
                </h2>
              </div>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                API keys can be granted granular scopes. A key created with no scopes has full unrestricted access. Calling an endpoint without the required scope returns HTTP 403 Forbidden.
              </p>
              <div style={{ overflowX: 'auto', margin: '0.75rem 0' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-border-default)', textAlign: 'left', color: 'var(--color-text-muted)' }}>
                      <th style={{ padding: '8px' }}>Scope</th>
                      <th style={{ padding: '8px' }}>Permissions Granted</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid var(--color-border-default)' }}>
                      <td style={{ padding: '8px' }}><code>orders:read</code></td>
                      <td style={{ padding: '8px' }}>List & look up single and bulk orders with delivery summaries</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--color-border-default)' }}>
                      <td style={{ padding: '8px' }}><code>orders:write</code></td>
                      <td style={{ padding: '8px' }}>Place single data orders and multi-recipient bulk submissions</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--color-border-default)' }}>
                      <td style={{ padding: '8px' }}><code>wallet:read</code></td>
                      <td style={{ padding: '8px' }}>Read agent wallet balance, overdraft facility, and ledger history</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--color-border-default)' }}>
                      <td style={{ padding: '8px' }}><code>bundles:read</code></td>
                      <td style={{ padding: '8px' }}>List available telecom bundles and agent wholesale prices</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--color-border-default)' }}>
                      <td style={{ padding: '8px' }}><code>webhooks:read</code></td>
                      <td style={{ padding: '8px' }}>List registered webhook delivery endpoints</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--color-border-default)' }}>
                      <td style={{ padding: '8px' }}><code>webhooks:write</code></td>
                      <td style={{ padding: '8px' }}>Create, rotate HMAC secrets, and delete webhook subscriptions</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--color-border-default)' }}>
                      <td style={{ padding: '8px' }}><code>beneficiaries:read</code></td>
                      <td style={{ padding: '8px' }}>Run MTN Up2U prechecks and query approval statuses</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <h4 style={{ fontSize: '13px', fontWeight: 800, margin: '1rem 0 0.5rem 0', color: 'var(--color-text-primary)' }}>Adaptive Rate Limits</h4>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                The public precheck is throttled to <strong>30 checks/min per IP</strong>. Keyed agent precheck allows <strong>20 calls/min per agent</strong> (each call carrying up to 1,000 numbers = 20,000 checks/min). Exceeding limits returns HTTP 429 with <code>Retry-After</code> header.
              </p>
            </Card>
          </section>

          {/* Section 7: POST /agent/orders (Single Order) */}
          <section id="sec-single-orders">
            <Card variant="elevated" padding="lg">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Badge variant="primary" size="sm">POST</Badge>
                  <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 800, margin: 0, color: 'var(--color-text-primary)' }}>
                    /agent/orders — Place Single Order
                  </h3>
                </div>
                <Badge variant="purple" size="sm">Scope: orders:write</Badge>
              </div>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                Atomically debits the agent wallet at wholesale price and queues the order for immediate delivery. Returns HTTP 201 Created with status <code>received</code>.
              </p>

              <div style={{ margin: '0.75rem 0' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Parameters (JSON Body)</div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginTop: '4px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--color-border-default)', textAlign: 'left', color: 'var(--color-text-muted)' }}>
                        <th style={{ padding: '6px' }}>Name</th>
                        <th style={{ padding: '6px' }}>Type</th>
                        <th style={{ padding: '6px' }}>Required</th>
                        <th style={{ padding: '6px' }}>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid var(--color-border-default)' }}>
                        <td style={{ padding: '6px' }}><code>bundleId</code></td>
                        <td style={{ padding: '6px' }}>UUID</td>
                        <td style={{ padding: '6px', color: '#EF4444', fontWeight: 700 }}>yes</td>
                        <td style={{ padding: '6px' }}>Bundle ID resolved from <code>GET /agent/bundles</code></td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid var(--color-border-default)' }}>
                        <td style={{ padding: '6px' }}><code>phoneNumber</code></td>
                        <td style={{ padding: '6px' }}>string</td>
                        <td style={{ padding: '6px', color: '#EF4444', fontWeight: 700 }}>yes</td>
                        <td style={{ padding: '6px' }}>Ghanaian MSISDN format (e.g. <code>0241234567</code> or <code>+233241234567</code>)</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid var(--color-border-default)' }}>
                        <td style={{ padding: '6px' }}><code>idempotencyKey</code></td>
                        <td style={{ padding: '6px' }}>UUID v4</td>
                        <td style={{ padding: '6px', color: '#EF4444', fontWeight: 700 }}>yes</td>
                        <td style={{ padding: '6px' }}>Unique UUID v4. Replays within 24h return original order without double charge.</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid var(--color-border-default)' }}>
                        <td style={{ padding: '6px' }}><code>email</code></td>
                        <td style={{ padding: '6px' }}>string</td>
                        <td style={{ padding: '6px', color: 'var(--color-text-muted)' }}>no</td>
                        <td style={{ padding: '6px' }}>Optional customer email address for receipt delivery</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ marginTop: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)' }}>REQUEST (cURL)</span>
                  <button onClick={() => handleCopy(`curl -X POST https://bytebeacon-2-0.onrender.com/api/v1/agent/orders \\\n  -H "x-api-key: ak_live_8f3c..." \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "bundleId": "550e8400-e29b-41d4-a716-446655440000",\n    "phoneNumber": "+233241234567",\n    "idempotencyKey": "b71b5b4a-2a8a-4b56-91a4-2e3f9a0a0c4f",\n    "email": "customer@example.com"\n  }'`, 'c-single-order')} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
                    <Copy size={12} /> Copy
                  </button>
                </div>
                <pre style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-base)', border: '1px solid var(--color-border-default)', fontSize: '12px', overflowX: 'auto', color: 'var(--color-text-primary)' }}>
{`curl -X POST https://bytebeacon-2-0.onrender.com/api/v1/agent/orders \\
  -H "x-api-key: ak_live_8f3c..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "bundleId": "550e8400-e29b-41d4-a716-446655440000",
    "phoneNumber": "+233241234567",
    "idempotencyKey": "b71b5b4a-2a8a-4b56-91a4-2e3f9a0a0c4f",
    "email": "customer@example.com"
  }'`}
                </pre>
              </div>

              <div style={{ marginTop: '0.75rem' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '4px' }}>RESPONSE (201 CREATED)</div>
                <pre style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-base)', border: '1px solid var(--color-border-default)', fontSize: '12px', overflowX: 'auto', color: '#10B981' }}>
{`{
  "success": true,
  "statusCode": 201,
  "message": "Order placed and queued for processing.",
  "data": {
    "id": "9c1f7b2a-8d3e-4f1a-b6c8-1e2d3f4a5b6c",
    "publicId": "ord_01J8K9P2X4",
    "referenceCode": "TXN-7GH2K9",
    "idempotencyKey": "b71b5b4a-2a8a-4b56-91a4-2e3f9a0a0c4f",
    "userId": "5f0c1122-3344-5566-7788-99aabbccddeeff",
    "agentId": "9b2e5d1a-6c54-4b01-90e6-d701748f0851",
    "channel": "agent_api",
    "bundleId": "550e8400-e29b-41d4-a716-446655440000",
    "amount": "21.00",
    "network": "MTN",
    "bundleType": "DATA",
    "groupSizeGb": "5.00",
    "phoneNumber": "0241234567",
    "email": "customer@example.com",
    "status": "received",
    "isSandbox": false,
    "createdAt": "2026-07-07T12:00:00.000Z"
  }
}`}
                </pre>
              </div>

              <div style={{ marginTop: '1rem', padding: '0.75rem', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#F59E0B', fontSize: '12px' }}>
                <strong>First-time MTN Rule:</strong> A single order for an unapproved MTN number returns HTTP 422 <code>BENEFICIARY_NOT_VALIDATED</code>. The number is recorded for MTN admin approval. Once approved, the order can be retried. Call <code>POST /agent/beneficiaries/precheck</code> prior to placing orders.
              </div>
            </Card>
          </section>

          {/* Section 8: GET /agent/bundles */}
          <section id="sec-bundles">
            <Card variant="elevated" padding="lg">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Badge variant="success" size="sm">GET</Badge>
                  <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 800, margin: 0, color: 'var(--color-text-primary)' }}>
                    /agent/bundles — Wholesale Catalog & Pricing
                  </h3>
                </div>
                <Badge variant="purple" size="sm">Scope: bundles:read</Badge>
              </div>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                Lists active data bundles available to this key, priced according to your wholesale tier. The <code>agentAmount</code> is the exact debit charged to your wallet.
              </p>
              <pre style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-base)', border: '1px solid var(--color-border-default)', fontSize: '12px', overflowX: 'auto', color: '#10B981', marginTop: '0.75rem' }}>
{`{
  "success": true,
  "statusCode": 200,
  "message": "Success",
  "data": {
    "data": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "MTN 5GB Data Package",
        "network": "MTN",
        "dataVolume": "5GB",
        "bundleType": "DATA",
        "amount": "25.00",
        "agentAmount": "21.00",
        "isActive": true
      }
    ],
    "meta": {
      "page": 1,
      "limit": 50,
      "total": 42
    }
  }
}`}
              </pre>
            </Card>
          </section>

          {/* Section 9: POST /agent/orders/bulk */}
          <section id="sec-bulk-orders">
            <Card variant="elevated" padding="lg">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Badge variant="primary" size="sm">POST</Badge>
                  <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 800, margin: 0, color: 'var(--color-text-primary)' }}>
                    /agent/orders/bulk — Multi-Recipient Batch Order
                  </h3>
                </div>
                <Badge variant="purple" size="sm">Scope: orders:write</Badge>
              </div>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                Order for up to 1,000 recipients in a single submission. Automatically groups recipients and creates per-bundle-size child orders. Debits wallet linear per-GB total once.
              </p>

              <div style={{ margin: '0.75rem 0' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Parameters (JSON Body)</div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginTop: '4px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--color-border-default)', textAlign: 'left', color: 'var(--color-text-muted)' }}>
                        <th style={{ padding: '6px' }}>Name</th>
                        <th style={{ padding: '6px' }}>Type</th>
                        <th style={{ padding: '6px' }}>Required</th>
                        <th style={{ padding: '6px' }}>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid var(--color-border-default)' }}>
                        <td style={{ padding: '6px' }}><code>network</code></td>
                        <td style={{ padding: '6px' }}>MTN | TELECEL</td>
                        <td style={{ padding: '6px', color: '#EF4444', fontWeight: 700 }}>yes</td>
                        <td style={{ padding: '6px' }}>One network for the entire bulk submission</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid var(--color-border-default)' }}>
                        <td style={{ padding: '6px' }}><code>recipients</code></td>
                        <td style={{ padding: '6px' }}>array (1–1000)</td>
                        <td style={{ padding: '6px', color: '#EF4444', fontWeight: 700 }}>yes</td>
                        <td style={{ padding: '6px' }}>Array of <code>{'{ phoneNumber, dataSizeGb }'}</code> objects</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid var(--color-border-default)' }}>
                        <td style={{ padding: '6px' }}><code>idempotencyKey</code></td>
                        <td style={{ padding: '6px' }}>string (8–36)</td>
                        <td style={{ padding: '6px', color: '#EF4444', fontWeight: 700 }}>yes</td>
                        <td style={{ padding: '6px' }}>Dedupes the entire bulk submission batch</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid var(--color-border-default)' }}>
                        <td style={{ padding: '6px' }}><code>confirmedPorted</code></td>
                        <td style={{ padding: '6px' }}>string[]</td>
                        <td style={{ padding: '6px', color: 'var(--color-text-muted)' }}>no</td>
                        <td style={{ padding: '6px' }}>Numbers on other network prefixes confirmed ported</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid var(--color-border-default)' }}>
                        <td style={{ padding: '6px' }}><code>onUnvalidated</code></td>
                        <td style={{ padding: '6px' }}>"set_aside" | "reject"</td>
                        <td style={{ padding: '6px', color: 'var(--color-text-muted)' }}>no</td>
                        <td style={{ padding: '6px' }}>Default <code>"set_aside"</code> partial success; <code>"reject"</code> strict 422</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ marginTop: '0.75rem' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '4px' }}>RESPONSE (201 CREATED)</div>
                <pre style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-base)', border: '1px solid var(--color-border-default)', fontSize: '12px', overflowX: 'auto', color: '#10B981' }}>
{`{
  "success": true,
  "statusCode": 201,
  "message": "Bulk order placed and queued for processing.",
  "data": {
    "id": "sub_01J8K9P2X4",
    "referenceCode": "BLK-7GH2K9ABCDEF",
    "network": "MTN",
    "amount": "48.00",
    "status": "received",
    "createdAt": "2026-07-07T12:00:00.000Z",
    "beneficiaryCount": 2,
    "groupCount": 2,
    "orders": [
      {
        "id": "ord_a1b2c3d4",
        "publicId": "ord_a1b2c3d4",
        "referenceCode": "TXN-AAA111",
        "sizeGb": 2,
        "beneficiaryCount": 1,
        "amount": "8.40",
        "status": "received"
      },
      {
        "id": "ord_e5f6g7h8",
        "publicId": "ord_e5f6g7h8",
        "referenceCode": "TXN-BBB222",
        "sizeGb": 5,
        "beneficiaryCount": 1,
        "amount": "21.00",
        "status": "received"
      }
    ],
    "blocked": ["0559990000"]
  }
}`}
                </pre>
              </div>
            </Card>
          </section>

          {/* Section 10: POST /me/agent/orders/bulk (XLSX Upload) */}
          <section id="sec-bulk-xlsx">
            <Card variant="elevated" padding="lg">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Badge variant="primary" size="sm">POST</Badge>
                  <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 800, margin: 0, color: 'var(--color-text-primary)' }}>
                    /me/agent/orders/bulk — Excel XLSX File Upload Mirror
                  </h3>
                </div>
                <Badge variant="purple" size="sm">Bearer JWT (Multipart)</Badge>
              </div>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                Accepts multipart file upload of <code>.xlsx</code> spreadsheet with columns <code>Phone</code> and <code>Data Size</code>. Produces identical submission receipt and child order grouping as the JSON bulk endpoint.
              </p>
            </Card>
          </section>

          {/* Section 11: POST /orders/beneficiaries/precheck */}
          <section id="sec-public-precheck">
            <Card variant="elevated" padding="lg">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Badge variant="primary" size="sm">POST</Badge>
                  <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 800, margin: 0, color: 'var(--color-text-primary)' }}>
                    /orders/beneficiaries/precheck — Public MTN Up2U Precheck
                  </h3>
                </div>
                <Badge variant="neutral" size="sm">Public (30 req/min/IP)</Badge>
              </div>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                Public validation endpoint (up to 10 numbers, max 20 chars each). Returns <code>known: true</code> for validated MTN recipients. Telecel always passes.
              </p>
              <pre style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-base)', border: '1px solid var(--color-border-default)', fontSize: '12px', overflowX: 'auto', color: '#10B981', marginTop: '0.75rem' }}>
{`{
  "success": true,
  "statusCode": 200,
  "message": "Success",
  "data": {
    "network": "MTN",
    "results": [
      {
        "phone": "0241234567",
        "normalized": "0241234567",
        "valid": true,
        "known": true
      },
      {
        "phone": "0209990000",
        "normalized": "0209990000",
        "valid": true,
        "known": false
      }
    ]
  }
}`}
              </pre>
            </Card>
          </section>

          {/* Section 12: POST /agent/beneficiaries/precheck */}
          <section id="sec-agent-precheck">
            <Card variant="elevated" padding="lg">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Badge variant="primary" size="sm">POST</Badge>
                  <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 800, margin: 0, color: 'var(--color-text-primary)' }}>
                    /agent/beneficiaries/precheck — Keyed Bulk Precheck
                  </h3>
                </div>
                <Badge variant="purple" size="sm">Scope: beneficiaries:read</Badge>
              </div>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                Allows checking up to 1,000 numbers in one call with opt-in <code>record: true</code> to automatically submit unapproved numbers into the Pending MTN Approval queue.
              </p>
              <pre style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-base)', border: '1px solid var(--color-border-default)', fontSize: '12px', overflowX: 'auto', color: '#10B981', marginTop: '0.75rem' }}>
{`{
  "success": true,
  "statusCode": 200,
  "message": "Success",
  "data": {
    "network": "MTN",
    "enforced": true,
    "sandbox": false,
    "recorded": true,
    "summary": {
      "requested": 3,
      "unique": 2,
      "valid": 2,
      "invalid": 0,
      "known": 1,
      "unknown": 1
    },
    "unknown": ["0209990000"],
    "results": [
      {
        "phone": "0241234567",
        "normalized": "0241234567",
        "valid": true,
        "known": true
      },
      {
        "phone": "0209990000",
        "normalized": "0209990000",
        "valid": true,
        "known": false
      }
    ]
  }
}`}
              </pre>
            </Card>
          </section>

          {/* Section 13: GET /agent/beneficiaries */}
          <section id="sec-beneficiary-status">
            <Card variant="elevated" padding="lg">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Badge variant="success" size="sm">GET</Badge>
                  <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 800, margin: 0, color: 'var(--color-text-primary)' }}>
                    /agent/beneficiaries — Check MTN Approval Status
                  </h3>
                </div>
                <Badge variant="purple" size="sm">Scope: beneficiaries:read</Badge>
              </div>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                Polls where each of your submitted recipient numbers stands in the approval lifecycle (<code>pending</code> → <code>submitted</code> → <code>approved</code> or <code>rejected</code>).
              </p>
            </Card>
          </section>

          {/* Section 14: GET /agent/orders */}
          <section id="sec-list-orders">
            <Card variant="elevated" padding="lg">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Badge variant="success" size="sm">GET</Badge>
                  <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 800, margin: 0, color: 'var(--color-text-primary)' }}>
                    /agent/orders — List Orders & Delivery Tallies
                  </h3>
                </div>
                <Badge variant="purple" size="sm">Scope: orders:read</Badge>
              </div>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                Lists this agent's orders (newest first) with per-order delivery tallies (<code>approved</code>, <code>pending</code>, <code>failed</code>). Excludes recipients array to optimize throughput.
              </p>
            </Card>
          </section>

          {/* Section 15: GET /agent/orders/:id */}
          <section id="sec-get-order">
            <Card variant="elevated" padding="lg">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Badge variant="success" size="sm">GET</Badge>
                  <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 800, margin: 0, color: 'var(--color-text-primary)' }}>
                    /agent/orders/:id — Order Detail & Beneficiaries
                  </h3>
                </div>
                <Badge variant="purple" size="sm">Scope: orders:read</Badge>
              </div>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                Fetches comprehensive status, recipient list (<code>beneficiaries[]</code>), and wallet payment split (main vs overdraft) for a given order public ID.
              </p>
            </Card>
          </section>

          {/* Section 16: GET /agent/wallet */}
          <section id="sec-wallet">
            <Card variant="elevated" padding="lg">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Badge variant="success" size="sm">GET</Badge>
                  <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 800, margin: 0, color: 'var(--color-text-primary)' }}>
                    /agent/wallet/balance & /agent/wallet/ledger
                  </h3>
                </div>
                <Badge variant="purple" size="sm">Scope: wallet:read</Badge>
              </div>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                Read live wallet balance, overdraft capacity, and detailed ledger entries. If overdraft is active, <code>availableToSpend = balance + overdraftAvailable</code>. A debit that crosses zero generates two ledger rows (one from <code>main_balance</code> and one from <code>overdraft</code>).
              </p>
              <pre style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-base)', border: '1px solid var(--color-border-default)', fontSize: '12px', overflowX: 'auto', color: '#10B981', marginTop: '0.75rem' }}>
{`{
  "success": true,
  "statusCode": 200,
  "message": "Success",
  "data": {
    "balance": 1540.75,
    "currency": "GHS",
    "overdraftLimit": 500,
    "overdraftUsed": 0,
    "overdraftAvailable": 500,
    "overdraftActive": true,
    "availableToSpend": 2040.75
  }
}`}
              </pre>
            </Card>
          </section>

          {/* Section 17: Webhooks Management */}
          <section id="sec-webhooks">
            <Card variant="elevated" padding="lg">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Webhook size={20} color="#F59E0B" />
                  <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 800, margin: 0, color: 'var(--color-text-primary)' }}>
                    17. Webhook Subscriptions Management
                  </h3>
                </div>
                <Badge variant="purple" size="sm">Scope: webhooks:write</Badge>
              </div>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                Manage destination webhook URLs for asynchronous real-time events. Signing secrets (<code>whsec_...</code>) are shown ONCE upon creation or rotation.
              </p>
              <ul style={{ fontSize: '12px', color: 'var(--color-text-secondary)', lineHeight: 1.8 }}>
                <li><code>POST /agent/webhooks</code> — Register new HTTPS URL; returns signing secret.</li>
                <li><code>GET /agent/webhooks</code> — List active subscriptions (secrets omitted).</li>
                <li><code>POST /agent/webhooks/:id/rotate-secret</code> — Rotate signing secret immediately.</li>
                <li><code>DELETE /agent/webhooks/:id</code> — Delete subscription (HTTP 204 No Content).</li>
              </ul>
            </Card>
          </section>

          {/* Section 18: Signature Verification */}
          <section id="sec-signatures">
            <Card variant="elevated" padding="lg">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <Lock size={20} color="#EF4444" />
                <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, margin: 0, color: 'var(--color-text-primary)' }}>
                  18. Cryptographic Signature Verification
                </h2>
              </div>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                Inbound webhook requests include an <code>X-Telecom-Signature</code> header formatted as <code>t=&lt;unix-ts&gt;,v1=&lt;hex-sig&gt;</code>. Compute HMAC-SHA256 over <code>{'\${ts}.\${rawBody}'}</code> using your <code>whsec_...</code> secret and compare using a timing-safe equality check.
              </p>
              <pre style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-base)', border: '1px solid var(--color-border-default)', fontSize: '12px', overflowX: 'auto', color: 'var(--color-text-primary)', marginTop: '0.75rem' }}>
{`import crypto from "node:crypto";

export function verifyWebhookSignature(rawBody: string, header: string, secret: string): boolean {
  // Header format: "t=<unix-ts>,v1=<hex-sig>"
  const [tsKv, sigKv] = header.split(",");
  const ts = tsKv?.split("=")[1];
  const sig = sigKv?.split("=")[1];

  if (!ts || !sig) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false; // 5-minute replay window

  const expected = crypto
    .createHmac("sha256", secret)
    .update(\`\${ts}.\${rawBody}\`)
    .digest("hex");

  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}`}
              </pre>
            </Card>
          </section>

          {/* Section 19: Outbound Events */}
          <section id="sec-outbound-events">
            <Card variant="elevated" padding="lg">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <Zap size={20} color="#10B981" />
                <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, margin: 0, color: 'var(--color-text-primary)' }}>
                  19. Outbound Event Delivery Payloads
                </h2>
              </div>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                The outbound webhook envelope is <code>{'{ id, type, created_at, data }'}</code>. Supported event types:
              </p>
              <ul style={{ fontSize: '12px', color: 'var(--color-text-secondary)', lineHeight: 1.8 }}>
                <li><code>order.received</code>, <code>order.processing</code>, <code>order.approved</code>, <code>order.partially_approved</code>, <code>order.rejected</code></li>
                <li><code>purchase.success</code>, <code>purchase.failed</code> (immediate fulfillment callbacks)</li>
                <li><code>wallet.updated</code> (fires on deposit or refund)</li>
              </ul>
              <pre style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-base)', border: '1px solid var(--color-border-default)', fontSize: '12px', overflowX: 'auto', color: '#10B981', marginTop: '0.75rem' }}>
{`{
  "id": "evt_01J8K9P2X4",
  "type": "order.approved",
  "created_at": "2026-07-07T12:05:00.000Z",
  "data": {
    "order_id": "ord_01J8K9P2X4",
    "reference": "TXN-7GH2K9",
    "status": "approved",
    "network": "MTN",
    "amount": "21.00",
    "occurred_at": "2026-07-07T12:05:00.000Z"
  }
}`}
              </pre>
            </Card>
          </section>

          {/* Section 20: Errors Reference */}
          <section id="sec-errors">
            <Card variant="elevated" padding="lg">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <AlertTriangle size={20} color="#EF4444" />
                <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, margin: 0, color: 'var(--color-text-primary)' }}>
                  20. Error Envelopes & Error Codes Reference
                </h2>
              </div>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                Standard failure envelope returned across all API endpoints:
              </p>
              <pre style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-base)', border: '1px solid var(--color-border-default)', fontSize: '12px', overflowX: 'auto', color: '#EF4444', margin: '0.75rem 0' }}>
{`{
  "success": false,
  "statusCode": 400,
  "error": {
    "code": "INSUFFICIENT_BALANCE",
    "message": "Insufficient agent wallet balance: have 4.00 GHS, need 21.00 GHS"
  },
  "meta": {
    "correlationId": "req-9a1b2c3d4e5f"
  }
}`}
              </pre>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-border-default)', textAlign: 'left', color: 'var(--color-text-muted)' }}>
                      <th style={{ padding: '6px' }}>HTTP</th>
                      <th style={{ padding: '6px' }}>Error Code</th>
                      <th style={{ padding: '6px' }}>Condition / Meaning</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid var(--color-border-default)' }}>
                      <td style={{ padding: '6px' }}>400</td>
                      <td style={{ padding: '6px' }}><code>INSUFFICIENT_BALANCE</code></td>
                      <td style={{ padding: '6px' }}>Wallet available to spend is less than order total</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--color-border-default)' }}>
                      <td style={{ padding: '6px' }}>400</td>
                      <td style={{ padding: '6px' }}><code>BUNDLE_INACTIVE</code></td>
                      <td style={{ padding: '6px' }}>The requested bundle is marked inactive by telecom ops</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--color-border-default)' }}>
                      <td style={{ padding: '6px' }}>400</td>
                      <td style={{ padding: '6px' }}><code>BULK_NOT_ON_SANDBOX</code></td>
                      <td style={{ padding: '6px' }}>Bulk orders are disabled on test keys (ak_test_...)</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--color-border-default)' }}>
                      <td style={{ padding: '6px' }}>401</td>
                      <td style={{ padding: '6px' }}><code>UNAUTHORIZED</code></td>
                      <td style={{ padding: '6px' }}>Missing or invalid x-api-key header</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--color-border-default)' }}>
                      <td style={{ padding: '6px' }}>403</td>
                      <td style={{ padding: '6px' }}><code>AGENT_INACTIVE</code></td>
                      <td style={{ padding: '6px' }}>Agent account suspended or lacking required scope</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--color-border-default)' }}>
                      <td style={{ padding: '6px' }}>404</td>
                      <td style={{ padding: '6px' }}><code>BUNDLE_NOT_FOUND</code></td>
                      <td style={{ padding: '6px' }}>The requested bundle ID does not exist</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--color-border-default)' }}>
                      <td style={{ padding: '6px' }}>422</td>
                      <td style={{ padding: '6px' }}><code>INVALID_PHONE</code></td>
                      <td style={{ padding: '6px' }}>Recipient phone number is not a valid Ghanaian MSISDN</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--color-border-default)' }}>
                      <td style={{ padding: '6px' }}>422</td>
                      <td style={{ padding: '6px' }}><code>BENEFICIARY_NOT_VALIDATED</code></td>
                      <td style={{ padding: '6px' }}>First-time MTN recipient requires admin approval; precheck first</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--color-border-default)' }}>
                      <td style={{ padding: '6px' }}>429</td>
                      <td style={{ padding: '6px' }}><code>RATE_LIMITED</code></td>
                      <td style={{ padding: '6px' }}>Per-key or IP request throttle exceeded</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--color-border-default)' }}>
                      <td style={{ padding: '6px' }}>500</td>
                      <td style={{ padding: '6px' }}><code>INTERNAL_ERROR</code></td>
                      <td style={{ padding: '6px' }}>Unexpected server error; re-query via idempotency key</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>
          </section>

          {/* Section 21: Idempotency & Lifecycle */}
          <section id="sec-idempotency-lifecycle">
            <Card variant="elevated" padding="lg">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <RefreshCw size={20} color="var(--color-primary)" />
                <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, margin: 0, color: 'var(--color-text-primary)' }}>
                  21. Idempotency & Order Finite State Machine
                </h2>
              </div>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                Every single order requires a valid UUID v4 <code>idempotencyKey</code>; bulk orders accept an 8–36 character string. The idempotency engine prevents duplicate wallet debits:
              </p>
              <ul style={{ fontSize: '12px', color: 'var(--color-text-secondary)', lineHeight: 1.8 }}>
                <li><strong>Same key + same payload:</strong> Returns the existing order response immediately (24-hour cache). Safe to replay on network dropouts.</li>
                <li><strong>Same key + different payload:</strong> Returns HTTP 400 Bad Request (Idempotency conflict).</li>
              </ul>
              <h4 style={{ fontSize: '13px', fontWeight: 800, margin: '1rem 0 0.5rem 0', color: 'var(--color-text-primary)' }}>Order Finite State Machine</h4>
              <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-base)', border: '1px solid var(--color-border-default)', fontSize: '12px', color: 'var(--color-text-primary)', textAlign: 'center' }}>
                <code>received</code> &rarr; <code>processing</code> &rarr; <code>delivered / approved</code> (Happy Path)<br />
                &searr; <code>failed / could_not_deliver</code> &rarr; <code>refunded</code> (Automated Wallet Credit)
              </div>
            </Card>
          </section>

        </div>
      </div>

      {/* In-System Swagger UI Modal */}
      <Modal
        isOpen={swaggerModalOpen}
        onClose={() => setSwaggerModalOpen(false)}
        title="Interactive Swagger UI Explorer"
        subtitle="Live API testing and OpenAPI interactive specification directly within your agent workspace"
        maxWidth="1180px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '75vh', minHeight: '500px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--color-border-default)' }}>
            <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
              Source: <code style={{ color: 'var(--color-primary)' }}>{swaggerUrl}</code>
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(swaggerUrl, '_blank')}
                leftIcon={<ExternalLink size={14} />}
              >
                Open In Standalone Window
              </Button>
            </div>
          </div>
          <iframe
            src={swaggerUrl}
            title="Authoritative Swagger UI"
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              borderRadius: 'var(--radius-lg)',
              backgroundColor: '#fff',
            }}
          />
        </div>
      </Modal>

      {/* In-System OpenAPI JSON Spec Modal */}
      <Modal
        isOpen={openapiModalOpen}
        onClose={() => setOpenapiModalOpen(false)}
        title="OpenAPI 3.1 Specification JSON"
        subtitle="Direct access to the raw machine-readable API specification schema"
        maxWidth="840px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '70vh' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--color-border-default)' }}>
            <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
              Endpoint: <code style={{ color: '#06B6D4' }}>{openapiUrl}</code>
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(openapiUrl);
                  toastSuccess('URL Copied', 'OpenAPI JSON URL copied to clipboard');
                }}
                leftIcon={<Copy size={14} />}
              >
                Copy URL
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => window.open(openapiUrl, '_blank')}
                leftIcon={<Download size={14} />}
              >
                Open / Download JSON
              </Button>
            </div>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', lineHeight: 1.6, margin: 0 }}>
            The OpenAPI 3.1 schema contains complete parameter typings, request and response envelopes, and error codes for Postman, Insomnia, or custom SDK generators.
          </p>
        </div>
      </Modal>
    </div>
  );
};
