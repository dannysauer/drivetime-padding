/**
 * Defaults, persistence, validation, migration. Technical Design section 5.
 *
 * Settings are stored as one JSON document so reads are atomic and migration
 * has a single input.
 */

function defaultSettings_() {
  return {
    schemaVersion: CURRENT_SETTINGS_SCHEMA,
    enabled: true,
    windowDays: 60,
    defaultBufferMinutes: 7,
    eligibility: {
      includeOutOfOffice: true,
      titlePatternEnabled: false,
      titlePattern: '^OOO(?::|\\b)',
      caseSensitive: false,
    },
    origins: {
      default: { type: 'address', value: '' },
      home: { type: 'address', value: '' },
      office: { type: 'address', value: '' },
    },
    workingLocation: {
      enabled: true,
      fallbackToDefault: true,
    },
    generatedEvents: {
      titlePrefix: '[Drivetime Padding]',
    },
  };
}

/**
 * Returns validated, migrated settings.
 *
 * Must deep-merge against defaults rather than Object.assign: a stored
 * document containing a partial nested object would otherwise drop the
 * remaining keys of that object.
 */
function loadSettings() {
  throw new Error('Not implemented: Technical Design section 5');
}

function saveSettings(settings) {
  throw new Error('Not implemented: Technical Design section 5.3');
}

/** Returns all errors, not just the first. Technical Design section 5.3. */
function validateSettings(settings) {
  throw new Error('Not implemented: Technical Design section 5.3');
}

function migrateSettings_(settings) {
  throw new Error('Not implemented: Technical Design section 5.4');
}
