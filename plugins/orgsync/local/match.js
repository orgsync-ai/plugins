// @ts-check
// Whether a text bears on a decision, and whether it states a fact the decision contradicts. A port of
// packages/core/src/steering-check.ts, kept identical by tests/steering-matcher.test.ts; change both together.
import { foldTerm, steeringTerms } from "./terms.js";

export const STEERING_THRESHOLDS = Object.freeze({ coverage: 0.5, rareTitles: 2, changedDays: 14 });

/** @type {Readonly<Record<string, readonly string[]>>} */
const AREA_WORDS = {
  sales_marketing: ["sales", "sell", "marketing", "lead", "prospect", "campaign", "deal", "discount"],
  finance: ["finance", "invoice", "expense", "budget", "payment", "pay", "reimburse", "spend", "cost"],
  legal: ["legal", "contract", "nda", "compliance", "privacy", "terms", "lawyer"],
  product: ["product", "feature", "roadmap", "release", "beta"],
  hiring_people: ["hire", "hiring", "candidate", "interview", "onboarding", "employee", "staff", "leave", "salary"],
  operations: ["operations", "support", "vendor", "shift", "outage", "ticket"]
};

/** @typedef {{ sourceId: string, title: string, area?: string | null, tagIds?: readonly string[] }} SteeringDecision */
/** @typedef {{ titles: number, frequency: Map<string, number>, common: Set<string> }} SteeringStats */
/** @typedef {{ score: number, rule: "title" | "entity", shared: string[] }} TopicMatch */
/** @typedef {{ value: number, unit: string, limit: "min" | "max" | null, anchors: Set<string>, sentence: string }} Fact */

/** @param {readonly SteeringDecision[]} decisions @param {string} [companyName] @returns {SteeringStats} */
export function steeringStats(decisions, companyName) {
  const frequency = new Map();
  for (const decision of decisions) for (const term of new Set(steeringTerms(decision.title))) frequency.set(term, (frequency.get(term) ?? 0) + 1);
  const common = new Set(steeringTerms(companyName ?? ""));
  for (const [term, count] of frequency) if (count >= 3 && count * 2 > decisions.length) common.add(term);
  return { titles: decisions.length, frequency, common };
}

/** @param {SteeringStats} stats @param {string} term */
const idf = (stats, term) => Math.log((stats.titles + 1) / ((stats.frequency.get(term) ?? 0) + 0.5));
/** @param {string} term */
const isNumber = term => /\p{N}/u.test(term);

/** @param {ReadonlySet<string>} textTerms @param {SteeringDecision} decision @param {SteeringStats} stats @returns {TopicMatch | null} */
export function topicMatch(textTerms, decision, stats) {
  const title = [...new Set(steeringTerms(decision.title))].filter(term => !isNumber(term) && !stats.common.has(term));
  if (!title.length) return null;
  const shared = title.filter(term => textTerms.has(term));
  if (!shared.length) return null;
  const weight = title.reduce((sum, term) => sum + idf(stats, term), 0);
  const score = shared.reduce((sum, term) => sum + idf(stats, term), 0) / weight;
  if (shared.length >= 2 && score >= STEERING_THRESHOLDS.coverage) return { score, rule: "title", shared };
  const rare = shared.filter(term => (stats.frequency.get(term) ?? 0) <= STEERING_THRESHOLDS.rareTitles);
  if (title.length === 1 && rare.length === 1) return { score, rule: "title", shared };
  // The area or a tag must add a word of its own; the shared word itself is no second sign.
  const area = decision.area ? (AREA_WORDS[decision.area] ?? []).map(foldTerm).some(word => textTerms.has(word) && !shared.includes(word)) : false;
  const tag = (decision.tagIds ?? []).some(tagId => tagId.split(/[-_]/).map(foldTerm).some(part => part.length > 2 && textTerms.has(part) && !shared.includes(part)));
  if (rare.length >= 2 || (rare.length === 1 && (area || tag))) return { score, rule: "entity", shared };
  return null;
}

/** @type {Readonly<Record<string, string>>} */
const CURRENCY = { "$": "usd", "€": "eur", "£": "gbp", usd: "usd", dollar: "usd", dollars: "usd", eur: "eur", euro: "eur", euros: "eur",
  gbp: "gbp", pound: "gbp", pounds: "gbp" };
/** @type {Readonly<Record<string, string>>} */
const DURATIONS = { minute: "minute", minutes: "minute", hour: "hour", hours: "hour", day: "day", days: "day", week: "week", weeks: "week",
  month: "month", months: "month", year: "year", years: "year" };
