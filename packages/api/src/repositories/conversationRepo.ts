import { prisma } from "../db";

export async function listConversationsByUserId(userId: string) {
  return prisma.conversation.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });
}

export async function createConversationForUser(userId: string, title: string) {
  return prisma.conversation.create({
    data: { userId, title },
  });
}

export async function deleteConversation(id: string, userId: string) {
  const conv = await prisma.conversation.findUnique({ where: { id } });
  if (!conv || conv.userId !== userId) {
    throw new Error("Conversation not found");
  }
  // Delete dependent messages first to satisfy FK constraints if cascade isn't configured
  await prisma.message.deleteMany({ where: { conversationId: id } });
  return prisma.conversation.delete({
    where: { id },
  });
}

