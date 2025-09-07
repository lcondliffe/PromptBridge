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

export default function ClientAuthWrapper({ children }: ClientAuthWrapperProps) {
  const [publishableKey, setPublishableKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    const loadConfig = async () => {
      try {
        const res = await fetch('/api/config', {
          signal: controller.signal
        });
        
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}, text: ${res.statusText}`);
        }

        const config: ConfigResponse = await res.json();
        
        // Check if component is still mounted before updating state
        if (!controller.signal.aborted) {
          setPublishableKey(config.clerkPublishableKey);
        }
      } catch (error) {
        // Only log/handle error if request wasn't aborted (component unmounted)
        if (!controller.signal.aborted) {
          console.error('Failed to load configuration:', error);
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
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!publishableKey) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-600">Configuration error: Missing Clerk publishable key</div>
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
