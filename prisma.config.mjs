import { defineConfig } from "prisma/config";

// Railway's managed PostgreSQL requires SSL on all connections, including internal
// (*.railway.internal). sslmode=require means "use SSL, skip cert verification"
// per the PostgreSQL spec — no NODE_TLS_REJECT_UNAUTHORIZED needed.
const migrateUrl = process.env.DATABASE_URL ?? "";

function withSsl(url) {
  if (!url || url.includes("sslmode")) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}sslmode=require`;
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
