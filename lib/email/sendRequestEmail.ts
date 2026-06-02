import { Resend } from "resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const TO_EMAIL =
  process.env.REMINDER_RESPONSIBLE_EMAIL || "librarian@example.com";
const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL || "noreply@openlibry.app";

export async function sendCheckoutRequestEmail(params: {
  bookTitle: string;
  bookAuthor: string;
  bookId: number;
  requesterEmail: string;
  requesterName?: string;
}) {
  if (!RESEND_API_KEY) {
    // Email not configured — skip silently in dev, log in prod
    if (process.env.NODE_ENV === "production") {
      console.error("RESEND_API_KEY is not set — checkout request email not sent");
    }
    return;
  }

  const resend = new Resend(RESEND_API_KEY);
  const requester = params.requesterName
    ? `${params.requesterName} (${params.requesterEmail})`
    : params.requesterEmail;

  await resend.emails.send({
    from: FROM_EMAIL,
    to: TO_EMAIL,
    subject: `New checkout request: "${params.bookTitle}"`,
    html: `
      <p>A member has requested to check out a book.</p>
      <table style="border-collapse:collapse;margin-top:12px">
        <tr><td style="padding:4px 12px 4px 0;color:#666">Book</td><td><strong>${params.bookTitle}</strong> by ${params.bookAuthor} (ID #${params.bookId})</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666">Requested by</td><td>${requester}</td></tr>
      </table>
      <p style="margin-top:16px">
        <a href="${process.env.NEXTAUTH_URL || "http://localhost:3000"}/admin/requests"
           style="background:#4f46e5;color:#fff;padding:8px 16px;border-radius:6px;text-decoration:none;display:inline-block">
          View requests queue
        </a>
      </p>
    `,
  });
}
