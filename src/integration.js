// -----------------------------------------------------------------------------
// The integration itself: every SDK handler, wired to the Polestar client.
//
// index.js only creates the SDK client and calls `registerIntegration`; the
// tests call it with the SDK's fake Gladys and a fake Polestar cloud. All the
// handlers are registered here, BEFORE connect().
//
// The life of a car:
//   connected / config saved -> sign in, list the cars, publish one device each
//   onPoll (every minute)    -> read the car at the user's interval, publish
//                               the values that changed, fire the scene events
//   widget / scene action    -> read the car now
// -----------------------------------------------------------------------------

import { createLogger, DEVICE_TRANSPORTS } from '@gladysassistant/integration-sdk';
import { hasCredentials, normalizeConfig, parseVins } from './config.js';
import { carExternalId, carName, publishCarStates } from './devices/car.js';
import { buildDiscoveredDevices, createPoller } from './devices/index.js';
import { connectedMessage, MESSAGES, missingVinsMessage } from './messages.js';
import { PolestarClient } from './polestar/client.js';
import { PolestarCredentialsError } from './polestar/errors.js';
import { detectSceneEvents, refreshOutputs, SCENE_ACTIONS } from './scenes.js';
import {
  buildCarWidget,
  CAR_WIDGET,
  REFRESH_TOASTS,
  refreshWidgets,
  WIDGET_ACTIONS,
} from './widgets.js';

const logger = createLogger({ name: 'polestar' });

// Key of the poller entry that paces the reconnection attempts.
const RECONNECT = 'reconnect';

const defaultCreateClient = (config) =>
  new PolestarClient({ email: config.email, password: config.password });

/**
 * Register every handler on a Gladys SDK client.
 *
 * @param {object} gladys a GladysIntegration (or the SDK's fake one)
 * @param {object} [options]
 * @param {(config: object) => PolestarClient} [options.createClient]
 * @param {() => number} [options.now]
 * @returns the internal state and operations, for the tests
 */
