import { prisma } from "../db";

export async function listMessages(conversationId: string, userId: string) {
  // Ensure the conversation belongs to the user
  const conv = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conv || conv.userId !== userId) return [];
  return prisma.message.findMany({ where: { conversationId }, orderBy: { createdAt: "asc" } });
}

export async function createMessage(
  conversationId: string,
  userId: string,
  input: { role: string; content: string; model?: string | null }
) {
  // Ensure the conversation belongs to the user
  const conv = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conv || conv.userId !== userId) throw new Error("Conversation not found");
  return prisma.message.create({ data: { conversationId, ...input } });
}

