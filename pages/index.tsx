import { CreateEmailService, ValidateEmail } from "@/services/email";
import {
  GetLandingPageService,
  ResponseGetLandingPageService,
} from "@/services/landingPage";
import { DirectLinkService } from "@/services/merchant";
import { PrismaClient } from "@prisma/client";
import * as crypto from "crypto";
import { JSDOM } from "jsdom";
import { GetServerSideProps } from "next";
import Head from "next/head";
import { useRouter } from "next/router";
import { event, GoogleAnalytics } from "nextjs-google-analytics";
import { useEffect } from "react";
import requestIp from "request-ip";
import Swal from "sweetalert2";
import { Language } from "../interfaces";

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

    const buttons = document.querySelectorAll("button");
    const multipleFormButtons = Array.from(buttons).filter((button) =>
      Array.from(button.classList).some((className) =>
        className.includes("form")
      )
    );
    if (multipleFormButtons.length > 0) {
      multipleFormButtons.forEach((button) => {
        const classId = button.classList;
        const text = button.textContent;
        button.addEventListener("click", function (e) {
          event(classId[0], {
            category: "multiple-form-step",
            label: text,
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

    submitButtons.forEach((button: HTMLButtonElement) => {
      button.addEventListener("click", async function (e) {
        e.preventDefault();
        emailInput.reportValidity();
        if (emailInput.value) {
          button.textContent = "Loading..";
          const validate = await ValidateEmail({ email: emailInput.value });
          if (validate === true) {
            event("click", {
              category: "button-click",
              label: mainLink,
            });
            const email = emailInput.value;
            await handleSumitEmail({ email });
          } else if (validate === false) {
            emailInput.focus();
            button.textContent = "Please Enter Valid Email";
          }
        }
      });
    });
  };

  useEffect(() => {
    preventDefaultForSubmitButtons();
  }, []);

  const handleSumitEmail = async ({ email }: { email: string }) => {
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
          }),
        ]);
        Swal.fire({
          title: "Success",
          text: "You have been successfully registered",
          icon: "success",
        });

        if (directLink.status === "rejected") {
          window.open(mainLink, "_self");
        } else if (directLink.value.status === "success") {
          router.push(directLink.value.location);
        }
        return;
      } else {
        await CreateEmailService({
          email: email,
          landingPageId: landingPage?.id,
        });
        if (email) {
          const encode_email = btoa(email);
          const url = new URL(mainLink);
          url.searchParams.set("sub3", encode_email);
          const newLink = url.toString();
          window.open(newLink, "_self");
        } else {
          window.open(mainLink, "_self");
        }
      }
    } catch (err) {
      console.log("run", err);
      window.open(mainLink), "_self";
    }
  };
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
      <>
        <Head>
          {/* facebook sharing link */}
          <meta property="og:title" content={landingPage.domain.name} />
          <meta
            property="og:site_name"
            content={landingPage.domain.name.split(".")[0]}
          />
          <meta property="og:type" content="website" />
          <meta
            property="og:url"
            content={`https://${landingPage.domain.name}`}
          />
          <meta
            name="viewport"
            content="initial-scale=1.0, width=device-width"
          />
        </Head>
        <div className="w-screen h-screen bg-black font-Anuphan">
          <div className="flex p-10 justify-center text-center  text-white items-center w-full h-full">
            <h1 className="text-base lg:text-3xl font-bold">
              This domain {landingPage.domain.name} has no landing page
            </h1>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {landingPage.domain.googleAnalyticsId && (
        <GoogleAnalytics
          trackPageViews
          nonce={crypto.randomBytes(16).toString("base64")}
          gaMeasurementId={landingPage.domain.googleAnalyticsId}
        />
      )}

      <Head>
        <meta name="description" content={landingPage.description} />
        {/* facebook sharing link */}
        <meta property="og:title" content={landingPage.title} />
        <meta
          property="og:site_name"
          content={landingPage.domain.name.split(".")[0]}
        />
        <meta property="og:type" content="website" />
        <meta property="og:description" content={landingPage.description} />
        <meta property="og:image" content={landingPage.backgroundImage} />
        <meta
          property="og:url"
          content={`https://${landingPage.domain.name}`}
        />

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
    </>
  );
}
const prisma = new PrismaClient();

export default Index;
export const getServerSideProps: GetServerSideProps = async (ctx) => {
  let host = ctx.req.headers.host;
  let country = "United States";
  try {
    const userIP = requestIp.getClientIp(ctx.req);
    console.log("userIP", userIP);
    const countryResponse = await fetch(`http://ip-api.com/json/${userIP}`);
    const response = await countryResponse?.json();
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

  try {
    const landingPage = await GetLandingPageService({
      domain: host,
      language: userLanguage,
      prisma,
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
        updatedHTML: updatedHTML ?? null,
        landingPage: landingPage ?? null,
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
