"use client";

import { useOptimistic, useState, useTransition } from "react";
import { deleteContributor, saveContributor, trackAuthor } from "@/actions/settings";
import { ChevronDownIcon, EditIcon, TrashIcon } from "@/components/icons";
import { inputBase } from "@/components/ui";
import { TARGET_UNITS, type TargetUnit } from "@/lib/target";
import { Menu, MenuCount, menuItem } from "./Menu";

export interface AuthorIdentity {
  displayName: string;
  githubLogins: string[];
  authorEmails: string[];
  authorNames: string[];
}

export interface AuthorItem {
  key: string;
  /** Pseudo GitHub, à défaut le nom ou l'e-mail de l'auteur des commits. */
  label: string;
  email: string;
  commits: number;
  /** Détail complet, en infobulle. */
  title: string;
  identity: AuthorIdentity;
}

export interface ContributorItem {
  id: string;
  displayName: string;
  logins: string;
  emails: string;
  names: string;
  /** Première identité saisie, affichée à côté du nom. */
  handle: string | null;
  targetHours: string;
  targetUnit: TargetUnit;
}

/** Colonnes partagées par l'en-tête et les lignes, calées sur celles des dépôts. */
const NAME_COL = "w-48 shrink-0 truncate";
/** Objectif : mêmes colonnes que « synchroniser » + « début du suivi » au-dessus. */
const OBJECTIVE_COL = "w-[198px] shrink-0";
const ICON_COL = "w-9 shrink-0";
const UNIT_COL = "w-[150px] shrink-0";
/** Largeur du champ d'ajout de dépôt et de son bouton « + », juste au-dessus. */
const ADD_COL = "w-[246px]";

const iconButton =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line bg-surface text-muted transition-colors hover:border-accent/40 hover:bg-accent-soft hover:text-accent-fg";
const iconDanger =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line bg-surface text-muted transition-colors hover:border-danger/30 hover:bg-danger/10 hover:text-danger";

/** Auteurs de commits qui ne sont rattachés à personne : un clic les met sous suivi. */
export function AuthorPicker({ authors }: { authors: AuthorItem[] }) {
  const [query, setQuery] = useState("");
  const [shown, hide] = useOptimistic(authors, (state: AuthorItem[], key: string) => state.filter((a) => a.key !== key));
  const [, startTransition] = useTransition();

  const track = (author: AuthorItem) =>
    startTransition(async () => {
      hide(author.key);
      await trackAuthor(author.identity);
    });

  if (shown.length === 0) return null;

  const needle = query.trim().toLowerCase();
  const list = shown.filter((a) => `${a.label} ${a.email}`.toLowerCase().includes(needle));

  return (
    <Menu label="Ajouter des auteurs" width={ADD_COL}>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Rechercher un auteur…"
        aria-label="Rechercher un auteur"
        className={`${inputBase} h-9 w-full px-3`}
      />
      <ul className="mt-1 max-h-64 overflow-y-auto">
        {list.map((author) => (
          <li key={author.key}>
            <button type="button" onClick={() => track(author)} className={menuItem} title={author.title}>
              <span className="shrink-0 font-medium">{author.label}</span>
              {author.email ? <span className="min-w-0 flex-1 truncate text-xs text-muted">{author.email}</span> : <span className="flex-1" />}
              <MenuCount>{author.commits}</MenuCount>
            </button>
          </li>
        ))}
        {list.length === 0 ? <li className="px-2 py-2 text-sm text-muted">Aucun auteur.</li> : null}
      </ul>
    </Menu>
  );
}

/** En-tête de colonne : ce que porte chaque ligne à droite. */
export function ContributorListHeader() {
  return (
    <div className="flex items-center gap-x-3 pb-2 text-[11px] font-semibold tracking-wide text-muted uppercase max-sm:hidden">
      <span className={ICON_COL} />
      <span className={NAME_COL} />
      <span className="flex-1" />
      <span className={`${OBJECTIVE_COL} text-right`}>Objectif horaire</span>
      <span className={ICON_COL} />
    </div>
  );
}

/** Enregistre dès qu'une valeur change réellement : la ligne se comporte comme un réglage, pas comme un formulaire. */
function submitForm(el: HTMLInputElement | HTMLSelectElement) {
  el.form?.requestSubmit();
}

