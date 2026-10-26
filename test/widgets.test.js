import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { buildCarDevice, carName } from '../src/devices/car.js';
import { parseTelematics } from '../src/polestar/telemetry.js';
import { buildCarWidget, formatAge, WIDGET_ACTIONS } from '../src/widgets.js';
import { telemetry, VIN_2 } from './helpers/fakePolestar.js';

const gladys = createFakeGladys();
const base = { vin: VIN_2, model: 'Polestar 2', registration: 'AB-123-CD' };
const car = { ...base, name: carName(base) };

const parsed = (overrides) => {
  const entry = telemetry(VIN_2, overrides);
  return parseTelematics(
    { battery: [entry.battery], odometer: [entry.odometer], health: [entry.health] },
    VIN_2,
  );
};

const now = (1_790_000_000 + 600) * 1000;

const CASES = {
  'not configured': { car: null, telemetry: null, configured: false },
  'unknown car': { car: null, telemetry: null, configured: true },
  'waiting for a report': { car, telemetry: null, configured: true },
  idle: { car, telemetry: parsed(), configured: true },
  charging: {
    car,
    telemetry: parsed({
      battery: {
        chargingStatusV2: 'CHARGING_STATUS_V2_CHARGING',
        estimatedChargingTimeToFullMinutes: 135,
      },
    }),
    configured: true,
  },
  'service overdue, oil low': {
    car,
    telemetry: parsed({
      health: {
        serviceWarning: 'SERVICE_WARNING_DISTANCE_DRIVEN_OVERDUE_FOR_SERVICE',
        oilLevelWarning: 'OIL_LEVEL_WARNING_TOO_LOW',
        brakeFluidLevelWarning: 'BRAKE_FLUID_LEVEL_WARNING_TOO_LOW',
        daysToService: -12,
        distanceToServiceKm: -300,
      },
    }),
    configured: true,
  },
};

for (const [name, state] of Object.entries(CASES)) {
  test(`the car widget is rendered exactly as sent: ${name}`, () => {
    // [] = nothing the core would drop, truncate or trim to the content budget.
    assert.deepEqual(validateWidgetContent(buildCarWidget(gladys, { ...state, now })), []);
  });
}

test('every text of the widget is in the four languages', () => {
  const content = buildCarWidget(gladys, { ...CASES['service overdue, oil low'], now });
  const texts = JSON.stringify(content.components);
  for (const match of texts.matchAll(/\{"en":[^{}]*\}/g)) {
    const text = JSON.parse(match[0]);
    assert.deepEqual(Object.keys(text).sort(), ['de', 'en', 'es', 'fr'], match[0]);
  }
});

test('the live tiles reference features the car device publishes', () => {
  const featureIds = new Set(buildCarDevice(gladys, car).features.map((f) => f.external_id));
  const tiles = buildCarWidget(gladys, { ...CASES.idle, now }).components.filter(
    (component) => component.device_feature,
  );
  assert.equal(tiles.length, 3);
  for (const tile of tiles) {
    assert.ok(featureIds.has(tile.device_feature), tile.device_feature);
  }
});

test('the refresh button names the car in its params', () => {
  const button = buildCarWidget(gladys, { ...CASES.idle, now }).components.find(
    (component) => component.type === 'button',
  );
  assert.equal(button.action.key, WIDGET_ACTIONS.REFRESH);
  assert.equal(button.action.params.car, gladys.externalIds('car', VIN_2).device);
});

test('the last report reads as a relative time', () => {
  const age = formatAge(new Date(now - 10 * 60 * 1000).toISOString(), now);
  assert.equal(age.en, '10 minutes ago');
  assert.equal(age.fr, 'il y a 10 minutes');
});
