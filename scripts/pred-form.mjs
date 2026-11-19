// The PRED form, checked (content/predictions/form.md; Dinis, 19 Nov 2026 about 03:15 UTC: "The predictions are one
// collection"). Shared by scripts/import-predictions.mjs and scripts/build.mjs. Pure: no files, no network.
// Every line is untrusted: it is checked field by field, unknown fields are refused, and nothing in it is run or followed.
export const LIMITS = { lines: 50_000, bytes: 20 * 1024 * 1024 };
const ID = /^[A-Za-z0-9._-]{1,100}$/;
const CONTROL = /[\u0000-\u001f\u007f-\u009f\u00ad\u200b-\u200f\u2028\u2029\u202a-\u202e\u2060-\u2064\u2066-\u2069\ufeff]/;
const MARKUP = /[[\]<>`]/;
const KINDS = ['forecast', 'warning', 'countdown', 'score', 'expected-date', 'statement'];
const RESULTS = ['held', 'missed', 'gap'];
const iso = (t) => { const n = Date.parse(t); return Number.isNaN(n) ? '' : new Date(n).toISOString(); };
export const realTime = (t) => typeof t === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z$/.test(t) && iso(t).slice(0, 16) + 'Z' === t;
export const realDay = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && iso(`${d}T00:00:00Z`).slice(0, 10) === d;

function text(errs, k, v, max, required = true) {
  if (v === undefined || v === null) { if (required) errs.push(`${k}: required`); return; }
  if (typeof v !== 'string' || !v.trim()) { errs.push(`${k}: must be text`); return; }
  if (v.length > max) errs.push(`${k}: longer than ${max} characters`);
  if (CONTROL.test(v)) errs.push(`${k}: control or direction characters`);
  if (MARKUP.test(v)) errs.push(`${k}: no [ ] < > or backticks`);
}
function https(errs, k, v, host) {
  let u = null;
  if (typeof v === 'string' && v.length <= 500 && !/\s/.test(v)) { try { u = new URL(v); } catch { /* refused below */ } }
  if (!u || u.protocol !== 'https:' || u.username || u.password || u.port) { errs.push(`${k}: must be an https address (no user, password or port), at most 500 characters`); return; }
  // a named public host only: no IP address, no localhost, no single-label name
  if (/^[0-9.]+$|^\[|^localhost$|\.localhost$|\.local$|\.internal$/i.test(u.hostname) || !/\.[a-z]{2,}$/i.test(u.hostname)) errs.push(`${k}: must name a public host`);
  if (host && u.hostname !== host) errs.push(`${k}: must be on ${host}`);
}
function value(errs, k, v) {
  if (v === undefined) return;
  if (!v || typeof v !== 'object' || Array.isArray(v)) { errs.push(`${k}: must be an object`); return; }
  for (const key of Object.keys(v)) if (!['quantity', 'unit', 'value', 'low', 'high', 'probability'].includes(key)) errs.push(`${k}.${key}: not in the form`);
  text(errs, `${k}.quantity`, v.quantity, 40, false); text(errs, `${k}.unit`, v.unit, 20, false);
  for (const n of ['value', 'low', 'high', 'probability']) if (n in v && !(typeof v[n] === 'number' && Number.isFinite(v[n]))) errs.push(`${k}.${n}: must be a number`);
  if ('probability' in v && (v.probability < 0 || v.probability > 1)) errs.push(`${k}.probability: from 0 to 1`);
}
function only(errs, line, keys) { for (const k of Object.keys(line)) if (!keys.includes(k)) errs.push(`${k}: not in the form`); }

// Returns a list of problems with one line ([] if none). site: the host the series belongs to.
export function checkLine(line, site) {
  const errs = [];
  if (!line || typeof line !== 'object' || Array.isArray(line)) return ['not a JSON object'];
  if (line.type === 'prediction') {
    only(errs, line, ['type', 'id', 'site', 'page', 'shown_at', 'said_by', 'source', 'licence', 'kind', 'subject', 'due', 'said', 'value', 'corrects', 'backfilled']);
    if (line.backfilled !== undefined && line.backfilled !== true) errs.push('backfilled: true, or left out');
    if (!ID.test(line.id || '')) errs.push('id: at most 100 of A-Z a-z 0-9 . _ -');
    if (line.site !== site) errs.push(`site: must be ${site}`);
    https(errs, 'page', line.page, site);
    if (!realTime(line.shown_at)) errs.push('shown_at: a real UTC time, YYYY-MM-DDTHH:MMZ');
    text(errs, 'said_by', line.said_by, 80); https(errs, 'source', line.source);
    if (!line.licence || typeof line.licence !== 'object' || Array.isArray(line.licence)) errs.push('licence: must be { "name": ..., "url": ... }');
    else { only(errs, line.licence, ['name', 'url']); text(errs, 'licence.name', line.licence.name, 100); https(errs, 'licence.url', line.licence.url); }
    if (!KINDS.includes(line.kind)) errs.push(`kind: one of ${KINDS.join(', ')}`);
    text(errs, 'subject', line.subject, 120);
    if (!realDay(line.due) && !realTime(line.due)) errs.push('due: a real day (YYYY-MM-DD) or UTC time');
    text(errs, 'said', line.said, 300); value(errs, 'value', line.value);
    if (line.corrects !== undefined && !ID.test(line.corrects)) errs.push('corrects: an id');
  } else if (line.type === 'outcome') {
    only(errs, line, ['type', 'of', 'checked_at', 'result', 'happened', 'value', 'difference', 'evidence', 'gap']);
    if (!ID.test(line.of || '')) errs.push('of: the id of a prediction');
    if (!realTime(line.checked_at)) errs.push('checked_at: a real UTC time, YYYY-MM-DDTHH:MMZ');
    if (!RESULTS.includes(line.result)) errs.push(`result: one of ${RESULTS.join(', ')}`);
    if (line.result === 'gap') {
      text(errs, 'gap', line.gap, 400);
      if (line.happened !== undefined || line.evidence !== undefined) errs.push('a gap has no happened or evidence');
    } else {
      text(errs, 'happened', line.happened, 400);
      if (!Array.isArray(line.evidence) || !line.evidence.length || line.evidence.length > 10) errs.push('evidence: a list of 1 to 10 https addresses');
      else line.evidence.forEach((e, i) => https(errs, `evidence[${i}]`, e));
      if (line.gap !== undefined) errs.push('gap: only on a gap');
    }
    value(errs, 'value', line.value); text(errs, 'difference', line.difference, 40, false);
  } else if (line.type === 'change') {
    // made by the library only: a catalogued prediction came back changed; the first form is kept
    only(errs, line, ['type', 'of', 'seen_at', 'note', 'by']); // also written when a second outcome arrives for one prediction
    if (!ID.test(line.of || '') || !realTime(line.seen_at) || line.by !== 'library.b@PrompTugal.dinis') errs.push('change: of, seen_at and by library.b@');
    text(errs, 'note', line.note, 300);
  } else errs.push('type: "prediction" or "outcome"');
  return errs;
}

// The track record of a series' lines: each prediction counted once, by its first outcome in catalogue order.
export function track(lines) {
  const preds = lines.filter((l) => l.type === 'prediction');
  const last = new Map();
  // the first outcome catalogued counts; a later one for the same prediction is recorded as a change, never a silent flip
  for (const o of lines.filter((l) => l.type === 'outcome')) if (!last.has(o.of)) last.set(o.of, o);
  // A prediction first shown after it was due is a retrospective record: its outcome could be known when it was shown,
  // so it is counted apart and never in the track record (library.b@, 19 Nov 2026, on civic's first file).
  // also retrospective: a line marked backfilled, or one whose first outcome was checked no later than it was first shown
  const retro = (p) => p.backfilled === true || (p.due.length === 10 ? p.shown_at.slice(0, 10) > p.due : p.shown_at > p.due) || (last.has(p.id) && last.get(p.id).checked_at <= p.shown_at);
  const t = { predictions: preds.length, held: 0, missed: 0, gap: 0, open: 0, changed: lines.filter((l) => l.type === 'change').length, retrospective: { predictions: 0, held: 0, missed: 0, gap: 0, open: 0 } };
  for (const p of preds) { const o = last.get(p.id); const b = retro(p) ? t.retrospective : t; if (b !== t) b.predictions++; if (!o) b.open++; else b[o.result]++; }
  t.predictions -= t.retrospective.predictions;
  return t;
}

// Checks over a whole series, repeated in the build (a hand edit must not double-count): ids unique, outcomes of known predictions.
export function checkSeries(lines) {
  const errs = []; const ids = new Set();
  for (const l of lines) if (l.type === 'prediction') { if (ids.has(l.id)) errs.push(`prediction ${l.id} repeated`); ids.add(l.id); }
  for (const l of lines) if ((l.type === 'outcome' || l.type === 'change') && !ids.has(l.of)) errs.push(`${l.type} of ${l.of}, which is not a prediction in the series`);
  return errs;
}
