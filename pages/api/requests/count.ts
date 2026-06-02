import { prisma } from "@/entities/db";
import { countPendingCheckoutRequests } from "@/entities/checkoutrequest";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { getServerSession } from "next-auth";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ message: "Unauthorized" });
  if ((session.user as { role?: string }).role !== "admin") {
    return res.status(403).json({ message: "Forbidden" });
  }
  const count = await countPendingCheckoutRequests(prisma);
  return res.status(200).json({ count });
}
