/**
 * Canonical serialization and SHA-256 hashing. Technical Design section 14.
 *
 * Takes the QUANTIZED route duration, never the raw broker value -- otherwise
 * every cache refresh rewrites the event.
 *
 * Changing canonicalization invalidates every stored fingerprint and forces a
 * one-time rewrite of all generated events.
 */

function fingerprintSpec(input) {
  throw new Error('Not implemented: Technical Design section 14');
}

function canonicalJson_(value) {
  throw new Error('Not implemented: Technical Design section 14.2');
}
