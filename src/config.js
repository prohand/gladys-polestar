// -----------------------------------------------------------------------------
// Integration configuration.
//
// The configuration is filled in by the user in Gladys, from the `config_schema`
// declared in `gladys-assistant-integration.json`. The SDK fetches it
// (`gladys.getConfig()`) and notifies every change (`gladys.onConfigUpdated()`).
//
// This module only provides the defaults and normalizes the received object,
// so the rest of the code never deals with `undefined` or with numbers typed as
// strings in a form.
// -----------------------------------------------------------------------------

// Defaults: they MUST stay consistent with the `default` values of the
// manifest `config_schema` (test/manifest.test.js checks it).
export const DEFAULT_CONFIG = {
  // Polestar ID account (the one of the Polestar app).
  email: '',
  password: '',
  // Optional comma-separated VIN list: empty means every car of the account.
  vins: '',
  // Seconds between two reads of a car. Gladys polls at most once a minute;
  // the slower interval is applied by skipping polls (see createPoller in
  // src/devices/index.js). The Polestar API is a cloud service shared by every
  // owner: no need to hammer it, the car itself only reports every few minutes.
  poll_frequency: 300,
  // Battery level (%) under which the `battery_low` scene trigger fires.
  battery_low_threshold: 20,
};

// Below two minutes the API answers the same values again and again, and a
// burst of requests is the kind of traffic a cloud service blocks.
export const MIN_POLL_FREQUENCY = 120;
export const MAX_POLL_FREQUENCY = 3600;

/**
 * Turn the free text of the `vins` field into a clean list of VINs.
 * Separators: commas, semicolons, spaces or new lines.
 * @param {unknown} raw
 * @returns {string[]}
 */
export function parseVins(raw) {
  return [
    ...new Set(
      String(raw ?? '')
        .split(/[\s,;]+/)
        .map((vin) => vin.trim().toUpperCase())
        .filter(Boolean),
    ),
  ];
}

function clamp(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, number));
}

/**
 * Merge the user config with the defaults.
 * @param {Record<string, unknown>} raw config returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const source = raw ?? {};
  return {
    ...DEFAULT_CONFIG,
    ...source,
    email: String(source.email ?? DEFAULT_CONFIG.email).trim(),
    // A password is never trimmed: a space can be part of it.
    password: String(source.password ?? DEFAULT_CONFIG.password),
    vins: String(source.vins ?? DEFAULT_CONFIG.vins).trim(),
    poll_frequency: clamp(
      source.poll_frequency ?? DEFAULT_CONFIG.poll_frequency,
      MIN_POLL_FREQUENCY,
      MAX_POLL_FREQUENCY,
      DEFAULT_CONFIG.poll_frequency,
    ),
    battery_low_threshold: clamp(
      source.battery_low_threshold ?? DEFAULT_CONFIG.battery_low_threshold,
      1,
      99,
      DEFAULT_CONFIG.battery_low_threshold,
    ),
  };
}

/** Whether the config holds what it takes to sign in. */
export function hasCredentials(config) {
  return Boolean(config.email && config.password);
}