export function registerIntegration(
  gladys,
  { createClient = defaultCreateClient, now = Date.now } = {},
) {
  const state = {
    config: normalizeConfig(),
    client: null,
    credentialsKey: null,
    // Polestar ID refused the password: no new try until the config changes
    // (or the user presses "Test the connection"), a locked account is worse
    // than a missing reading.
    credentialsRejected: false,
    cars: [],
    telemetry: new Map(),
    reachable: new Map(),
    memory: new Map(),
    inflight: new Map(),
  };
  const poller = createPoller({ now });

  const findCar = (externalId) => state.cars.find((car) => car.externalId === externalId) ?? null;

  function clientFor(config) {
    const key = `${config.email}\n${config.password}`;
    if (!state.client || state.credentialsKey !== key) {
      state.client = createClient(config);
      state.credentialsKey = key;
      state.credentialsRejected = false;
    }
    return state.client;
  }

  async function setStatus(connected, message) {
    await gladys.setConnectionStatus(connected, message).catch((err) => {
      logger.warn(`Could not report the connection status: ${err.message}`);
    });
  }

  async function publishTransports(cars = state.cars) {
    if (cars.length === 0) {
      return;
    }
    await gladys
      .publishTransports(
        cars.map((car) => ({
          external_id: car.externalId,
          transport:
            state.reachable.get(car.vin) === false
              ? DEVICE_TRANSPORTS.UNREACHABLE
              : DEVICE_TRANSPORTS.CLOUD,
        })),
      )
      .catch((err) => logger.warn(`Could not publish the transports: ${err.message}`));
  }

  /** Report an error of the cloud; resolves the message shown to the user. */
  async function handleError(err) {
    if (err instanceof PolestarCredentialsError) {
      state.credentialsRejected = true;
      logger.error('Polestar ID refused the e-mail or the password: no new try until saved again');
      await setStatus(false, MESSAGES.badCredentials);
      return MESSAGES.badCredentials;
    }
    logger.warn(`Polestar cloud error: ${err.message}`);
    await setStatus(false, MESSAGES.unreachable);
    return MESSAGES.unreachable;
  }

  /**
   * Sign in, list the cars and publish them. Resolves the message for the
   * "Test the connection" button.
   */
  async function connect() {
    const { config } = state;
    if (!hasCredentials(config)) {
      state.cars = [];
      await setStatus(false, MESSAGES.missingCredentials);
      return MESSAGES.missingCredentials;
    }
    const client = clientFor(config);
    if (state.credentialsRejected) {
      await setStatus(false, MESSAGES.badCredentials);
      return MESSAGES.badCredentials;
    }
    poller.markRead(RECONNECT);
    try {
      await client.signIn();
      const all = await client.getCars();
      const wanted = parseVins(config.vins);
      const missing = wanted.filter((vin) => !all.some((car) => car.vin === vin));
      state.cars = all
        .filter((car) => wanted.length === 0 || wanted.includes(car.vin))
        .map((car) => ({ ...car, name: carName(car), externalId: carExternalId(gladys, car.vin) }));
      logger.info(
        `${state.cars.length} car(s) followed: ${state.cars.map((c) => c.name).join(', ')}`,
      );

      await gladys.publishDiscoveredDevices(buildDiscoveredDevices(gladys, state.cars));
      await publishTransports();
      refreshWidgets(gladys);

      if (state.cars.length === 0) {
        const message = missing.length > 0 ? missingVinsMessage(missing) : MESSAGES.noCar;
        await setStatus(false, message);
        return message;
      }
      if (missing.length > 0) {
        logger.warn(`VIN not found on the account: ${missing.join(', ')}`);
        await setStatus(true, missingVinsMessage(missing));
        return missingVinsMessage(missing);
      }
      await setStatus(true);
      return connectedMessage(state.cars);
    } catch (err) {
      return handleError(err);
    }
  }

  async function setReachable(car, reachable) {
    if (state.reachable.get(car.vin) !== reachable) {
      state.reachable.set(car.vin, reachable);
      await publishTransports([car]);
    }
  }

  /**
   * Read one car now and publish what changed. Concurrent reads of the same
   * car (a poll and a widget tap) share one request.
   */
  function readCar(car) {
    if (state.inflight.has(car.vin)) {
      return state.inflight.get(car.vin);
    }
    const read = (async () => {
      if (!hasCredentials(state.config) || state.credentialsRejected) {
        throw new Error('Not connected to Polestar ID');
      }
      const wasDown = [...state.reachable.values()].includes(false);
      try {
        const telemetry = (await clientFor(state.config).getTelematics([car.vin])).get(car.vin);
        state.telemetry.set(car.vin, telemetry);
        await publishCarStates(gladys, car.vin, telemetry);
        await setReachable(car, true);
        if (wasDown && ![...state.reachable.values()].includes(false)) {
          await setStatus(true);
        }
        refreshWidgets(gladys);
        return telemetry;
      } catch (err) {
        await setReachable(car, false);
        await handleError(err);
        throw err;
      }
    })().finally(() => state.inflight.delete(car.vin));
    state.inflight.set(car.vin, read);
    return read;
  }

  /**
   * Fire the scene events of a new reading. Kept apart from readCar: a read
   * asked by a SCENE ACTION must not fire events (a scene bound to the event
   * could loop through the integration). Its reading leaves the trigger memory
   * untouched, so the next poll still sees — and fires — the transition.
   */
  async function fireSceneEvents(car, telemetry) {
    const { memory, events } = detectSceneEvents(
      state.memory.get(car.vin),
      telemetry,
      state.config,
    );
    state.memory.set(car.vin, memory);
    for (const { key, data } of events) {
      logger.info(`Scene event ${key} <- ${car.name}`);
      await gladys
        .publishSceneEvent(key, { car: car.externalId, car_name: car.name, ...data })
        .catch((err) => logger.warn(`Scene event ${key} refused: ${err.message}`));
    }
  }

  async function pollCar(car) {
    const telemetry = await readCar(car);
    poller.markRead(car.externalId);
    await fireSceneEvents(car, telemetry);
    return telemetry;
  }

  // --- Discovery: Gladys asks for the list of devices ------------------------
  gladys.onScanRequest(async () => {
    logger.info('onScanRequest -> listing the cars');
    await connect();
  });

  // --- Polling: once a minute per car, read at the user's interval -----------
  gladys.onPoll(async (device) => {
    const car = findCar(device.external_id);
    if (!car) {
      // The cloud was down at startup: retry the sign-in at the poll pace.
      if (
        state.cars.length === 0 &&
        hasCredentials(state.config) &&
        !state.credentialsRejected &&
        poller.isDue(RECONNECT, state.config)
      ) {
        await connect();
      }
      return;
    }
    if (!poller.isDue(car.externalId, state.config)) {
      return;
    }
    try {
      await pollCar(car);
    } catch (err) {
      // Already reported (status + transport badge): retried at the next poll.
      logger.debug(`Read of ${car.name} failed: ${err.message}`);
    }
  });

  // --- Manifest action: "Test the connection" --------------------------------
  gladys.onAction('test_connection', async () => {
    logger.info('Action test_connection');
    // An explicit request from the user: one new try, even after a refusal.
    state.credentialsRejected = false;
    return connect();
  });

  // --- Scene action: read a car now, return its values -----------------------
  gladys.onSceneAction(SCENE_ACTIONS.REFRESH_CAR, async (fields) => {
    logger.info(`Scene action ${SCENE_ACTIONS.REFRESH_CAR} <- ${fields.car}`);
    const car = findCar(fields.car);
    if (!car) {
      throw new Error(MESSAGES.unknownCar.en);
    }
    return refreshOutputs(await readCar(car));
  });

  // --- Dashboard widget -------------------------------------------------------
  gladys.onWidgetGet(CAR_WIDGET, async ({ settings = {} }) => {
    const car = settings.car ? findCar(settings.car) : null;
    return buildCarWidget(gladys, {
      car,
      telemetry: car ? (state.telemetry.get(car.vin) ?? null) : null,
      configured: Boolean(settings.car),
      now: now(),
    });
  });

  gladys.onWidgetAction(CAR_WIDGET, async (actionKey, params) => {
    if (actionKey !== WIDGET_ACTIONS.REFRESH) {
      throw new Error(`Unknown widget action: ${actionKey}`);
    }
    const car = findCar(params.car);
    if (!car) {
      throw new Error(MESSAGES.unknownCar.en);
    }
    await pollCar(car);
    return REFRESH_TOASTS.done;
  });

  // --- Configuration saved by the user ---------------------------------------
  gladys.onConfigUpdated(async (newConfig) => {
    logger.info('onConfigUpdated -> new configuration received');
    state.config = normalizeConfig(newConfig);
    // A save is the user's answer to a refused password: one new try, even
    // with the same password (it may have been changed back in the app).
    state.credentialsRejected = false;
    poller.reset();
    await connect();
  });

  // --- Connection to Gladys ---------------------------------------------------
  gladys.on('connected', async () => {
    try {
      state.config = normalizeConfig(await gladys.getConfig());
      await connect();
    } catch (err) {
      logger.error('Post-connection initialization failed', err);
      await setStatus(false, MESSAGES.unreachable);
    }
  });

  return { state, connect, readCar, pollCar, poller };
}
