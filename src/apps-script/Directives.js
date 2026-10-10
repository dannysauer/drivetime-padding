/**
 * Description directive grammar and parsing. Technical Design section 6.
 *
 * Pure function. Collects warnings rather than failing, so malformed
 * directives can be surfaced on the event card instead of silently ignored.
 */

/**
 * Parses the 6.1 grammar over descriptionToText_(description), never the
 * raw string: Calendar descriptions may be HTML. A line starting with
 * the prefix that matches no production is malformed (6.4): ignored,
 * never an occurrence for last-wins (6.2), and quoted in warnings.
 * Total: never throws (descriptionToText_ is total).
 */
function parseDirectives(description) {
  throw new Error('Not implemented: Technical Design section 6');
}

/**
 * Plain text of a Calendar description (6), in this order: null to '';
 * CRLF/CR to LF; <br> and block-element tags (p, div, li, ul, ol, tr,
 * h1-h6, blockquote, pre, hr) to LF; other tags removed; entities
 * decoded once, after tag removal; U+00A0 to a space. Applied to every
 * description, markup or not.
 *
 * A numeric entity (&#NNN; / &#xHH;) is decoded ONLY when its value is
 * a Unicode scalar value (1..0x10FFFF, not 0xD800..0xDFFF), checked
 * before String.fromCodePoint (which throws RangeError above 0x10FFFF);
 * any other value is an unrecognized entity, left as written. TOTAL:
 * never throws, so plain text such as '&#x110000;' cannot fail the
 * event or block its directives (6, REQ-DIRECTIVE-008).
 *
 * A tag is only 6's tag shape: '<', optional '/', a listed tag name,
 * then '>' or '/>', or whitespace and non-'<'/'>' characters up to the
 * first '>', never across a line break. Anything else is text, so
 * plain-text 'a < b', '<$10 ... ->' and '<pat@example.com>' survive and
 * a directive line between them is still parsed.
 * Private helper (TD 2): called only by parseDirectives; the `_` is
 * part of the documented name and is spelled the same everywhere.
 */
function descriptionToText_(description) {
  throw new Error('Not implemented: Technical Design section 6');
}
