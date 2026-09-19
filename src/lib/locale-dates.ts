import { enUS, fr } from "date-fns/locale";
import type { Locale } from "@/i18n";
import type { Locale as DateFnsLocale } from "date-fns";

export function dateFnsLocale(locale: Locale): DateFnsLocale {
  return locale === "fr" ? fr : enUS;
}
