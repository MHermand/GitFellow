"use client";

import { saveLocale } from "@/actions/settings";
import { ChevronDownIcon } from "@/components/icons";
import { inputBase } from "@/components/ui";
import { useI18n } from "@/i18n/client";
import { LOCALES } from "@/i18n";

/** Colonne calée sur les libellés des règles de calcul, juste au-dessus. */
const LABEL_COL = "w-60 shrink-0";
const FIELD_COL = "w-[198px] shrink-0";

/** Langue de l'application : « celle du navigateur » ou un choix fixé, enregistré dès le changement. */
export function LanguageField({ value }: { value: "auto" | "fr" | "en" }) {
  const { m } = useI18n();
  return (
    <form action={saveLocale} className="flex items-center gap-x-3">
      <label htmlFor="locale" className={`${LABEL_COL} text-sm text-ink-2`}>
        {m.settings.language.label}
      </label>
      <span className={`relative inline-flex ${FIELD_COL}`}>
        <select
          id="locale"
          name="locale"
          defaultValue={value}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          className={`${inputBase} h-9 w-full appearance-none px-3 pr-9`}
        >
          <option value="auto">{m.settings.language.auto}</option>
          {LOCALES.map((locale) => (
            <option key={locale} value={locale}>
              {m.settings.language[locale]}
            </option>
          ))}
        </select>
        <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-[9px] size-4 -translate-y-1/2 text-ink-2" />
      </span>
    </form>
  );
}
