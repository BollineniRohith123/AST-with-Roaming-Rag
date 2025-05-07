'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import api, { ApiError } from '../utils/api';

type ApiStatus = 'idle' | 'loading' | 'success' | 'error';

interface UseApiResult<T> {
  data: T | null;
  error: ApiError | Error | null;
  status: ApiStatus;
  isLoading: boolean;
  isError: boolean;
  isSuccess: boolean;
  refetch: () => Promise<void>;
  reset: () => void;
}

/**
 * Custom hook for making API requests with state management and error handling
 */
export function useApi<T>(
  apiMethod: (...args: any[]) => Promise<T>,
  params: any[] = [],
  initialFetch: boolean | { autoExecute: boolean } = true,
  cacheKey?: string
): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | Error | null>(null);
  const [status, setStatus] = useState<ApiStatus>('idle');
  const isMounted = useRef(true);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastFetchTimeRef = useRef<number>(0);

  // For caching
  const cacheKeyRef = useRef<string | undefined>(cacheKey);

  // Get data from cache if available
  useEffect(() => {
    if (cacheKeyRef.current) {
      const cachedData = localStorage.getItem(`api_cache_${cacheKeyRef.current}`);
      if (cachedData) {
        try {
          const { data: cachedValue, timestamp } = JSON.parse(cachedData);
          // Check if cache is still valid (1 hour)
          const isValid = Date.now() - timestamp < 60 * 60 * 1000;
          if (isValid) {
            setData(cachedValue);
            setStatus('success');
          }
        } catch (e) {
          // Invalid cache, ignore
        }
      }
    }
  }, []);

  // Set up cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, []);

  // Fetch data function with debounce to prevent rate limiting
  const fetchData = useCallback(async () => {
    // Prevent multiple rapid requests (debounce)
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchTimeRef.current;

    // If less than 2 seconds since last fetch, debounce
    if (timeSinceLastFetch < 2000) {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }

      fetchTimeoutRef.current = setTimeout(() => {
        fetchData();
      }, 2000 - timeSinceLastFetch);

      return;
    }

    try {
      setStatus('loading');
      setError(null);
      lastFetchTimeRef.current = Date.now();

      const result = await apiMethod(...params);

      if (isMounted.current) {
        setData(result);
        setStatus('success');

        // Cache the result if cacheKey provided
        if (cacheKeyRef.current) {
          localStorage.setItem(
            `api_cache_${cacheKeyRef.current}`,
            JSON.stringify({
              data: result,
              timestamp: Date.now()
            })
          );
        }
      }
    } catch (err) {
      if (isMounted.current) {
        setError(err as ApiError | Error);
        setStatus('error');
      }
    }
  }, [apiMethod, ...params]);

  // Initial fetch
  useEffect(() => {
    const shouldFetch = typeof initialFetch === 'boolean'
      ? initialFetch
      : initialFetch.autoExecute;

    if (shouldFetch) {
      fetchData();
    }
  }, [fetchData, initialFetch]);

  // Reset state
  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setStatus('idle');
  }, []);

  return {
    data,
    error,
    status,
    isLoading: status === 'loading',
    isError: status === 'error',
    isSuccess: status === 'success',
    refetch: fetchData,
    reset,
  };
}

/**
 * Custom hook for making a POST API request
 */
export function useApiPost<T, D>(
  apiMethod: (data: D) => Promise<T>
): [
  (data: D) => Promise<T>,
  {
    data: T | null;
    error: ApiError | Error | null;
    status: ApiStatus;
    isLoading: boolean;
    reset: () => void;
  }
] {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | Error | null>(null);
  const [status, setStatus] = useState<ApiStatus>('idle');

  const executePost = useCallback(
    async (postData: D) => {
      try {
        setStatus('loading');
        setError(null);

        const result = await apiMethod(postData);

        setData(result);
        setStatus('success');

        return result;
      } catch (err) {
        setError(err as ApiError | Error);
        setStatus('error');
        throw err;
      }
    },
    [apiMethod]
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setStatus('idle');
  }, []);

  return [
    executePost,
    {
      data,
      error,
      status,
      isLoading: status === 'loading',
      reset,
    }
  ];
}

export default useApi;