import { PrismaClient } from "@prisma/client";
import { Domain, LandingPage, Language } from "../interfaces";
import { pickLander } from "./pick-lander";

export type ResponseGetLandingPageService = (LandingPage | undefined) & {
  domain: Domain;
};

export async function GetLandingPageService(dto: {
  domain: string;
  language: Language;
  route?: string;
  prisma: PrismaClient;
}): Promise<ResponseGetLandingPageService> {
  try {
    const domain = await dto.prisma.domain.findUnique({
      where: {
        name: dto.domain,
      },
    });

    if (!domain) {
      throw new Error("This domain doesn't exist in our system");
    }
    delete domain.createAt;
    delete domain.updateAt;

    // Two-phase fetch: weigh the A/B pick on metadata only, then pull the
    // heavy fields (html, translations, ...) for the single winner. A domain
    // can hold many landers and their html is large — fetching them all per
    // request was the bulk of the DB payload.
    const candidates = await dto.prisma.landingPage.findMany({
      where: {
        domainId: domain.id,
      },
      select: {
        id: true,
        percent: true,
        route: true,
        supportedLanguages: true,
        language: true,
      },
    });

    const picked = pickLander(candidates, {
      route: dto.route,
      language: dto.language,
    });

    if (!picked) {
      // Same shape the pre-split code produced when no lander matched:
      // only the domain, so the page renders its "no landing page" view.
      return { domain } as unknown as ResponseGetLandingPageService;
    }

    const landingPage = await dto.prisma.landingPage.findUnique({
      where: { id: picked.id },
      select: {
        id: true,
        directLink: true,
        backgroundImage: true,
        description: true,
        html: true,
        language: true,
        primaryLanguage: true,
        supportedLanguages: true,
        translations: true,
        mainButton: true,
        title: true,
        percent: true,
        icon: true,
        name: true,
        backOffer: true,
        secondOffer: true,
        route: true,
      },
    });

    return { ...landingPage, domain } as unknown as ResponseGetLandingPageService;
  } catch (error) {
    throw error;
  }
}
