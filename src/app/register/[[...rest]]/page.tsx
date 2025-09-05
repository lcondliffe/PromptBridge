"use client";

import dynamic from "next/dynamic";

const SignUp = dynamic(() => import("@clerk/nextjs").then(mod => ({ default: mod.SignUp })), {
  ssr: false
});

export default function RegisterPage() {
  return (
    <div className="flex justify-center items-center">
      <SignUp afterSignUpUrl="/" signInUrl="/login" />
    </div>
  );
}

