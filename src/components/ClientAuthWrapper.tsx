"use client";

import dynamic from "next/dynamic";
import { ReactNode } from "react";

const ClerkProvider = dynamic(() => import("@clerk/nextjs").then(mod => ({ default: mod.ClerkProvider })), {
  ssr: false
});

interface ClientAuthWrapperProps {
  children: ReactNode;
}

export default function ClientAuthWrapper({ children }: ClientAuthWrapperProps) {
  return (
    <ClerkProvider
      signInUrl="/login"
      signUpUrl="/register"
    >
      {children}
    </ClerkProvider>
  );
}
