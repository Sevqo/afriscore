import { migrate, isPostgres } from "./db";
import { createApp } from "./app";

async function main() {
  if (process.env.NODE_ENV === "production") {
    const required: Record<string, number> = { DATABASE_URL: 1, AFRISCORE_ADMIN_TOKEN: 32, ID_HASH_SALT: 32 };
    for (const [name, minLength] of Object.entries(required)) {
      if (!process.env[name] || process.env[name]!.length < minLength) throw new Error(`${name} is required for production (minimum ${minLength} characters)`);
    }
  }
  await migrate();

  const app = createApp();
  const PORT = process.env.PORT || 4000;

  app.listen(PORT, () => {
    console.log(`AfriScore (Phase 10) listening on :${PORT} [db: ${isPostgres ? "postgres" : "sqlite"}]`);
  });
}

main().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
