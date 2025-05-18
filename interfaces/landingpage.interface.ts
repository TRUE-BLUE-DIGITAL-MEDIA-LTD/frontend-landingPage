export interface LandingPage {
  id: string;
  createAt: string;
  updateAt: string;
  name: string;
  title: string;
  description: string;
  backgroundImage: string;
  icon: string | null;
  language: Language;
  html: string;
  json: string;
  viewCount: number | null;
  mainButton: string;
  directLink?: string | null;
  secondOffer?: string | null;
  backOffer?: string | null;
  percent: number;
  categoryId: string | null;
  creatorId: string;
  domainId: string | null;
}
export type Language =
  | "en"
  | "es"
  | "fr"
  | "de"
  | "it"
  | "pt"
  | "hr"
  | "de-ch"
  | "fr-ch"
  | "it-ch"
  | "nl"
  | "fi"
  | "no"
  | "sv"
  | "ro"
  | "hu"
  | "pl"
  | "cs";
