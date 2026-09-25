import React, { useState } from 'react';
import { DateInput } from './DateInput.js';
import styles from '../Input/Input.module.css';

export interface DateRangeValue {
  startDate: string;
  endDate: string;
  preset?: 'TODAY' | 'YESTERDAY' | '7D' | '30D' | 'THIS_MONTH' | 'CUSTOM';
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
      case 'YESTERDAY': {
        const y = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        return { startDate: y, endDate: y, preset: 'YESTERDAY' as const };
      }
      case '7D': {
        const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        return { startDate: start, endDate: end, preset: '7D' as const };
      }
      case '30D': {
        const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        return { startDate: start, endDate: end, preset: '30D' as const };
      }
      case 'THIS_MONTH': {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
        return { startDate: start, endDate: end, preset: 'THIS_MONTH' as const };
      }
      default:
        return { startDate: value?.startDate || end, endDate: value?.endDate || end, preset: 'CUSTOM' as const };
    }
  };

  const handlePresetClick = (preset: 'TODAY' | 'YESTERDAY' | '7D' | '30D' | 'THIS_MONTH' | 'CUSTOM') => {
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
          { id: 'YESTERDAY', label: 'Yesterday' },
          { id: '7D', label: '7 days' },
          { id: '30D', label: '30 days' },
          { id: 'THIS_MONTH', label: 'This month' },
          { id: 'CUSTOM', label: 'Custom' },
        ].map((p) => {
          const isSelected = selectedPreset === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => handlePresetClick(p.id as any)}
              style={{
                padding: '4px 9px',
                borderRadius: 'var(--radius-sm)',
                border: isSelected
                  ? '1px solid var(--color-brand)'
                  : '1px solid var(--color-border-default)',
                backgroundColor: isSelected
                  ? 'var(--color-brand-surface)'
                  : 'var(--color-bg-surface)',
                color: isSelected ? 'var(--color-brand)' : 'var(--color-text-secondary)',
                fontSize: 'var(--font-size-2xs)',
                fontWeight: isSelected ? 700 : 500,
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
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
