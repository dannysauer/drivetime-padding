/**
 * Stable application error codes. Technical Design section 18.
 *
 * ROUTE_TOO_LONG and ROUTE_BUDGET_EXCEEDED are planning failures, not
 * ineligibility: they must preserve existing generated events.
 */

const ERROR_CODES = {
  INVALID_SETTINGS: 'INVALID_SETTINGS',
  MISSING_DEFAULT_ORIGIN: 'MISSING_DEFAULT_ORIGIN',
  INVALID_TITLE_PATTERN: 'INVALID_TITLE_PATTERN',

  CALENDAR_READ_FAILED: 'CALENDAR_READ_FAILED',
  CALENDAR_WRITE_FAILED: 'CALENDAR_WRITE_FAILED',
  CALENDAR_EVENT_INVALID: 'CALENDAR_EVENT_INVALID',

  INVALID_ORIGIN: 'INVALID_ORIGIN',
  INVALID_DESTINATION: 'INVALID_DESTINATION',
  NO_ROUTE: 'NO_ROUTE',
  ROUTE_TOO_LONG: 'ROUTE_TOO_LONG',
  BROKER_AUTH_FAILED: 'BROKER_AUTH_FAILED',
  BROKER_RATE_LIMITED: 'BROKER_RATE_LIMITED',
  BROKER_UNAVAILABLE: 'BROKER_UNAVAILABLE',
  BROKER_PROTOCOL_ERROR: 'BROKER_PROTOCOL_ERROR',

  LOCK_CONTENTION: 'LOCK_CONTENTION',
  EXECUTION_BUDGET_EXCEEDED: 'EXECUTION_BUDGET_EXCEEDED',
  ROUTE_BUDGET_EXCEEDED: 'ROUTE_BUDGET_EXCEEDED',
  UNEXPECTED_ERROR: 'UNEXPECTED_ERROR',

  // Non-fatal warnings: surface in ReconciliationDiagnostics.warnings
  // (Technical Design section 4.11), never fail the run.
  WORKING_LOCATION_UNAVAILABLE: 'WORKING_LOCATION_UNAVAILABLE',
  // Directive named an unconfigured home/office origin; resolution fell
  // back to default. Recorded by the engine, not the resolver (10.2).
  DIRECTIVE_ORIGIN_UNCONFIGURED: 'DIRECTIVE_ORIGIN_UNCONFIGURED',
  // Hourly diagnostic-spend write threw in the engine finally; recorded,
  // never rethrown -- accounting must not cost the run its result.
  DIAGNOSTIC_SPEND_RECORD_FAILED: 'DIAGNOSTIC_SPEND_RECORD_FAILED',
};