function submitIfChanged(el: HTMLInputElement) {
  if (el.value !== el.defaultValue) submitForm(el);
}

/** Ligne d'un contributeur : nom, identité principale, objectif facultatif, édition dépliable. */
export function ContributorRow({ contributor }: { contributor: ContributorItem }) {
  const [editing, setEditing] = useState(false);

  return (
    <form action={saveContributor} className="border-t border-line py-2.5">
      <input type="hidden" name="id" value={contributor.id} />
      <div className="flex items-center gap-x-3 gap-y-2 max-sm:flex-wrap">
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          aria-expanded={editing}
          aria-label={`Modifier ${contributor.displayName}`}
          title="Nom affiché et identités rattachées"
          className={iconButton}
        >
          <EditIcon />
        </button>
        <span className={`${NAME_COL} text-sm font-medium`} title={contributor.displayName}>
          {contributor.displayName}
        </span>
        <span className="min-w-0 flex-1 truncate text-xs text-muted">{contributor.handle}</span>
        <div className={`${OBJECTIVE_COL} flex items-center gap-x-3`}>
          <input
            name="target_hours"
            type="number"
            min={0}
            max={400}
            step="0.5"
            placeholder="—"
            defaultValue={contributor.targetHours}
            onBlur={(e) => submitIfChanged(e.currentTarget)}
            aria-label={`Objectif de ${contributor.displayName}, en heures`}
            title="Heures visées"
            className={`${inputBase} ${ICON_COL} h-9 px-0 text-center tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
          />
          {/* Chevron dessiné à la main : il se cale alors exactement sur l'icône du champ date au-dessus. */}
          <span className={`relative inline-flex ${UNIT_COL}`}>
            <select
              name="target_unit"
              defaultValue={contributor.targetUnit}
              onChange={(e) => submitForm(e.currentTarget)}
              aria-label={`Unité de l'objectif de ${contributor.displayName}`}
              className={`${inputBase} h-9 w-full appearance-none px-3 pr-9`}
            >
              {TARGET_UNITS.map((unit) => (
                <option key={unit.value} value={unit.value}>
                  {`/ ${unit.label}`}
                </option>
              ))}
            </select>
            <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-[9px] size-4 -translate-y-1/2 text-ink-2" />
          </span>
        </div>
        <button
          type="submit"
          formAction={deleteContributor}
          aria-label={`Supprimer ${contributor.displayName}`}
          title="Supprimer ce contributeur"
          className={iconDanger}
        >
          <TrashIcon />
        </button>
      </div>

      {/* Toujours rendus : le nom et les identités doivent partir avec le formulaire même repliés. */}
      <div className={`grid gap-2 sm:grid-cols-4 ${editing ? "pt-3" : "hidden"}`}>
        <EditField id={contributor.id} name="display_name" label="Nom affiché" value={contributor.displayName} placeholder="Félix" />
        <EditField id={contributor.id} name="github_logins" label="Logins GitHub" value={contributor.logins} placeholder="Felixooos" />
        <EditField id={contributor.id} name="author_emails" label="E-mails" value={contributor.emails} placeholder="felix@exemple.fr" />
        <EditField id={contributor.id} name="author_names" label="Noms d'auteur" value={contributor.names} placeholder="Felix H" />
        <p className="text-xs text-muted sm:col-span-4">
          Plusieurs valeurs séparées par des virgules. Les logins servent aussi à rattacher les commits d&apos;un agent via
          l&apos;auteur de la pull request.
        </p>
      </div>
    </form>
  );
}

function EditField({
  id,
  name,
  label,
  value,
  placeholder,
}: {
  id: string;
  name: string;
  label: string;
  value: string;
  placeholder: string;
}) {
  return (
    <div>
      <label htmlFor={`${id}-${name}`} className="text-xs text-ink-2">
        {label}
      </label>
      <input
        id={`${id}-${name}`}
        name={name}
        defaultValue={value}
        placeholder={placeholder}
        onBlur={(e) => submitIfChanged(e.currentTarget)}
        className={`${inputBase} mt-1 h-9 w-full px-3`}
      />
    </div>
  );
}
