import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listMessages, createMessage } from "@promptbridge/api";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const items = await listMessages(id, session.user.id);
  return NextResponse.json(items);
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const json = await req.json().catch(() => null);
  if (!json || typeof json.role !== "string" || typeof json.content !== "string") {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { id } = await ctx.params;
  const msg = await createMessage(id, session.user.id, {
    role: json.role,
    content: json.content,
    model: typeof json.model === "string" ? json.model : null,
  });
  return NextResponse.json(msg, { status: 201 });
}

