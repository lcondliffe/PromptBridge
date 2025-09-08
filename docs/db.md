# Database Schema and Operations

This document describes PromptBridge's database schema changes and operational considerations.

## Cascade Delete Implementation

### Rationale

Previously, `conversationRepo.deleteConversation()` manually deleted messages before deleting conversations:

```typescript
// Old approach - manual cleanup
await prisma.message.deleteMany({ where: { conversationId: id } });
await prisma.conversation.delete({ where: { id } });
```

This approach had several issues:
- **Data integrity risk**: If the second delete failed, messages would be orphaned
- **Performance**: Two database round-trips for every conversation deletion
- **Code complexity**: Manual foreign key constraint management
- **Transaction safety**: Operations weren't atomic without explicit transaction handling

### Schema Change

**Before:**
```prisma
model Message {
  id             String        @id @default(uuid())
  conversation   Conversation  @relation(fields: [conversationId], references: [id])
  conversationId String
  role           String
  content        String
  model          String?
  createdAt      DateTime      @default(now())
}
```

**After:**
```prisma
model Message {
  id             String        @id @default(uuid())
  conversation   Conversation  @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  conversationId String
  role           String
  content        String
  model          String?
  createdAt      DateTime      @default(now())
}
```

### Migration

**File:** `packages/api/prisma/migrations/20250908182043_cascade_conversation_messages/migration.sql`

```sql
-- Drop existing foreign key constraint
ALTER TABLE "Message" DROP CONSTRAINT "Message_conversationId_fkey";

-- Add the same foreign key constraint but with CASCADE delete
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" 
FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") 
ON DELETE CASCADE ON UPDATE CASCADE;
```

**Command used to generate migration:**
```bash
prisma migrate dev --name cascade_conversation_messages --schema packages/api/prisma/schema.prisma
```

### Repository Simplification

**After cascade implementation:**
```typescript
export async function deleteConversation(id: string, userId: string) {
  const conv = await prisma.conversation.findUnique({ where: { id } });
  if (!conv || conv.userId !== userId) {
    throw new Error("Conversation not found");
  }
  // Messages will be automatically deleted via cascade
  return prisma.conversation.delete({
    where: { id },
  });
}
```

## Behavioral Changes

### What Changes
- **Conversation deletion**: Now automatically removes all associated messages
- **Performance**: Single database operation instead of two
- **Atomicity**: Guaranteed consistency - either both conversation and messages are deleted, or neither

### What Doesn't Change
- **API behavior**: Routes still return the same status codes and response format
- **Authorization**: User ownership checks remain in place
- **Error handling**: Same error messages for unauthorized access
- **Frontend behavior**: UI works identically

## Testing the Changes

### Manual Testing

1. **Create test data:**
   ```sql
   INSERT INTO "User" (id, email, "passwordHash") VALUES ('test-user', 'test@example.com', 'hash');
   INSERT INTO "Conversation" (id, title, "userId") VALUES ('test-conv', 'Test Conversation', 'test-user');
   INSERT INTO "Message" (id, "conversationId", role, content) VALUES ('test-msg', 'test-conv', 'user', 'Hello');
   ```

2. **Delete conversation:**
   ```bash
   curl -X DELETE http://localhost:3000/api/conversations/test-conv
   ```

3. **Verify cascade:**
   ```sql
   SELECT COUNT(*) FROM "Message" WHERE "conversationId" = 'test-conv'; -- Should return 0
   SELECT COUNT(*) FROM "Conversation" WHERE id = 'test-conv'; -- Should return 0
   ```

### Automated Testing

The existing API route tests in `src/app/api/conversations/[id]/route.ts` continue to work:
- Returns `200 { ok: true }` on successful deletion
- Returns `404 { error: "Not found" }` for missing/unauthorized conversations

## Rollback Considerations

### If Rollback is Needed

1. **Revert schema change:**
   ```sql
   ALTER TABLE "Message" DROP CONSTRAINT "Message_conversationId_fkey";
   ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" 
   FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id");
   ```

2. **Revert repository code:**
   ```typescript
   // Add back manual deletion
   await prisma.message.deleteMany({ where: { conversationId: id } });
   return prisma.conversation.delete({ where: { id } });
   ```

3. **Create rollback migration:**
   ```bash
   prisma migrate dev --name rollback_cascade_deletes --schema packages/api/prisma/schema.prisma
   ```

### Risk Assessment

- **Low risk**: This is a standard database pattern
- **Backwards compatible**: Existing queries continue to work
- **Recoverable**: Can be rolled back if issues arise
- **Well-tested pattern**: CASCADE deletes are widely used and supported

## Production Deployment

### Prerequisites
- Database backup before migration
- Maintenance window (if required by organization policy)
- Monitoring of error rates post-deployment

### Deployment Steps
1. Deploy application code (repository changes)
2. Run database migration
3. Verify operation with test deletion
4. Monitor error rates and performance metrics

### Monitoring
- Watch for foreign key constraint errors
- Monitor API response times for conversation deletion
- Check error logs for any orphaned record issues (shouldn't occur with cascade)

## Performance Impact

### Before (2 operations)
```sql
DELETE FROM "Message" WHERE "conversationId" = $1;  -- O(n) where n = message count
DELETE FROM "Conversation" WHERE id = $1;           -- O(1)
```

### After (1 operation)
```sql
DELETE FROM "Conversation" WHERE id = $1;  -- O(1) + automatic cascade cleanup
```

**Benefits:**
- Reduced network round-trips (2 → 1)
- Atomic operation (better consistency)
- Database handles optimization internally
- Simpler application code

**Potential considerations:**
- Large conversations with many messages may take slightly longer to delete
- Database handles the message cleanup, reducing application control over the process
