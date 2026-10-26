// -----------------------------------------------------------------------------
// A fake Polestar cloud, served through a fake `fetch`: Polestar ID (OIDC
// sign-in page, credentials form, token endpoint) and the GraphQL API.
//
// It is strict where the real one is: the cookie of the sign-in page must come
// back with the form, the PKCE verifier must match the challenge, and the API
// refuses an unknown or revoked token with UNAUTHENTICATED. Tests never touch
// the network.
// -----------------------------------------------------------------------------

import { createHash } from 'node:crypto';
import { API_URL } from '../../src/polestar/client.js';
import { OIDC_PROVIDER, OIDC_REDIRECT_URI } from '../../src/polestar/auth.js';

const AUTHORIZE = `${OIDC_PROVIDER}/as/authorization.oauth2`;
const TOKEN = `${OIDC_PROVIDER}/as/token.oauth2`;
const LOGIN_PAGE = `${OIDC_PROVIDER}/login`;
const RESUME = '/as/AbC12/resume/as/authorization.ping';

export const EMAIL = 'driver@example.com';
export const PASSWORD = 'correct horse';

export const VIN_2 = 'LPSVSEDEEML000002';
export const VIN_4 = 'LPSVSEDEEML000004';

const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

const redirect = (location, headers = {}) =>
  new Response(null, { status: 302, headers: { location, ...headers } });

/** A `carTelematicsV2` entry set for one car. */
export function telemetry(vin, overrides = {}) {
  const at = { seconds: overrides.seconds ?? 1_790_000_000, nanos: 0 };
  return {
    battery: {
      vin,
      chargingStatusV2: 'CHARGING_STATUS_V2_IDLE',
      batteryChargeLevelPercentage: 64,
      estimatedChargingTimeToFullMinutes: 0,
      estimatedDistanceToEmptyKm: 280,
      timestamp: at,
      ...overrides.battery,
    },
    odometer: { vin, odometerMeters: 12_345_678, timestamp: at, ...overrides.odometer },
    health: {
      vin,
      brakeFluidLevelWarning: 'BRAKE_FLUID_LEVEL_WARNING_NO_WARNING',
      daysToService: 200,
      distanceToServiceKm: 18_000,
      engineCoolantLevelWarning: 'ENGINE_COOLANT_LEVEL_WARNING_NO_WARNING',
      oilLevelWarning: 'OIL_LEVEL_WARNING_NO_WARNING',
      serviceWarning: 'SERVICE_WARNING_NO_WARNING',
      timestamp: at,
      ...overrides.health,
    },
  };
}

/**
 * @param {object} [options]
 * @param {boolean} [options.termsPending] Polestar asks to confirm the account first
 */
