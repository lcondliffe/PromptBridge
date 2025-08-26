import { NextResponse } from "next/server";
import { z } from "zod";
import { Role } from "@prisma/client";
import { createUser, getUserByEmail, countUsers } from "@promptbridge/api";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { email, password } = parsed.data;
  const userCount = await countUsers();
  if (userCount > 0) {
    return NextResponse.json({ error: "Registration is disabled" }, { status: 403 });
  }
  const existing = await getUserByEmail(email);
  if (existing) return NextResponse.json({ error: "Email already in use" }, { status: 409 });
  await createUser(email, password, { role: Role.ADMIN });
  return NextResponse.json({ ok: true });
}

