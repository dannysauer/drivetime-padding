/**
 * Shared constants.
 *
 * Values here are decided, not placeholders. See docs/adrs/ for the reasoning
 * behind MAX_TRAVEL_MINUTES (0012), the route cache (0011), and quantization.
 */

// Settings bounds. Technical Design section 5.3.
const MIN_WINDOW_DAYS = 7;
const MAX_WINDOW_DAYS = 180;
const MAX_BUFFER_MINUTES = 120;

// Maximum supported one-way travel. ADR 0012, REQ-TIME-012.
// Also bounds the observation range, so raising it widens every read.
const MAX_TRAVEL_MINUTES = 360;

// Longest timed source event we will plan. ADR 0012, REQ-TIME-014.
// Bounds how far past planEnd a return block can land. Without it the
// observation range has no finite upper bound.
const MAX_SOURCE_DURATION_MINUTES = 1440;

// Furthest a companion event can sit from its source, in either direction.
// Derived, not chosen. Technical Design section 7.2.
const COMPANION_SPAN_MINUTES = MAX_TRAVEL_MINUTES + MAX_BUFFER_MINUTES;
const RECONCILIATION_LOOKBACK_MINUTES = COMPANION_SPAN_MINUTES;

// Route plan cache. ADR 0011, Technical Design section 13.3.
const ROUTE_CACHE_MAX_AGE_HOURS = 24;
const ROUTE_GRANULARITY_SECONDS = 300;
const MAX_ROUTE_CALLS_PER_RUN = 60;
const MAX_CONSECUTIVE_CONTINUATIONS = 10;
const DIAGNOSTIC_ROUTE_CALLS_PER_HOUR = 20;

// Storage keys.
const SETTINGS_KEY = 'dtp.settings';
const LAST_RUN_KEY = 'dtp.lastRun';
const CURRENT_SETTINGS_SCHEMA = 1;

// Generated-event metadata. ADR 0009 -- this property is the deletion-safety
// boundary. Never identify a managed event by title.
const GENERATED_FLAG_KEY = 'dtp';
const GENERATED_FLAG_VALUE = '1';
