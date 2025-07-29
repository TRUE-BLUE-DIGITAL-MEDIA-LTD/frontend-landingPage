import { Customer, PrismaClient } from "@prisma/client";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<boolean>
) {
  try {
    const body = req.body;

    if (req.method === "POST") {
      if (!body.email) {
        res.status(400);
        return;
      }
      const validate = await IsEmailValid(body.email);
      res.status(201).json(validate);
      return;
    }
  } catch (error) {
    res.status(500);
  }
}

import dns from "dns";
import { promisify } from "util";

// Promisify the dns.resolveMx function for use with async/await
const resolveMx = promisify(dns.resolveMx);

export async function IsEmailValid(email: string) {
  // 1. Basic syntax check using a simple regex.
  // This regex is not exhaustive but covers most common cases.
  const emailRegex =
    /^[-!#$%&'*+\/0-9=?A-Z^_`a-z{|}~](\.?[-!#$%&'*+\/0-9=?A-Z^_`a-z`{|}~])*@[a-zA-Z0-9](-*\.?[a-zA-Z0-9])*\.[a-zA-Z](-?[a-zA-Z0-9])+$/;
  if (!email || email.length > 254 || !emailRegex.test(email)) {
    return false;
  }

  // 2. Extract the domain from the email address.
  const domain = email.split("@")[1];

  // 3. Check for MX records on the domain.
  try {
    const addresses = await resolveMx(domain);
    console.log(addresses);
    // If MX records are found, the domain is configured to receive mail.
    if (addresses && addresses.length > 0) {
      return true;
    }
  } catch (error) {
    // If there's an error (e.g., domain not found - ENOTFOUND), it's invalid.
    console.error(`DNS lookup failed for domain ${domain}:`, error.code);
    return false;
  }

  // If no MX records are found, it's considered invalid.
  return false;
}
