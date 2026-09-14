import { PrismaClient } from "@prisma/client";
import type { NextApiRequest, NextApiResponse } from "next";
import { recordLanderView } from "@/server/analytics/record-view";
import {
  parseViewPayload,
  queryFromSearch,
} from "@/server/analytics/view-payload";
import {
  buildVisitorCookie,
  resolveVisitor,
  VISITOR_COOKIE,
} from "@/server/analytics/visitor-cookie";
import { countryFromNetlifyHeader, NETLIFY_GEO_HEADER } from "@/server/geo";

const prisma = new PrismaClient();

// Creates the LanderSession that /api/track events attach to. Called as a
// client-side beacon on lander mount so the page render itself never waits
// on an analytics write.
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.status(405).end();
    return;
  }
  try {
    const payload = parseViewPayload(req.body);
    if (!payload) {
      res.status(400).json({ sessionId: null });
      return;
    }

    // Analytics keeps its historical default when the lookup fails.
    const country =
      countryFromNetlifyHeader(req.headers[NETLIFY_GEO_HEADER]) ??
      "United States";
    if (country === "Thailand") {
      res.status(200).json({ sessionId: null });
      return;
    }

    // The lander must exist; its domainId comes from the DB, never the client.
    const landingPage = await prisma.landingPage.findUnique({
      where: { id: payload.landingPageId },
      select: { id: true, domainId: true },
    });
    if (!landingPage) {
      res.status(200).json({ sessionId: null });
      return;
    }

    const visitor = resolveVisitor(req.cookies?.[VISITOR_COOKIE]);
    if (!visitor.isReturning) {
      try {
        res.setHeader(
          "Set-Cookie",
          buildVisitorCookie(
            visitor.visitorId,
            process.env.NEXT_PUBLIC_NODE_ENV !== "development",
          ),
        );
      } catch {
        /* cookie failure must not break tracking */
      }
    }

    const sessionId = await recordLanderView({
      prisma,
      landingPageId: landingPage.id,
      domainId: landingPage.domainId,
      country,
      userAgent: req.headers["user-agent"],
      referrer: payload.referrer ?? undefined,
      query: queryFromSearch(payload.search),
      visitorId: visitor.visitorId,
      isReturning: visitor.isReturning,
    });

    res.status(200).json({ sessionId });
  } catch (err) {
    console.error("[analytics] view failed", err);
    res.status(200).json({ sessionId: null });
  }
}
