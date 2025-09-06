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
    fetch('/api/config')
      .then(res => res.json())
      .then((config: ConfigResponse) => {
        setPublishableKey(config.clerkPublishableKey);
        setIsLoading(false);
      })
      .catch((error) => {
        console.error('Failed to load configuration:', error);
        setIsLoading(false);
      });
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