export function createFakePolestar({ termsPending = false } = {}) {
  const fake = {
    email: EMAIL,
    password: PASSWORD,
    termsPending,
    down: false,
    cars: [
      { vin: VIN_2, modelName: 'Polestar 2', registrationNo: 'AB-123-CD', modelYear: '2024' },
      { vin: VIN_4, modelName: 'Polestar 4', registrationNo: null, modelYear: '2025' },
    ],
    telematics: { [VIN_2]: telemetry(VIN_2), [VIN_4]: telemetry(VIN_4) },
    tokens: new Set(),
    refreshTokens: new Set(),
    tokenLifetime: 3600,
    counts: { signIns: 0, refreshes: 0, api: 0, credentialPosts: 0 },
    requests: [],
    challenge: null,
    nextId: 1,
  };

  const issueTokens = () => {
    const access = `access-${fake.nextId}`;
    const refresh = `refresh-${fake.nextId}`;
    fake.nextId += 1;
    fake.tokens.add(access);
    fake.refreshTokens.add(refresh);
    return json({ access_token: access, refresh_token: refresh, expires_in: fake.tokenLifetime });
  };

  /** Revoke every access token: the next API call gets UNAUTHENTICATED. */
  fake.revokeAccessTokens = () => fake.tokens.clear();

  fake.fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    const headers = Object.fromEntries(
      Object.entries(init.headers ?? {}).map(([key, value]) => [key.toLowerCase(), value]),
    );
    fake.requests.push({ url: String(url), method, headers, body: init.body });
    if (fake.down) {
      throw new TypeError('fetch failed');
    }
    const target = new URL(url);
    const path = `${target.origin}${target.pathname}`;

    if (path === `${OIDC_PROVIDER}/.well-known/openid-configuration`) {
      return json({
        issuer: OIDC_PROVIDER,
        authorization_endpoint: AUTHORIZE,
        token_endpoint: TOKEN,
      });
    }
    if (path === AUTHORIZE && method === 'GET') {
      fake.challenge = target.searchParams.get('code_challenge');
      return redirect('/login?flow=1', { 'set-cookie': 'PF=session-cookie; Path=/; Secure' });
    }
    if (path === LOGIN_PAGE && method === 'GET') {
      if (headers.cookie !== 'PF=session-cookie') {
        return new Response('no session', { status: 400 });
      }
      return new Response(`<script>var config = { action: "${RESUME}", other: "x" };</script>`, {
        status: 200,
      });
    }
    if (path === `${OIDC_PROVIDER}${RESUME}` && method === 'POST') {
      const form = new URLSearchParams(init.body);
      if (headers.cookie !== 'PF=session-cookie') {
        return new Response('no session', { status: 400 });
      }
      if (form.get('pf.submit') === 'true') {
        fake.termsPending = false;
        return redirect(`${OIDC_REDIRECT_URI}?code=the-code&state=x`);
      }
      fake.counts.credentialPosts += 1;
      if (form.get('pf.username') !== fake.email || form.get('pf.pass') !== fake.password) {
        return new Response('<script>authMessage: "ERR001"</script>', { status: 200 });
      }
      if (fake.termsPending) {
        return redirect(`${OIDC_REDIRECT_URI}?uid=user-42`);
      }
      return redirect(`${OIDC_REDIRECT_URI}?code=the-code&state=x`);
    }
    if (path === TOKEN && method === 'POST') {
      const form = new URLSearchParams(init.body);
      if (form.get('grant_type') === 'authorization_code') {
        const challenge = createHash('sha256')
          .update(form.get('code_verifier') ?? '')
          .digest('base64url');
        if (form.get('code') !== 'the-code' || challenge !== fake.challenge) {
          return json({ error: 'invalid_grant' }, 400);
        }
        fake.counts.signIns += 1;
        return issueTokens();
      }
      if (form.get('grant_type') === 'refresh_token') {
        if (!fake.refreshTokens.has(form.get('refresh_token'))) {
          return json({ error: 'invalid_grant' }, 400);
        }
        fake.counts.refreshes += 1;
        return issueTokens();
      }
      return json({ error: 'unsupported_grant_type' }, 400);
    }
    if (String(url) === API_URL && method === 'POST') {
      fake.counts.api += 1;
      const token = (headers.authorization ?? '').replace(/^Bearer /, '');
      if (!fake.tokens.has(token)) {
        return json({
          data: null,
          errors: [{ message: 'Unauthorized', extensions: { code: 'UNAUTHENTICATED' } }],
        });
      }
      const { query, variables } = JSON.parse(init.body);
      if (query.includes('getConsumerCarsV2')) {
        return json({ data: { getConsumerCarsV2: fake.cars } });
      }
      if (query.includes('carTelematicsV2')) {
        const entries = (variables.vins ?? []).map((vin) => fake.telematics[vin]).filter(Boolean);
        return json({
          data: {
            carTelematicsV2: {
              battery: entries.map((entry) => entry.battery),
              odometer: entries.map((entry) => entry.odometer),
              health: entries.map((entry) => entry.health),
            },
          },
        });
      }
      return json({ errors: [{ message: 'Unknown query' }] }, 400);
    }
    return new Response('not found', { status: 404 });
  };

  return fake;
}
