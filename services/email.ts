import axios from "axios";

export async function CreateEmailService({
  email,
  landingPageId,
  name,
}: {
  email: string;
  landingPageId: string;
  name: string;
}) {
  try {
    const res = await axios.post(
      process.env.NEXT_PUBLIC_NODE_ENV === "development"
        ? "http://localhost:3001/public/email/collect"
        : "https://backend-landingpage-admin-dasboard-n2vkrqhb2a-uc.a.run.app/public/email/collect",
      {
        email,
        name,
        landingPageId,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    return res.data;
  } catch (err) {
    console.log(err);
    throw err.response.data;
  }
}
