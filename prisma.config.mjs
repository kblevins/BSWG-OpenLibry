import { defineConfig } from "prisma/config";

// Railway's internal PostgreSQL (postgres.railway.internal) does not use SSL.
// Appending sslmode=disable prevents the migration engine from attempting SSL
// negotiation, which fails and is misreported as P1000 auth failure.
const rawUrl = process.env.DATABASE_URL ?? "";
const dbUrl =
  rawUrl && !rawUrl.includes("sslmode")
    ? rawUrl + (rawUrl.includes("?") ? "&" : "?") + "sslmode=disable"
    : rawUrl;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: dbUrl,
  },
});
