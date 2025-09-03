import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { listMessages, createMessage } from "@promptbridge/api";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const items = await listMessages(id, userId);
  return NextResponse.json(items);
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const json = await req.json().catch(() => null);
  if (!json || typeof json.role !== "string" || typeof json.content !== "string") {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { id } = await ctx.params;
  const msg = await createMessage(id, userId, {
    role: json.role,
    content: json.content,
    model: typeof json.model === "string" ? json.model : null,
  });
  return NextResponse.json(msg, { status: 201 });
}

