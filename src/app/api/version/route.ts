import { NextResponse } from "next/server";
import { getVersionSync } from "@/lib/version";

export async function GET() {
  try {
    const version = getVersionSync();
    return new Response(version, {
      headers: {
        "Content-Type": "text/plain",
        "Cache-Control": "public, max-age=3600", // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error("Failed to get version:", error);
    return NextResponse.json({ error: "Unable to retrieve version" }, { status: 500 });
  }
}