/* ==========================================================================
   JobPilot — frontend application (vanilla JS, no build step)

   API (existing, unchanged):
     GET  /api/rank              -> { ranked: [{ job, totalScore, isStrongMatch, hasAnalysis }] }
     GET  /api/jobs/:id/explain  -> { job, match:{ recommendation, categories, matchedSkills }, analysis }
     POST /api/analyze           -> { results: AnalyzeOutcome[] }
     GET  /api/match             -> { profileFound, outcomes: [{kind:'scored'|'skipped'}] }
     POST /api/jobs/fetch        -> { source, created, duplicates }
     POST /api/jobs/ingest       -> { created, duplicates }
     GET  /api/profile           -> profile | 404
     POST /api/profile           -> { id, name, skills }
   ========================================================================== */
'use strict';

/* ---------- 1. API layer ---------- */
async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

/* ---------- 2. State ---------- */
const state = {
  ranked: [],
  profile: null,
  loaded: false,
  expanded: new Set(),
  details: new Map(),
};

/* ---------- 3. Utilities ---------- */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

function relTime(iso) {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.round(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? 'yesterday' : `${d}d ago`;
}

let toastTimer = null;
function toast(message, type = 'ok') {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.toggle('error', type === 'error');
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3600);
}

function setBusy(btn, busy, busyLabel) {
  if (!btn) return;
  if (busy) {
    btn.dataset.label = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="spin">◌</span> ${busyLabel || 'Working…'}`;
  } else {
    btn.disabled = false;
    if (btn.dataset.label) btn.innerHTML = btn.dataset.label;
  }
}

/* ---------- 4. Fit-signal tiers (presentation only) ---------- */
function tierOf(item) {
  if (item.totalScore == null) return 'none';
  if (item.isStrongMatch && item.totalScore >= 80) return 'strong';
  if (item.isStrongMatch) return 'mid';
  return 'low';
}

const TIER_CHIP = {
  strong: 'Strong match',
  mid: 'Potential',
  low: 'Borderline',
  none: 'Unscored',
};

function fitBlock(item) {
  if (item.totalScore == null) {
    return '<div class="fit"><div class="fit-score">—</div><div class="fit-label">Unscored</div></div>';
  }
  const tier = tierOf(item);
  return '<div class="fit fit-' + tier + '">' +
    '<div class="fit-score">' + item.totalScore + '</div>' +
    '<div class="fit-label">' + TIER_CHIP[tier] + '</div>' +
    '</div>';
}

/* ---------- 5. Data loading ---------- */
async function loadRanked() {
  const data = await api('/api/rank');
  state.ranked = data.ranked || [];
}

async function loadProfile() {
  try {
    state.profile = await api('/api/profile');
  } catch (e) {
    state.profile = null;
  }
}

async function refreshAll() {
  await Promise.all([loadRanked(), loadProfile()]);
  state.loaded = true;
}

/* ---------- 6. Actions ---------- */
async function fetchJobs(source) {
  return api('/api/jobs/fetch', { method: 'POST', body: JSON.stringify({ source }) });
}

async function analyzeJobs() {
  return api('/api/analyze', { method: 'POST', body: JSON.stringify({}) });
}

async function matchJobs() {
  return api('/api/match');
}

async function getDetail(jobId) {
  if (state.details.has(jobId)) return state.details.get(jobId);
  const data = await api('/api/jobs/' + jobId + '/explain');
  state.details.set(jobId, data);
  return data;
}

/* ---------- 7. Job card ---------- */
function oppCard(item) {
  var job = item.job;
  var tier = tierOf(item);
  return '<article class="opp-card opp-' + tier + '" data-job-id="' + job.id + '">' +
    fitBlock(item) +
    '<div class="opp-body">' +
      '<h3 class="opp-title">' + escapeHtml(job.title) + '</h3>' +
      '<div class="opp-meta">' + escapeHtml(job.company) + (job.location ? ' · ' + escapeHtml(job.location) : '') + '</div>' +
      '<div class="opp-remote">' + (job.remoteStatus !== 'UNKNOWN' ? job.remoteStatus : '') + '</div>' +
    '</div>' +
    '<div class="opp-actions">' +
      '<button class="btn btn-sm" data-action="explain" data-job-id="' + job.id + '">Why?</button>' +
    '</div>' +
  '</article>';
}

/* ---------- 8. Pipeline stats ---------- */
function pipelineStats() {
  var total = state.ranked.length;
  var scored = state.ranked.filter(function(r) { return r.totalScore != null; }).length;
  var strong = state.ranked.filter(function(r) { return r.isStrongMatch; }).length;
  var analyzed = state.ranked.filter(function(r) { return r.hasAnalysis; }).length;
  var pendingMatch = scored > 0 ? 0 : analyzed;
  return { total: total, scored: scored, strong: strong, analyzed: analyzed, pendingMatch: pendingMatch };
}

/* ---------- 9. Views ---------- */
var view = document.getElementById('view');

function sectionHead(title, count, hint) {
  hint = hint || '';
  return '<div class="section-head"><h2>' + escapeHtml(title) + '</h2>' +
    (count != null ? '<span class="count">' + count + '</span>' : '') +
    (hint ? '<span class="hint">' + escapeHtml(hint) + '</span>' : '') +
  '</div>';
}

function emptyState(title, body, cta) {
  cta = cta || '';
  return '<div class="empty-state"><h3>' + escapeHtml(title) + '</h3>' +
    '<p>' + escapeHtml(body) + '</p>' +
    (cta ? '<div class="empty-cta">' + cta + '</div>' : '') +
  '</div>';
}

async function renderOverview() {
  var scored = state.ranked.filter(function(r) { return r.totalScore != null; });
  var top = scored.slice().sort(function(a, b) { return b.totalScore - a.totalScore; });
  var priority = top.slice(0, 3);
  var rest = top.slice(3, 7);
  var fresh = state.ranked.filter(function(r) { return r.totalScore == null; }).slice(0, 6);
  var borderline = top.filter(function(r) { return !r.isStrongMatch; }).slice(0, 4);
  var s = pipelineStats();
  await Promise.allSettled(priority.map(function(r) { return getDetail(r.job.id); }));
  state.expanded = new Set(priority.map(function(r) { return r.job.id; }));
  var headline;
  if (s.strong > 0) headline = s.strong + ' opportunit' + (s.strong === 1 ? 'y deserves' : 'ies deserve') + ' your attention today.';
  else if (s.scored > 0) headline = 'Your pipeline is scored. Nothing stands out yet — keep discovering.';
  else headline = 'Let’s find out what is worth your time.';
  var html = '<section class="masthead"><div class="kicker"><span class="eyebrow">Today’s briefing</span></div>' +
    '<h1>' + escapeHtml(headline) + '</h1>' +
    '<p class="lede">JobPilot reads every job description, extracts what actually matters, and scores it against your real profile — deterministically, with the reasoning shown.</p></section>';
  if (priority.length) html += '<section class="priority-section">' + sectionHead('Priority opportunities', priority.length, 'top matches') +
    '<div class="opp-grid cols-1">' + priority.map(function(r) { return oppCard(r); }).join('') + '</div></section>';
  if (rest.length) html += '<section>' + sectionHead('Worth a look', rest.length) +
    '<div class="opp-grid cols-2">' + rest.map(function(r) { return oppCard(r); }).join('') + '</div></section>';
  if (fresh.length) html += '<section>' + sectionHead('Recently discovered', fresh.length, 'awaiting analysis') +
    '<div class="opp-grid cols-2">' + fresh.map(function(r) { return oppCard(r); }).join('') + '</div></section>';
  if (borderline.length) html += '<section>' + sectionHead('Potential gaps', borderline.length, 'interesting, but something is missing') +
    '<div class="opp-grid cols-2">' + borderline.map(function(r) { return oppCard(r); }).join('') + '</div></section>';
  if (s.total === 0) html += emptyState('No opportunities yet', 'Fetch jobs from a source or paste a description to begin.', '<a class="btn btn-primary" href="#/discover">Go to Discover</a>');
  view.innerHTML = html;
}


function renderDiscover() {
  var items = state.ranked.slice().sort(function(a, b) {
    return (b.totalScore ?? -1) - (a.totalScore ?? -1) || new Date(b.job.discoveredAt) - new Date(a.job.discoveredAt);
  });
  var html = '<section class="masthead"><div class="kicker"><span class="eyebrow">Discover</span></div>' +
    '<h1>Bring work in. Let JobPilot read it.</h1>' +
    '<p class="lede">Fetch from a source, paste a job description, or sync tracked boards. Every job is normalized, deduplicated and queued for analysis.</p></section>' +
    '<section class="pipeline-panel"><h3>Fetch from source</h3>' +
    '<p class="panel-sub">Pulls live listings, normalizes them and skips duplicates by fingerprint.</p>' +
    '<div class="pipeline-row"><select id="fetch-source" class="select" aria-label="Job source">' +
    '<option value="mock">Mock source (offline demo)</option></select>' +
    '<button class="btn btn-primary" data-action="fetch">Fetch jobs</button></div></section>' +
    '<section class="pipeline-panel"><h3>Paste a job description</h3>' +
    '<p class="panel-sub">Ingest any posting manually. JobPilot extracts requirements and scores it.</p>' +
    '<form id="ingest-form" class="ingest-form">' +
    '<div class="field"><label for="ing-title">Job title</label><input id="ing-title" class="input" required placeholder="Senior Frontend Engineer" /></div>' +
    '<div class="field"><label for="ing-company">Company</label><input id="ing-company" class="input" required placeholder="Acme Inc." /></div>' +
    '<div class="field"><label for="ing-location">Location <span class="opt">(optional)</span></label><input id="ing-location" class="input" placeholder="Remote (India)" /></div>' +
    '<div class="field"><label for="ing-content">Job description</label><textarea id="ing-content" class="textarea" required placeholder="Paste the full job description here…"></textarea></div>' +
    '<button class="btn btn-primary" type="submit">Ingest job</button></form></section>';
  if (items.length) html += '<section>' + sectionHead('Pipeline', items.length, 'everything JobPilot knows about') +
    '<div class="opp-grid cols-2">' + items.map(function(r) { return oppCard(r); }).join('') + '</div></section>';
  view.innerHTML = html;
}


function renderMatches() {
  var scored = state.ranked.filter(function(r) { return r.totalScore != null; }).sort(function(a, b) { return b.totalScore - a.totalScore; });
  var unscored = state.ranked.filter(function(r) { return r.totalScore == null; });
  var s = pipelineStats();
  var emptyMsg;
  if (!state.profile) {
    emptyMsg = emptyState('Nothing scored yet', 'Scores are computed against your profile. Import it first, then run the match.', '<a class="btn btn-primary" href="#/profile">Import profile</a>');
  } else {
    var msg = s.pendingMatch > 0 ? s.pendingMatch + ' analyzed job(s) are waiting to be scored.' : 'Analyze some jobs first, then run the match.';
    emptyMsg = emptyState('Nothing scored yet', msg, '<button class="btn btn-primary" data-action="match">Run match</button>');
  }
  var html = '<section class="masthead"><div class="kicker"><span class="eyebrow">Matches</span></div>' +
    '<h1>Ranked by fit. Explained by design.</h1>' +
    '<p class="lede">Every score is deterministic. Every reason is shown. No black boxes.</p></section>';
  if (scored.length) html += '<section>' + sectionHead('Ranked opportunities', scored.length) +
    '<div class="opp-grid cols-1">' + scored.map(function(r) { return oppCard(r); }).join('') + '</div></section>';
  if (unscored.length) html += '<section>' + sectionHead('Awaiting score', unscored.length) +
    '<div class="opp-grid cols-2">' + unscored.map(function(r) { return oppCard(r); }).join('') + '</div></section>';
  if (scored.length === 0 && unscored.length === 0) html += emptyMsg;
  view.innerHTML = html;
}

function renderSaved() {
  view.innerHTML = '<section class="masthead"><div class="kicker"><span class="eyebrow">Saved</span></div>' +
    '<h1>Your shortlist</h1><p class="lede">Jobs you’ve marked for later. Coming in a future release.</p></section>' +
    emptyState('No saved jobs yet', 'Save opportunities from Overview or Matches to build your shortlist.');
}

function renderApplications() {
  view.innerHTML = '<section class="masthead"><div class="kicker"><span class="eyebrow">Applications</span></div>' +
    '<h1>Track your outreach</h1><p class="lede">Log submissions, interviews, and offers. Coming in a future release.</p></section>' +
    emptyState('No applications tracked yet', 'Application tracking is coming in a future release.');
}

function renderResume() {
  view.innerHTML = '<section class="masthead"><div class="kicker"><span class="eyebrow">Resume</span></div>' +
    '<h1>Tailored to the role</h1><p class="lede">Generate truthful, role-specific resumes from your master profile. Coming in a future release.</p></section>' +
    emptyState('Resume engine coming soon', 'JobPilot will tailor your resume using only facts from your master profile.');
}

function renderProfile() {
  var p = state.profile;
  var html = '<section class="masthead"><div class="kicker"><span class="eyebrow">Profile</span></div>' +
    '<h1>Your master profile</h1><p class="lede">The source of truth for every match. Import your skills, experience, and preferences.</p></section>' +
    '<section class="pipeline-panel"><h3>Import profile</h3>' +
    '<p class="panel-sub">Paste your YAML profile below. This overwrites the current profile.</p>' +
    '<form id="profile-form" class="ingest-form">' +
    '<div class="field"><label for="profile-yaml">Profile YAML</label>' +
    '<textarea id="profile-yaml" class="textarea" rows="12" required placeholder="name: Your Name&#10;headline: …"></textarea></div>' +
    '<button class="btn btn-primary" type="submit">Import profile</button></form></section>';
  if (p) {
    html += '<section class="pipeline-panel"><h3>Current profile</h3><div class="profile-facts">' +
      '<div class="fact"><div class="v">' + escapeHtml(p.name) + '</div><div class="k">Name</div></div>' +
      '<div class="fact"><div class="v">' + escapeHtml(p.headline || '—') + '</div><div class="k">Headline</div></div>' +
      '<div class="fact"><div class="v">' + (p.totalYearsExperience != null ? p.totalYearsExperience + ' yrs' : '—') + '</div><div class="k">Experience</div></div>' +
      '<div class="fact"><div class="v">' + escapeHtml(p.remotePreference || '—') + '</div><div class="k">Work mode</div></div></div>';
    if (p.skills && p.skills.length) {
      html += '<div class="eyebrow" style="margin:14px 0 8px">Skills</div>' +
        '<div class="pill-row">' + p.skills.map(function(s) { return '<span class="pill">' + escapeHtml(s.skillName) + '</span>'; }).join('') + '</div>';
    }
    html += '</section>';
  }
  view.innerHTML = html;
}


/* ---------- 10. Workspace (job detail modal) ---------- */
function renderWorkspace(data) {
  var job = data.job, m = data.match, a = data.analysis;
  var matched = (m.matchedSkills || []).filter(function(s) { return s.matched; });
  var missing = (m.matchedSkills || []).filter(function(s) { return !s.matched; });
  var modal = document.getElementById('modal');
  var wsBody = document.getElementById('ws-body');
  var html = '<div class="ws-section"><div class="ws-eyebrow"><span class="eyebrow">Opportunity analysis</span></div>' +
    '<h1 class="ws-title">' + escapeHtml(job.title) + '</h1>' +
    '<p class="ws-sub">' + escapeHtml(job.company) + (job.location ? ' · ' + escapeHtml(job.location) : '') + '</p></div>' +
    '<div class="ws-section">' + fitBlock({ totalScore: m.totalScore, isStrongMatch: m.isStrongMatch }) +
    (m.recommendation ? '<div class="ws-rec">' + escapeHtml(m.recommendation) + '</div>' : '') + '</div>' +
    '<div class="ws-section"><h3>Match breakdown</h3><div class="breakdown">' +
    (m.categories || []).map(function(c) {
      return '<div class="bd-row"><div class="bd-label">' + escapeHtml(c.label) + '</div>' +
        '<div class="bd-bar"><div class="bd-fill" style="width:' + c.rawScore + '%"></div></div>' +
        '<div class="bd-score">' + c.rawScore + '</div></div>';
    }).join('') + '</div></div>';
  if (matched.length) html += '<div class="ws-section"><h3>Skills you have</h3>' +
    '<div class="pill-row">' + matched.map(function(s) { return '<span class="pill kind-matched">' + escapeHtml(s.skill) + '</span>'; }).join('') + '</div></div>';
  if (missing.length) html += '<div class="ws-section"><h3>Skills missing</h3>' +
    '<div class="pill-row">' + missing.map(function(s) { return '<span class="pill kind-missing">' + escapeHtml(s.skill) + '</span>'; }).join('') + '</div></div>';
  if (a) {
    html += '<div class="ws-section"><h3>What the analysis found</h3><div class="profile-facts">' +
      '<div class="fact"><div class="v">' + (a.experienceYears != null ? a.experienceYears + '+ yrs' : '—') + '</div><div class="k">Experience asked</div></div>' +
      '<div class="fact"><div class="v">' + (a.seniority ? escapeHtml(a.seniority) : '—') + '</div><div class="k">Seniority</div></div>' +
      '<div class="fact"><div class="v">' + (a.remoteStatus ? escapeHtml(a.remoteStatus) : '—') + '</div><div class="k">Work mode</div></div></div>';
    if ((a.requiredSkills || []).length) html += '<div class="eyebrow" style="margin:14px 0 8px">Required skills</div>' +
      '<div class="pill-row">' + a.requiredSkills.map(function(s) { return '<span class="pill">' + escapeHtml(s) + '</span>'; }).join('') + '</div>';
    if ((a.preferredSkills || []).length) html += '<div class="eyebrow" style="margin:14px 0 8px">Preferred skills</div>' +
      '<div class="pill-row">' + a.preferredSkills.map(function(s) { return '<span class="pill kind-PREFERRED">' + escapeHtml(s) + '</span>'; }).join('') + '</div>';
    html += '</div>';
  }
  html += '<div class="ws-section"><h3>Next step</h3><div class="ws-actions">' +
    (job.url ? '<a class="btn btn-primary" href="' + escapeHtml(job.url) + '" target="_blank" rel="noopener">View posting</a>' : '') +
    '<button class="btn btn-ghost" data-close-modal>Back</button></div></div>';
  wsBody.innerHTML = html;
  modal.classList.add('open');
}

/* ---------- 11. Navigation ---------- */
var VIEWS = {
  '/overview': renderOverview, '/discover': renderDiscover, '/matches': renderMatches,
  '/saved': renderSaved, '/applications': renderApplications, '/resume': renderResume, '/profile': renderProfile,
};
function navigateTo(path) {
  var render = VIEWS[path] || renderOverview;
  render().catch(function(e) { toast(e.message, 'error'); });
  document.querySelectorAll('nav a').forEach(function(a) { a.classList.toggle('active', a.getAttribute('href') === '#' + path); });
  window.location.hash = path;
}


/* ---------- 12. Event delegation ---------- */
document.addEventListener('click', async function(e) {
  var target = e.target.closest('[data-action]');
  if (!target) return;
  var action = target.dataset.action;
  var btn = target;
  try {
    if (action === 'fetch') {
      setBusy(btn, true, 'Fetching…');
      var res = await fetchJobs(document.getElementById('fetch-source').value);
      toast('Fetched ' + res.created + ' job(s)');
      await refreshAll();
      navigateTo('/discover');
    } else if (action === 'analyze') {
      setBusy(btn, true, 'Analyzing…');
      var res = await analyzeJobs();
      toast('Analyzed ' + (res.results ? res.results.length : 0) + ' job(s)');
      await refreshAll();
    } else if (action === 'match') {
      setBusy(btn, true, 'Matching…');
      var res = await matchJobs();
      var n = res.outcomes ? res.outcomes.filter(function(o) { return o.kind === 'scored'; }).length : 0;
      toast('Matched ' + n + ' job(s)');
      await refreshAll();
      navigateTo('/matches');
    } else if (action === 'explain') {
      var data = await getDetail(target.dataset.jobId);
      renderWorkspace(data);
    }
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    setBusy(btn, false);
  }
});

document.addEventListener('submit', async function(e) {
  e.preventDefault();
  var form = e.target;
  if (form.id === 'ingest-form') {
    var btn = form.querySelector('button[type="submit"]');
    setBusy(btn, true, 'Ingesting…');
    try {
      var body = {
        title: document.getElementById('ing-title').value,
        company: document.getElementById('ing-company').value,
        location: document.getElementById('ing-location').value || null,
        content: document.getElementById('ing-content').value,
      };
      var res = await api('/api/jobs/ingest', { method: 'POST', body: JSON.stringify(body) });
      toast('Ingested job (' + (res.created ? 'new' : 'duplicate') + ')');
      form.reset();
      await refreshAll();
    } catch (err) { toast(err.message, 'error'); }
    finally { setBusy(btn, false); }
  }
  if (form.id === 'profile-form') {
    var btn = form.querySelector('button[type="submit"]');
    setBusy(btn, true, 'Importing…');
    try {
      var yaml = document.getElementById('profile-yaml').value;
      await api('/api/profile', { method: 'POST', body: JSON.stringify({ yaml: yaml }) });
      toast('Profile imported');
      await refreshAll();
    } catch (err) { toast(err.message, 'error'); }
    finally { setBusy(btn, false); }
  }
});

document.addEventListener('click', function(e) {
  if (e.target.matches('[data-close-modal]') || e.target.matches('#modal')) {
    document.getElementById('modal').classList.remove('open');
  }
});

/* ---------- 13. Router + boot ---------- */
window.addEventListener('hashchange', function() {
  navigateTo(window.location.hash.slice(1) || '/overview');
});
refreshAll().then(function() {
  navigateTo(window.location.hash.slice(1) || '/overview');
}).catch(function(e) { toast(e.message, 'error'); });

