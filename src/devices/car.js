// -----------------------------------------------------------------------------
// Device type: POLESTAR CAR
//
// One Gladys device per car of the account, keyed on its VIN — the one id
// Polestar gives a car that never changes. Every feature is read-only: the
// Polestar API reports, it does not take orders.
//
// The values are published with `publishChangedStates`: a parked car reports
// the same odometer poll after poll, and the host API accepts 300 states per
// minute, sized for changes, not snapshots. The heartbeat re-sends an unchanged
// value every 30 minutes so it stays recently dated in Gladys.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
  DEVICE_FEATURE_UNITS,
  DEVICE_POLL_FREQUENCIES,
} from '@gladysassistant/integration-sdk';

export const DEVICE_TYPE = 'car';

const HEARTBEAT_MS = 30 * 60 * 1000;

/** Feature keys: part of the external ids, never rename them. */
export const FEATURES = {
  BATTERY_LEVEL: 'battery-level',
  RANGE: 'range',
  CHARGING: 'charging',
  TIME_TO_FULL: 'time-to-full',
  ODOMETER: 'odometer',
  DAYS_TO_SERVICE: 'days-to-service',
  DISTANCE_TO_SERVICE: 'distance-to-service',
};

const C = DEVICE_FEATURE_CATEGORIES;
const T = DEVICE_FEATURE_TYPES;
const U = DEVICE_FEATURE_UNITS;

// Gladys stores min/max as NOT NULL: every feature declares both.
const FEATURE_DEFINITIONS = [
  {
    key: FEATURES.BATTERY_LEVEL,
    name: 'Battery',
    category: C.ELECTRICAL_VEHICLE_BATTERY,
    type: T.ELECTRICAL_VEHICLE_BATTERY.BATTERY_LEVEL,
    unit: U.PERCENT,
    min: 0,
    max: 100,
    value: (t) => t.batteryLevel,
  },
  {
    key: FEATURES.RANGE,
    name: 'Range',
    category: C.ELECTRICAL_VEHICLE_BATTERY,
    type: T.ELECTRICAL_VEHICLE_BATTERY.BATTERY_RANGE_ESTIMATE,
    unit: U.KM,
    min: 0,
    max: 1000,
    value: (t) => t.rangeKm,
  },
  {
    key: FEATURES.CHARGING,
    name: 'Charging',
    category: C.ELECTRICAL_VEHICLE_CHARGE,
    type: T.ELECTRICAL_VEHICLE_CHARGE.CHARGE_ON,
    min: 0,
    max: 1,
    value: (t) => (t.charging === null ? null : t.charging ? 1 : 0),
  },
  {
    key: FEATURES.TIME_TO_FULL,
    name: 'Time to full charge',
    category: C.DURATION,
    type: T.DURATION.INTEGER,
    unit: U.MINUTES,
    min: 0,
    max: 6000,
    value: (t) => t.timeToFullMinutes,
  },
  {
    key: FEATURES.ODOMETER,
    name: 'Odometer',
    category: C.ELECTRICAL_VEHICLE_STATE,
    type: T.ELECTRICAL_VEHICLE_STATE.ODOMETER,
    unit: U.KM,
    min: 0,
    max: 10_000_000,
    value: (t) => t.odometerKm,
  },
  {
    key: FEATURES.DAYS_TO_SERVICE,
    name: 'Days to service',
    category: C.DURATION,
    type: T.DURATION.INTEGER,
    unit: U.DAYS,
    // Negative once the service is overdue.
    min: -3650,
    max: 3650,
    value: (t) => t.daysToService,
  },
  {
    key: FEATURES.DISTANCE_TO_SERVICE,
    name: 'Distance to service',
    // The distance category has no type of its own: the generic sensor one.
    category: C.DISTANCE_SENSOR,
    type: T.SENSOR.INTEGER,
    unit: U.KM,
    min: -100_000,
    max: 100_000,
    value: (t) => t.distanceToServiceKm,
  },
];

export function carIds(gladys, vin) {
  return gladys.externalIds(DEVICE_TYPE, vin);
}

export function carExternalId(gladys, vin) {
  return carIds(gladys, vin).device;
}

/** "Polestar 2 (AB-123-CD)", the VIN end when there is no plate. */
export function carName(car) {
  return `${car.model} (${car.registration ?? car.vin.slice(-6)})`;
}

/**
 * The discovery payload of one car.
 * @param {object} gladys
 * @param {{ vin: string, model: string, registration: string|null }} car
 */
export function buildCarDevice(gladys, car) {
  const ids = carIds(gladys, car.vin);
  return {
    name: carName(car),
    external_id: ids.device,
    // Gladys calls onPoll for a device published with a `poll_frequency` (ms,
    // one of DEVICE_POLL_FREQUENCIES, or the whole list is refused). A minute
    // is the slowest pace it knows: the user's own interval is applied by the
    // poller (src/devices/index.js). `should_poll` stays explicit for the
    // older cores, which only poll with both fields.
    should_poll: true,
    poll_frequency: DEVICE_POLL_FREQUENCIES.EVERY_MINUTES,
    features: FEATURE_DEFINITIONS.map((definition) => ({
      name: definition.name,
      external_id: ids.feature(definition.key),
      category: definition.category,
      type: definition.type,
      ...(definition.unit ? { unit: definition.unit } : {}),
      min: definition.min,
      max: definition.max,
      read_only: true,
      has_feedback: false,
      keep_history: true,
    })),
  };
}

/**
 * The states of one car, the values the car did not report left out.
 * @returns {{ device_feature_external_id: string, state: number }[]}
 */
export function carStates(gladys, vin, telemetry) {
  const ids = carIds(gladys, vin);
  return FEATURE_DEFINITIONS.map((definition) => ({
    device_feature_external_id: ids.feature(definition.key),
    state: definition.value(telemetry),
  })).filter(({ state }) => typeof state === 'number' && Number.isFinite(state));
}

/** Publish the states of one car, only those that changed. */
export async function publishCarStates(gladys, vin, telemetry) {
  const states = carStates(gladys, vin, telemetry);
  if (states.length > 0) {
    await gladys.publishChangedStates(states, { heartbeat: HEARTBEAT_MS });
  }
  return states.length;
}
