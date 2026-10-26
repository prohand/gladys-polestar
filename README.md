# Gladys Polestar

External integration for [Gladys Assistant](https://gladysassistant.com) that
brings your **Polestar** electric cars into Gladys: battery, range, charging,
odometer and service — with scene triggers, a scene action and a dashboard
widget.

> Not made nor supported by Polestar. It uses the Polestar cloud, like the
> Polestar app: read-only, internet access needed.

Built with the JavaScript SDK
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js),
from the official
[template](https://github.com/GladysAssistant/integration-template-js).

User documentation: [English](docs/en.md) · [Français](docs/fr.md) ·
[Deutsch](docs/de.md) · [Español](docs/es.md).

## Features

| Surface          | What                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------ |
| Devices          | one per car (VIN): battery %, range km, charging, time to full, odometer, days/km to service     |
| Transport (tag)  | `cloud` — each car shows a `cloud` badge, `unreachable` while the Polestar cloud does not answer |
| Scene triggers   | `charging_started`, `charging_stopped`, `battery_low`, `service_due`                             |
| Scene action     | `refresh_car`: read a car now, outputs battery, range, charging, odometer, service               |
| Dashboard widget | `car`: live battery / range / odometer, charging, service, fluids, last report, Refresh button   |
| Configuration    | Polestar ID e-mail + password (secret), VIN filter, refresh interval, low battery threshold      |
| Languages        | English, French, German, Spanish                                                                 |

Requires **Gladys 5.3.0** or later.

## How it works

1. **Sign-in** — Polestar ID (OpenID Connect, authorization code + PKCE), with
   the e-mail and password of the Polestar app. The tokens stay in memory and
   are refreshed before they expire.
2. **Cars** — `getConsumerCarsV2` lists the cars of the account; each one
   becomes a Gladys device keyed on its VIN.
3. **Telemetry** — `carTelematicsV2` gives the battery, the range, the charging
   state, the odometer and the service data. Gladys polls each car once a
   minute; the integration reads it at the interval of the configuration and
   only sends the values that changed.
4. **Scenes** — each reading is compared with the previous one: one event per
   transition (charge started or stopped, battery under the threshold, service
   more urgent).

A refused password stops the sign-in attempts until the configuration is saved
again, so retries never lock the account.

## Project structure

```
.
├─ index.js                        # SDK bootstrap: registerIntegration + connect
├─ src/
│  ├─ integration.js               # every SDK handler
│  ├─ config.js                    # defaults + normalization
│  ├─ i18n.js / messages.js        # en, fr, de, es
│  ├─ polestar/                    # Polestar ID sign-in + GraphQL client
│  ├─ devices/                     # the car device + poll pacing
│  ├─ scenes.js                    # scene triggers detection + action outputs
│  └─ widgets.js                   # dashboard widget
├─ docs/{en,fr,de,es}.md           # user documentation (re-hosted by Gladys)
├─ test/                           # node --test, fake Gladys + fake Polestar cloud
├─ gladys-assistant-integration.json
├─ Dockerfile                      # Node 24 Alpine, read-only rootfs ready
├─ CHANGELOG.md · SECURITY.md · CLAUDE.md
└─ .github/                        # CI, Release, build, GitHub releases, Dependabot
```

## Development

```bash
npm install
npm test               # unit and end-to-end tests (no network)
npm run lint           # ESLint
npm run format:check   # Prettier
```

Run it against a Gladys instance:

```bash
GLADYS_HOST_API_URL="http://localhost:1443" \
GLADYS_INTEGRATION_TOKEN="<token>" \
GLADYS_INTEGRATION_SELECTOR="polestar" \
LOG_LEVEL=debug \
npm start
```

## Workflows

The same as [prohand/gladys-devmel](https://github.com/prohand/gladys-devmel):

- **CI** (`ci.yml`) — on every push to `main` and every pull request: Prettier,
  ESLint and tests on Node 22 and 24; on pull requests, the store admission
  checks and a Docker build.
- **Release** (`release.yml`) — Actions → Release → `patch` / `minor` /
  `major`: bumps `package.json` and the manifest (`version` + `docker_image`),
  rolls `CHANGELOG.md`, tags `vX.Y.Z`, builds the multi-arch image, publishes
  the GitHub Release and runs the full store checks.
- **Build** (`build.yml`) — multi-arch image (`linux/amd64` + `linux/arm64`) to
  `ghcr.io`, on a tag, by hand, or called by Release.
- **GitHub releases** (`github-release.yml`) — one GitHub Release per version
  tag, with its changelog section as notes.
- **Dependabot** — weekly npm, monthly GitHub Actions and Docker base image.

## Publish

1. Add the GitHub topic `gladys-assistant-integration` to the repository.
2. Turn on **Private vulnerability reporting** (see [SECURITY.md](SECURITY.md)).
3. Describe the changes under `## [Unreleased]` in [CHANGELOG.md](CHANGELOG.md).
4. **Actions → Release → Run workflow**. The first release from `0.0.0`:
   `major` gives `1.0.0`, `minor` gives `0.1.0`.

## License

Apache-2.0
