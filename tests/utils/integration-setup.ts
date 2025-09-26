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