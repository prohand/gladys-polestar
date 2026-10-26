// -----------------------------------------------------------------------------
// Entry point of the Polestar integration for Gladys Assistant.
//
// This file only creates the SDK client, registers the handlers (all in
// src/integration.js, BEFORE connect()) and connects. The SDK handles the
// connection to Gladys, the auth and the reconnections.
//
// Environment variables provided by the Gladys supervisor to the container:
//   - GLADYS_HOST_API_URL         (host API URL)
//   - GLADYS_INTEGRATION_TOKEN    (integration-scoped JWT)
//   - GLADYS_INTEGRATION_SELECTOR (integration identifier)
// The SDK reads them automatically: `new GladysIntegration()` is enough.
// -----------------------------------------------------------------------------

import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { registerIntegration } from './src/integration.js';

const gladys = new GladysIntegration();

registerIntegration(gladys);

// --- Graceful shutdown -------------------------------------------------------
// The SDK disconnects cleanly and exits with code 0 when the supervisor stops
// the container (SIGTERM/SIGINT). Nothing to clean: no timer, no file.
gladys.handleShutdown((signal) => {
  logger.info(`Received ${signal} -> graceful shutdown`);
});

// --- Startup -----------------------------------------------------------------
logger.info('Starting the Polestar integration...');
gladys.connect().catch((err) => {
  logger.error('Initial connection failed', err);
  process.exit(1);
});
