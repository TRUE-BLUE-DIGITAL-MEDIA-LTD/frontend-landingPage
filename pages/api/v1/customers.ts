import { Customer, PrismaClient } from "@prisma/client";
import type { NextApiRequest, NextApiResponse } from "next";
const prisma = new PrismaClient();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Customer>
) {
  try {
    const body = req.body;
    if (req.method === "POST") {
      if (!body.email || !body.landingPageId) {
        res.status(400);
        return;
      }
      const customers = await prisma.customer.create({
        data: {
          email: body.email,
          name: body.name,
          landingPageId: body.landingPageId,
        },
      });
      res.status(200).json(customers);
      return;
    }
  } catch (error) {
    res.status(500);
  }
}
