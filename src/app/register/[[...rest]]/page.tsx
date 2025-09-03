import { SignUp } from "@clerk/nextjs";

export default function RegisterPage() {
  return (
    <div className="flex justify-center items-center">
      <SignUp afterSignUpUrl="/" signInUrl="/login" />
    </div>
  );
}

