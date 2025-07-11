import { PrismaClient } from "@prisma/client";
import { Domain, LandingPage, Language } from "../interfaces";

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
    let landingPages: {
      id: string;
      name: string;
      title: string;
      description: string;
      backgroundImage: string;
      backOffer: string;
      secondOffer: string;
      icon: string;
      html: string;
      mainButton: string;
      directLink: string;
      percent: number;
      coef?: number;
      route: string;
    }[];

    landingPages = await dto.prisma.landingPage
      .findMany({
        where: {
          domainId: domain.id,
          language: dto.language,
        },
        select: {
          id: true,
          directLink: true,
          backgroundImage: true,
          description: true,
          html: true,
          language: true,
          mainButton: true,
          title: true,
          percent: true,
          icon: true,
          name: true,
          backOffer: true,
          secondOffer: true,
          route: true,
        },
      })
      .then((res) => {
        return dto.route
          ? res.filter((r) => r.route === dto.route)
          : res.filter((r) => !r.route);
      });

    // If landingPages is empty and language is es, fr, or de, fetch en landingPage
    if (landingPages.length === 0) {
      landingPages = await dto.prisma.landingPage
        .findMany({
          where: {
            domainId: domain.id,
            language: "en",
          },
          select: {
            id: true,
            directLink: true,
            backgroundImage: true,
            description: true,
            html: true,
            mainButton: true,
            title: true,
            percent: true,
            language: true,
            route: true,
            icon: true,
            name: true,
            backOffer: true,
            secondOffer: true,
          },
        })
        .then((res) => {
          return dto.route
            ? res.filter((r) => r.route === dto.route)
            : res.filter((r) => !r.route);
        });
    }

    let totalRate = 0;
    for (const landingPage of landingPages) {
      totalRate += landingPage.percent;
    }

    let lastCoef = 0;
    const landignPagesWithlastCoef = [];
    for (let landingPage of landingPages) {
      const coef = lastCoef + landingPage.percent / totalRate;
      landingPage = { ...landingPage, coef };
      lastCoef = landingPage.coef;
      landignPagesWithlastCoef.push(landingPage);
    }

    function chooseWeighted(landingPages: (LandingPage & { coef?: number })[]) {
      const randomNum = Math.random();
      for (const landingPage of landingPages) {
        if (randomNum < landingPage.coef) {
          return landingPage;
        }
      }
    }
    const randomLandingPage = chooseWeighted(landignPagesWithlastCoef);
    return { ...randomLandingPage, domain };
  } catch (err) {
    console.log(err);
    throw err.response.data;
  }
}
