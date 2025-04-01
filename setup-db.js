const { execSync } = require('child_process');
const { config } = require('dotenv');
const fs = require('fs');

// Load environment variables
config();

// Check if DATABASE_URL exists
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL environment variable is not set');
  process.exit(1);
}

console.log('Database URL found. Attempting to connect...');

// Create a temporary config file
const tempConfigContent = `
import type { Config } from "drizzle-kit";

export default {
  schema: "./shared/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: "${dbUrl}",
  },
} satisfies Config;
`;

fs.writeFileSync('temp-drizzle.config.ts', tempConfigContent);

try {
  // Try to run db:push with the config file
  execSync('npx drizzle-kit push --config=temp-drizzle.config.ts', {
    stdio: 'inherit'
  });
  
  console.log('Database schema push completed successfully');
} catch (error) {
  console.error('Failed to push database schema:', error.message);
} finally {
  // Clean up the temporary config file
  fs.unlinkSync('temp-drizzle.config.ts');
}