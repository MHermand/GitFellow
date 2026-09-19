/**
 * Cœur du calcul : regroupe des événements horodatés (commits) en sessions de travail.
 *
 * Règle (paramétrable) :
 *  - une session commence `preMinutes` avant son premier événement ;
 *  - deux événements séparés d'au plus `gapMinutes` appartiennent à la même session ;
 *  - une session se termine `postMinutes` après son dernier événement.
 *
 * Fonction pure, sans dépendance : testée dans sessions.test.ts.
 */

export interface ActivityEvent {
  /** Instant de l'événement (date auteur du commit). */
  at: Date;
  sha: string;
  /** "owner/name" */
  repo: string;
  message: string;
  isMerge: boolean;
  url: string | null;
}

export interface SessionParams {
  preMinutes: number;
  gapMinutes: number;
  postMinutes: number;
}

export const DEFAULT_SESSION_PARAMS: SessionParams = {
  preMinutes: 30,
  gapMinutes: 120,
  postMinutes: 30,
};

export interface Session {
  /** Début conventionnel : premier événement − preMinutes. */
  start: Date;
  /** Fin conventionnelle : dernier événement + postMinutes. */
  end: Date;
  firstEvent: Date;
  lastEvent: Date;
  events: ActivityEvent[];
}

const MINUTE = 60_000;

export function computeSessions(
  events: ActivityEvent[],
  params: SessionParams = DEFAULT_SESSION_PARAMS,
): Session[] {
  const sorted = [...events].sort((a, b) => a.at.getTime() - b.at.getTime());
  const gapMs = params.gapMinutes * MINUTE;
  const sessions: Session[] = [];
  let bucket: ActivityEvent[] = [];

  for (const event of sorted) {
    const last = bucket[bucket.length - 1];
    if (last && event.at.getTime() - last.at.getTime() > gapMs) {
      sessions.push(toSession(bucket, params));
      bucket = [];
    }
    bucket.push(event);
  }
  if (bucket.length > 0) sessions.push(toSession(bucket, params));
  return sessions;
}

function toSession(events: ActivityEvent[], params: SessionParams): Session {
  const firstEvent = events[0].at;
  const lastEvent = events[events.length - 1].at;
  return {
    start: new Date(firstEvent.getTime() - params.preMinutes * MINUTE),
    end: new Date(lastEvent.getTime() + params.postMinutes * MINUTE),
    firstEvent,
    lastEvent,
    events,
  };
}

/** Durée conventionnelle (tampons inclus), en minutes. */
export function sessionMinutes(session: Session): number {
  return Math.round((session.end.getTime() - session.start.getTime()) / MINUTE);
}

/** Durée brute entre premier et dernier événement, en minutes. */
export function rawMinutes(session: Session): number {
  return Math.round((session.lastEvent.getTime() - session.firstEvent.getTime()) / MINUTE);
}

export function totalMinutes(sessions: Session[]): number {
  return sessions.reduce((sum, s) => sum + sessionMinutes(s), 0);
}

export function totalRawMinutes(sessions: Session[]): number {
  return sessions.reduce((sum, s) => sum + rawMinutes(s), 0);
}
