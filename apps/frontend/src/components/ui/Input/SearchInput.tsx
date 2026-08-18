import React, { useState, useEffect, useRef } from 'react';
import { Input, InputProps } from './Input.js';
import { Search, X } from 'lucide-react';
import styles from './Input.module.css';

export interface SearchInputProps extends Omit<InputProps, 'leftIcon' | 'rightIcon'> {
  onSearch?: (query: string) => void;
  debounceMs?: number;
  onClear?: () => void;
}

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ onSearch, debounceMs = 300, onClear, value, onChange, placeholder = 'Search...', ...props }, ref) => {
    const [localValue, setLocalValue] = useState<string>(
      typeof value === 'string' ? value : '',
    );
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
      if (typeof value === 'string') {
        setLocalValue(value);
      }
    }, [value]);

    const handleInternalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newVal = e.target.value;
      setLocalValue(newVal);
      onChange?.(e);

      if (onSearch) {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
        debounceTimerRef.current = setTimeout(() => {
          onSearch(newVal);
        }, debounceMs);
      }
    };

    const handleClear = () => {
      setLocalValue('');
      onClear?.();
      onSearch?.('');
      if (onChange) {
        const syntheticEvent = {
          target: { value: '' },
        } as React.ChangeEvent<HTMLInputElement>;
        onChange(syntheticEvent);
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape' && localValue) {
        handleClear();
      }
      props.onKeyDown?.(e);
    };

    return (
      <Input
        ref={ref}
        type="search"
        leftIcon={<Search size={15} color="var(--color-text-muted)" />}
        rightIcon={
          localValue ? (
            <button
              type="button"
              tabIndex={-1}
              onClick={handleClear}
              className={styles.iconButton}
              title="Clear search"
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          ) : undefined
        }
        value={localValue}
        onChange={handleInternalChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        {...props}
      />
    );
  },
);

SearchInput.displayName = 'SearchInput';
