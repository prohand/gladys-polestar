# Changelog

All notable changes to this integration are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[semantic versioning](https://semver.org/), bumped by the Release workflow.

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

## [0.0.1] - 2026-10-26

### Added

- Polestar ID sign-in (e-mail and password of the Polestar app), with the token
  refreshed before it expires and kept in memory only.
- One Gladys device per car of the account (or per VIN listed in the
  configuration): battery, range, charging, time to full charge, odometer, days
  and distance to service. Read-only, from the Polestar cloud.
- Refresh interval set in the configuration (5 minutes by default, 2 minutes
  minimum); only the values that changed are sent to Gladys.
- **Cloud** transport badge on each car: `cloud` while the Polestar cloud
  answers, `unreachable` otherwise.
- Scene triggers: **Charging started**, **Charging stopped**, **Battery low**
  (threshold in the configuration) and **Service needed**.
- Scene action: **Read a Polestar now**, which gives the battery, range,
  charging state, odometer and service to the next actions.
- **Polestar car** dashboard widget: live battery, range and odometer, charging
  and service state, fluid levels, last report, and a **Refresh** button.
- **Test the connection** button in the configuration.
- English, French, German and Spanish: configuration screen, messages, widget
  and documentation.
- After a refused password, no new sign-in attempt until the configuration is
  saved again, so the Polestar account is never locked by retries.
- CI (format, lint, tests on Node 22 and 24, store checks, Docker build),
  Release workflow, GitHub Releases and Dependabot.
- `SECURITY.md` and `CLAUDE.md`.

[Unreleased]: https://github.com/prohand/gladys-polestar/compare/v0.0.1...HEAD
[0.0.1]: https://github.com/prohand/gladys-polestar/releases/tag/v0.0.1
