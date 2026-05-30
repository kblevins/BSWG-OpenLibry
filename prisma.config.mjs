import { defineConfig } from "prisma/config";

// Prefer DATABASE_PUBLIC_URL for migrations — it routes through Railway's external
// proxy which reliably supports SSL. Fall back to DATABASE_URL if not set.
// The app itself connects via DATABASE_URL (internal) using pg.Pool's ssl option.
const migrateUrl = process.env.DATABASE_PUBLIC_URL ?? process.env.DATABASE_URL ?? "";

function withSsl(url) {
  if (!url || url.includes("sslmode")) return url;
  const sep = url.includes("?") ? "&" : "?";
  // Internal Railway URLs don't use SSL; all others require it.
  const mode = url.includes(".railway.internal") ? "disable" : "require";
  return `${url}${sep}sslmode=${mode}`;
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: withSsl(migrateUrl),
  },
});
