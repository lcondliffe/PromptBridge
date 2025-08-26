import { NextResponse } from "next/server";
import { countUsers } from "@promptbridge/api";

// Public endpoint to indicate whether any users exist
export async function GET() {
  const count = await countUsers();
  return NextResponse.json({ hasUsers: count > 0 });
}

