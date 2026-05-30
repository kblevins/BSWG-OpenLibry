import { defineConfig } from "prisma/config";

// DATABASE_URL is read here in Node.js — safe from shell $ expansion issues.
// Internal Railway URLs (*.railway.internal) do not use SSL; all others require it.
const migrateUrl = process.env.DATABASE_URL ?? "";

function withSsl(url) {
  if (!url || url.includes("sslmode")) return url;
  const sep = url.includes("?") ? "&" : "?";
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
