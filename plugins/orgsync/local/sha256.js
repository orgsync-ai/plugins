// @ts-check
// SHA-256 (FIPS 180-4) in plain JavaScript over a string's UTF-8 bytes, for the Claude Code mod, which has no Node crypto.
// tests/capture-local.test.ts compares it with node:crypto, lone surrogates included (both encode them as U+FFFD).

const K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
];

/** A string's UTF-8 bytes; a lone surrogate becomes U+FFFD, as TextEncoder and Node do. @param {string} text @returns {number[]} */
export function utf8Bytes(text) {
  /** @type {number[]} */
  const bytes = [];
  for (let index = 0; index < text.length; index += 1) {
    let code = text.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff && index + 1 < text.length) {
      const low = text.charCodeAt(index + 1);
      if (low >= 0xdc00 && low <= 0xdfff) { code = 0x10000 + ((code - 0xd800) << 10) + (low - 0xdc00); index += 1; }
    }
    if (code >= 0xd800 && code <= 0xdfff) code = 0xfffd;
    if (code < 0x80) bytes.push(code);
    else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 63));
    else if (code < 0x10000) bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
    else bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 63), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
  }
  return bytes;
}

/** How many bytes a string takes in UTF-8, without building them; transcript offsets are counted in these. @param {string} text */
export function utf8Length(text) {
  let length = 0;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code < 0x80) length += 1;
    else if (code < 0x800) length += 2;
    else if (code >= 0xd800 && code <= 0xdbff && index + 1 < text.length && text.charCodeAt(index + 1) >= 0xdc00 && text.charCodeAt(index + 1) <= 0xdfff) { length += 4; index += 1; }
    else length += 3;
  }
  return length;
}

/** @param {number} value @param {number} bits */
const rotr = (value, bits) => (value >>> bits) | (value << (32 - bits));

/** The SHA-256 digest of a string's UTF-8 bytes, as 64 lowercase hex characters. @param {string} text */
export function sha256Hex(text) {
  const bytes = utf8Bytes(text), bitLength = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  // The length as a 64-bit big-endian number; strings here stay far below 2^32 bits, so the high word is its quotient.
  const high = Math.floor(bitLength / 0x100000000), low = bitLength >>> 0;
  bytes.push((high >>> 24) & 255, (high >>> 16) & 255, (high >>> 8) & 255, high & 255, (low >>> 24) & 255, (low >>> 16) & 255, (low >>> 8) & 255, low & 255);
  const hash = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const words = new Array(64).fill(0);
  for (let block = 0; block < bytes.length; block += 64) {
    for (let t = 0; t < 16; t += 1) {
      const at = block + t * 4;
      words[t] = ((bytes[at] ?? 0) << 24 | (bytes[at + 1] ?? 0) << 16 | (bytes[at + 2] ?? 0) << 8 | (bytes[at + 3] ?? 0)) >>> 0;
    }
    for (let t = 16; t < 64; t += 1) {
      const w15 = words[t - 15], w2 = words[t - 2];
      const s0 = rotr(w15, 7) ^ rotr(w15, 18) ^ (w15 >>> 3), s1 = rotr(w2, 17) ^ rotr(w2, 19) ^ (w2 >>> 10);
      words[t] = (words[t - 16] + s0 + words[t - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = /** @type {[number, number, number, number, number, number, number, number]} */ (hash.slice());
    for (let t = 0; t < 64; t += 1) {
      const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + (K[t] ?? 0) + words[t]) >>> 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    const next = [a, b, c, d, e, f, g, h];
    for (let index = 0; index < 8; index += 1) hash[index] = ((hash[index] ?? 0) + (next[index] ?? 0)) >>> 0;
  }
  return hash.map(word => word.toString(16).padStart(8, "0")).join("");
}
