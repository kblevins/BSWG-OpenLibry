import { prisma } from "@/entities/db";
import { addLoginUser, getAllLoginUsers } from "@/entities/loginuser";
import { LogEvents } from "@/lib/logEvents";
import { businessLogger, errorLogger } from "@/lib/logger";
import { Prisma } from "@prisma/client";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method === "GET") {
    return getHandler(res);
  }
  if (req.method === "POST") {
    return postHandler(req, res);
  }
  return res.status(405).json({ message: "Method not allowed" });
}

async function getHandler(res: NextApiResponse) {
  try {
    const users = await getAllLoginUsers(prisma);
    const safe = users.map(({ password: _pw, ...u }) => u);
    return res.status(200).json(safe);
  } catch (e) {
    errorLogger.error(
      { event: LogEvents.DB_ERROR, operation: "listLoginUsers", error: String(e) },
      "Error listing login users",
    );
    return res.status(500).json({ message: "Internal server error" });
  }
}

async function postHandler(req: NextApiRequest, res: NextApiResponse) {
  const { email, role } = req.body as { email?: string; role?: string };

  if (!email || !email.includes("@")) {
    return res.status(400).json({ message: "Valid email is required" });
  }
  if (!role || !["admin", "user"].includes(role)) {
    return res.status(400).json({ message: "Role must be admin or user" });
  }

  businessLogger.debug(
    { event: LogEvents.LOGIN_USER_CREATE_ATTEMPT, email, role },
    "Creating login user via admin panel",
  );

  try {
    await addLoginUser(prisma, {
      username: email,
      email,
      password: "google-sso",
      role,
      active: true,
    });

    businessLogger.info(
      { event: LogEvents.LOGIN_USER_CREATED, email, role },
      "Login user created via admin panel",
    );

    return res.status(201).json({ email });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return res.status(400).json({ message: "This email is already in the allowlist" });
    }
    errorLogger.error(
      { event: LogEvents.DB_ERROR, operation: "createLoginUser", email, error: String(e) },
      "Error creating login user",
    );
    return res.status(500).json({ message: "Internal server error" });
  }
}
