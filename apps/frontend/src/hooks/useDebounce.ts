import { useState, useEffect } from 'react';

/**
 * useDebounce hook to delay updating state until the user has stopped changing it for delayMs.
 * Prevents redundant re-renders and excessive network requests during rapid typing.
 */
export function useDebounce<T>(value: T, delayMs = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delayMs]);

  return debouncedValue;
}
