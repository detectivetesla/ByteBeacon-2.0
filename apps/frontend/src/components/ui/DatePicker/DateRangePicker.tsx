import React, { useState } from 'react';
import { DateInput } from './DateInput.js';
import styles from '../Input/Input.module.css';

export interface DateRangeValue {
  startDate: string;
  endDate: string;
  preset?: 'TODAY' | '7D' | '30D' | '90D' | '1Y' | 'CUSTOM';
}

export interface DateRangePickerProps {
  label?: string;
  value?: DateRangeValue;
  onChange?: (range: DateRangeValue) => void;
  style?: React.CSSProperties;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  label,
  value,
  onChange,
  style,
}) => {
  const [selectedPreset, setSelectedPreset] = useState<string>(value?.preset || '30D');

  const todayStr = new Date().toISOString().slice(0, 10);

  const getPresetDates = (preset: string) => {
    const d = new Date();
    const end = d.toISOString().slice(0, 10);
    switch (preset) {
      case 'TODAY':
        return { startDate: end, endDate: end, preset: 'TODAY' as const };
      case '7D': {
        const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        return { startDate: start, endDate: end, preset: '7D' as const };
      }
      case '30D': {
        const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        return { startDate: start, endDate: end, preset: '30D' as const };
      }
      case '90D': {
        const start = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        return { startDate: start, endDate: end, preset: '90D' as const };
      }
      case '1Y': {
        const start = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        return { startDate: start, endDate: end, preset: '1Y' as const };
      }
      default:
        return { startDate: value?.startDate || end, endDate: value?.endDate || end, preset: 'CUSTOM' as const };
    }
  };

  const handlePresetClick = (preset: 'TODAY' | '7D' | '30D' | '90D' | '1Y' | 'CUSTOM') => {
    setSelectedPreset(preset);
    if (preset !== 'CUSTOM') {
      const dates = getPresetDates(preset);
      onChange?.(dates);
    }
  };

  const handleCustomStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedPreset('CUSTOM');
    onChange?.({
      startDate: e.target.value,
      endDate: value?.endDate || todayStr,
      preset: 'CUSTOM',
    });
  };

  const handleCustomEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedPreset('CUSTOM');
    onChange?.({
      startDate: value?.startDate || todayStr,
      endDate: e.target.value,
      preset: 'CUSTOM',
    });
  };

  return (
    <div className={styles.wrapper} style={style}>
      {label && (
        <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
          {label}
        </span>
      )}

      {/* Preset Chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
        {[
          { id: 'TODAY', label: 'Today' },
          { id: '7D', label: '7 days' },
          { id: '30D', label: '30 days' },
          { id: '90D', label: '90 days' },
          { id: '1Y', label: '1 year' },
          { id: 'CUSTOM', label: 'Custom' },
        ].map((p) => {
          const isSelected = selectedPreset === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => handlePresetClick(p.id as any)}
              style={{
                padding: '3px 8px',
                borderRadius: 'var(--radius-sm)',
                border: isSelected
                  ? '1px solid var(--color-primary)'
                  : '1px solid var(--color-border-default)',
                backgroundColor: isSelected
                  ? 'rgba(0, 102, 255, 0.12)'
                  : 'var(--color-bg-surface-elevated)',
                color: isSelected ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                fontSize: 'var(--font-size-2xs)',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 120ms ease',
              }}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Inputs row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <DateInput
          label="Start date"
          value={value?.startDate}
          onChange={handleCustomStartChange}
        />
        <DateInput
          label="End date"
          value={value?.endDate}
          onChange={handleCustomEndChange}
        />
      </div>
    </div>
  );
};
