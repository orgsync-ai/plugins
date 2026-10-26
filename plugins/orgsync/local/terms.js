// @ts-check
// The words a steering match weighs. A port of packages/core's decision-wording-match.ts tokenizer and steering-check.ts
// stop words, kept identical by tests/steering-matcher.test.ts; change both together. Plain ES2022 with no imports, so the
// Claude Code mod and Codex's node hook load it without a build. English only.

const QUESTION_WORDS = ("a an and are about any does for from has have how into its our the their them this that " +
  "what when where which who whom whose why will with would should could can handles handle owns own responsible " +
  "responsibility responsibilities person people someone team company please tell know").split(" ");
const STATUS_WORDS = ["current", "currently", "latest", "now", "still", "decided", "decide", "decision", "decisions", "being",
  "our", "we", "us", "is", "are", "was", "were", "be", "been", "do", "does", "did", "there", "here", "also", "just", "yet"];
const STOP_WORDS = new Set([...QUESTION_WORDS, ...STATUS_WORDS]);

/** English plural and verb-ending folding, so "Plans and prices" meets "plan pricing". Numbers are kept as written.
 * @param {string} word */
export function foldTerm(word) {
  if (/\p{N}/u.test(word)) return word;
  let w = word;
  if (w.length > 4 && w.endsWith("ies")) w = `${w.slice(0, -3)}y`;
  else if (w.length > 3 && w.endsWith("s") && !/(ss|us|is)$/.test(w)) w = w.slice(0, -1);
  if (w.length > 5 && w.endsWith("ing")) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith("ed")) w = w.slice(0, -2);
  if (w.length > 3 && /([b-df-hj-np-tv-z])\1$/.test(w) && !w.endsWith("ss")) w = w.slice(0, -1);
  if (w.length > 3 && w.endsWith("e")) w = w.slice(0, -1);
  return w;
}

const FOLDED_STOP_WORDS = new Set([...STOP_WORDS].map(foldTerm));

/** @param {string} text */
export function wordingTerms(text) {
  return text.normalize("NFKC").toLowerCase().split(/[^\p{L}\p{N}]+/u)
    .filter(word => word && (/\p{N}/u.test(word) || word.length > 2) && !STOP_WORDS.has(word))
    .map(foldTerm).filter(term => !FOLDED_STOP_WORDS.has(term));
}

const STEERING_STOP = new Set(["not", "never", "may", "must", "need", "needs", "require", "required", "requires", "all", "any",
  "every", "each", "per", "over", "under", "above", "below", "more", "less", "than", "only", "get", "got", "make", "use", "used",
  "new", "via", "yes", "okay", "sure", "like", "want", "let", "lets", "please", "thanks", "hello", "dear", "off", "within", "least",
  "most", "until", "after", "before", "out", "cannot", "one", "two", "three"].map(foldTerm));

/** Content terms a steering match weighs: the wording match's terms, minus words that carry no topic.
 * @param {string} text */
export function steeringTerms(text) {
  return wordingTerms(text).filter(term => !STEERING_STOP.has(term));
}
