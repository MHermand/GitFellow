/**
 * Schéma SQLite, par versions successives : `PRAGMA user_version` dit où en est le fichier,
 * chaque entrée ne s'applique qu'une fois. Ajouter une version = ajouter une entrée à la fin.
 */
export const MIGRATIONS: string[] = [
  `
  create table if not exists settings (
    id                    integer primary key check (id = 1),
    pre_minutes           integer not null default 30  check (pre_minutes between 0 and 240),
    gap_minutes           integer not null default 120 check (gap_minutes between 1 and 720),
    post_minutes          integer not null default 30  check (post_minutes between 0 and 240),
    timezone              text    not null default 'UTC',
    locale                text    check (locale in ('fr', 'en')),
    sync_interval_minutes integer not null default 15 check (sync_interval_minutes between 5 and 1440),
    updated_at            text    not null
  );

  create table if not exists repos (
    id                 text primary key,
    owner              text not null,
    name               text not null,
    enabled            integer not null default 1,
    tracked_since      text,
    last_synced_at     text,
    last_sync_error    text,
    last_sync_commits  integer,
    created_at         text not null,
    unique (owner, name)
  );

  create table if not exists contributors (
    id            text primary key,
    display_name  text not null,
    github_logins text not null default '[]',
    author_emails text not null default '[]',
    author_names  text not null default '[]',
    target_hours  real not null default 0 check (target_hours >= 0),
    target_unit   text not null default 'week' check (target_unit in ('day', 'week', 'month')),
    active        integer not null default 1,
    created_at    text not null,
    updated_at    text not null
  );

  create table if not exists commits (
    repo_id          text not null references repos (id) on delete cascade,
    sha              text not null,
    author_name      text,
    author_email     text,
    author_login     text,
    committer_name   text,
    committer_email  text,
    authored_at      text not null,
    committed_at     text not null,
    message          text,
    is_merge         integer not null default 0,
    parents_count    integer not null default 1,
    branches         text not null default '[]',
    pr_number        integer,
    pr_author_login  text,
    pr_checked       integer not null default 0,
    html_url         text,
    synced_at        text not null,
    primary key (repo_id, sha)
  );

  create index if not exists commits_authored_at_idx on commits (authored_at);
  create index if not exists commits_pr_pending_idx on commits (repo_id) where pr_checked = 0;
  `,
];
