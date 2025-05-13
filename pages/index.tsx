import { CreateEmailService } from "@/services/email";
import {
  GetLandingPageService,
  ResponseGetLandingPageService,
} from "@/services/landingPage";
import { DirectLinkService } from "@/services/merchant";
import * as crypto from "crypto";
import { GetServerSideProps } from "next";
import Head from "next/head";
import { useRouter } from "next/router";
import { event, GoogleAnalytics } from "nextjs-google-analytics";
import { useEffect, useState } from "react";
import requestIp from "request-ip";
import Swal from "sweetalert2";
import { Language } from "../interfaces";
import { JSDOM } from "jsdom";

function Index({
  landingPage,
  errorMessage,
  country,
  updatedHTML,
}: {
  landingPage: ResponseGetLandingPageService;
  errorMessage?: string;
  country: string;
  updatedHTML: string;
}) {
  const router = useRouter();
  const mainLink = landingPage?.mainButton;

  const preventDefaultForSubmitButtons = () => {
    const submitButtons = document.querySelectorAll('button[type="submit"]');

    const emailInput: HTMLInputElement = document.querySelector(
      'input[type="email"][name="email"]'
    );
    const NameInput: HTMLInputElement = document.querySelector(
      'input[type="text"][name="name"]'
    );

    const buttons = document.querySelectorAll("button");
    const multipleFormButtons = Array.from(buttons).filter((button) =>
      Array.from(button.classList).some((className) =>
        className.includes("form")
      )
    );
    if (multipleFormButtons.length > 0) {
      multipleFormButtons.forEach((button) => {
        const value = JSON.parse(button.getAttribute("value") as string) as {
          url: string;
        };
        button.addEventListener("click", function (e) {
          event("click", {
            category: "multiple-form-step",
            label: value.url,
          });
          e.preventDefault();
        });
      });
    }

    const anchorTags = document.querySelectorAll("a");
    anchorTags.forEach((button) => {
      let href = button.href;

      if (href === window.location.href) {
        href = mainLink;
      }
      button.addEventListener("click", function (e) {
        event("click", {
          category: "button-click",
          label: href,
        });
        router.push(href);
        e.preventDefault();
      });
    });

    submitButtons.forEach((button) => {
      button.addEventListener("click", function (e) {
        event("click", {
          category: "button-click",
          label: mainLink,
        });
        e.preventDefault();
        const email = emailInput?.value;
        const name = NameInput?.value;
        handleSumitEmail({ email, name });
      });
    });
  };
  useEffect(() => {
    // const body = document.getElementById("u_body");
    // if (body) {
    //   body.style.display = "flex";
    //   body.style.alignItems = "center";
    //   body.style.justifyContent = "center";
    //   body.style.gap = "0.75rem";
    // } else {
    //   console.log('Element with id "u_body" not found.');
    // }

    preventDefaultForSubmitButtons();
  }, []);

  const handleSumitEmail = async ({ email, name }) => {
    try {
      Swal.fire({
        title: "Thanks For Joining us",
        html: "Loading....",
        allowEscapeKey: false,
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });
      if (landingPage.directLink) {
        const [directLink, collectEmail] = await Promise.allSettled([
          DirectLinkService({
            email: email,
            url: landingPage.directLink,
          }),
          CreateEmailService({
            email: email,
            landingPageId: landingPage?.id,
            name,
          }),
        ]);
        Swal.fire({
          title: "Success",
          text: "You have been successfully registered",
          icon: "success",
        });

        if (directLink.status === "rejected") {
          router.push(mainLink);
        } else if (directLink.value.status === "success") {
          router.push(directLink.value.location);
        }
      } else {
        window.open(mainLink, "_self");
      }
    } catch (err) {
      console.log("run", err);
      window.open(mainLink), "_self";
    }
  };
  console.log("errorMessage", errorMessage);
  if (errorMessage) {
    return (
      <div className="w-screen h-screen bg-black font-Anuphan">
        <div className="flex p-10 justify-center text-center  text-white items-center w-full h-full">
          <h1 className="text-base lg:text-3xl font-bold">{errorMessage}</h1>
        </div>
      </div>
    );
  }

  if (country === "Thailand") {
    return (
      <div
        className="w-screen h-screen bg-black font-semibold text-center
       font-Poppins text-white flex justify-center items-center text-lg md:text-2xl"
      >
        Our service is not available in your country.
      </div>
    );
  }
  if (!landingPage.id) {
    return (
      <div className="w-screen h-screen bg-black font-Anuphan">
        <div className="flex p-10 justify-center text-center  text-white items-center w-full h-full">
          <h1 className="text-base lg:text-3xl font-bold">
            This domain {landingPage.domain.name} has no landing page
          </h1>
        </div>
      </div>
    );
  }

  return (
    <div>
      <GoogleAnalytics
        trackPageViews
        nonce={crypto.randomBytes(16).toString("base64")}
        gaMeasurementId={landingPage?.domain?.googleAnalyticsId}
      />

      <Head>
        <meta name="description" content={landingPage.description} />
        {/* facebook sharing link */}
        <meta property="og:title" content={landingPage.title} />
        <meta property="og:type" content="website" />
        <meta property="og:description" content={landingPage.description} />
        <meta property="og:image" content={landingPage.backgroundImage} />
        <meta property="og:url" content="https://bestDatingSite.com" />

        {/* tweeter sharing link */}
        <meta name="twitter:title" content={landingPage.title} />
        <meta name="twitter:type" content="website" />
        <meta name="twitter:description" content={landingPage.description} />
        <meta name="twitter:image" content={landingPage.backgroundImage} />
        <meta name="viewport" content="initial-scale=1.0, width=device-width" />
        <link rel="shortcut icon" href={landingPage.icon} />
        <title>{landingPage.title}</title>
      </Head>
      <main dangerouslySetInnerHTML={{ __html: `${updatedHTML}` }} />
    </div>
  );
}

