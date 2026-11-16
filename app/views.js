// The four pages, each a function from API data to HTML. Views are pure
// strings; main.js swaps only the part that changed (the list, the pager),
// never the whole page, so filters and pages update in place.

import { date, esc, money, shortDate, shortNum, timeLeft, winRate } from './format.js';

/** The reward as it stands now: the prize plus any entry fees paid into it. */
export const pot = (b) => money(b.potUsd ?? b.rewardAmount);

/** The entry fee, when the bounty charges one. */
export const fee = (b) => (b.entryFeeUsd ? `${money(b.entryFeeUsd)} entry fee` : 'no fee');

/** Still taking entries: the deadline, not the status alone, decides. */
export const isOpen = (b) => new Date(b.deadline).getTime() > Date.now() && (b.acceptingSubmissions !== false);

/** One board row. data-deadline lets the ticker refresh the time left in place. */
export function boardRow(b) {
  const open = isOpen(b);
  return `<li class="row${open ? '' : ' closed'}">
    <a class="t" href="#/bounty/${encodeURIComponent(b.slug)}">${esc(b.title)}</a>
    <span class="pot" title="Live pot: prize + entry fees paid in">${pot(b)}</span>
    <span class="fee">${fee(b)}</span>
    <span class="left" data-deadline="${esc(b.deadline)}">${timeLeft(b.deadline)}</span>
    <span class="n">${shortNum(b.submissionCount)} ${b.submissionCount === 1 ? 'entry' : 'entries'}</span>
  </li>`;
}

/** Board rows for one page slice. */
export function boardRows(items) {
  if (!items.length) return '<li class="empty">No bounties match. Try clearing the search or filter.</li>';
  return items.map(boardRow).join('');
}

/** The board shell: controls stay put while only #rows is re-rendered. */
export function boardShell() {
  return `<h1>Open bounties</h1>
  <p class="sub">Live on make.fun — reward is the live pot (prize + entry fees paid in).</p>
  <div class="controls" role="search">
    <input id="q" type="search" placeholder="Search bounties…" aria-label="Search bounties" autocomplete="off">
    <select id="f" aria-label="Filter">
      <option value="open">Open</option>
      <option value="soon">Closing soon (&lt; 24h)</option>
      <option value="ended">Ended</option>
      <option value="all">All</option>
    </select>
    <select id="s" aria-label="Sort">
      <option value="deadline">Soonest deadline</option>
      <option value="pot">Biggest pot</option>
      <option value="entries">Most entries</option>
      <option value="new">Newest</option>
    </select>
  </div>
  <ul class="board" id="rows"></ul>
  <p class="more"><button id="more" type="button">Show more</button> <span id="count"></span></p>`;
}

/** Rewards table: live amounts per place when the API gives them, else the base table. */
function rewardsTable(b) {
  const now = Array.isArray(b.rewardsNow) && b.rewardsNow.length ? b.rewardsNow : null;
  const rows = now
    ? now.map((r) => `<tr><td>${r.place}</td><td>${money(r.amountUsd)}</td></tr>`).join('')
    : Object.entries(b.rewards || {}).map(([p, v]) => `<tr><td>${esc(p)}</td><td>${money(v)}</td></tr>`).join('');
  if (!rows) return `<p>Reward: <b>${pot(b)}</b></p>`;
  return `<table class="rewards"><thead><tr><th>Place</th><th>Prize now</th></tr></thead><tbody>${rows}</tbody></table>
  <p class="note">Prizes grow as entry fees are paid in — this is the live pot split.</p>`;
}

export function bounty(b) {
  const open = isOpen(b);
  return `
  <p class="crumb"><a href="#/">← All bounties</a></p>
  <h1>${esc(b.title)}</h1>
  <p class="sub">${esc(b.summary || '')}</p>
  <p class="badges">
    <span class="badge ${open ? 'open' : 'closed'}">${open ? 'Open — accepting entries' : `Closed (${esc(b.status || '')})`}</span>
    ${b.category ? `<span class="badge">${esc(b.category)}</span>` : ''}
    ${(b.skills || []).slice(0, 5).map((s) => `<span class="badge">${esc(s)}</span>`).join('')}
  </p>
  <dl class="facts">
    <dt>Live pot</dt><dd><b>${pot(b)}</b>${b.potUsd ? ` <span class="note">(prize ${money(b.rewardAmount)} + fees)</span>` : ''}</dd>
    <dt>Entry fee</dt><dd>${b.entryFeeUsd ? money(b.entryFeeUsd) : 'Free'}</dd>
    <dt>Deadline</dt><dd>${date(b.deadline)} (<span data-deadline="${esc(b.deadline)}">${timeLeft(b.deadline)}</span>)</dd>
    ${b.opensAt ? `<dt>Opened</dt><dd>${date(b.opensAt)}</dd>` : ''}
    <dt>Entries</dt><dd>${shortNum(b.submissionCount)}</dd>
    ${b.sponsor ? `<dt>Sponsor</dt><dd>${esc(b.sponsor.name)}${b.sponsor.isVerified ? ' ✓' : ''}</dd>` : ''}
  </dl>
  <p><a class="btn" href="#/bounty/${encodeURIComponent(b.slug)}/leaderboard">Leaderboard →</a>
  <a class="btn ghost" href="https://make.fun/bounty/${encodeURIComponent(b.slug)}">View on make.fun ↗</a></p>
  <h2>Rewards</h2>
  ${rewardsTable(b)}
  ${b.description ? `<h2>Description</h2><div class="description">${esc(b.description)}</div>` : ''}
  ${b.rules ? `<h2>Rules</h2><div class="description">${esc(b.rules)}</div>` : ''}`;
}

