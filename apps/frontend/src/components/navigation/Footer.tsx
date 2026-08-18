import React from 'react';

export const Footer: React.FC = () => {
  const footerLinks = {
    Products: [
      { name: 'MTN Turbo Data', href: '/#networks' },
      { name: 'Telecel Instant Data', href: '/#networks' },
      { name: 'AirtelTigo Big Time', href: '/#networks' },
      { name: 'Track Delivery', href: '/track' },
      { name: 'How It Works', href: '/#how-it-works' },
    ],
    Company: [
      { name: 'About Us', href: '/about' },
      { name: 'Become an Agent', href: '/#become-agent' },
      { name: 'Security & Escrow', href: '/security' },
      { name: 'System Status', href: '/status' },
    ],
    Developers: [
      { name: 'REST API Reference', href: '/developer' },
      { name: 'Webhook Signatures', href: '/developer' },
      { name: 'Idempotency Keys', href: '/developer' },
      { name: 'Rate Limits', href: '/developer' },
    ],
    Support: [
      { name: 'Help Center', href: '/support' },
      { name: 'Contact WhatsApp', href: 'https://chat.whatsapp.com/Jpmtz6kPYbR6bcYV63MiQi' },
      { name: 'Terms of Service', href: '/terms' },
      { name: 'Privacy Policy', href: '/privacy' },
    ],
  };

  const socialLinks = [
    {
      name: 'WhatsApp',
      href: 'https://chat.whatsapp.com/Jpmtz6kPYbR6bcYV63MiQi',
      icon: 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z',
    },
    {
      name: 'Facebook',
      href: '#',
      icon: 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z',
    },
    {
      name: 'Instagram',
      href: '#',
      icon: 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z',
    },
  ];

  return (
    <footer
      style={{
        backgroundColor: '#080D1A',
        color: '#F5F7FA',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        paddingTop: 'var(--space-16)',
        paddingBottom: 'var(--space-12)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <div style={{ maxWidth: 'var(--container-xl)', margin: '0 auto', padding: '0 var(--space-6)' }}>
        {/* Top Section: Brand + Links Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 'var(--space-10)',
            paddingBottom: 'var(--space-12)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          {/* Brand Column */}
          <div style={{ gridColumn: 'span 2', minWidth: '260px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: 'var(--space-4)' }}>
              <img src="/logo.png" alt="ByteBeacon" style={{ width: '44px', height: '44px', objectFit: 'contain' }} />
              <span
                style={{
                  fontSize: 'var(--font-size-xl)',
                  fontWeight: 800,
                  fontFamily: 'var(--font-display)',
                  letterSpacing: '-0.02em',
                  color: '#FFFFFF',
                }}
              >
                ByteBeacon
              </span>
            </div>

            <p
              style={{
                fontSize: 'var(--font-size-xs)',
                color: 'rgba(255, 255, 255, 0.65)',
                lineHeight: 1.6,
                maxWidth: '340px',
                marginBottom: 'var(--space-6)',
              }}
            >
              Bespoke digital solutions for modern connectivity. Ghana's most trusted platform for secure, instant, and affordable data bundles.
            </p>

            {/* Social Links Row */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: 'var(--space-6)' }}>
              {socialLinks.map((social) => (
                <a
                  key={social.name}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.name}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'rgba(255, 255, 255, 0.7)',
                    transition: 'all var(--transition-fast)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--color-primary-bright)';
                    e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.4)';
                    e.currentTarget.style.backgroundColor = 'rgba(34, 197, 94, 0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                  }}
                >
                  <svg style={{ width: '16px', height: '16px', fill: 'currentColor' }} viewBox="0 0 24 24">
                    <path d={social.icon} />
                  </svg>
                </a>
              ))}
            </div>

            {/* Live System Status Badge */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.35rem 0.75rem',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'rgba(34, 197, 94, 0.10)',
                border: '1px solid rgba(34, 197, 94, 0.25)',
                fontSize: 'var(--font-size-2xs)',
                fontWeight: 600,
                color: 'var(--color-primary-bright)',
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-primary-bright)',
                  boxShadow: '0 0 6px var(--color-primary-bright)',
                }}
              />
              All Carrier Pipelines Operational
            </div>
          </div>

          {/* Navigation Category Columns */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4
                style={{
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: '#FFFFFF',
                  marginBottom: 'var(--space-4)',
                }}
              >
                {category}
              </h4>
              <ul
                style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.625rem',
                  fontSize: 'var(--font-size-xs)',
                  color: 'rgba(255, 255, 255, 0.65)',
                }}
              >
                {links.map((link) => (
                  <li key={link.name}>
                    <a
                      href={link.href}
                      style={{
                        color: 'inherit',
                        transition: 'color var(--transition-fast)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = '#FFFFFF';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = 'rgba(255, 255, 255, 0.65)';
                      }}
                    >
                      {link.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Section: Copyright & Compliance */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 'var(--space-4)',
            paddingTop: 'var(--space-8)',
            fontSize: 'var(--font-size-2xs)',
            color: 'rgba(255, 255, 255, 0.45)',
          }}
        >
          <div>
            © {new Date().getFullYear()} ByteBeacon Technologies Ltd. All rights reserved. Registered in Ghana.
          </div>

          <div style={{ display: 'flex', gap: '1.25rem' }}>
            <span style={{ color: 'rgba(255, 255, 255, 0.45)' }}>MTN MoMo</span>
            <span>•</span>
            <span style={{ color: 'rgba(255, 255, 255, 0.45)' }}>Telecel Cash</span>
            <span>•</span>
            <span style={{ color: 'rgba(255, 255, 255, 0.45)' }}>AT Money</span>
            <span>•</span>
            <span style={{ color: 'rgba(255, 255, 255, 0.45)' }}>Bank Cards</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
