import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PolestarClient } from '../src/polestar/client.js';
import { PolestarApiError, PolestarCredentialsError } from '../src/polestar/errors.js';
import { createFakePolestar, EMAIL, PASSWORD, VIN_2, VIN_4 } from './helpers/fakePolestar.js';

const clientOf = (fake, { password = PASSWORD, now } = {}) =>
  new PolestarClient({ email: EMAIL, password, fetch: fake.fetch, now });

test('signs in through Polestar ID (cookie + PKCE) and lists the cars', async () => {
  const fake = createFakePolestar();
  const cars = await clientOf(fake).getCars();

  assert.equal(fake.counts.signIns, 1);
  assert.deepEqual(cars, [
    { vin: VIN_2, model: 'Polestar 2', modelYear: '2024', registration: 'AB-123-CD' },
    { vin: VIN_4, model: 'Polestar 4', modelYear: '2025', registration: null },
  ]);
});

test('confirms the account when Polestar asks for it, then signs in', async () => {
  const fake = createFakePolestar({ termsPending: true });
  await clientOf(fake).signIn();
  assert.equal(fake.counts.signIns, 1);
  assert.equal(fake.termsPending, false);
});

test('a wrong password is a credentials error, tried only once', async () => {
  const fake = createFakePolestar();
  const client = clientOf(fake, { password: 'wrong' });
  await assert.rejects(client.signIn(), PolestarCredentialsError);
  assert.equal(fake.counts.credentialPosts, 1);
});

test('no error message carries the password', async () => {
  const fake = createFakePolestar();
  const secret = 'Sup3r-Secret!';
  const error = await clientOf(fake, { password: secret })
    .signIn()
    .catch((err) => err);
  assert.ok(!String(error.message).includes(secret));
  assert.ok(!String(error.stack).includes(secret));
});

test('the token is refreshed before it expires, without a new sign-in', async () => {
  const fake = createFakePolestar();
  let clock = 1_000_000;
  const client = clientOf(fake, { now: () => clock });

  await client.getTelematics([VIN_2]);
  clock += 3_400 * 1000; // 200 s left of 3600: inside the refresh window
  await client.getTelematics([VIN_2]);

  assert.equal(fake.counts.signIns, 1);
  assert.equal(fake.counts.refreshes, 1);
});

test('a token the API refuses is renewed once, and the request retried', async () => {
  const fake = createFakePolestar();
  const client = clientOf(fake);
  await client.getCars();
  fake.revokeAccessTokens();

  const cars = await client.getCars();

  assert.equal(cars.length, 2);
  assert.equal(fake.counts.refreshes, 1);
});

test('a failed refresh falls back to a new sign-in', async () => {
  const fake = createFakePolestar();
  const client = clientOf(fake);
  await client.getCars();
  fake.revokeAccessTokens();
  fake.refreshTokens.clear();

  await client.getCars();

  assert.equal(fake.counts.signIns, 2);
});

test('concurrent requests share one sign-in', async () => {
  const fake = createFakePolestar();
  const client = clientOf(fake);
  await Promise.all([client.getCars(), client.getTelematics([VIN_2]), client.getCars()]);
  assert.equal(fake.counts.signIns, 1);
});

test('an unreachable cloud is an API error', async () => {
  const fake = createFakePolestar();
  const client = clientOf(fake);
  await client.signIn();
  fake.down = true;
  await assert.rejects(client.getCars(), PolestarApiError);
});

test('the telemetry of each car is read from one request', async () => {
  const fake = createFakePolestar();
  const telemetry = await clientOf(fake).getTelematics([VIN_2, VIN_4]);
  assert.equal(telemetry.get(VIN_2).batteryLevel, 64);
  assert.equal(telemetry.get(VIN_4).odometerKm, 12_346);
  assert.equal(fake.counts.api, 1);
});
