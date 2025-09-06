import { NextResponse } from 'next/server';

export async function GET() {
  // Serve the publishable key from server-side environment variable
  // This allows runtime configuration while keeping the app open source friendly
  return NextResponse.json({
    clerkPublishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  });
}
