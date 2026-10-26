import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  chargingState,
  fluidLevel,
  parseCar,
  parseTelematics,
  serviceLevel,
} from '../src/polestar/telemetry.js';
import { telemetry, VIN_2, VIN_4 } from './helpers/fakePolestar.js';

const asApi = (...entries) => ({
  battery: entries.map((entry) => entry.battery),
  odometer: entries.map((entry) => entry.odometer),
  health: entries.map((entry) => entry.health),
});

test('charging states: V2 and older enums', () => {
  assert.equal(chargingState('CHARGING_STATUS_V2_CHARGING'), 'charging');
  assert.equal(chargingState('CHARGING_STATUS_V2_IDLE'), 'idle');
  assert.equal(chargingState('CHARGING_STATUS_SMART_CHARGING'), 'charging');
  assert.equal(chargingState('CHARGING_STATUS_SMART_CHARGING_PAUSED'), 'idle');
  assert.equal(chargingState('CHARGING_STATUS_DONE'), 'done');
  assert.equal(chargingState('CHARGING_STATUS_SCHEDULED'), 'scheduled');
  assert.equal(chargingState('CHARGING_STATUS_FAULT'), 'fault');
  assert.equal(chargingState('CHARGING_STATUS_V2_UNSPECIFIED'), 'unknown');
  assert.equal(chargingState(undefined), 'unknown');
});

test('service levels, from the warning enum', () => {
  assert.equal(serviceLevel('SERVICE_WARNING_NO_WARNING'), 'ok');
  assert.equal(serviceLevel('SERVICE_WARNING_REGULAR_MAINTENANCE_ALMOST_TIME_FOR_SERVICE'), 'soon');
  assert.equal(serviceLevel('SERVICE_WARNING_DISTANCE_DRIVEN_TIME_FOR_SERVICE'), 'due');
  assert.equal(serviceLevel('SERVICE_WARNING_SERVICE_REQUIRED'), 'due');
  assert.equal(serviceLevel('SERVICE_WARNING_REGULAR_MAINTENANCE_OVERDUE_FOR_SERVICE'), 'overdue');
  assert.equal(serviceLevel('SERVICE_WARNING_UNSPECIFIED'), 'unknown');
});

test('fluid levels', () => {
  assert.equal(fluidLevel('OIL_LEVEL_WARNING_NO_WARNING'), 'ok');
  assert.equal(fluidLevel('OIL_LEVEL_WARNING_TOO_LOW'), 'low');
  assert.equal(fluidLevel('OIL_LEVEL_WARNING_TOO_HIGH'), 'high');
  assert.equal(fluidLevel('OIL_LEVEL_WARNING_SERVICE_REQUIRED'), 'low');
  assert.equal(fluidLevel(null), 'unknown');
});

test('the telemetry of the asked car only', () => {
  const raw = asApi(
    telemetry(VIN_4, { battery: { batteryChargeLevelPercentage: 10 } }),
    telemetry(VIN_2, {
      battery: {
        chargingStatusV2: 'CHARGING_STATUS_V2_CHARGING',
        estimatedChargingTimeToFullMinutes: 95,
      },
    }),
  );
  const parsed = parseTelematics(raw, VIN_2);
  assert.equal(parsed.batteryLevel, 64);
  assert.equal(parsed.charging, true);
  assert.equal(parsed.timeToFullMinutes, 95);
  assert.equal(parsed.rangeKm, 280);
  assert.equal(parsed.odometerKm, 12_346);
  assert.equal(parsed.service, 'ok');
  assert.equal(parsed.updatedAt, new Date(1_790_000_000 * 1000).toISOString());
});

test('what the car did not report is null, never 0', () => {
  const parsed = parseTelematics({ battery: [], odometer: [], health: [] }, VIN_2);
  assert.equal(parsed.batteryLevel, null);
  assert.equal(parsed.rangeKm, null);
  assert.equal(parsed.charging, null);
  assert.equal(parsed.odometerKm, null);
  assert.equal(parsed.service, 'unknown');
  assert.equal(parsed.updatedAt, null);
});

test('a car without a model name or a plate still has a name', () => {
  assert.deepEqual(parseCar({ vin: 'lpsabc' }), {
    vin: 'LPSABC',
    model: 'Polestar',
    modelYear: null,
    registration: null,
  });
});
