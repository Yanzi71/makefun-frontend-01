// make.fun's public API: read-only GET requests, open to any origin (CORS).
// The full API is described at https://make.fun/api/openapi.json.
//
// Performance: every answer is revalidated with its ETag. The API binds ETags
// to the minute, so a repeat request inside the same minute answers 304 with
// no body; we keep the last body per path in memory and reuse it on a 304.
// A view therefore costs one small request (often zero bytes) per visit.

const API = 'https://make.fun/api';
const cache = new Map(); // path -> { etag, data }

async function get(path) {
  const hit = cache.get(path);
  const res = await fetch(API + path, hit && hit.etag ? { headers: { 'If-None-Match': hit.etag } } : undefined);
  if (res.status === 304 && hit) return hit.data;
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  const data = await res.json();
  const etag = res.headers.get('ETag');
  if (etag) cache.set(path, { etag, data });
  return data;
}

/** The open bounties: { items: [...] } (activity=times leaves out the activity a board does not show). */
export const getBounties = () => get('/competitions?status=open&activity=times');

/** Bounties of any status, for the board's "ended" filter (fetched lazily, once). */
export const getAllBounties = () => get('/competitions?activity=times');

/** One bounty, by its slug. */
export const getBounty = (slug) => get(`/competitions/${encodeURIComponent(slug)}`);

/** A bounty's leaderboard: { competition, phase, columns, entries: [{ rank, handle, title, values, display }] }. */
export const getLeaderboard = (slug) => get(`/competitions/${encodeURIComponent(slug)}/leaderboard`);

/** An account's public profile: { handle, bio, record, solutions: [...] }. */
export const getProfile = (handle) => get(`/profiles/${encodeURIComponent(handle)}`);
