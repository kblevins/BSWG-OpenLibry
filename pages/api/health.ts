import { prisma } from "@/entities/db";
import { getCustomPathInfo } from "@/lib/utils/customPath";
import fs from "fs";
import type { NextApiRequest, NextApiResponse } from "next";
import os from "os";
import path from "path";

// Health check types
type CheckStatus = "ok" | "warning" | "error";

interface CheckResult {
  status: CheckStatus;
  message: string;
  details?: Record<string, unknown>;
}

interface HealthCheckResponse {
  status: CheckStatus;
  timestamp: string;
  version?: string;
  checks: {
    database: CheckResult;
    data: CheckResult;
    folders: CheckResult;
    files: CheckResult;
  };
  environment: {
    nodeEnv: string;
    nodeVersion: string;
    authEnabled: boolean;
    port: string;
  };
  system: {
    platform: string;
    arch: string;
    uptime: number;
    memory: {
      total: number;
      free: number;
      used: number;
      usedPercent: number;
    };
  };
  stats?: {
    activeRentals: number;
    overdueBooks: number;
    lastActivity?: string;
  };
}

// Helper to check if a path exists and is accessible
function checkPath(
  filePath: string,
  type: "file" | "directory",
): { exists: boolean; readable: boolean; writable?: boolean; size?: number } {
  try {
    const stats = fs.statSync(filePath);
    const isCorrectType =
      type === "file" ? stats.isFile() : stats.isDirectory();

    if (!isCorrectType) {
      return { exists: false, readable: false };
    }

    // Check read access
    let readable = true;
    try {
      fs.accessSync(filePath, fs.constants.R_OK);
    } catch {
      readable = false;
    }

    // Check write access for directories
    let writable: boolean | undefined;
    if (type === "directory") {
      writable = true;
      try {
        fs.accessSync(filePath, fs.constants.W_OK);
      } catch {
        writable = false;
      }
    }

    // Get file size for files
    const size = type === "file" ? stats.size : undefined;

    return { exists: true, readable, writable, size };
  } catch {
    return { exists: false, readable: false };
  }
}

// Returns the SQLite file path for a file: DATABASE_URL, or null for postgres/mysql URLs.
function getSqliteDbPath(): string | null {
  const dbUrl = process.env.DATABASE_URL || "";
  const match = dbUrl.match(/^file:(\.\/)?(.+)$/);
  if (!match) return null;
  const relativePath = match[2];
  if (relativePath.startsWith("/")) return relativePath;
  return path.join(process.cwd(), relativePath);
}

