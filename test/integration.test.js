// End to end: the SDK's fake Gladys on one side, the fake Polestar cloud on the
// other, every handler registered by src/integration.js in between.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerIntegration } from '../src/integration.js';
import { PolestarClient } from '../src/polestar/client.js';
import { FEATURES } from '../src/devices/car.js';
import {
  createFakePolestar,
  EMAIL,
  PASSWORD,
  telemetry,
  VIN_2,
  VIN_4,
} from './helpers/fakePolestar.js';

async function setup({ config = {}, fake = createFakePolestar() } = {}) {
  let clock = 1_000_000_000;
  const gladys = createFakeGladys({
    config: { email: EMAIL, password: PASSWORD, ...config },
  });
  const integration = registerIntegration(gladys, {
    createClient: (cfg) =>
      new PolestarClient({ email: cfg.email, password: cfg.password, fetch: fake.fetch }),
    now: () => clock,
  });
  await gladys.connect();
  const tick = (seconds) => {
    clock += seconds * 1000;
  };
  return { gladys, fake, integration, tick };
}

const deviceOf = (gladys, vin) =>
  gladys.fake.discoveredDevices.find((device) => device.external_id.endsWith(vin));

test('on connection: signs in, publishes one device per car, reports connected', async () => {
  const { gladys } = await setup();
  assert.equal(gladys.fake.discoveredDevices.length, 2);
  assert.deepEqual(
    gladys.fake.discoveredDevices.map((device) => device.name),
    ['Polestar 2 (AB-123-CD)', 'Polestar 4 (000004)'],
  );
  assert.equal(gladys.fake.connectionStatus.connected, true);
  assert.deepEqual(
    gladys.fake.transports.map((entry) => entry.transport),
    ['cloud', 'cloud'],
  );
});

test('the VIN list limits the cars followed', async () => {
  const { gladys } = await setup({ config: { vins: VIN_4.toLowerCase() } });
  assert.equal(gladys.fake.discoveredDevices.length, 1);
  assert.ok(deviceOf(gladys, VIN_4));
});

test('a VIN missing from the account is said, the others are followed', async () => {
  const { gladys } = await setup({ config: { vins: `${VIN_2}, LPSUNKNOWN` } });
  assert.equal(gladys.fake.discoveredDevices.length, 1);
  assert.equal(gladys.fake.connectionStatus.connected, true);
  assert.match(gladys.fake.connectionStatus.message.en, /LPSUNKNOWN/);
});

test('no credentials: nothing is published, the user is told what to fill in', async () => {
  const { gladys, fake } = await setup({ config: { email: '', password: '' } });
  assert.equal(gladys.fake.discoveredDevices.length, 0);
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(gladys.fake.connectionStatus.message.en, /e-mail and password/);
  assert.equal(fake.requests.length, 0);
});

test('a poll publishes the values of the car', async () => {
  const { gladys } = await setup();
  const device = deviceOf(gladys, VIN_2);
  await gladys.fake.poll(device);
  const ids = gladys.externalIds('car', VIN_2);
  assert.equal(gladys.fake.lastState(ids.feature(FEATURES.BATTERY_LEVEL)), 64);
  assert.equal(gladys.fake.lastState(ids.feature(FEATURES.RANGE)), 280);
  assert.equal(gladys.fake.lastState(ids.feature(FEATURES.CHARGING)), 0);
  assert.equal(gladys.fake.lastState(ids.feature(FEATURES.ODOMETER)), 12_346);
});

test('polls follow the configured interval', async () => {
  const { gladys, fake, tick } = await setup({ config: { poll_frequency: 300 } });
  const device = deviceOf(gladys, VIN_2);
  const reads = () => fake.requests.filter((r) => r.body?.includes?.('carTelematicsV2')).length;

  await gladys.fake.poll(device);
  tick(60);
  await gladys.fake.poll(device);
  assert.equal(reads(), 1);
  tick(240);
  await gladys.fake.poll(device);
  assert.equal(reads(), 2);
});

test('a charge starting between two polls fires charging_started', async () => {
  const { gladys, fake, tick } = await setup();
  const device = deviceOf(gladys, VIN_2);
  await gladys.fake.poll(device);
  fake.telematics[VIN_2] = telemetry(VIN_2, {
    battery: { chargingStatusV2: 'CHARGING_STATUS_V2_CHARGING', batteryChargeLevelPercentage: 65 },
  });
  tick(300);
  await gladys.fake.poll(device);

  assert.equal(gladys.fake.sceneEvents.length, 1);
  const [{ key, data }] = gladys.fake.sceneEvents;
  assert.equal(key, 'charging_started');
  assert.equal(data.car, device.external_id);
  assert.equal(data.car_name, 'Polestar 2 (AB-123-CD)');
  assert.equal(data.battery_level, 65);
});

