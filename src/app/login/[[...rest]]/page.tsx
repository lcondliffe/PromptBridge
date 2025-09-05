"use client";

import dynamic from "next/dynamic";

const SignIn = dynamic(() => import("@clerk/nextjs").then(mod => ({ default: mod.SignIn })), {
  ssr: false
});

export default function LoginPage() {
  return (
    <div className="flex justify-center items-center">
      <SignIn afterSignInUrl="/" signUpUrl="/register" />
    </div>
  );
}

