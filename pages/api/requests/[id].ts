import { prisma } from "@/entities/db";
import {
  deleteCheckoutRequest,
  updateCheckoutRequestStatus,
  CheckoutRequestStatus,
} from "@/entities/checkoutrequest";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { getServerSession } from "next-auth";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ message: "Unauthorized" });
  if ((session.user as { role?: string }).role !== "admin") {
    return res.status(403).json({ message: "Forbidden" });
  }

  const id = parseInt(req.query.id as string, 10);
  if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });

  if (req.method === "PATCH") return patchHandler(req, res, id);
  if (req.method === "DELETE") return deleteHandler(res, id);
  return res.status(405).json({ message: "Method not allowed" });
}

async function patchHandler(
  req: NextApiRequest,
  res: NextApiResponse,
  id: number,
) {
  const { status, note } = req.body as {
    status?: string;
    note?: string;
  };
  const validStatuses: CheckoutRequestStatus[] = ["pending", "approved", "denied"];
  if (!status || !validStatuses.includes(status as CheckoutRequestStatus)) {
    return res
      .status(400)
      .json({ message: "status must be pending, approved, or denied" });
  }

  const existing = await prisma.checkoutRequest.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ message: "Request not found" });

  const updated = await updateCheckoutRequestStatus(
    prisma,
    id,
    status as CheckoutRequestStatus,
    note,
  );
  return res.status(200).json(updated);
}

async function deleteHandler(res: NextApiResponse, id: number) {
  const existing = await prisma.checkoutRequest.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ message: "Request not found" });
  await deleteCheckoutRequest(prisma, id);
  return res.status(204).end();
}
