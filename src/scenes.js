// -----------------------------------------------------------------------------
// Scene triggers and scene actions (SDK v0.14+, Gladys 5.1+).
//
// TRIGGERS say "this happened": the integration compares each new reading of a
// car with the previous one and fires one event per transition — never one
// per poll. The very first reading after a start only sets the memory: a
// restart of Gladys must not announce "charging started" for a car that has
// been charging for an hour.
//
// ACTIONS are operations a scene author places in a scene. `refresh_car`
// reads a car now and returns its values as outputs, so the following actions
// can use them ("if the battery is under 50 %, send me a message").
//
// Keys, fields, variables and outputs are stored in the users' scenes: never
// rename them (test/manifest.test.js ties them to the manifest).
// -----------------------------------------------------------------------------

import { CHARGING_STATES, SERVICE_LEVELS } from './polestar/telemetry.js';

export const SCENE_TRIGGERS = {
  CHARGING_STARTED: 'charging_started',
  CHARGING_STOPPED: 'charging_stopped',
  BATTERY_LOW: 'battery_low',
  SERVICE_DUE: 'service_due',
};

export const SCENE_ACTIONS = {
  REFRESH_CAR: 'refresh_car',
};

// Service levels that call for a garage visit, the least urgent first.
const SERVICE_ORDER = [
  SERVICE_LEVELS.OK,
  SERVICE_LEVELS.SOON,
  SERVICE_LEVELS.DUE,
  SERVICE_LEVELS.OVERDUE,
];

/**
 * What the trigger memory keeps of a reading. Values the car did not report
 * keep the previous ones: a reading without battery data is not a transition.
 */
function remember(previous, telemetry, config) {
  const below =
    telemetry.batteryLevel === null
      ? previous?.below
      : telemetry.batteryLevel < config.battery_low_threshold;
  const service =
    telemetry.service === SERVICE_LEVELS.UNKNOWN ? previous?.service : telemetry.service;
  return {
    charging: telemetry.charging === null ? previous?.charging : telemetry.charging,
    below,
    service,
  };
}

/**
 * The scene events one new reading of a car fires.
 *
 * @param {object|undefined} previous the trigger memory of this car (undefined: first reading)
 * @param {object} telemetry the new reading (src/polestar/telemetry.js)
 * @param {object} config normalized configuration (battery_low_threshold)
 * @returns {{ memory: object, events: { key: string, data: object }[] }}
 *   `data` without the `car` key, which the caller adds
 */
export function detectSceneEvents(previous, telemetry, config) {
  const memory = remember(previous, telemetry, config);
  const events = [];
  if (!previous) {
    return { memory, events };
  }

  const battery = {
    battery_level: telemetry.batteryLevel,
    range_km: telemetry.rangeKm,
  };

  if (previous.charging === false && memory.charging === true) {
    events.push({ key: SCENE_TRIGGERS.CHARGING_STARTED, data: battery });
  }
  if (previous.charging === true && memory.charging === false) {
    events.push({
      key: SCENE_TRIGGERS.CHARGING_STOPPED,
      // Done (target reached) or interrupted (unplugged, scheduled stop).
      data: { ...battery, completed: telemetry.chargingState === CHARGING_STATES.DONE },
    });
  }
  if (previous.below === false && memory.below === true) {
    events.push({
      key: SCENE_TRIGGERS.BATTERY_LOW,
      data: { ...battery, threshold: config.battery_low_threshold },
    });
  }
  // Fired when the service gets MORE urgent: soon -> due -> overdue.
  if (
    previous.service !== undefined &&
    memory.service !== undefined &&
    SERVICE_ORDER.indexOf(memory.service) > SERVICE_ORDER.indexOf(previous.service) &&
    memory.service !== SERVICE_LEVELS.OK
  ) {
    events.push({
      key: SCENE_TRIGGERS.SERVICE_DUE,
      data: {
        level: memory.service,
        days_to_service: telemetry.daysToService,
        distance_to_service_km: telemetry.distanceToServiceKm,
      },
    });
  }
  return { memory, events };
}

/**
 * The outputs of the `refresh_car` action, as the manifest declares them.
 * Scalars only; a value the car did not report is null.
 */
export function refreshOutputs(telemetry) {
  return {
    battery_level: telemetry.batteryLevel,
    range_km: telemetry.rangeKm,
    charging: telemetry.charging,
    odometer_km: telemetry.odometerKm,
    service: telemetry.service,
  };
}
