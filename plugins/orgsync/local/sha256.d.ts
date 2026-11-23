/** A string's UTF-8 bytes; a lone surrogate becomes U+FFFD, as TextEncoder and Node do. @param {string} text @returns {number[]} */
export function utf8Bytes(text: string): number[];
/** How many bytes a string takes in UTF-8, without building them; transcript offsets are counted in these. @param {string} text */
export function utf8Length(text: string): number;
/** The SHA-256 digest of a string's UTF-8 bytes, as 64 lowercase hex characters. @param {string} text */
export function sha256Hex(text: string): string;
