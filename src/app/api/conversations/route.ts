import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { z } from "zod";
import { createConversationForUser, listConversationsByUserId } from "@promptbridge/api";

const createSchema = z.object({ title: z.string().min(1).max(200) });

export async function GET() {
  const session = await auth();
  if (!session?.user?.email || !session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const items = await listConversationsByUserId(userId);
  return NextResponse.json(items);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const json = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const conv = await createConversationForUser(session.user.id, parsed.data.title);
  return NextResponse.json(conv, { status: 201 });
}

