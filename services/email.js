import axios from "axios";
import Error from "next/error";

export async function CreateEmailService({ email, landingPageId, name }) {
  try {
    const res = await axios.post(
      `https://backend-landingpage-admin-dasboard-n2vkrqhb2a-uc.a.run.app/public/email/collect`,
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
    throw new Error(err);
  }
}
