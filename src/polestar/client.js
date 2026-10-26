// -----------------------------------------------------------------------------
// The Polestar cloud API (the "My Polestar" GraphQL API).
//
// Read-only: Polestar does not open remote commands (lock, climate, charge)
// to this API. Two queries are enough:
//   - getConsumerCarsV2: the cars of the account (VIN, model, plate);
//   - carTelematicsV2:   battery, range, charging, odometer and service data.
//
// A token the API refuses (UNAUTHENTICATED) is renewed once, then the request
// is retried; any other error goes up to the caller, which retries at the next
// poll.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { PolestarAuth } from './auth.js';
import { PolestarApiError } from './errors.js';
import { HTTP_TIMEOUT_MS } from './http.js';
import { parseCar, parseTelematics } from './telemetry.js';

const logger = createLogger({ name: 'polestar-api' });

export const API_URL = 'https://pc-api.polestar.com/eu-north-1/mystar-v2/';

export const QUERY_CARS = `query GetConsumerCarsV2 {
  getConsumerCarsV2 {
    vin
    internalVehicleIdentifier
    registrationNo
    modelYear
    modelName
  }
}`;

export const QUERY_TELEMATICS = `query CarTelematicsV2($vins: [String!]!) {
  carTelematicsV2(vins: $vins) {
    health {
      vin
      brakeFluidLevelWarning
      daysToService
      distanceToServiceKm
      engineCoolantLevelWarning
      oilLevelWarning
      serviceWarning
      timestamp { seconds nanos }
    }
    battery {
      vin
      chargingStatusV2
      batteryChargeLevelPercentage
      estimatedChargingTimeToFullMinutes
      estimatedDistanceToEmptyKm
      timestamp { seconds nanos }
    }
    odometer {
      vin
      odometerMeters
      timestamp { seconds nanos }
    }
  }
}`;

const isUnauthenticated = (status, errors) =>
  status === 401 ||
  (errors ?? []).some(
    (error) =>
      error?.extensions?.code === 'UNAUTHENTICATED' || /unauthori[sz]ed/i.test(error?.message),
  );

export class PolestarClient {
  /**
   * @param {object} options
   * @param {string} options.email
   * @param {string} options.password
   * @param {typeof fetch} [options.fetch]
   */
  constructor({ email, password, fetch: fetchImpl = globalThis.fetch, now }) {
    this.fetch = fetchImpl;
    this.auth = new PolestarAuth({ email, password, fetch: fetchImpl, now });
  }

  /** Sign in (or check the current token). Throws on bad credentials. */
  async signIn() {
    await this.auth.getAccessToken();
  }

  /** The cars of the account. */
  async getCars() {
    const data = await this.query(QUERY_CARS);
    const cars = (data.getConsumerCarsV2 ?? []).map(parseCar).filter((car) => car.vin);
    logger.debug(`${cars.length} car(s) on the account`);
    return cars;
  }

  /**
   * The telemetry of some cars, in one request.
   * @param {string[]} vins
   * @returns {Promise<Map<string, ReturnType<typeof parseTelematics>>>}
   */
  async getTelematics(vins) {
    const data = await this.query(QUERY_TELEMATICS, { vins });
    const raw = data.carTelematicsV2 ?? {};
    return new Map(vins.map((vin) => [vin, parseTelematics(raw, vin)]));
  }

  async query(query, variables = {}, { retried = false } = {}) {
    const token = await this.auth.getAccessToken({ force: retried });
    let response;
    try {
      response = await this.fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
      });
    } catch (err) {
      throw new PolestarApiError(`Polestar API unreachable: ${err.message}`, { cause: err });
    }
    const body = await response.json().catch(() => ({}));

    if (isUnauthenticated(response.status, body.errors)) {
      if (retried) {
        throw new PolestarApiError('Polestar API refused a fresh token', { status: 401 });
      }
      logger.debug('Token refused by the API: renewing it');
      return this.query(query, variables, { retried: true });
    }
    if (!response.ok) {
      throw new PolestarApiError(`Polestar API: HTTP ${response.status}`, {
        status: response.status,
      });
    }
    if (body.errors?.length && !body.data) {
      throw new PolestarApiError(`Polestar API: ${body.errors[0]?.message ?? 'error'}`, {
        status: response.status,
      });
    }
    return body.data ?? {};
  }
}
