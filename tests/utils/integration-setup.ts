import { beforeAll, afterAll, afterEach } from 'vitest';
import { execSync } from 'child_process';
import path from 'path';

// Integration test database setup
let testDbSetup = false;

beforeAll(async () => {
  if (testDbSetup) return;
  
  // Set up test database
  process.env.DATABASE_URL = 'file:./test-integration.db';
  
  try {
    // Run Prisma migrations on test database
    execSync('npx prisma db push --schema packages/api/prisma/schema.prisma', {
      stdio: 'pipe',
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
    });
    
    testDbSetup = true;
  } catch (error) {
    console.error('Failed to set up test database:', error);
    throw error;
  }
});

afterEach(async () => {
  // Clean up test data between tests
  try {
    const { prisma } = await import('@promptbridge/api/db');
    
    // Delete all test data in proper order (due to foreign key constraints)
    await prisma.message.deleteMany({});
    await prisma.conversation.deleteMany({});
    await prisma.user.deleteMany({});
    
    await prisma.$disconnect();
  } catch (error) {
    console.warn('Failed to clean up test database:', error);
  }
});

afterAll(async () => {
  // Clean up test database file
  try {
    const fs = await import('fs');
    const testDbPath = path.resolve('./test-integration.db');
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  } catch (error) {
    console.warn('Failed to clean up test database file:', error);
  }
});