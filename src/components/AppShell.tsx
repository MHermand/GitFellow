"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ComponentType, type SVGProps } from "react";
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, GridIcon, SlidersIcon } from "./icons";

/** Teinte posée par la page affichée (PageHue), le bleu de données quand la page n'en pose pas. */
const HUE = "var(--page-hue, var(--data))";

interface NavItem {
  href: string;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  matches: (path: string) => boolean;
}

interface NavSection {
  id: string;
  label: string;
  items: NavItem[];
}

/**
 * Navigation de la barre latérale, par sections repliables.
 * Ajouter un module = ajouter une entrée à une section, ou une nouvelle section ici.
 */
const SECTIONS: NavSection[] = [
  {
    id: "tracking",
    label: "Suivi",
    items: [
      {
        href: "/",
        label: "Activité",
        Icon: GridIcon,
        matches: (path) => path === "/" || path.startsWith("/contributors"),
      },
      {
        href: "/settings",
        label: "Paramètres",
        Icon: SlidersIcon,
        matches: (path) => path.startsWith("/settings"),
      },
    ],
  },
];

const NAV_ITEMS = SECTIONS.flatMap((section) => section.items);

/** Sections repliées, mémorisées d'une visite à l'autre. */
const STORAGE_KEY = "gitfellow:nav-collapsed";
/** Barre latérale réduite aux icônes, mémorisée elle aussi. */
const RAIL_KEY = "gitfellow:nav-rail";

/** Avatar GitHub : celui de la connexion, sinon celui que GitHub sert pour tout login. */
function avatarOf(login: string, avatarUrl: string | null): string {
  return avatarUrl ?? `https://github.com/${encodeURIComponent(login)}.png?size=64`;
}

/** Marque : le signe, et le nom quand il y a la place. */
function Brand({ withName, size = 28 }: { withName: boolean; size?: number }) {
  return (
    <Link href="/" className="flex items-center gap-2.5" title="GitFellow">
      <img src="/gitfellow-logo.svg" alt="" width={size} height={size} style={{ width: size, height: size }} />
      {withName ? <span className="text-lg font-bold tracking-tight">GitFellow</span> : null}
    </Link>
  );
}

/** Pied du bandeau : le compte GitHub connecté, qui mène aux paramètres. */
function Identity({ login, avatarUrl, open }: { login: string | null; avatarUrl: string | null; open: boolean }) {
  if (!login) {
    return (
      <Link href="/setup" className="text-xs text-ink-2 hover:text-ink" title="Connecter GitHub">
        {open ? "Connecter GitHub" : "GH"}
      </Link>
    );
  }
  return (
    <Link href="/settings#github" className="flex min-w-0 items-center gap-2.5" title={`@${login} · GitHub`}>
      <img src={avatarOf(login, avatarUrl)} alt="" width={32} height={32} className="h-8 w-8 shrink-0 rounded-full bg-track" />
      {open ? <span className="min-w-0 flex-1 truncate text-xs text-ink-2">@{login}</span> : null}
    </Link>
  );
}

/**
 * Coquille de l'app : barre latérale (masquée sur mobile), en-tête, zone de contenu.
 * La coquille occupe la hauteur de la fenêtre ; c'est la zone de contenu qui défile, ce qui
 * permet à une page (l'agenda) de tenir exactement dans la hauteur disponible.
 */
