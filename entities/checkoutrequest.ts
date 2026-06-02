import { PrismaClient } from "@prisma/client";

export type CheckoutRequestStatus = "pending" | "approved" | "denied";

export async function createCheckoutRequest(
  client: PrismaClient,
  bookId: number,
  requesterEmail: string,
  requesterName?: string,
) {
  return client.checkoutRequest.create({
    data: { bookId, requesterEmail, requesterName, status: "pending" },
    include: { book: { select: { id: true, title: true, author: true } } },
  });
}

export async function getAllCheckoutRequests(client: PrismaClient) {
  return client.checkoutRequest.findMany({
    orderBy: { createdAt: "desc" },
    include: { book: { select: { id: true, title: true, author: true } } },
  });
}

export async function countPendingCheckoutRequests(client: PrismaClient) {
  return client.checkoutRequest.count({ where: { status: "pending" } });
}

export async function updateCheckoutRequestStatus(
  client: PrismaClient,
  id: number,
  status: CheckoutRequestStatus,
  note?: string,
) {
  return client.checkoutRequest.update({
    where: { id },
    data: { status, ...(note !== undefined ? { note } : {}) },
    include: { book: { select: { id: true, title: true, author: true } } },
  });
}

export async function deleteCheckoutRequest(client: PrismaClient, id: number) {
  return client.checkoutRequest.delete({ where: { id } });
}

export async function hasPendingRequestForBook(
  client: PrismaClient,
  bookId: number,
  requesterEmail: string,
) {
  const existing = await client.checkoutRequest.findFirst({
    where: { bookId, requesterEmail, status: "pending" },
  });
  return existing !== null;
}
