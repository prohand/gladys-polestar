// -----------------------------------------------------------------------------
// Device registry and polling.
//
// The integration has a single device type, the car (src/devices/car.js), with
// one device per car of the Polestar account. This module builds the discovery
// list and paces the polls.
// -----------------------------------------------------------------------------

import { DEVICE_POLL_FREQUENCIES } from '@gladysassistant/integration-sdk';
import { buildCarDevice } from './car.js';

/** The discovery payload: one device per car. */
export function buildDiscoveredDevices(gladys, cars) {
  return cars.map((car) => buildCarDevice(gladys, car));
}

// Gladys' poll ticks drift by a few milliseconds: a read due within the next
// half-minute runs now, so a 300 s interval does not slip to 360 s.
const POLL_TOLERANCE_MS = DEVICE_POLL_FREQUENCIES.EVERY_MINUTES / 2;

/**
 * Create the poll pacer: Gladys polls each car once a minute, the car is read
 * at the interval the user chose (`poll_frequency`, in seconds) by skipping
 * the polls in between. The user can change it at any time, without
 * re-creating the devices.
 *
 * `isDue(externalId, config)` says whether to read now; `markRead` records a
 * successful read. A failed read is not recorded: it is retried at the next
 * poll.
 */
export function createPoller({ now = Date.now } = {}) {
  const lastReads = new Map();
  return {
    isDue(externalId, config) {
      const lastRead = lastReads.get(externalId);
      return (
        lastRead === undefined ||
        now() - lastRead >= config.poll_frequency * 1000 - POLL_TOLERANCE_MS
      );
    },
    markRead(externalId) {
      lastReads.set(externalId, now());
    },
    reset() {
      lastReads.clear();
    },
  };
}
