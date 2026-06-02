import fs from "fs";
import path from "path";
import type { NextApiRequest, NextApiResponse } from "next";

interface FileInfo {
  name: string;
  type: "file" | "directory";
  size?: number;
  modified?: string;
  path: string;
}

interface VolumeResponse {
  volumePath: string;
  exists: boolean;
  readable: boolean;
  files: FileInfo[];
  totalFiles: number;
  totalSize: number;
  error?: string;
}

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<VolumeResponse | { error: string }>,
) {
  // Only allow GET requests
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: `${req.method} Not Allowed` });
  }

  const volumePath = "/app/images";

  try {
    // Check if volume path exists
    if (!fs.existsSync(volumePath)) {
      return res.status(200).json({
        volumePath,
        exists: false,
        readable: false,
        files: [],
        totalFiles: 0,
        totalSize: 0,
        error: "Volume path does not exist",
      });
    }

    // Check if readable
    try {
      fs.accessSync(volumePath, fs.constants.R_OK);
    } catch {
      return res.status(200).json({
        volumePath,
        exists: true,
        readable: false,
        files: [],
        totalFiles: 0,
        totalSize: 0,
        error: "Volume path is not readable",
      });
    }

    // List files recursively
    const files: FileInfo[] = [];
    let totalSize = 0;

    function walkDir(dir: string, relativePath: string = "") {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relPath = relativePath
            ? path.join(relativePath, entry.name)
            : entry.name;

          if (entry.isDirectory()) {
            files.push({
              name: entry.name,
              type: "directory",
              path: relPath,
            });
            // Recursively walk subdirectories
            walkDir(fullPath, relPath);
          } else if (entry.isFile()) {
            const stats = fs.statSync(fullPath);
            files.push({
              name: entry.name,
              type: "file",
              size: stats.size,
              modified: stats.mtime.toISOString(),
              path: relPath,
            });
            totalSize += stats.size;
          }
        }
      } catch (err) {
        console.error(`Error reading directory ${dir}:`, err);
      }
    }

    walkDir(volumePath);

    return res.status(200).json({
      volumePath,
      exists: true,
      readable: true,
      files: files.sort((a, b) => a.path.localeCompare(b.path)),
      totalFiles: files.length,
      totalSize,
    });
  } catch (err) {
    console.error("Error listing volume files:", err);
    return res.status(500).json({
      error: `Failed to list volume files: ${err instanceof Error ? err.message : "Unknown error"}`,
    });
  }
}

