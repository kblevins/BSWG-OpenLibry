import { prisma } from "@/entities/db";
import {
  createCheckoutRequest,
  getAllCheckoutRequests,
  hasPendingRequestForBook,
} from "@/entities/checkoutrequest";
import { sendCheckoutRequestEmail } from "@/lib/email/sendRequestEmail";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { getServerSession } from "next-auth";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method === "GET") return getHandler(req, res);
  if (req.method === "POST") return postHandler(req, res);
  return res.status(405).json({ message: "Method not allowed" });
}

async function getHandler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ message: "Unauthorized" });
  if ((session.user as { role?: string }).role !== "admin") {
    return res.status(403).json({ message: "Forbidden" });
  }
  const requests = await getAllCheckoutRequests(prisma);
  return res.status(200).json(requests);
}

async function postHandler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    return res.status(401).json({ message: "Sign in to request a book" });
  }
  if ((session.user as { role?: string }).role === "admin") {
    return res.status(403).json({ message: "Admins use the rental desk" });
  }

  const { bookId } = req.body as { bookId?: number };
  if (!bookId || typeof bookId !== "number") {
    return res.status(400).json({ message: "bookId is required" });
  }

  const book = await prisma.book.findUnique({
    where: { id: bookId },
    select: { id: true, title: true, author: true, rentalStatus: true },
  });
  if (!book) return res.status(404).json({ message: "Book not found" });
  if (book.rentalStatus !== "available") {
    return res.status(409).json({ message: "Book is not available" });
  }

  const alreadyPending = await hasPendingRequestForBook(
    prisma,
    bookId,
    session.user.email,
  );
  if (alreadyPending) {
    return res
      .status(409)
      .json({ message: "You already have a pending request for this book" });
  }

  const request = await createCheckoutRequest(
    prisma,
    bookId,
    session.user.email,
    session.user.name ?? undefined,
  );

  // Fire-and-forget email — don't fail the request if email fails
  sendCheckoutRequestEmail({
    bookTitle: book.title,
    bookAuthor: book.author,
    bookId: book.id,
    requesterEmail: session.user.email,
    requesterName: session.user.name ?? undefined,
  }).catch((err) => console.error("Failed to send request email:", err));

  return res.status(201).json(request);
}
