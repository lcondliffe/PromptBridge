"use client";

import dynamic from "next/dynamic";
import { ReactNode, useEffect, useState } from "react";

const ClerkProvider = dynamic(() => import("@clerk/nextjs").then(mod => ({ default: mod.ClerkProvider })), {
  ssr: false
});

interface ClientAuthWrapperProps {
  children: ReactNode;
}

interface ConfigResponse {
  clerkPublishableKey: string;
}

// Configuration timeout in milliseconds
const CONFIG_TIMEOUT = 5000;

export default function ClientAuthWrapper({ children }: ClientAuthWrapperProps) {
  const [publishableKey, setPublishableKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let timeoutId: NodeJS.Timeout;

    const loadConfig = async () => {
      try {
        // Set up timeout
        timeoutId = setTimeout(() => {
          controller.abort();
        }, CONFIG_TIMEOUT);

        console.log('Loading Clerk configuration from /api/config...');
        
        const res = await fetch('/api/config', {
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache'
          }
        });
        
        clearTimeout(timeoutId);
        
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        const contentType = res.headers.get('content-type');
        if (!contentType?.includes('application/json')) {
          throw new Error(`Expected JSON response, got ${contentType}`);
        }

        const config: ConfigResponse = await res.json();
        console.log('Clerk configuration loaded successfully');
        
        // Check if component is still mounted before updating state
        if (!controller.signal.aborted) {
          setPublishableKey(config.clerkPublishableKey);
          setError(null);
        }
      } catch (error) {
        clearTimeout(timeoutId);
        
        // Only handle error if request wasn't aborted (component unmounted)
        if (!controller.signal.aborted) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error('Failed to load configuration from /api/config:', errorMessage);
          
          // Fallback to build-time environment variables
          const fallbackKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
          
          if (fallbackKey) {
            console.log('Using fallback Clerk publishable key from build-time environment');
            setPublishableKey(fallbackKey);
            setError(null);
          } else {
            setError(`Configuration load failed: ${errorMessage}. No fallback key available.`);
          }
        }
      } finally {
        // Only update loading state if component is still mounted
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    loadConfig();

    // Cleanup: abort the request if component unmounts
    return () => {
      controller.abort();
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-950 text-zinc-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
          <div className="text-zinc-300">Loading authentication...</div>
          <div className="text-xs text-zinc-500 mt-2">Connecting to Clerk</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-950 text-zinc-100">
        <div className="text-center max-w-md px-6">
          <div className="text-red-400 mb-4">
            <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <h2 className="text-lg font-semibold">Authentication Configuration Error</h2>
          </div>
          <p className="text-zinc-300 text-sm mb-6">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!publishableKey) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-950 text-zinc-100">
        <div className="text-center">
          <div className="text-red-400 mb-4">
            <h2 className="text-lg font-semibold">Configuration Error</h2>
          </div>
          <p className="text-zinc-300 text-sm">Missing Clerk publishable key</p>
        </div>
      </div>
    );
  }

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      signInUrl="/login"
      signUpUrl="/register"
    >
      {children}
    </ClerkProvider>
  );
}
