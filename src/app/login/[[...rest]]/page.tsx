"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

const SignIn = dynamic(() => import("@clerk/nextjs").then(mod => ({ default: mod.SignIn })), {
  ssr: false
});

function LoginContent() {
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect_url') || '/';
  
  console.log('Login page loaded with redirect_url:', redirectUrl);
  
  return (
    <div className="flex justify-center items-center">
      <SignIn 
        afterSignInUrl={redirectUrl} 
        signUpUrl="/register"
        redirectUrl={redirectUrl}
      />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
          <div className="text-zinc-300">Loading login...</div>
        </div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}