test('the refresh_car scene action returns the values and fires no event', async () => {
  const { gladys, fake, tick } = await setup();
  const device = deviceOf(gladys, VIN_2);
  await gladys.fake.poll(device);
  fake.telematics[VIN_2] = telemetry(VIN_2, {
    battery: { chargingStatusV2: 'CHARGING_STATUS_V2_CHARGING' },
  });

  const ack = await gladys.fake.sceneAction('refresh_car', { car: device.external_id });
  assert.equal(ack.success, true);
  assert.equal(ack.data.outputs.charging, true);
  assert.equal(ack.data.outputs.battery_level, 64);
  assert.equal(gladys.fake.sceneEvents.length, 0, 'no event from a scene action');

  // The transition is not lost: the next poll fires it.
  tick(300);
  await gladys.fake.poll(device);
  assert.deepEqual(
    gladys.fake.sceneEvents.map((event) => event.key),
    ['charging_started'],
  );
});

test('the widget shows the chosen car and its Refresh button reads it', async () => {
  const { gladys } = await setup();
  const device = deviceOf(gladys, VIN_4);
  const settings = { car: device.external_id };

  const before = await gladys.fake.widgetGet('car', { settings });
  assert.equal(before.success, true);

  const tap = await gladys.fake.widgetAction(
    'car',
    'refresh',
    { car: device.external_id },
    { settings },
  );
  assert.equal(tap.success, true);
  assert.equal(tap.data.message.en, 'Car data refreshed.');

  const after = await gladys.fake.widgetGet('car', { settings });
  const status = after.data.content.components.find((component) => component.type === 'status');
  assert.ok(status, 'the status rows appear once the car was read');
  assert.ok(gladys.fake.widgetRefreshes.includes('car'));
});

test('Test the connection lists the cars', async () => {
  const { gladys } = await setup();
  const ack = await gladys.fake.action('test_connection');
  assert.equal(ack.success, true);
  assert.match(JSON.stringify(ack.data), /2 car\(s\)/);
});

test('a refused password is not tried again until the config changes', async () => {
  const fake = createFakePolestar();
  fake.password = 'changed in the app';
  const { gladys, tick } = await setup({ fake });

  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(gladys.fake.connectionStatus.message.en, /refused/);
  assert.equal(fake.counts.credentialPosts, 1);

  const ghost = { external_id: gladys.externalIds('car', VIN_2).device };
  for (let i = 0; i < 5; i += 1) {
    tick(600);
    await gladys.fake.poll(ghost);
  }
  assert.equal(fake.counts.credentialPosts, 1, 'no new sign-in attempt on polls');

  // Saved again, same password: one new try.
  await gladys.fake.configUpdated({ email: EMAIL, password: PASSWORD });
  assert.equal(fake.counts.credentialPosts, 2);
  assert.equal(gladys.fake.connectionStatus.connected, false);

  await gladys.fake.configUpdated({ email: EMAIL, password: 'changed in the app' });
  assert.equal(fake.counts.credentialPosts, 3);
  assert.equal(gladys.fake.connectionStatus.connected, true);
  assert.equal(gladys.fake.discoveredDevices.length, 2);
});

test('a cloud outage turns the badge unreachable, and back to cloud', async () => {
  const { gladys, fake, tick } = await setup();
  const device = deviceOf(gladys, VIN_2);
  fake.down = true;
  await gladys.fake.poll(device);
  assert.equal(gladys.fake.transports.at(-1).transport, 'unreachable');
  assert.equal(gladys.fake.connectionStatus.connected, false);

  fake.down = false;
  tick(60);
  await gladys.fake.poll(device);
  assert.equal(gladys.fake.transports.at(-1).transport, 'cloud');
  assert.equal(gladys.fake.connectionStatus.connected, true);
});

test('the cloud down at startup: the sign-in is retried at the poll pace', async () => {
  const fake = createFakePolestar();
  fake.down = true;
  const { gladys, tick } = await setup({ fake });
  assert.equal(gladys.fake.discoveredDevices.length, 0);

  fake.down = false;
  const ghost = { external_id: gladys.externalIds('car', VIN_2).device };
  await gladys.fake.poll(ghost);
  assert.equal(gladys.fake.discoveredDevices.length, 0, 'not before the interval');
  tick(300);
  await gladys.fake.poll(ghost);
  assert.equal(gladys.fake.discoveredDevices.length, 2);
});
