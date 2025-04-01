import type { Config } from "drizzle-kit";
import * as dotenv from "dotenv";

dotenv.config();

console.log("DB : ", process.env.DATABASE_URL)

export default {
  schema: "./shared/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  driver: "pglite",
  dbCredentials: {
    connectionString: process.env.DATABASE_URL,
    ssl: true
  },
} satisfies Config;