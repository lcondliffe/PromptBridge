-- Migration to add CASCADE delete on Message -> Conversation relation
-- This ensures that when a Conversation is deleted, all its Messages are automatically deleted

-- Drop existing foreign key constraint
ALTER TABLE "Message" DROP CONSTRAINT "Message_conversationId_fkey";

-- Add the same foreign key constraint but with CASCADE delete
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
