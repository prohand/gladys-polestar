import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { buildCarDevice, carName, carStates, FEATURES } from '../src/devices/car.js';
import { buildDiscoveredDevices, createPoller } from '../src/devices/index.js';
import { normalizeConfig } from '../src/config.js';
import { parseTelematics } from '../src/polestar/telemetry.js';
import { telemetry, VIN_2 } from './helpers/fakePolestar.js';

const car = { vin: VIN_2, model: 'Polestar 2', registration: 'AB-123-CD' };

test('Gladys accepts the car device (categories, types, units, poll frequency)', async () => {
  // The fake Gladys refuses what the host API refuses, with the same 400.
  const gladys = createFakeGladys();
  await gladys.publishDiscoveredDevices(buildDiscoveredDevices(gladys, [car]));
  const [device] = gladys.fake.discoveredDevices;
  assert.equal(device.name, 'Polestar 2 (AB-123-CD)');
  assert.equal(device.features.length, Object.keys(FEATURES).length);
});

test('every feature is read-only and declares min and max', () => {
  const device = buildCarDevice(createFakeGladys(), car);
  for (const feature of device.features) {
    assert.equal(feature.read_only, true, feature.external_id);
    assert.equal(typeof feature.min, 'number', feature.external_id);
    assert.equal(typeof feature.max, 'number', feature.external_id);
  }
});

test('the external id is built on the VIN, the one id that never changes', () => {
  const gladys = createFakeGladys();
  assert.equal(buildCarDevice(gladys, car).external_id, gladys.externalIds('car', VIN_2).device);
  assert.equal(
    carName({ vin: VIN_2, model: 'Polestar 4', registration: null }),
    'Polestar 4 (000002)',
  );
});

test('the states leave out what the car did not report', async () => {
  const gladys = createFakeGladys();
  const full = carStates(gladys, VIN_2, parseTelematics(asApi(telemetry(VIN_2)), VIN_2));
  assert.equal(full.length, Object.keys(FEATURES).length);
  await gladys.publishStates(full);

  const partial = carStates(
    gladys,
    VIN_2,
    parseTelematics({ battery: [], odometer: [], health: [] }, VIN_2),
  );
  assert.deepEqual(partial, []);
});

test('the poller reads a car at the configured interval', () => {
  let clock = 0;
  const poller = createPoller({ now: () => clock });
  const config = normalizeConfig({ poll_frequency: 300 });

  assert.equal(poller.isDue('car', config), true);
  poller.markRead('car');
  clock = 60_000;
  assert.equal(poller.isDue('car', config), false);
  clock = 290_000; // within the half-minute tolerance
  assert.equal(poller.isDue('car', config), true);
  poller.reset();
  clock = 291_000;
  assert.equal(poller.isDue('car', config), true);
});

function asApi(entry) {
  return { battery: [entry.battery], odometer: [entry.odometer], health: [entry.health] };
}
