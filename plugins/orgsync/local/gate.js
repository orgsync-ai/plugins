// @ts-check
// D-195's never-capture gate on the person's side (plan B2 §4.10, layer 2): deterministic, local, and closed on failure. A dropped
// business decision is a missed suggestion; a kept never-capture item would break the promise. Each dropped item names a fixed
// reason word and its index, never its text. The Claude Code mod, the capture worker and the Hermes kit's proxy run the same rules;
// tests/fixtures/capture-gate-g5.json is the labelled set (gate G5).
import { INDIVIDUAL_WORDS, PERSONAL_ATTRIBUTES, TOPICS, foldText } from "./lexicon.js";
import { STEERING_THRESHOLDS, steeringStats, topicMatch } from "./match.js";
import { steeringTerms } from "./terms.js";

export const GATE_VERSION = "gate-1";

/** Credential shapes, identical to packages/core/src/capture-policy.ts `CAPTURE_CREDENTIAL_PATTERNS`, which the server refuses
 * with `capture_sensitive_pattern`. tests/capture-gate-parity.test.ts keeps them identical; change both together. */
export const CREDENTIAL_PATTERNS = Object.freeze([
  /\b(?:sk|pk|rk)[-_](?:live|test|proj|ant)?[-_]?[A-Za-z0-9_-]{16,}/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{30,}\b/,
  /\bxox[abpors]-[A-Za-z0-9-]{10,}/,
  /\bAIza[0-9A-Za-z_-]{35}\b/,
  /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\b(?:password|passwd|pwd|secret|api[_ -]?key|token)\s*[:=]\s*\S{6,}/i,
  /\b[a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:[^\s@]+@[^\s]+/i,
  /\b\d{3}-\d{2}-\d{4}\b/,
  /\b\d{3}[ -]\d{3}[ -]\d{3}\b/,
  /\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){3,7}(?: ?[A-Z0-9]{1,3})?\b/,
  /\b[A-Z0-9_]*(?:API_?KEY|SECRET|TOKEN|PASSW(?:OR)?D)[A-Z0-9_]*\s*[:=]\s*\S{6,}/i,
  /\b(?:github_pat_[A-Za-z0-9_]{22,}|whsec_[A-Za-z0-9+=]{16,}|glpat-[A-Za-z0-9_-]{20,}|npm_[A-Za-z0-9]{30,}|hf_[A-Za-z0-9]{30,}|sbp_[A-Za-z0-9]{30,})/,
  /\bBearer\s+\S{16,}/i,
  /\bhooks\.slack\.com\/services\/[A-Za-z0-9_\/-]{10,}/,
  /\b(?:password|passwd|pwd)\s+(?=\S*[\d!@#$%^&*])\S{6,}/i
]);

/** Whether a run of 13 to 19 digits, spaces or dashes allowed between them, passes the Luhn check, as a card number does.
 * Identical to core's `hasCardNumber`. @param {string} text */
export function hasCardNumber(text) {
  for (const match of text.matchAll(/\b\d(?:[ -]?\d){12,18}\b/g)) {
    const digits = match[0].replace(/\D/g, "");
    let sum = 0;
    for (let index = 0; index < digits.length; index += 1) {
      let digit = Number(digits[digits.length - 1 - index]);
      if (index % 2 === 1) { digit *= 2; if (digit > 9) digit -= 9; }
      sum += digit;
    }
    if (sum % 10 === 0) return true;
  }
  return false;
}

/** Secrets said in words, on the person's side only (the server keeps the shared list above): a password, passphrase or key
 * followed by a value with a digit or symbol, in English or French. */
export const LOCAL_SECRET_PATTERNS = Object.freeze([
  /\b(?:password|passcode|passphrase|pin code|mot de passe|mdp|cl[eé] d'api|cl[eé] secr[eè]te|jeton d'acc[eè]s)(?: is| est| :|:| =|=)\s*(?=\S*[\d!@#$%^&*])\S{6,}/i
]);

/** What `maskSecrets` puts in place of a secret; an item that still carries it is about a secret and is dropped. */
export const MASK = "[secret]";

/** Whether a text carries a credential shape, a card number or a masked secret. @param {string} text */
export const hasCredential = text => text.includes(MASK) || CREDENTIAL_PATTERNS.some(pattern => pattern.test(text)) ||
  LOCAL_SECRET_PATTERNS.some(pattern => pattern.test(text)) || hasCardNumber(text);

/** The contract's limits for a captured item (`CAPTURE_LIMITS`, `CONTRACT_LIMITS.maxTitleChars`) and Q9's per-run cap. */
export const CAPTURED_LIMITS = Object.freeze({ maxTitleChars: 120, maxSummaryChars: 600, maxExcerpts: 3, maxExcerptChars: 500, perRun: 5 });
/** The lowest confidence kept, per extractor; research B8 tunes these. */
export const THRESHOLDS = Object.freeze(/** @type {Record<string, number>} */ ({ "cc-1": 0.7, "codex-1": 0.7 }));
export const DEFAULT_THRESHOLD = 0.7;

export const ITEM_KINDS = Object.freeze(["decision", "rule", "price", "owner", "commitment", "way_of_working", "goal"]);
export const SENSITIVE_LABELS = Object.freeze(["none", "health", "family", "hr", "pay", "union", "legal_advice", "special_category", "credentials", "third_party_personal"]);
export const HELP_AREAS = Object.freeze(["sales_marketing", "finance", "legal", "product", "hiring_people", "operations"]);

/** @typedef {"decision" | "rule" | "price" | "owner" | "commitment" | "way_of_working" | "goal"} ItemKind */
/** An extracted candidate, as `parseExtraction` returns it.
 * @typedef {{ title: string, summary: string, excerpts: string[], kind: ItemKind, area?: string | null, confidence: number, sensitive: string,
 *   decided: "confirmed" | "proposed", scope: "company" | "personal" | "session" }} CaptureItem */
/** @typedef {{ index: number, reason: string }} Dropped */

/** @type {readonly { topic: string, pattern: RegExp }[]} */
const TOPIC_PATTERNS = Object.entries(TOPICS).flatMap(([topic, lists]) => [...lists.en, ...lists.fr].map(source => ({ topic, pattern: new RegExp(source) })));
const ATTRIBUTE_PATTERNS = [...PERSONAL_ATTRIBUTES.en, ...PERSONAL_ATTRIBUTES.fr].map(source => new RegExp(source));
const INDIVIDUAL_PATTERNS = INDIVIDUAL_WORDS.map(source => new RegExp(source));
/** Capitalised words that are not people's names, in English and French. */
const NOT_NAMES = new Set(("I We Our Us You Your They Their The A An This That These Those It Its If When Then Also And But Or So For From To In On At By With " +
  "Monday Tuesday Wednesday Thursday Friday Saturday Sunday January February March April May June July August September October November December " +
  "Jan Feb Mar Apr Jun Jul Aug Sep Sept Oct Nov Dec Q1 Q2 Q3 Q4 OK Okay Yes No Nous Notre Nos Vous Votre Le La Les Un Une Des Ce Cette Ces Et Mais Ou " +
  "Pour Dans Sur Avec Lundi Mardi Mercredi Jeudi Vendredi Samedi Dimanche Janvier Fevrier Mars Avril Mai Juin Juillet Aout Septembre Octobre Novembre Decembre").split(" "));

/** Whether a text names one individual: a personal pronoun, or a capitalised name that is not a sentence's first word.
 * @param {string} text */
export function individualNamed(text) {
  const folded = foldText(text);
  if (INDIVIDUAL_PATTERNS.some(pattern => pattern.test(folded))) return true;
  for (const sentence of text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").split(/(?<=[.!?;:])\s+|\n+/)) {
    const words = sentence.trim().split(/\s+/).map(word => word.replace(/^[("'\u2018\u201c]+|[)"'\u2019\u201d,.;:!?]+$/g, ""));
    for (const [index, word] of words.entries()) {
      const bare = word.replace(/['\u2019]s$/, "");
      // A possessive name may open a sentence ("Sam's address"); any other capitalised word must be inside it.
      if (/^[A-Z][a-z]+$/.test(bare) && !NOT_NAMES.has(bare) && (index > 0 || bare !== word)) return true;
    }
  }
  return false;
}

/** The never-capture topic a text bears on, or null. @param {string} text */
export function sensitiveTopic(text) {
  const folded = foldText(text);
  return TOPIC_PATTERNS.find(({ pattern }) => pattern.test(folded))?.topic ?? null;
}

/** Whether a text pairs one individual with a personal attribute (third-party personal data). @param {string} text */
export function personalAboutIndividual(text) {
  const folded = foldText(text);
  return ATTRIBUTE_PATTERNS.some(pattern => pattern.test(folded)) && individualNamed(text);
}

/** Spacing ignored, nothing else: an excerpt must appear in the redacted text as written. @param {string} text */
const spaced = text => text.normalize("NFC").replace(/\s+/g, " ").trim();
/** Tokens with letters and digits, 12 characters or longer: ids, keys, canaries and paths. @param {string} text */
const opaqueTokens = text => (text.match(/[A-Za-z0-9][A-Za-z0-9_\-./+=:@]{11,}/g) ?? []).map(token => token.replace(/[.,;:)]+$/, ""))
  .filter(token => /\p{L}/u.test(token) && /\d/.test(token));
const GROUNDING_STOP = new Set(("that this with from have will would should could they them their there which what when were been into also only more than then each other " +
  "such some team decided decide decision agreed agree company going using used make made need needs like just about after before over under every " +
  "people because since while where these those your ours will must shall keep kept nous notre avec pour dans sont etre avoir cette elle elles leur " +
  "leurs decide decidee decision equipe entreprise apres avant aussi plus tout tous toute toutes").split(" "));
/** Stems of the content words of a text, for a loose check that a summary speaks of the conversation. @param {string} text */
const stems = text => foldText(text).split(/[^a-z]+/).filter(word => word.length >= 4 && !GROUNDING_STOP.has(word)).map(word => word.slice(0, 5));
/** At least this share of a title and summary's content words must come from the conversation. */
export const GROUNDED_SHARE = 1 / 3;

/** @param {unknown} value @returns {value is CaptureItem} */
function wellFormed(value) {
  const item = /** @type {Record<string, unknown>} */ (value);
  return value !== null && typeof value === "object" && typeof item.title === "string" && typeof item.summary === "string" && Array.isArray(item.excerpts) &&
    item.excerpts.every(excerpt => typeof excerpt === "string") && typeof item.confidence === "number" && Number.isFinite(item.confidence) &&
    ITEM_KINDS.includes(String(item.kind)) && typeof item.sensitive === "string" && (item.area === undefined || item.area === null || HELP_AREAS.includes(String(item.area)));
}

/**
 * Why one item may not leave the machine, as a fixed word, or null when it may. The checks run in a fixed order, cheapest first.
 * @param {unknown} item @param {{ source: string | null | undefined, threshold?: number }} options
 */
export function gateReason(item, options) {
  if (!wellFormed(item)) return "malformed";
  const title = item.title.trim(), summary = item.summary.trim(), excerpts = item.excerpts.map(excerpt => excerpt.trim());
  if (!title || !summary || !excerpts.length || excerpts.some(excerpt => !excerpt)) return "malformed";
  if ([...title].length > CAPTURED_LIMITS.maxTitleChars || [...summary].length > CAPTURED_LIMITS.maxSummaryChars || excerpts.length > CAPTURED_LIMITS.maxExcerpts ||
    excerpts.some(excerpt => [...excerpt].length > CAPTURED_LIMITS.maxExcerptChars)) return "too_large";
  if (item.sensitive !== "none") return "sensitive";
  if (item.decided !== "confirmed") return "not_confirmed";
  if (item.scope !== "company") return "not_company";
  if (!(item.confidence >= (options.threshold ?? DEFAULT_THRESHOLD)) || item.confidence > 1) return "low_confidence";
  const all = [title, summary, ...excerpts].join("\n");
  if (hasCredential(all)) return "credential";
  const topic = sensitiveTopic(all);
  if (topic) return `topic_${topic}`;
  if (personalAboutIndividual(all)) return "third_party_personal";
  // The excerpts quote the redacted text the extractor read, which holds no tool output, so nothing else can be quoted.
  if (typeof options.source !== "string") return "excerpt_not_verbatim";
  const source = spaced(options.source);
  if (excerpts.some(excerpt => !source.includes(spaced(excerpt)))) return "excerpt_not_verbatim";
  // An id, key or canary in the title or summary must come from the conversation too, and most of their words with it.
  if (opaqueTokens(`${title}\n${summary}`).some(token => !source.includes(token))) return "ungrounded";
  const known = new Set(stems(source)), own = stems(`${title} ${summary}`);
  if (own.length >= 3 && own.filter(stem => known.has(stem)).length / own.length < GROUNDED_SHARE) return "ungrounded";
  return null;
}

/** Items that pass every check, and the index and reason of each that does not.
 * @param {readonly unknown[]} items @param {{ source: string | null | undefined, threshold?: number }} options
 * @returns {{ kept: CaptureItem[], dropped: Dropped[] }} */
export function gateItems(items, options) {
  /** @type {CaptureItem[]} */
  const kept = [];
  /** @type {Dropped[]} */
  const dropped = [];
  items.forEach((item, index) => {
    const reason = gateReason(item, options);
    if (reason) dropped.push({ index, reason });
    else kept.push(/** @type {CaptureItem} */ (item));
  });
  return { kept, dropped };
}

/** Case, accents, punctuation and spacing ignored, as core's `captureTitleKey`. @param {string} title */
export const titleKey = title => title.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** Whether a candidate title loosely matches one of the titles, with B1's title matcher run both ways (research B8 fix 1).
 * @param {string} title @param {readonly string[]} titles @param {import("./match.js").SteeringStats} stats */
function looselyMatches(title, titles, stats) {
  const key = titleKey(title), terms = new Set(steeringTerms(title));
  return titles.some((other, index) => {
    if (key && titleKey(other) === key) return true;
    const forward = topicMatch(terms, { sourceId: `t${index}`, title: other }, stats);
    const back = topicMatch(new Set(steeringTerms(other)), { sourceId: "candidate", title }, stats);
    return (forward?.rule === "title" && forward.score >= STEERING_THRESHOLDS.coverage) || (back?.rule === "title" && back.score >= STEERING_THRESHOLDS.coverage);
  });
}

/**
 * Research B8's first fix, the person's side: drop a candidate that matches a current decision title, an item already in the
 * person's queue, an item captured earlier in the session, or an earlier candidate of this run. The server also refuses an
 * exact-title duplicate (`capture_duplicate`).
 * @template {{ title: string }} T
 * @param {readonly T[]} items
 * @param {{ decisionTitles?: readonly string[], queuedTitles?: readonly string[], earlierTitles?: readonly string[] }} known
 * @returns {{ kept: T[], dropped: Dropped[] }}
 */
export function dedupeItems(items, known) {
  const decisions = [...(known.decisionTitles ?? [])], queued = [...(known.queuedTitles ?? [])], earlier = [...(known.earlierTitles ?? [])];
  const everything = [...decisions, ...queued, ...earlier, ...items.map(item => item.title)];
  const stats = steeringStats(everything.map((title, index) => ({ sourceId: `t${index}`, title })));
  /** @type {T[]} */
  const kept = [];
  /** @type {Dropped[]} */
  const dropped = [];
  items.forEach((item, index) => {
    const reason = looselyMatches(item.title, decisions, stats) ? "duplicate_decision" : looselyMatches(item.title, queued, stats) ? "duplicate_queued"
      : looselyMatches(item.title, earlier, stats) ? "duplicate_earlier" : looselyMatches(item.title, kept.map(other => other.title), stats) ? "duplicate_in_run" : null;
    if (reason) dropped.push({ index, reason });
    else kept.push(item);
  });
  return { kept, dropped };
}
