import type { NextApiRequest, NextApiResponse } from "next";

export default function handle(req: NextApiRequest, res: NextApiResponse) {
  res.status(410).json({ error: "This endpoint has been removed." });
}
