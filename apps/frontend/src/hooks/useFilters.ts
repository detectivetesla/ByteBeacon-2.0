import { useState, useMemo, useCallback } from 'react';
import { useDebounce } from './useDebounce.js';

export interface FilterConfig<T extends Record<string, any>> {
  initialValues: T;
  searchKey?: keyof T;
  debounceMs?: number;
  isDefaultValue?: (key: keyof T, value: any) => boolean;
}

export function useFilters<T extends Record<string, any>>({
  initialValues,
  searchKey = 'search' as keyof T,
  debounceMs = 300,
  isDefaultValue,
}: FilterConfig<T>) {
  const [filters, setFiltersState] = useState<T>(initialValues);

  const defaultCheck = useCallback(
    (key: keyof T, value: any): boolean => {
      if (isDefaultValue) return isDefaultValue(key, value);
      const initVal = initialValues[key];
      if (value === initVal) return true;
      if (value === '' || value === 'ALL' || value === undefined || value === null) return true;
      if (Array.isArray(value) && value.length === 0) return true;
      return false;
    },
    [initialValues, isDefaultValue],
  );

  const setFilter = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setFiltersState((prev) => ({ ...prev, [key]: value }));
  }, []);

  const setFilters = useCallback((partial: Partial<T>) => {
    setFiltersState((prev) => ({ ...prev, ...partial }));
  }, []);

  const resetFilter = useCallback(
    (key: keyof T) => {
      setFiltersState((prev) => ({ ...prev, [key]: initialValues[key] }));
    },
    [initialValues],
  );

  const resetAll = useCallback(() => {
    setFiltersState(initialValues);
  }, [initialValues]);

  // Debounced search query
  const searchValue = typeof filters[searchKey] === 'string' ? (filters[searchKey] as string) : '';
  const debouncedSearch = useDebounce(searchValue, debounceMs);

  // Active filters count
  const activeCount = useMemo(() => {
    let count = 0;
    for (const key of Object.keys(filters) as (keyof T)[]) {
      if (!defaultCheck(key, filters[key])) {
        count++;
      }
    }
    return count;
  }, [filters, defaultCheck]);

  const hasActiveFilters = activeCount > 0;

  return {
    filters,
    debouncedSearch,
    setFilter,
    setFilters,
    resetFilter,
    resetAll,
    activeCount,
    hasActiveFilters,
  };
}
