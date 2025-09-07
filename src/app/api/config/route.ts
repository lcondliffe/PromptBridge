import { NextResponse } from 'next/server';

export async function GET() {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "Missing Clerk publishable key" },
      { status: 500 }
    );
  }
  return NextResponse.json({ clerkPublishableKey: key });
}
