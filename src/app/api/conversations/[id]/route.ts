import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { deleteConversation } from "@promptbridge/api";

export async function DELETE(
  _req: Request,
  ctx: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await deleteConversation(ctx.params.id, session.user.id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

