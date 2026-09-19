import { describe, expect, it } from "vitest";
import { en } from "./en";
import { fr } from "./fr";
import { count, detectLocale, fill } from "./index";

type Tree = Record<string, unknown>;

function leaves(tree: Tree, prefix = ""): Map<string, unknown> {
  const out = new Map<string, unknown>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      for (const [k, v] of leaves(value as Tree, path)) out.set(k, v);
    } else {
      out.set(path, value);
    }
  }
  return out;
}

const placeholders = (value: unknown) =>
  typeof value === "string" ? [...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort() : [];

describe("dictionnaires", () => {
  it("le français couvre exactement les clés de l'anglais", () => {
    expect([...leaves(fr).keys()].sort()).toEqual([...leaves(en).keys()].sort());
  });

  it("chaque gabarit garde les mêmes paramètres dans les deux langues", () => {
    const enLeaves = leaves(en);
    for (const [key, value] of leaves(fr)) {
      expect({ key, params: placeholders(value) }).toEqual({ key, params: placeholders(enLeaves.get(key)) });
    }
  });

  it("les listes ont la même longueur", () => {
    expect(fr.dates.weekdays).toHaveLength(en.dates.weekdays.length);
    expect(fr.export.headers).toHaveLength(en.export.headers.length);
  });
});

describe("aides", () => {
  it("détecte le français avant l'anglais selon l'ordre du navigateur", () => {
    expect(detectLocale("fr-FR,fr;q=0.9,en;q=0.8")).toBe("fr");
    expect(detectLocale("en-US,en;q=0.9,fr;q=0.8")).toBe("en");
    expect(detectLocale("de-DE")).toBe("en");
    expect(detectLocale(null)).toBe("en");
  });

  it("remplit les gabarits et accorde les pluriels de chaque langue", () => {
    expect(fill("{repo}: {n}", { repo: "a/b", n: 3 })).toBe("a/b: 3");
    expect(count("fr", fr.common.commits, 0)).toBe("0 commit");
    expect(count("fr", fr.common.commits, 2)).toBe("2 commits");
    expect(count("en", en.common.commits, 0)).toBe("0 commits");
    expect(count("en", en.common.commits, 1)).toBe("1 commit");
  });
});
