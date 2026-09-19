import { headers } from "next/headers";
import { cache } from "react";
import { getStore } from "@/lib/runtime";
import { detectLocale, makeI18n, type Locale } from "./index";

/** Langue de la requête : le réglage enregistré, sinon celle du navigateur. Une seule lecture par requête. */
export const getLocale = cache(async (): Promise<Locale> => {
  const settings = await getStore().settings();
  if (settings.locale) return settings.locale;
  const accept = (await headers()).get("accept-language");
  return detectLocale(accept);
});

/** Dictionnaire et aides de la requête, pour les composants serveur et les actions. */
export const getI18n = cache(async () => makeI18n(await getLocale()));
