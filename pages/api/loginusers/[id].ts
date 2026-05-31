import { prisma } from "@/entities/db";
import { deleteUser, disableUser, enableUser, updateLoginUser } from "@/entities/loginuser";
import { LogEvents } from "@/lib/logEvents";
import { businessLogger, errorLogger } from "@/lib/logger";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const id = parseInt(req.query.id as string, 10);
  if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });

  if (req.method === "PATCH") return patchHandler(id, req, res);
  if (req.method === "DELETE") return deleteHandler(id, res);
  return res.status(405).json({ message: "Method not allowed" });
}

async function patchHandler(
  id: number,
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { active, role } = req.body as {
    active?: boolean;
    role?: string;
  };

  try {
    if (active !== undefined) {
      active ? await enableUser(prisma, id) : await disableUser(prisma, id);
      businessLogger.info(
        { event: LogEvents.LOGIN_USER_CREATED, id, active },
        "Login user active status updated",
      );
    }
    if (role !== undefined) {
      if (!["admin", "user"].includes(role)) {
        return res.status(400).json({ message: "Role must be admin or user" });
      }
      const existing = await prisma.loginUser.findUnique({ where: { id } });
      if (!existing) return res.status(404).json({ message: "User not found" });
      await updateLoginUser(prisma, id, {
        ...existing,
        createdAt: existing.createdAt.toISOString(),
        updatedAt: existing.updatedAt.toISOString(),
        role,
      });
      businessLogger.info(
        { event: LogEvents.LOGIN_USER_CREATED, id, role },
        "Login user role updated",
      );
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    errorLogger.error(
      { event: LogEvents.DB_ERROR, operation: "updateLoginUser", id, error: String(e) },
      "Error updating login user",
    );
    return res.status(500).json({ message: "Internal server error" });
  }
}

async function deleteHandler(id: number, res: NextApiResponse) {
  try {
    await deleteUser(prisma, id);
    businessLogger.info(
      { event: LogEvents.LOGIN_USER_CREATED, id },
      "Login user deleted via admin panel",
    );
    return res.status(200).json({ ok: true });
  } catch (e) {
    errorLogger.error(
      { event: LogEvents.DB_ERROR, operation: "deleteLoginUser", id, error: String(e) },
      "Error deleting login user",
    );
    return res.status(500).json({ message: "Internal server error" });
  }
}
