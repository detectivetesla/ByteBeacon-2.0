import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { OFFICIAL_WHATSAPP_COMMUNITY_URL } from '../config/brand.config.js';
import { Footer } from '../components/navigation/Footer.js';
import { WhatsAppFloat } from '../components/ui/WhatsAppFloat.js';

describe('Official ByteBeacon WhatsApp Community Link', () => {
  it('has the correct canonical WhatsApp community invite URL', () => {
    expect(OFFICIAL_WHATSAPP_COMMUNITY_URL).toBe(
      'https://chat.whatsapp.com/CmZ5BIrCWThHGAoiovtMAg',
    );
  });

  it('renders official WhatsApp link in the Footer for Contact and Social icon', () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>,
    );

    // Contact WhatsApp support link
    const contactWhatsAppLink = screen.getByRole('link', { name: /Contact WhatsApp/i });
    expect(contactWhatsAppLink).toBeInTheDocument();
    expect(contactWhatsAppLink).toHaveAttribute(
      'href',
      'https://chat.whatsapp.com/CmZ5BIrCWThHGAoiovtMAg',
    );

    // Social icon link
    const socialWhatsAppLink = screen.getByRole('link', { name: /^WhatsApp$/i });
    expect(socialWhatsAppLink).toBeInTheDocument();
    expect(socialWhatsAppLink).toHaveAttribute(
      'href',
      'https://chat.whatsapp.com/CmZ5BIrCWThHGAoiovtMAg',
    );
  });

  it('renders floating WhatsApp community button with official URL', () => {
    render(<WhatsAppFloat />);

    const floatButton = screen.getByRole('link', { name: /Join our WhatsApp community/i });
    expect(floatButton).toBeInTheDocument();
    expect(floatButton).toHaveAttribute(
      'href',
      'https://chat.whatsapp.com/CmZ5BIrCWThHGAoiovtMAg',
    );
    expect(floatButton).toHaveAttribute('target', '_blank');
  });
});
