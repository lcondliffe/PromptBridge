import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { z } from "zod";
import { createConversationForUser, listConversationsByUserId, syncClerkUser } from "@promptbridge/api";

const createSchema = z.object({ title: z.string().min(1).max(200) });

export async function GET() {
  const { userId } = await auth();
  const user = await currentUser();
  if (!userId || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  // Sync user with local database
  await syncClerkUser(userId, user.emailAddresses[0]?.emailAddress || "");
  
  const items = await listConversationsByUserId(userId);
  return NextResponse.json(items);
}

export async function POST(req: Request) {
  const { userId } = await auth();
  const user = await currentUser();
  if (!userId || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  
  // Sync user with local database
  await syncClerkUser(userId, user.emailAddresses[0]?.emailAddress || "");
  
  const json = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const conv = await createConversationForUser(userId, parsed.data.title);
  return NextResponse.json(conv, { status: 201 });
}

