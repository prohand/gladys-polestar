import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeConfig } from '../src/config.js';
import { detectSceneEvents, refreshOutputs, SCENE_TRIGGERS } from '../src/scenes.js';
import { parseTelematics } from '../src/polestar/telemetry.js';
import { telemetry, VIN_2 } from './helpers/fakePolestar.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const config = normalizeConfig({ battery_low_threshold: 20 });

const reading = (overrides) =>
  parseTelematics(
    (({ battery, odometer, health }) => ({
      battery: [battery],
      odometer: [odometer],
      health: [health],
    }))(telemetry(VIN_2, overrides)),
    VIN_2,
  );

/** Feed readings one after the other, collect the events. */
function run(...readings) {
  let memory;
  const events = [];
  for (const entry of readings) {
    const result = detectSceneEvents(memory, entry, config);
    memory = result.memory;
    events.push(...result.events);
  }
  return events;
}

const charging = (level) =>
  reading({
    battery: {
      chargingStatusV2: 'CHARGING_STATUS_V2_CHARGING',
      batteryChargeLevelPercentage: level,
    },
  });
const idle = (level) => reading({ battery: { batteryChargeLevelPercentage: level } });

test('the first reading after a start fires nothing', () => {
  assert.deepEqual(run(charging(5)), []);
});

test('one event per charging transition, none per poll', () => {
  const events = run(idle(40), charging(41), charging(50), charging(60), idle(80), idle(80));
  assert.deepEqual(
    events.map((event) => event.key),
    [SCENE_TRIGGERS.CHARGING_STARTED, SCENE_TRIGGERS.CHARGING_STOPPED],
  );
  assert.equal(events[0].data.battery_level, 41);
  assert.equal(events[1].data.battery_level, 80);
  assert.equal(events[1].data.completed, false);
});

test('a complete charge says so', () => {
  const done = reading({ battery: { chargingStatusV2: 'CHARGING_STATUS_DONE' } });
  const [event] = run(charging(70), done);
  assert.equal(event.key, SCENE_TRIGGERS.CHARGING_STOPPED);
  assert.equal(event.data.completed, true);
});

test('battery low fires once when the level crosses the threshold', () => {
  const events = run(idle(25), idle(21), idle(19), idle(15), idle(30), idle(18));
  const low = events.filter((event) => event.key === SCENE_TRIGGERS.BATTERY_LOW);
  assert.deepEqual(
    low.map((event) => event.data.battery_level),
    [19, 18],
  );
  assert.equal(low[0].data.threshold, 20);
});

test('a reading without battery data is not a transition', () => {
  const empty = parseTelematics({ battery: [], odometer: [], health: [] }, VIN_2);
  assert.deepEqual(run(idle(25), empty, idle(25)), []);
  assert.deepEqual(run(charging(25), empty, charging(26)), []);
});

test('service_due fires when the service gets more urgent', () => {
  const service = (warning) => reading({ health: { serviceWarning: warning, daysToService: 3 } });
  const events = run(
    service('SERVICE_WARNING_NO_WARNING'),
    service('SERVICE_WARNING_REGULAR_MAINTENANCE_ALMOST_TIME_FOR_SERVICE'),
    service('SERVICE_WARNING_REGULAR_MAINTENANCE_ALMOST_TIME_FOR_SERVICE'),
    service('SERVICE_WARNING_REGULAR_MAINTENANCE_OVERDUE_FOR_SERVICE'),
    service('SERVICE_WARNING_NO_WARNING'),
  );
  assert.deepEqual(
    events.map((event) => event.data.level),
    ['soon', 'overdue'],
  );
  assert.equal(events[0].data.days_to_service, 3);
});

test('every event only carries keys its trigger declares, as primitives', () => {
  const service = reading({
    health: { serviceWarning: 'SERVICE_WARNING_SERVICE_REQUIRED' },
    battery: { batteryChargeLevelPercentage: 10 },
  });
  const events = run(charging(30), service);
  assert.deepEqual(events.map((event) => event.key).sort(), [
    SCENE_TRIGGERS.BATTERY_LOW,
    SCENE_TRIGGERS.CHARGING_STOPPED,
    SCENE_TRIGGERS.SERVICE_DUE,
  ]);
  for (const { key, data } of events) {
    const trigger = manifest.scene_triggers.find((entry) => entry.key === key);
    const declared = [...trigger.fields, ...trigger.variables].map((entry) => entry.key);
    // `car` and `car_name` are added by the integration when it publishes.
    for (const [name, value] of Object.entries({ car: 'x', car_name: 'x', ...data })) {
      assert.ok(declared.includes(name), `${key}: data.${name} is not declared`);
      assert.ok(value === null || typeof value !== 'object', `${key}: data.${name}`);
    }
  }
  const level = manifest.scene_triggers
    .find((entry) => entry.key === SCENE_TRIGGERS.SERVICE_DUE)
    .fields.find((field) => field.key === 'level')
    .options.map((option) => option.value);
  assert.ok(level.includes(events.find((e) => e.key === SCENE_TRIGGERS.SERVICE_DUE).data.level));
});

test('refresh_car outputs are the declared ones, scalars only', () => {
  const outputs = refreshOutputs(idle(55));
  const declared = manifest.scene_actions
    .find((action) => action.key === 'refresh_car')
    .outputs.map((output) => output.key);
  assert.deepEqual(Object.keys(outputs).sort(), [...declared].sort());
  assert.deepEqual(outputs, {
    battery_level: 55,
    range_km: 280,
    charging: false,
    odometer_km: 12_346,
    service: 'ok',
  });
});
