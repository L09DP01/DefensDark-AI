"use client";

import React, { useEffect, useState, useCallback, useRef } from 'react';

export function useQuery(apiFn: any, args?: any) {
  const [data, setData] = useState<any>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const argsString = JSON.stringify(args || {});

  useEffect(() => {
    if (args === "skip") {
      return;
    }
    
    let isMounted = true;
    
    if (typeof apiFn === 'function') {
      const result = apiFn(args);
      
      if (result instanceof Promise) {
         result.then(res => {
           if (isMounted) setData(res);
         }).catch(err => {
           if (isMounted) setError(err);
         });
      } else if (result && result.subscribe) {
        // Handle Realtime Subscription
        const subscription = result.subscribe((payload: any) => {
           if (isMounted) setData(payload);
        });
        
        if (result.fetch) {
           result.fetch().then((res: any) => {
              if (isMounted) setData(res);
           });
        }
        
        return () => {
           if (result.unsubscribe) result.unsubscribe();
           isMounted = false;
        };
      }
    }
    
    return () => {
      isMounted = false;
    };
  }, [apiFn, argsString]);

  if (error) throw error;
  return data;
}

export function usePaginatedQuery(apiFn: any, args?: any, options?: any) {
  const [results, setResults] = useState<any[]>([]);
  const [status, setStatus] = useState<"Exhausted" | "LoadingMore" | "LoadingFirstPage" | "CanLoadMore" | undefined>("LoadingMore");
  const argsString = JSON.stringify(args || {});
  
  useEffect(() => {
     let isMounted = true;
     if (typeof apiFn === 'function') {
        const result = apiFn(args);
        if (result instanceof Promise) {
           result.then(res => {
              if (isMounted) {
                setResults(res || []);
                setStatus("Exhausted");
              }
           });
        }
     }
     return () => { isMounted = false; };
  }, [apiFn, argsString]);
  
  const loadMore = useCallback((numItems: number) => {
    // Basic mock
  }, []);

  const isLoading = status === "LoadingFirstPage";
  return { results, status, loadMore, isLoading };
}

export function useMutation(apiFn: any) {
  return async (args?: any) => {
    return await apiFn(args);
  };
}

export function useAction(apiFn: any) {
  return async (args?: any) => {
    return await apiFn(args);
  };
}

export function useConvex() {
   return {
      query: async (apiFn: any, args: any) => await apiFn(args),
      mutation: async (apiFn: any, args: any) => await apiFn(args),
      action: async (apiFn: any, args: any) => await apiFn(args),
   };
}

export class ConvexError extends Error {
  data: any;
  constructor(message: string, data?: any) {
    super(message);
    this.name = 'ConvexError';
    this.data = data;
  }
}

export type Id<TableName> = string;
export type Doc<TableName> = any;

export function Authenticated({ children }: { children: React.ReactNode }) {
   return <>{children}</>;
}

export function Unauthenticated({ children }: { children: React.ReactNode }) {
   return null;
}

export function AuthLoading({ children }: { children: React.ReactNode }) {
   return null;
}

