import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, hasCredentials, normalizeConfig, parseVins } from '../src/config.js';

test('defaults apply to an empty config', () => {
  assert.deepEqual(normalizeConfig(), DEFAULT_CONFIG);
  assert.deepEqual(normalizeConfig(null), DEFAULT_CONFIG);
});

test('numbers typed as text are read, and kept in range', () => {
  const config = normalizeConfig({ poll_frequency: '600', battery_low_threshold: '15' });
  assert.equal(config.poll_frequency, 600);
  assert.equal(config.battery_low_threshold, 15);
  assert.equal(normalizeConfig({ poll_frequency: 10 }).poll_frequency, 120);
  assert.equal(normalizeConfig({ poll_frequency: 99999 }).poll_frequency, 3600);
  assert.equal(normalizeConfig({ poll_frequency: 'abc' }).poll_frequency, 300);
  assert.equal(normalizeConfig({ battery_low_threshold: 0 }).battery_low_threshold, 1);
});

test('the e-mail is trimmed, the password never', () => {
  const config = normalizeConfig({ email: '  me@example.com ', password: ' pass ' });
  assert.equal(config.email, 'me@example.com');
  assert.equal(config.password, ' pass ');
  assert.equal(hasCredentials(config), true);
  assert.equal(hasCredentials(normalizeConfig({ email: 'me@example.com' })), false);
});

test('VIN lists accept commas, spaces and new lines', () => {
  assert.deepEqual(parseVins(''), []);
  assert.deepEqual(parseVins(' lpsa1, LPSB2;LPSC3\nlpsa1 '), ['LPSA1', 'LPSB2', 'LPSC3']);
});
