import { describe, expect, it } from "vitest";
import {
  isGenericAuthor,
  needsPullRequestLookup,
  parseList,
  resolveContributor,
  groupDetectedAuthors,
  type IdentityCount,
} from "./attribution";

const felix = {
  id: "felix",
  displayName: "Félix",
  githubLogins: ["Felixooos"],
  authorEmails: ["felix@example.com"],
  authorNames: ["Felixooos"],
};
const maxence = {
  id: "maxence",
  displayName: "Maxence",
  githubLogins: ["MHermand"],
  authorEmails: [],
  authorNames: [],
};
const all = [felix, maxence];

describe("resolveContributor", () => {
  it("par login GitHub, insensible à la casse", () => {
    const c = resolveContributor(
      { authorLogin: "felixooos", authorEmail: null, authorName: null, prAuthorLogin: null },
      all,
    );
    expect(c?.id).toBe("felix");
  });

  it("par e-mail puis par nom d'auteur", () => {
    expect(
      resolveContributor(
        { authorLogin: null, authorEmail: "Felix@example.com", authorName: null, prAuthorLogin: null },
        all,
      )?.id,
    ).toBe("felix");
    expect(
      resolveContributor(
        { authorLogin: null, authorEmail: "autre@example.com", authorName: "Felixooos", prAuthorLogin: null },
        all,
      )?.id,
    ).toBe("felix");
  });

  it("un commit « Claude » est rattaché à l'auteur de sa PR", () => {
    const c = resolveContributor(
      {
        authorLogin: null,
        authorEmail: "noreply@anthropic.com",
        authorName: "Claude",
        prAuthorLogin: "MHermand",
      },
      all,
    );
    expect(c?.id).toBe("maxence");
  });

  it("le nom « Claude » ne matche jamais par nom", () => {
    const claudeLike = { ...felix, authorNames: ["Claude"] };
    const c = resolveContributor(
      { authorLogin: null, authorEmail: "noreply@anthropic.com", authorName: "Claude", prAuthorLogin: null },
      [claudeLike],
    );
    expect(c).toBeNull();
  });

  it("retourne null quand rien ne correspond", () => {
    expect(
      resolveContributor(
        { authorLogin: "inconnu", authorEmail: "x@y.z", authorName: "X", prAuthorLogin: "inconnu" },
        all,
      ),
    ).toBeNull();
  });
});

describe("helpers", () => {
  it("isGenericAuthor", () => {
    expect(isGenericAuthor("noreply@anthropic.com")).toBe(true);
    expect(isGenericAuthor("dependabot[bot]@users.noreply.github.com")).toBe(true);
    expect(isGenericAuthor(null)).toBe(true);
    expect(isGenericAuthor("felix@example.com")).toBe(false);
  });

  it("needsPullRequestLookup", () => {
    expect(needsPullRequestLookup({ authorLogin: "Felixooos", authorEmail: "felix@example.com" })).toBe(false);
    expect(needsPullRequestLookup({ authorLogin: null, authorEmail: "felix@example.com" })).toBe(true);
    expect(needsPullRequestLookup({ authorLogin: "Felixooos", authorEmail: "noreply@anthropic.com" })).toBe(true);
  });

  it("parseList", () => {
    expect(parseList(" a, b ;c\n d ")).toEqual(["a", "b", "c", "d"]);
    expect(parseList("")).toEqual([]);
  });
});

describe("groupDetectedAuthors", () => {
  const row = (extra: Partial<IdentityCount>): IdentityCount => ({
    authorLogin: null,
    authorEmail: null,
    authorName: null,
    prAuthorLogin: null,
    count: 1,
    ...extra,
  });

  it("réunit les lignes d'un même login", () => {
    const groups = groupDetectedAuthors([
      row({ authorLogin: "MHermand", authorEmail: "max@colibrimo.com", authorName: "Maxence", count: 3 }),
      row({ authorLogin: "mhermand", authorEmail: "max@colibrimo.com", authorName: "Maxence Hermand", count: 2, prAuthorLogin: "Felixooos" }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].commits).toBe(5);
    expect(groups[0].githubLogins).toEqual(["MHermand"]);
    expect(groups[0].authorNames).toEqual(["Maxence", "Maxence Hermand"]);
  });

  it("rattache les commits d'agent à l'auteur de la PR, avec les siens", () => {
    const groups = groupDetectedAuthors([
      row({ authorName: "claude", authorEmail: "noreply@anthropic.com", prAuthorLogin: "MHermand", count: 7 }),
      row({ authorName: "Claude", authorEmail: "noreply@anthropic.com", prAuthorLogin: "MHermand", count: 1 }),
      row({ authorLogin: "MHermand", authorEmail: "max@colibrimo.com", authorName: "Maxence", count: 3 }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].handle).toBe("MHermand");
    expect(groups[0].commits).toBe(11);
    expect(groups[0].viaPullRequests).toBe(8);
    // L'adresse générique de l'agent ne devient pas une identité du contributeur.
    expect(groups[0].authorEmails).toEqual(["max@colibrimo.com"]);
    expect(groups[0].email).toBe("max@colibrimo.com");
  });

  it("sépare deux auteurs de PR différents", () => {
    const groups = groupDetectedAuthors([
      row({ authorName: "claude", authorEmail: "noreply@anthropic.com", prAuthorLogin: "MHermand", count: 7 }),
      row({ authorName: "claude", authorEmail: "noreply@anthropic.com", prAuthorLogin: "Felixooos", count: 1 }),
    ]);
    expect(groups.map((g) => g.handle)).toEqual(["MHermand", "Felixooos"]);
  });

  it("garde un agent sans pull request, sans lui inventer d'identité", () => {
    const groups = groupDetectedAuthors([
      row({ authorName: "claude", authorEmail: "noreply@anthropic.com", count: 2 }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].handle).toBe("claude");
    expect(groups[0].githubLogins).toEqual([]);
    expect(groups[0].email).toBe("noreply@anthropic.com");
  });

  it("regroupe par e-mail quand le login manque", () => {
    const groups = groupDetectedAuthors([
      row({ authorEmail: "felix@perso.fr", authorName: "Felix H", count: 4 }),
      row({ authorEmail: "Felix@perso.fr", authorName: "felix", count: 1, prAuthorLogin: "MHermand" }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].commits).toBe(5);
    // La PR ne rattache pas un auteur déjà identifiable : le login de Maxence n'est pas repris.
    expect(groups[0].githubLogins).toEqual([]);
  });
});