const MIN_BEFORE = /\b(over|above|exceed(?:s|ing)?|more than|greater than|at least|minimum|min|beyond|no less than)\s*$/;
const MAX_BEFORE = /\b(under|below|less than|fewer than|up to|at most|maximum|max|within|no more than)\s*$/;
const MIN_AFTER = /^\s*(or more|and up|and over|and above|plus|minimum)\b/;
const MAX_AFTER = /^\s*(or less|or fewer|or under|or below|max|maximum)\b/;
const NUMBER = /([$€£])?\s?(\d+(?:,\d{3})*(?:\.\d+)?)(?::(\d{2}))?\s?(%|percent\b|am\b|pm\b|k\b)?/gu;
/** A fact is read from at most this much text, and its words from this window around it (B1 load bounds). */
const MAX_FACT_TEXT_CHARS = 20_000, WINDOW_CHARS = 200;
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const DATE = /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b/gu;
const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const WEEKDAY = /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)s?\b/gu;
/** Units whose values can form a span ("9:00-17:00", "December 18 to January 4", "Monday to Friday"). */
const SPANS = new Set(["time", "date", "weekday"]);
/** "The bonus is $1,000, right?" asks to confirm a claim, so it states one. */
const TAG_QUESTION = /(?:,|\s)\s*(right|correct|yes|isn't it|aren't they|isn't that so)\?$/i;

/** Sentences of a text; each keeps its own question mark, so a question is never read as a claim. @param {string} text */
export function sentences(text) {
  return text.normalize("NFKC").split(/(?<=[.!?;])\s+|\n+/u).map(sentence => sentence.trim()).filter(Boolean);
}
/** @param {string} sentence */
const claims = sentence => !sentence.endsWith("?") || TAG_QUESTION.test(sentence);

/** @param {string} lower @param {number} start @param {number} end @param {string} unit */
function anchorsAround(lower, start, end, unit) {
  // Seven words each side, read from a bounded window so a long sentence costs no more than a short one; a word the
  // window cuts in two is dropped.
  const before = lower.slice(Math.max(0, start - WINDOW_CHARS), start).split(/\s+/), after = lower.slice(end, end + WINDOW_CHARS).split(/\s+/);
  if (start > WINDOW_CHARS) before.shift();
  if (end + WINDOW_CHARS < lower.length) after.pop();
  const around = `${before.slice(-7).join(" ")} ${after.slice(0, 7).join(" ")}`;
  return new Set(steeringTerms(around).filter(term => !isNumber(term) && term !== unit && !WEEKDAYS.includes(term) && !MONTHS.some(m => term.startsWith(m))));
}
/** @param {string} lower @param {number} start @param {number} end @returns {"min" | "max" | null} */
function limitAt(lower, start, end) {
  const before = lower.slice(Math.max(0, start - 24), start), after = lower.slice(end);
  return MIN_BEFORE.test(before) || MIN_AFTER.test(after) ? "min" : MAX_BEFORE.test(before) || MAX_AFTER.test(after) ? "max" : null;
}

/** The facts a text states. A question states nothing, unless it only asks to confirm a claim.
 * @param {string} text @param {{ questions?: boolean }} [options] @returns {Fact[]} */
export function textFacts(text, options = {}) {
  /** @type {Fact[]} */
  const facts = [];
  for (const sentence of sentences(text.slice(0, MAX_FACT_TEXT_CHARS))) {
    if (!options.questions && !claims(sentence)) continue;
    const lower = sentence.toLowerCase();
    /** @type {[number, number][]} */
    const dates = [];
    for (const match of lower.matchAll(DATE)) {
      const start = match.index ?? 0, end = start + match[0].length, day = Number(match[2]);
      dates.push([start, end]);
      if (day < 1 || day > 31) continue;
      facts.push({ value: (MONTHS.indexOf((match[1] ?? "").slice(0, 3)) + 1) * 100 + day, unit: "date", limit: null, anchors: anchorsAround(lower, start, end, "date"), sentence });
    }
    for (const match of lower.matchAll(WEEKDAY)) {
      const start = match.index ?? 0, end = start + match[0].length;
      facts.push({ value: WEEKDAYS.indexOf(match[1] ?? "") + 1, unit: "weekday", limit: null, anchors: anchorsAround(lower, start, end, "weekday"), sentence });
    }
    for (const match of lower.matchAll(NUMBER)) {
      const [whole, currency, digits, minutes, suffix] = match;
      const start = (match.index ?? 0) + (whole.length - whole.trimStart().length), end = (match.index ?? 0) + whole.trimEnd().length;
      if (dates.some(([from, to]) => start >= from && start < to)) continue;
      // Part of a longer token (a version 1.2.3, a date 2026-10-21, an id) is not a stated amount; a range's ends are two.
      const before = lower.charAt(start - 1), next = lower.charAt(end);
      if (/[\p{L}\d.]/u.test(before) || (/[-–/]/u.test(before) && !/\d/.test(lower.charAt(start - 2))) ||
          /[\p{L}\d]/u.test(next) || (/[-–/]/u.test(next) && !/[\d$€£]/u.test(lower.charAt(end + 1)))) continue;
      let value = Number((digits ?? "").replace(/,/g, ""));
      const after = /^\s*([\p{L}][\p{L}'-]*)/u.exec(lower.slice(end))?.[1] ?? "";
      /** @type {string | null} */
      let unit = null;
      if (currency) unit = CURRENCY[currency] ?? null;
      else if (minutes !== undefined || suffix === "am" || suffix === "pm") {
        let hours = value;
        if (suffix === "pm" && hours < 12) hours += 12;
        if (suffix === "am" && hours === 12) hours = 0;
        value = hours * 60 + Number(minutes ?? 0); unit = "time";
      } else if (suffix === "%" || suffix === "percent") unit = "pct";
      else if (CURRENCY[after]) unit = CURRENCY[after] ?? null;
      else if (DURATIONS[after]) unit = DURATIONS[after] ?? null;
      else if (after && steeringTerms(after).length && !isNumber(after)) unit = steeringTerms(after)[0] ?? null;
      if (suffix === "k") value *= 1000;
      if (!unit || !Number.isFinite(value)) continue;
      facts.push({ value, unit, limit: limitAt(lower, start, end), anchors: anchorsAround(lower, start, end, unit), sentence });
    }
  }
  return facts;
}

/** A claimed fact against a decision's: same unit and subject, a different value, and a limit only against a limit of the
 * same direction. A single time, date or weekday inside a span the decision states agrees with it.
 * @param {readonly Fact[]} claimed @param {readonly Fact[]} decided @param {ReadonlySet<string>} topic
 * @returns {{ claimed: Fact, decided: Fact } | null} */
export function factConflict(claimed, decided, topic) {
  for (const decision of decided) {
    const same = decided.filter(other => other.unit === decision.unit && other.limit === decision.limit);
    const values = same.map(other => other.value);
    for (const claim of claimed) {
      if (claim.unit !== decision.unit || claim.limit !== decision.limit) continue;
      if (![...claim.anchors].some(term => decision.anchors.has(term) || topic.has(term))) continue;
      const alone = claimed.filter(other => other.unit === claim.unit && other.sentence === claim.sentence).length === 1;
      const agrees = values.includes(claim.value) || (SPANS.has(claim.unit) && alone && new Set(values).size >= 2 &&
        claim.value >= Math.min(...values) && claim.value <= Math.max(...values));
      if (!agrees) return { claimed: claim, decided: decision };
    }
  }
  return null;
}

/** Which matched decision each claimed fact is about. One that repeats a decision's value is about that decision, so it
 * contradicts no other; otherwise it is about the decisions whose titles the words around it cover best.
 * @param {readonly Fact[]} claimed @param {readonly { id: string, title: ReadonlySet<string>, facts: readonly Fact[] }[]} decisions
 * @returns {Map<string, Fact[]>} */
export function assignClaims(claimed, decisions) {
  /** @type {Map<string, Fact[]>} */
  const assigned = new Map(decisions.map(decision => [decision.id, []]));
  for (const claim of claimed) {
    const able = decisions.filter(decision => decision.facts.some(fact => fact.unit === claim.unit && fact.limit === claim.limit));
    if (!able.length || able.some(decision => decision.facts.some(fact => fact.unit === claim.unit && fact.value === claim.value))) continue;
    /** @param {{ title: ReadonlySet<string> }} decision */
    const overlap = decision => [...claim.anchors].filter(term => decision.title.has(term)).length;
    const best = Math.max(...able.map(overlap));
    for (const decision of able) if (overlap(decision) === best) assigned.get(decision.id)?.push(claim);
  }
  return assigned;
}

const NEGATION = /\b(not|no|never|cannot|can't|mustn't|won't|isn't|aren't|don't|doesn't|prohibited|forbidden|banned|disallowed|without|nobody|no one)\b/;
const ASSERTION = /\b(can|may|allowed|allow|permitted|is|are|will|should|ok|okay|fine|let|give|grant|approve|have|has|need|needs|required|requires|must|always|get)\b/;

/** A rule one side states and the other denies, about the same words.
 * @param {string} text @param {string} decisionText @param {readonly string[]} shared */
export function negationConflict(text, decisionText, shared) {
  if (shared.length < 2) return false;
  /** @param {string} sentence */
  const about = sentence => { const terms = new Set(steeringTerms(sentence)); return shared.filter(term => terms.has(term)).length >= 2; };
  const decided = sentences(decisionText).filter(about);
  const claimed = sentences(text).filter(sentence => claims(sentence) && about(sentence) && (ASSERTION.test(sentence.toLowerCase()) || NEGATION.test(sentence.toLowerCase())));
  // Two shared words are not yet the same rule: the claim must also carry at least a third of the decided sentence's words.
  /** @param {string} d @param {string} c */
  const covers = (d, c) => { const said = new Set(steeringTerms(c)), rule = [...new Set(steeringTerms(d))]; return rule.filter(term => said.has(term)).length * 3 >= rule.length; };
  return decided.some(d => claimed.some(c => NEGATION.test(d.toLowerCase()) !== NEGATION.test(c.toLowerCase()) && covers(d, c)));
}
