// -----------------------------------------------------------------------------
// Turn the raw answers of the Polestar API into plain values.
//
// The API speaks in enums (`CHARGING_STATUS_V2_CHARGING`,
// `SERVICE_WARNING_REGULAR_MAINTENANCE_ALMOST_TIME_FOR_SERVICE`...) and leaves
// any value it does not know out. Everything below returns `null` for "not
// reported", never a made-up 0: a 0 % battery published by mistake would fire
// every "battery low" scene of the house.
// -----------------------------------------------------------------------------

/** Charging states, as this integration names them. */
export const CHARGING_STATES = {
  CHARGING: 'charging',
  IDLE: 'idle',
  DONE: 'done',
  SCHEDULED: 'scheduled',
  FAULT: 'fault',
  UNKNOWN: 'unknown',
};

/** Service states, from the most to the least urgent. */
export const SERVICE_LEVELS = {
  OVERDUE: 'overdue',
  DUE: 'due',
  SOON: 'soon',
  OK: 'ok',
  UNKNOWN: 'unknown',
};

/** Fluid level states. */
export const FLUID_LEVELS = { OK: 'ok', LOW: 'low', HIGH: 'high', UNKNOWN: 'unknown' };

const toInteger = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : null;
};

const toIsoDate = (timestamp) => {
  const seconds = Number(timestamp?.seconds);
  return Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000).toISOString() : null;
};

/**
 * `CHARGING_STATUS_V2_CHARGING` -> 'charging'. The V2 enum only says idle or
 * charging today, the older one had more states: both are understood.
 */
export function chargingState(raw) {
  const value = String(raw ?? '')
    .toUpperCase()
    .replace(/^CHARGING_STATUS_(V2_)?/, '');
  if (!value || value === 'UNSPECIFIED') {
    return CHARGING_STATES.UNKNOWN;
  }
  if (value.includes('PAUSED')) {
    return CHARGING_STATES.IDLE;
  }
  if (value === 'CHARGING' || value === 'SMART_CHARGING') {
    return CHARGING_STATES.CHARGING;
  }
  if (value === 'DONE') {
    return CHARGING_STATES.DONE;
  }
  if (value === 'SCHEDULED') {
    return CHARGING_STATES.SCHEDULED;
  }
  if (value === 'FAULT' || value === 'ERROR') {
    return CHARGING_STATES.FAULT;
  }
  return CHARGING_STATES.IDLE;
}

/** `SERVICE_WARNING_..._OVERDUE_FOR_SERVICE` -> 'overdue', and so on. */
export function serviceLevel(raw) {
  const value = String(raw ?? '').toUpperCase();
  if (!value || value.endsWith('UNSPECIFIED')) {
    return SERVICE_LEVELS.UNKNOWN;
  }
  if (value.endsWith('NO_WARNING')) {
    return SERVICE_LEVELS.OK;
  }
  if (value.includes('OVERDUE')) {
    return SERVICE_LEVELS.OVERDUE;
  }
  if (value.includes('ALMOST')) {
    return SERVICE_LEVELS.SOON;
  }
  return SERVICE_LEVELS.DUE;
}

/** `..._TOO_LOW` -> 'low'. A level that needs a service counts as low. */
export function fluidLevel(raw) {
  const value = String(raw ?? '').toUpperCase();
  if (!value || value.endsWith('UNSPECIFIED')) {
    return FLUID_LEVELS.UNKNOWN;
  }
  if (value.endsWith('NO_WARNING')) {
    return FLUID_LEVELS.OK;
  }
  if (value.endsWith('TOO_HIGH')) {
    return FLUID_LEVELS.HIGH;
  }
  return FLUID_LEVELS.LOW;
}

const forVin = (list, vin) =>
  (Array.isArray(list) ? list : []).find((item) => item && item.vin === vin) ?? null;

/**
 * The telemetry of ONE car, out of a `carTelematicsV2` answer.
 * @param {object} raw the `carTelematicsV2` object ({ battery, odometer, health })
 * @param {string} vin
 */
export function parseTelematics(raw, vin) {
  const battery = forVin(raw?.battery, vin);
  const odometer = forVin(raw?.odometer, vin);
  const health = forVin(raw?.health, vin);

  const charging = battery ? chargingState(battery.chargingStatusV2) : CHARGING_STATES.UNKNOWN;
  const odometerMeters = toInteger(odometer?.odometerMeters);
  const dates = [battery?.timestamp, odometer?.timestamp, health?.timestamp]
    .map(toIsoDate)
    .filter(Boolean)
    .sort();

  return {
    vin,
    batteryLevel: toInteger(battery?.batteryChargeLevelPercentage),
    rangeKm: toInteger(battery?.estimatedDistanceToEmptyKm),
    chargingState: charging,
    // null when the car did not say: a binary state needs a real answer.
    charging: charging === CHARGING_STATES.UNKNOWN ? null : charging === CHARGING_STATES.CHARGING,
    timeToFullMinutes: toInteger(battery?.estimatedChargingTimeToFullMinutes),
    odometerKm: odometerMeters === null ? null : Math.round(odometerMeters / 1000),
    daysToService: toInteger(health?.daysToService),
    distanceToServiceKm: toInteger(health?.distanceToServiceKm),
    service: health ? serviceLevel(health.serviceWarning) : SERVICE_LEVELS.UNKNOWN,
    fluids: {
      brake: health ? fluidLevel(health.brakeFluidLevelWarning) : FLUID_LEVELS.UNKNOWN,
      coolant: health ? fluidLevel(health.engineCoolantLevelWarning) : FLUID_LEVELS.UNKNOWN,
      oil: health ? fluidLevel(health.oilLevelWarning) : FLUID_LEVELS.UNKNOWN,
    },
    // The most recent report of the car, not the time we asked.
    updatedAt: dates.at(-1) ?? null,
  };
}

/** The car fields of `getConsumerCarsV2` this integration uses. */
export function parseCar(raw) {
  const vin = String(raw?.vin ?? '').toUpperCase();
  return {
    vin,
    model: String(raw?.modelName ?? raw?.content?.model?.name ?? '').trim() || 'Polestar',
    modelYear: raw?.modelYear ? String(raw.modelYear) : null,
    registration: String(raw?.registrationNo ?? '').trim() || null,
  };
}
