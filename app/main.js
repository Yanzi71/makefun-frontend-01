// Router + in-place updates for the four surfaces:
//
//   #/                          the bounty board
//   #/bounty/<slug>             one bounty
//   #/bounty/<slug>/leaderboard its leaderboard (paged, 25/page)
//   #/profile/<handle>          an account's public profile
//
// window.__shotReady is false while a page loads and true once its data is
// on screen, so a screenshot script knows when to capture.
// A 30s ticker refreshes only the [data-deadline] countdowns in place —
// no re-fetch, no re-render — until the minute turns and the ETag cache
// revalidates on the next navigation.

import { getAllBounties, getBounties, getBounty, getLeaderboard, getProfile } from './api.js';
import { boardRows, boardShell, bounty, errorBox, leaderboardPage, leaderboardRows, profile } from './views.js';
import { timeLeft } from './format.js';

const app = document.getElementById('app');
const PER_PAGE = 20; // board rows per page
const LB_PAGE = 25; // leaderboard rows per page
let allCache = null; // the full list, fetched lazily for the "ended" filter
let tickTimer = null;

function startTicker() {
  stopTicker();
  tickTimer = setInterval(() => {
    document.querySelectorAll('[data-deadline]').forEach((el) => { el.textContent = timeLeft(el.dataset.deadline); });
  }, 30000);
}

function stopTicker() {
  if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
}

function fail(err) {
  app.innerHTML = errorBox(err && err.message ? `make.fun API: ${err.message}` : 'Could not load data.');
  window.__shotReady = true;
}

/** Board: one fetch, then filter/sort/search update only #rows in place. */
async function showBoard() {
  document.title = 'make.fun bounties';
  let items;
  try {
    items = (await getBounties()).items || [];
  } catch (err) { return fail(err); }
  app.innerHTML = boardShell();
  const rows = document.getElementById('rows');
  const q = document.getElementById('q');
  const f = document.getElementById('f');
  const s = document.getElementById('s');
  const more = document.getElementById('more');
  const count = document.getElementById('count');
  let shown = PER_PAGE;

  function visible() {
    let list = items.slice();
    const query = q.value.trim().toLowerCase();
    if (query) list = list.filter((b) => `${b.title} ${b.summary || ''} ${b.category || ''}`.toLowerCase().includes(query));
    const mode = f.value;
    if (mode === 'soon') list = list.filter((b) => new Date(b.deadline).getTime() - Date.now() < 86400000 && new Date(b.deadline).getTime() > Date.now());
    else if (mode === 'ended') list = (allCache || []).filter((b) => new Date(b.deadline).getTime() <= Date.now());
    else if (mode === 'all') list = (allCache || items).slice();
    else list = list.filter((b) => new Date(b.deadline).getTime() > Date.now());
    const by = s.value;
    list.sort(by === 'pot' ? (a, b) => Number(b.potUsd ?? b.rewardAmount) - Number(a.potUsd ?? a.rewardAmount)
      : by === 'entries' ? (a, b) => (b.submissionCount || 0) - (a.submissionCount || 0)
      : by === 'new' ? (a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0)
      : (a, b) => new Date(a.deadline) - new Date(b.deadline));
    return list;
  }

  function paint() {
    const list = visible();
    rows.innerHTML = boardRows(list.slice(0, shown));
    count.textContent = `Showing ${Math.min(shown, list.length)} of ${list.length}`;
    more.style.display = list.length > shown ? '' : 'none';
  }

  q.addEventListener('input', () => { shown = PER_PAGE; paint(); });
  f.addEventListener('change', async () => {
    shown = PER_PAGE;
    if ((f.value === 'ended' || f.value === 'all') && !allCache) {
      try { allCache = (await getAllBounties()).items || []; } catch { allCache = items; }
    }
    paint();
  });
  s.addEventListener('change', paint);
  more.addEventListener('click', () => { shown += PER_PAGE; paint(); });
  paint();
  window.__shotReady = true;
}

async function showBounty(slug) {
  let b;
  try {
    b = await getBounty(slug);
  } catch (err) { return fail(err); }
  document.title = `${b.title} | make.fun bounties`;
  app.innerHTML = bounty(b);
  window.__shotReady = true;
}

async function showLeaderboard(slug) {
  let lb;
  try {
    lb = await getLeaderboard(slug);
  } catch (err) { return fail(err); }
  const title = (lb.competition && lb.competition.title) || slug;
  document.title = `${title} leaderboard | make.fun bounties`;
  let page = 0;
  const paint = () => { app.innerHTML = leaderboardPage(lb, page, LB_PAGE); wire(); };
  const wire = () => {
    const prev = document.getElementById('prev');
    const next = document.getElementById('next');
    if (prev) prev.addEventListener('click', () => { page -= 1; paint(); });
    if (next) next.addEventListener('click', () => { page += 1; paint(); });
  };
  paint();
  window.__shotReady = true;
}

async function showProfile(handle) {
  let p;
  try {
    p = await getProfile(handle);
  } catch (err) { return fail(err); }
  document.title = `@${p.handle} | make.fun bounties`;
  app.innerHTML = profile(p);
  window.__shotReady = true;
}

async function render() {
  window.__shotReady = false;
  startTicker();
  window.scrollTo(0, 0);
  const hash = location.hash || '#/';
  let m = hash.match(/^#\/bounty\/([^/]+)\/leaderboard\/?$/);
  if (m) return showLeaderboard(decodeURIComponent(m[1]));
  m = hash.match(/^#\/bounty\/([^/]+)\/?$/);
  if (m) return showBounty(decodeURIComponent(m[1]));
  m = hash.match(/^#\/profile\/([^/]+)\/?$/);
  if (m) return showProfile(decodeURIComponent(m[1]));
  return showBoard();
}

window.addEventListener('hashchange', render);
render();
