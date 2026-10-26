# Security policy

## Supported versions

Only the latest release of the Polestar integration receives security fixes.
Update the integration from the Gladys store before reporting an issue.

| Version | Supported |
| ------- | --------- |
| latest  | Yes       |
| older   | No        |

## Reporting a vulnerability

Please do **not** open a public issue, pull request or forum post for a
security problem.

Report it privately through GitHub: open the **Security** tab of
[prohand/gladys-polestar](https://github.com/prohand/gladys-polestar/security),
then **Report a vulnerability**.

No such button? Private reporting is not enabled yet: open an issue that only
asks the maintainers for a private contact, without any detail of the problem,
and send the report there.

Include, when you can:

- the version of the integration and of Gladys;
- what an attacker can do, and the steps to reproduce it;
- any log line that helps (remove e-mails, passwords, tokens and VINs first).

You should get a first answer within 7 days. A fix is released as a new version
of the integration, and the advisory is published once users can update.

## Scope

In scope: the code of this repository and the Docker image it publishes.

Out of scope: Gladys Assistant itself (report to
[GladysAssistant/Gladys](https://github.com/GladysAssistant/Gladys/security)),
and Polestar's own services and apps (report to Polestar).

## How the integration handles your account

- The Polestar ID password is stored by Gladys in a **secret** field of the
  configuration; the integration only sends it to Polestar ID
  (`polestarid.eu.polestar.com`), over HTTPS.
- The access and refresh tokens live **in memory only**: nothing is written to
  disk, a restart signs in again.
- The password and the tokens are **never logged**, and error messages never
  echo a server answer that could contain one.
- After a refused password, the integration **stops signing in** until the
  configuration is saved again: repeated attempts could lock the account.
- The integration only **reads** data: Polestar offers no remote command to
  this API, so it cannot unlock, start or move a car.

## Good practices for users

- Use a strong, unique password for your Polestar ID account.
- Keep Gladys and the integration up to date.