// Format bytes to human readable
function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  while (bytes >= 1024 && i < units.length - 1) {
    bytes /= 1024;
    i++;
  }
  return `${bytes.toFixed(1)} ${units[i]}`;
}

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse<HealthCheckResponse | { error: string }>,
) {
  // Only allow GET requests
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: `${req.method} Not Allowed` });
  }

  // System information
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  // RSS = memory actually held by the Node.js process, not total OS usage
  const rss = process.memoryUsage().rss;

  const response: HealthCheckResponse = {
    status: "ok",
    timestamp: new Date().toISOString(),
    checks: {
      database: { status: "ok", message: "" },
      data: { status: "ok", message: "" },
      folders: { status: "ok", message: "" },
      files: { status: "ok", message: "" },
    },
    environment: {
      nodeEnv: process.env.NODE_ENV || "development",
      nodeVersion: process.version,
      authEnabled: process.env.AUTH_ENABLED === "true",
      port: process.env.PORT || "3000",
    },
    system: {
      platform: os.platform(),
      arch: os.arch(),
      uptime: Math.floor(process.uptime()),
      memory: {
        total: totalMem,
        free: freeMem,
        used: rss,
        usedPercent: Math.round((rss / totalMem) * 100),
      },
    },
  };

  // Try to read package.json for version
  try {
    const packagePath = path.join(process.cwd(), "package.json");
    if (fs.existsSync(packagePath)) {
      const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf-8"));
      response.version = packageJson.version;
    }
  } catch {
    // Version is optional, ignore errors
  }

  // 1. Check database connectivity
  const sqlitePath = getSqliteDbPath();
  const isPostgres = !sqlitePath;

  if (sqlitePath) {
    // SQLite: check the file exists before querying
    const dbCheck = checkPath(sqlitePath, "file");
    if (!dbCheck.exists) {
      response.checks.database = {
        status: "error",
        message: "Database file not found",
        details: { path: sqlitePath, databaseUrl: process.env.DATABASE_URL },
      };
      response.status = "error";
    } else if (!dbCheck.readable) {
      response.checks.database = {
        status: "error",
        message: "Database file not readable (permission error)",
        details: { path: sqlitePath },
      };
      response.status = "error";
    }
  }

  // For PostgreSQL (or a SQLite file that exists), test the actual connection
  if (isPostgres || response.checks.database.status === "ok") {
    try {
      await prisma.$queryRaw`SELECT 1`;
      response.checks.database = {
        status: "ok",
        message: isPostgres
          ? "PostgreSQL connection successful"
          : "Database connection successful",
        details: isPostgres
          ? { databaseUrl: process.env.DATABASE_URL?.replace(/:\/\/[^@]+@/, "://<credentials>@") }
          : { path: sqlitePath },
      };
    } catch (error) {
      response.checks.database = {
        status: "error",
        message: "Database connection failed",
        details: {
          databaseUrl: process.env.DATABASE_URL?.replace(/:\/\/[^@]+@/, "://<credentials>@"),
          error: error instanceof Error ? error.message : String(error),
        },
      };
      response.status = "error";
    }
  }

  // 2. Check if database has data (only if connection is ok)
  if (response.checks.database.status === "ok") {
    try {
      const [bookCount, userCount, loginUserCount] = await Promise.all([
        prisma.book.count(),
        prisma.user.count(),
        prisma.loginUser.count(),
      ]);

      const hasBooks = bookCount > 0;
      const hasUsers = userCount > 0;
      const hasLoginUsers = loginUserCount > 0;

      if (!hasBooks && !hasUsers) {
        response.checks.data = {
          status: "warning",
          message: "Database is empty — no books or users found",
          details: {
            books: bookCount,
            users: userCount,
            loginUsers: loginUserCount,
          },
        };
        if (response.status === "ok") {
          response.status = "warning";
        }
      } else if (!hasLoginUsers && process.env.AUTH_ENABLED === "true") {
        response.checks.data = {
          status: "warning",
          message:
            "Keine Login-Benutzer vorhanden, aber Authentifizierung ist aktiviert",
          details: {
            books: bookCount,
            users: userCount,
            loginUsers: loginUserCount,
          },
        };
        if (response.status === "ok") {
          response.status = "warning";
        }
      } else {
        response.checks.data = {
          status: "ok",
          message: "Daten vorhanden",
          details: {
            books: bookCount,
            users: userCount,
            loginUsers: loginUserCount,
          },
        };
      }

      // Get additional stats
      try {
        const [rentedCount, lastAudit] = await Promise.all([
          prisma.book.count({
            where: { rentalStatus: "rented" },
          }),
          prisma.audit.findFirst({
            orderBy: { createdAt: "desc" },
            select: { createdAt: true, eventType: true },
          }),
        ]);

        const overdueCount = await prisma.book.count({
          where: {
            rentalStatus: "rented",
            dueDate: { lt: new Date() },
          },
        });

        response.stats = {
          activeRentals: rentedCount,
          overdueBooks: overdueCount,
          lastActivity: lastAudit?.createdAt.toISOString(),
        };
      } catch {
        // Stats are optional
      }
    } catch (error) {
      response.checks.data = {
        status: "error",
        message: "Error querying the database",
        details: {
          error: error instanceof Error ? error.message : String(error),
        },
      };
      response.status = "error";
    }
  } else {
    response.checks.data = {
      status: "error",
      message: "Skipped — database connection failed",
    };
  }

  // 3. Check required folders
  const requiredFolders = [
    // Only check the SQLite directory for SQLite installs; PostgreSQL has no local file.
    ...(sqlitePath
      ? [{ name: "database", path: path.dirname(sqlitePath), mustBeWritable: true }]
      : []),
    {
      name: "public",
      path: path.join(process.cwd(), "public"),
      mustBeWritable: false,
    },
    {
      name: "prisma",
      path: path.join(process.cwd(), "prisma"),
      mustBeWritable: false,
    },
  ];

  // Add cover images folder if configured
  const coverImagePath = process.env.COVERIMAGE_FILESTORAGE_PATH;
  if (coverImagePath) {
    requiredFolders.push({
      name: "covers",
      path: coverImagePath,
      mustBeWritable: true,
    });
  }

  // Add database/custom folder check
  const customDir = path.join(process.cwd(), "database", "custom");
  requiredFolders.push({
    name: "custom",
    path: customDir,
    mustBeWritable: false, // Not required to exist, just informational
  });

  // Add label config directory check
  const labelConfigDir =
    process.env.LABEL_CONFIG_DIR ||
    path.join(process.cwd(), "database", "custom", "labels");
  requiredFolders.push({
    name: "labels",
    path: labelConfigDir,
    mustBeWritable: true, // Templates are saved here via the editor
  });

  const folderResults: Record<
    string,
    { exists: boolean; writable: boolean; fileCount?: number }
  > = {};
  const folderIssues: string[] = [];

  for (const folder of requiredFolders) {
    const check = checkPath(folder.path, "directory");
    const result: { exists: boolean; writable: boolean; fileCount?: number } = {
      exists: check.exists,
      writable: check.writable || false,
    };

    // Count files in covers folder
    if (folder.name === "covers" && check.exists) {
      try {
        const files = fs.readdirSync(folder.path);
        const imageFiles = files.filter((f) =>
          /\.(jpg|jpeg|png|gif|webp)$/i.test(f),
        );
        result.fileCount = imageFiles.length;
      } catch {
        // Ignore counting errors
      }
    }

    // Count files in labels folder (sheets + templates)
    if (folder.name === "labels" && check.exists) {
      try {
        const sheetsDir = path.join(folder.path, "sheets");
        const templatesDir = path.join(folder.path, "templates");
        const sheetCount = fs.existsSync(sheetsDir)
          ? fs.readdirSync(sheetsDir).filter((f) => f.endsWith(".json")).length
          : 0;
        const templateCount = fs.existsSync(templatesDir)
          ? fs.readdirSync(templatesDir).filter((f) => f.endsWith(".json"))
              .length
          : 0;
        result.fileCount = sheetCount + templateCount;
      } catch {
        // Ignore counting errors
      }
    }

    // Count files in custom folder
    if (folder.name === "custom" && check.exists) {
      try {
        const files = fs.readdirSync(folder.path);
        // Filter out README.txt
        const customFiles = files.filter((f) => f !== "README.txt");
        result.fileCount = customFiles.length;
      } catch {
        // Ignore counting errors
      }
    }

    folderResults[folder.name] = result;

    // Only report issues for required folders (not custom/labels, which are optional)
    if (folder.name !== "custom" && folder.name !== "labels") {
      if (!check.exists) {
        folderIssues.push(`${folder.name}: nicht gefunden`);
      } else if (!check.writable && folder.mustBeWritable) {
        folderIssues.push(`${folder.name}: nicht beschreibbar`);
      }
    }
  }

  // Add info about missing cover path (not an error, just informational)
  if (!coverImagePath) {
    folderResults["covers"] = {
      exists: false,
      writable: false,
    };
  }

  // Separate critical issues from warnings
  const criticalFolderIssues = folderIssues.filter(
    (issue) => !issue.startsWith("covers:"),
  );
  const coverIssues = folderIssues.filter((issue) =>
    issue.startsWith("covers:"),
  );

  if (criticalFolderIssues.length > 0) {
    response.checks.folders = {
      status: "error",
      message: `Probleme mit Verzeichnissen: ${criticalFolderIssues.join(", ")}`,
      details: folderResults,
    };
    response.status = "error";
  } else if (coverIssues.length > 0 || !coverImagePath) {
    response.checks.folders = {
      status: "warning",
      message: !coverImagePath
        ? "COVERIMAGE_FILESTORAGE_PATH nicht konfiguriert - Cover-Bilder werden nicht funktionieren"
        : `Cover-Verzeichnis: ${coverIssues.join(", ")}`,
      details: folderResults,
    };
    if (response.status === "ok") {
      response.status = "warning";
    }
  } else {
    response.checks.folders = {
      status: "ok",
      message: "Alle erforderlichen Verzeichnisse vorhanden",
      details: folderResults,
    };
  }

  // 4. Check optional files using customPath resolution (database/custom/ → public/)
  const optionalFiles = [
    {
      name: "Mahnungs-Template (REMINDER_TEMPLATE_DOC)",
      envVar: "REMINDER_TEMPLATE_DOC",
      defaultValue: "mahnung-template.docx",
    },
    {
      name: "Benutzerausweis-Hintergrund (USERID_LABEL_IMAGE)",
      envVar: "USERID_LABEL_IMAGE",
      defaultValue: "ausweis_hintergrund.png",
    },
    {
      name: "Antolin-Daten",
      envVar: null as string | null,
      fixedPath: "antolin/antolingesamt.csv",
      defaultValue: null as string | null,
    },
  ];

  const fileResults: Record<
    string,
    { configured: boolean; exists: boolean; path: string; source?: string }
  > = {};
  const fileWarnings: string[] = [];

  for (const file of optionalFiles) {
    let filename: string;
    let isConfigured: boolean;

    if ("fixedPath" in file && file.fixedPath) {
      filename = file.fixedPath;
      isConfigured = true;
    } else {
      const envValue = file.envVar ? process.env[file.envVar] : null;
      isConfigured = !!envValue;
      filename = envValue || file.defaultValue || "";
    }

    // Use customPath resolution to check both database/custom/ and public/
    const pathInfo = getCustomPathInfo(filename);
    fileResults[file.name] = {
      configured: isConfigured,
      exists: pathInfo.activeSource !== "missing",
      path:
        pathInfo.activeSource === "custom"
          ? pathInfo.customPath
          : pathInfo.publicPath,
      source: pathInfo.activeSource,
    };

    // Only warn if explicitly configured but missing in both locations
    if (isConfigured && pathInfo.activeSource === "missing" && file.envVar) {
      fileWarnings.push(`${file.name}: konfiguriert aber nicht gefunden`);
    }
  }

  if (fileWarnings.length > 0) {
    response.checks.files = {
      status: "warning",
      message: `Einige konfigurierte Dateien fehlen: ${fileWarnings.join(", ")}`,
      details: fileResults,
    };
    if (response.status === "ok") {
      response.status = "warning";
    }
  } else {
    response.checks.files = {
      status: "ok",
      message: "Alle konfigurierten Dateien vorhanden",
      details: fileResults,
    };
  }

  // Set appropriate HTTP status code
  const httpStatus = response.status === "error" ? 503 : 200;

  // Set cache headers - don't cache health checks
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");

  return res.status(httpStatus).json(response);
}
