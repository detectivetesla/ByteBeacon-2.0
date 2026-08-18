import React, { useEffect } from 'react';
import { Input, InputProps } from './Input.js';
import { Phone } from 'lucide-react';

export interface PhoneInputProps extends Omit<InputProps, 'type' | 'leftIcon'> {
  showNetworkBadge?: boolean;
  onNetworkDetected?: (network: 'MTN' | 'TELECEL' | 'AIRTELTIGO' | 'UNKNOWN') => void;
}

export const detectGhanaianNetwork = (cleanPhone: string): 'MTN' | 'TELECEL' | 'AIRTELTIGO' | 'UNKNOWN' => {
  let localNum = cleanPhone.replace(/[^0-9]/g, '');
  if (localNum.startsWith('233')) {
    localNum = '0' + localNum.slice(3);
  }
  if (localNum.length < 3) return 'UNKNOWN';

  const prefix = localNum.slice(0, 3);
  // MTN: 024, 054, 055, 059, 025, 053
  if (['024', '054', '055', '059', '025', '053'].includes(prefix)) return 'MTN';
  // Telecel: 020, 050
  if (['020', '050'].includes(prefix)) return 'TELECEL';
  // AirtelTigo: 027, 057, 026, 056
  if (['027', '057', '026', '056'].includes(prefix)) return 'AIRTELTIGO';

  return 'UNKNOWN';
};

export const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ showNetworkBadge = true, onNetworkDetected, value, onChange, placeholder = '024 123 4567', ...props }, ref) => {
    const phoneStr = typeof value === 'string' ? value : '';
    const network = detectGhanaianNetwork(phoneStr);

    useEffect(() => {
      onNetworkDetected?.(network);
    }, [network, onNetworkDetected]);

    const getNetworkBadge = () => {
      if (!showNetworkBadge || network === 'UNKNOWN' || phoneStr.length < 3) return null;
      switch (network) {
        case 'MTN':
          return (
            <span
              style={{
                fontSize: '9px',
                fontWeight: 900,
                padding: '2px 5px',
                borderRadius: '4px',
                backgroundColor: '#FFCC00',
                color: '#000000',
                letterSpacing: '0.02em',
                lineHeight: 1,
              }}
            >
              MTN
            </span>
          );
        case 'TELECEL':
          return (
            <span
              style={{
                fontSize: '9px',
                fontWeight: 900,
                padding: '2px 5px',
                borderRadius: '4px',
                backgroundColor: '#E11D48',
                color: '#FFFFFF',
                letterSpacing: '0.02em',
                lineHeight: 1,
              }}
            >
              TELECEL
            </span>
          );
        case 'AIRTELTIGO':
          return (
            <span
              style={{
                fontSize: '9px',
                fontWeight: 900,
                padding: '2px 5px',
                borderRadius: '4px',
                backgroundColor: '#2563EB',
                color: '#FFFFFF',
                letterSpacing: '0.02em',
                lineHeight: 1,
              }}
            >
              AT
            </span>
          );
      }
    };

    return (
      <Input
        ref={ref}
        type="tel"
        inputMode="tel"
        leftIcon={<Phone size={15} color="var(--color-text-muted)" />}
        rightIcon={getNetworkBadge() || props.rightIcon}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        {...props}
      />
    );
  },
);

PhoneInput.displayName = 'PhoneInput';