export default Index;
export const getServerSideProps: GetServerSideProps = async (ctx) => {
  let host = ctx.req.headers.host;
  let country = "United States";
  try {
    const userIP = requestIp.getClientIp(ctx.req);
    console.log("userIP", userIP);
    const countryResponse = await fetch(`http://ip-api.com/json/${userIP}`);
    const response = await countryResponse?.json();
    console.log("response", response);
    if (response?.country) {
      country = response?.country;
    }
  } catch (error) {
    console.log("error", error);
  }

  if (process.env.NEXT_PUBLIC_NODE_ENV === "development") {
    host = "localhost:8181";
  } else {
    host = ctx.req.headers.host;
  }
  const acceptLanguage = ctx.req.headers["accept-language"];
  let userLanguage: Language = acceptLanguage
    ? (acceptLanguage.split(",")[0] as Language)
    : ("en" as Language);
  userLanguage = userLanguage?.split("-")[0] as Language;
  console.log("userLanguage", userLanguage);

  try {
    const landingPage = await GetLandingPageService({
      host,
      language: userLanguage,
    });

    const dom = new JSDOM(landingPage.html);
    let updatedHTML: string = landingPage.html;
    const scriptProductionMultipleForm = dom.window.document.querySelector(
      'script.script_multiple_form[src="https://oxyclick.com/unlayer-custom/script-multiple-form.js"]'
    );
    const scriptDevMultipleForm = dom.window.document.querySelector(
      'script.script_multiple_form[src="http://localhost:8080/unlayer-custom/script-multiple-form.js"]'
    );
    if (scriptProductionMultipleForm && host.includes("localhost")) {
      scriptProductionMultipleForm.remove();
      updatedHTML = dom.serialize();
    }
    if (scriptDevMultipleForm && !host.includes("localhost")) {
      scriptDevMultipleForm.remove();
      updatedHTML = dom.serialize();
    }

    return {
      props: {
        updatedHTML,
        landingPage: landingPage,
        country,
      },
    };
  } catch (error) {
    console.log("error", error);
    return {
      props: {
        errorMessage: error.message,
      },
    };
  }
};
