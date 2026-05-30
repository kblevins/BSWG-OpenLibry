import { defineConfig } from "prisma/config";

// Railway internal connections (postgres.railway.internal) do not use SSL.
// Railway public proxy connections require SSL.
const rawUrl = process.env.DATABASE_URL ?? "";
function buildMigrateUrl(url) {
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
    url: buildMigrateUrl(rawUrl),
  },
});
