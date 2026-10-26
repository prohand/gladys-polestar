# CLAUDE.md

Project rules for coding assistants (Claude Code reads this file) and for human
contributors.

## What this is

A Gladys Assistant **external integration** (Node 22+, ESM, no build step, one
runtime dependency: `@gladysassistant/integration-sdk`) for **Polestar**
electric cars. It signs in to Polestar ID with the e-mail and password of the
Polestar app, reads the "My Polestar" GraphQL API, and publishes one Gladys
device per car: battery, range, charging, time to full, odometer, days and
distance to service. Read-only (Polestar opens no remote command), cloud only
(manifest `transports: ["cloud"]`). Requires Gladys 5.3+. Scene triggers
(charging started/stopped, battery low, service needed), one scene action (read
a car now) and a "Polestar car" dashboard widget.

It started from the official
[JavaScript template](https://github.com/GladysAssistant/integration-template-js);
the CI and release workflows are the ones of
[prohand/gladys-devmel](https://github.com/prohand/gladys-devmel).

## Commands

```bash
npm install
npm test                                    # node --test (built-in runner)
node --test test/integration.test.js        # one file
node --test --test-name-pattern "charging"  # tests whose name matches
npm run lint                                # eslint .
npm run format:check                        # prettier --check . (CI gate)
npm run format                              # prettier --write .
npx github:GladysAssistant/integration-store --skip-image-check .   # store checks
```

CI runs `format:check`, `lint` and `test` on Node 22 and 24, and on pull
requests the store checks and a Docker build: run the three commands before
pushing.

## Architecture

```
index.js                  SDK client + registerIntegration + connect (nothing else)
src/integration.js        every SDK handler: connect, discovery, poll, action, scenes, widget
src/config.js             DEFAULT_CONFIG (mirrors the manifest defaults) + normalization
src/i18n.js               the languages (en, fr, de, es) + localize/pick helpers
src/messages.js           connection status and action messages, in the four languages
src/polestar/http.js      cookie jar + manual redirects (the sign-in needs both)
src/polestar/auth.js      Polestar ID: OIDC authorization code + PKCE, token refresh
src/polestar/client.js    GraphQL: getConsumerCarsV2, carTelematicsV2
src/polestar/telemetry.js raw API enums -> plain values (null when not reported)
src/polestar/errors.js    credentials error vs API error
src/devices/car.js        the car device: features, states
src/devices/index.js      discovery list + poll pacing
src/scenes.js             scene trigger detection (transitions) + scene action outputs
src/widgets.js            the `car` dashboard widget content
docs/{en,fr,de,es}.md     user documentation, re-hosted by Gladys (mandatory)
test/helpers/fakePolestar.js  fake Polestar ID + GraphQL API behind a fake fetch
.github/scripts/changelog-release.mjs  rolls CHANGELOG.md at release time
```

## Rules

- **External ids are forever.** A car is keyed on its VIN
  (`gladys.externalIds('car', vin)`); the feature keys of `src/devices/car.js`,
  the config keys, the action, trigger, variable, output and widget keys are
  stored by users. Never rename them.
- **Never lock the user's account.** After `PolestarCredentialsError`, no new
  sign-in until the config changes or the user presses "Test the connection".
- **Secrets.** The password and the tokens are never logged, never written to
  disk (tokens live in memory), never put in an error message. The container
  rootfs is read-only anyway: only `/data` is writable.
- **Null, never 0.** A value the car did not report is `null` and is not
  published: a fake 0 % battery would fire every "battery low" scene.
- **One scene event per transition**, compared with the previous reading. The
  first reading after a start fires nothing. A read asked by a scene action
  fires no event (no loop) and leaves the trigger memory alone.
- **Polling**: Gladys `poll_frequency` is an enum in ms; the device declares
  `EVERY_MINUTES` and the poller applies the user's interval (seconds) by
  skipping polls. Values go out with `publishChangedStates`.
- **Tests never touch the network**: use `createFakeGladys()` from the SDK and
  `createFakePolestar()`.
- **Versions belong to the Release workflow** (Actions → Release). Never edit
  `version` in `package.json` or in the manifest, nor the `docker_image` tag,
  by hand. `test/manifest.test.js` checks they agree.
- **Changelog.** Every user-visible change adds a line under `## [Unreleased]`
  in `CHANGELOG.md` (`### Added`, `Changed`, `Fixed`, `Removed`, `Security`).
  Never write a version heading: the Release workflow moves the section.
- **Manifest.** Every text is `{ en, fr, de, es }` (label, description,
  placeholder…). The catalog `description` holds 10 to 100 characters per
  language. `keywords` need `gladys_version >=5.3.0`. `test/manifest.test.js`
  ties the manifest to the code: change both sides together.
- **User-facing text** is in English, French, German and Spanish: messages,
  widget, manifest and `docs/*.md`, kept in sync.
- **Style.** Prettier formats, ESLint catches mistakes. Comments explain why,
  in English.