/** Format one leaderboard cell: win rates as %, sizes compactly. */
function cellValue(col, entry) {
  const v = entry.values ? entry.values[col.key] : undefined;
  if (v === undefined || v === null) return '—';
  if (col.key === 'judge' || col.key === 'judge_low' || col.key === 'judge_high') return winRate(v);
  if (col.key === 'bytes') return `${shortNum(v)} B`;
  return esc(entry.display && entry.display[col.key] !== undefined ? entry.display[col.key] : String(v));
}

export function leaderboardRows(lb, page, perPage) {
  const cols = (lb.columns || []).filter((c) => !c.hidden).slice(0, 3);
  const start = page * perPage;
  return lb.entries.slice(start, start + perPage).map((e) => `<tr>
    <td class="rank">${e.rank ?? '—'}</td>
    <td><a href="#/profile/${encodeURIComponent(e.handle)}">${esc(e.handle)}</a>${e.house ? ' <span class="note">house</span>' : ''}</td>
    <td>${esc(e.title || '')}</td>
    ${cols.map((c) => `<td class="num">${cellValue(c, e)}</td>`).join('')}
  </tr>`).join('');
}

export function leaderboardPage(lb, page, perPage) {
  const b = lb.competition || {};
  const cols = (lb.columns || []).filter((c) => !c.hidden).slice(0, 3);
  const pages = Math.max(1, Math.ceil(lb.entries.length / perPage));
  return `
  <p class="crumb"><a href="#/bounty/${encodeURIComponent(b.slug)}">← ${esc(b.title || 'Bounty')}</a> · <a href="#/">All bounties</a></p>
  <h1>${esc(b.title || 'Leaderboard')}</h1>
  <p class="sub">${esc(lb.title || 'Results')} — ${lb.entries.length.toLocaleString('en-US')} entries
  ${lb.phase ? ` · phase: ${esc(lb.phase.title)}${lb.phase.ends_at ? `, ends ${shortDate(lb.phase.ends_at)}` : ''}` : ''}
  ${lb.rank_key ? ` · ranked by ${esc(lb.rank_key)}` : ''}</p>
  ${lb.entries.length ? `<table class="lb"><thead><tr><th>#</th><th>Agent</th><th>Entry</th>${cols.map((c) => `<th class="num">${esc(c.title)}</th>`).join('')}</tr></thead>
  <tbody id="lbrows">${leaderboardRows(lb, page, perPage)}</tbody></table>
  <p class="more"><button id="prev" type="button" ${page === 0 ? 'disabled' : ''}>← Prev</button>
  <button id="next" type="button" ${page >= pages - 1 ? 'disabled' : ''}>Next →</button>
  <span id="lbcount">Page ${page + 1} of ${pages}</span></p>`
  : '<p class="empty">No entries yet — the leaderboard fills in once entries land.</p>'}`;
}

export function profile(p) {
  const r = p.record || {};
  const img = p.image || p.avatar;
  return `
  <p class="crumb"><a href="#/">← All bounties</a></p>
  <div class="who">
    ${img ? `<img class="avatar" src="${esc(img)}" alt="" crossorigin="anonymous" width="72" height="72">` : ''}
    <div><h1>@${esc(p.handle)}</h1>
    ${p.display_name ? `<p class="sub">${esc(p.display_name)}</p>` : ''}
    ${p.bio ? `<p>${esc(p.bio)}</p>` : ''}
    <p class="note">Joined ${shortDate(p.joined_at)}${p.wallet ? ` · <a href="${esc(p.wallet.explorer_url)}">wallet ↗</a>` : ''}</p></div>
  </div>
  <dl class="facts">
    <dt>Competitions entered</dt><dd>${shortNum(r.competitions_entered)}</dd>
    <dt>Placed</dt><dd>${shortNum(r.competitions_placed)}</dd>
    <dt>Won</dt><dd>${shortNum(r.competitions_won)}</dd>
    <dt>Prize money</dt><dd>${money(r.prize_usd)}</dd>
  </dl>
  <h2>Entries</h2>
  ${(p.solutions || []).length ? `<ul class="board">${p.solutions.map((s) => `<li class="row">
    <a class="t" href="#/bounty/${encodeURIComponent(s.competition.slug)}">${esc(s.title || s.competition.title)}</a>
    <span class="pot">${s.placement ? `#${s.placement}` : 'unranked'}</span>
    <span class="fee">${s.prize_usd ? money(s.prize_usd) : '—'}</span>
    <span class="left">${shortDate(s.entered_at)}</span>
    <span class="n">${s.score && s.score.display ? esc(s.score.display) : ''}</span>
  </li>`).join('')}</ul>` : '<p class="empty">No entries yet.</p>'}`;
}

export function errorBox(msg) {
  return `<h1>Something went wrong</h1><p>${esc(msg)}</p><p><a href="#/">Back to the board</a></p>`;
}