export function AppShell({ login, avatarUrl, children }: { login: string | null; avatarUrl: string | null; children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const current = NAV_ITEMS.find((item) => item.matches(pathname)) ?? NAV_ITEMS[0];
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [rail, setRail] = useState(false);
  const open = !rail;

  // Lu après le montage : le rendu serveur ne connaît pas le stockage local et
  // doit rester identique au premier rendu client (barre et sections dépliées).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setCollapsed(parsed.filter((value): value is string => typeof value === "string"));
        }
      }
      setRail(window.localStorage.getItem(RAIL_KEY) === "1");
    } catch {
      // Stockage indisponible (navigation privée, cookies bloqués) : tout reste déplié.
    }
  }, []);

  function toggleRail() {
    setRail((previous) => {
      const next = !previous;
      try {
        window.localStorage.setItem(RAIL_KEY, next ? "1" : "0");
      } catch {
        // Stockage indisponible : le pli vaut pour cette visite seulement.
      }
      return next;
    });
  }

  function toggleSection(id: string) {
    setCollapsed((previous) => {
      const next = previous.includes(id) ? previous.filter((value) => value !== id) : [...previous, id];
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Stockage indisponible : le pli vaut pour cette visite seulement.
      }
      return next;
    });
  }

  return (
    <div className="flex h-dvh overflow-hidden">
      <aside
        className={`group/side relative hidden shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-200 md:flex ${
          open ? "w-64" : "w-16"
        }`}
      >
        {/* La bordure droite est l'interrupteur : filet au survol, chevron aligné sur le logo. */}
        <button
          type="button"
          onClick={toggleRail}
          aria-expanded={open}
          aria-label={open ? "Replier la barre latérale" : "Déplier la barre latérale"}
          title={open ? "Replier la barre latérale" : "Déplier la barre latérale"}
          className="group/grip absolute inset-y-0 -right-1.5 z-10 w-3 cursor-pointer"
        >
          {/* Le filet s'annonce dès que la souris entre dans le bandeau, et s'affirme sur la poignée. */}
          <span
            className="absolute inset-y-0 left-1 w-1 rounded-full opacity-0 transition-opacity group-hover/side:opacity-40 group-hover/grip:opacity-100! group-focus-visible/grip:opacity-100!"
            style={{ background: HUE }}
          />
          <span
            className="absolute top-7 left-1/2 grid h-5 w-5 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-white opacity-0 shadow-sm transition-opacity group-hover/side:opacity-60 group-hover/grip:opacity-100! group-focus-visible/grip:opacity-100!"
            style={{ background: HUE }}
          >
            {open ? <ChevronLeftIcon className="h-3 w-3" /> : <ChevronRightIcon className="h-3 w-3" />}
          </span>
        </button>
        <div className={`flex h-14 items-center justify-center ${open ? "px-5" : "px-0"}`}>
          <Brand withName={open} />
        </div>
        <nav
          aria-label="Navigation principale"
          className={`flex flex-1 flex-col gap-2 overflow-y-auto ${open ? "p-3" : "items-center p-2"}`}
        >
          {SECTIONS.map((section) => {
            // Réduite aux icônes, la barre n'a plus de titres de section : tout reste visible.
            const expanded = !open || !collapsed.includes(section.id);
            const holdsCurrent = section.items.includes(current);
            return (
              <div key={section.id} className="flex flex-col gap-1">
                {open ? (
                <button
                  type="button"
                  onClick={() => toggleSection(section.id)}
                  aria-expanded={expanded}
                  aria-controls={`nav-${section.id}`}
                  className={`group flex items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                    holdsCurrent && !expanded ? "text-accent-fg" : "text-muted hover:text-ink-2"
                  }`}
                >
                  <span>{section.label}</span>
                  <ChevronDownIcon
                    className={`h-3.5 w-3.5 opacity-0 transition-[transform,opacity] group-hover:opacity-100 group-focus-visible:opacity-100 ${
                      expanded ? "" : "-rotate-90 opacity-100"
                    }`}
                  />
                </button>
                ) : null}
                <ul
                  id={`nav-${section.id}`}
                  className={expanded ? `flex flex-col gap-1 ${open ? "pl-2" : "items-center"}` : "hidden"}
                >
                  {section.items.map((item) => {
                    const active = item === current;
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          aria-label={open ? undefined : item.label}
                          title={open ? undefined : item.label}
                          className={`relative flex items-center rounded-lg text-sm transition-colors ${
                            open ? "gap-2.5 px-3 py-2" : "h-10 w-10 justify-center"
                          } ${
                            active
                              ? open
                                ? "font-semibold text-ink before:absolute before:top-1.5 before:bottom-1.5 before:-left-2 before:w-[3px] before:rounded-full before:bg-accent"
                                : "bg-accent-soft font-medium text-accent-fg"
                              : "font-medium text-ink-2 hover:bg-track hover:text-ink"
                          }`}
                        >
                          <item.Icon className={`h-4 w-4 ${active && open ? "text-accent" : ""}`} />
                          {open ? item.label : null}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        <div className={`flex shrink-0 items-center gap-2.5 border-t border-line ${open ? "px-3 py-2.5" : "justify-center px-2 py-2.5"}`}>
          <Identity login={login} avatarUrl={avatarUrl} open={open} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Sur mobile, le bandeau n'existe pas : cette barre porte la navigation et l'identité. */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-line px-4 md:hidden">
          <div className="flex items-center gap-4">
            <Brand withName size={24} />
            <nav aria-label="Navigation principale" className="flex gap-1">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={item === current ? "page" : undefined}
                  className={`rounded-lg px-2.5 py-1.5 text-sm font-medium ${
                    item === current ? "bg-accent-soft text-accent-fg" : "text-ink-2"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <Identity login={login} avatarUrl={avatarUrl} open />
        </header>
        <main className="min-w-0 flex-1 space-y-6 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
