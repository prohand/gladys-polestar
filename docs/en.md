# Polestar

Follow your Polestar cars in Gladys: battery, range, charging, odometer and
service. The data comes from the **Polestar cloud** (the one of the Polestar
app): the integration needs an internet access, and the car must be online.

> This integration is not made nor supported by Polestar. It uses the same
> service as the Polestar app, which may change without notice.

## What you get

One device per car of your Polestar account, with these values:

| Value               | Unit    | Note                                 |
| ------------------- | ------- | ------------------------------------ |
| Battery             | %       |                                      |
| Range               | km      | estimated by the car                 |
| Charging            | on/off  | on while the car is charging         |
| Time to full charge | minutes | while charging                       |
| Odometer            | km      |                                      |
| Days to service     | days    | negative when the service is overdue |
| Distance to service | km      | negative when the service is overdue |

Everything is **read-only**: Polestar does not open remote commands (lock,
climate, charge) to third parties.

## Configuration

1. Open the **Configuration** tab of the integration.
2. Enter the **e-mail** and the **password** of your **Polestar ID** account,
   the one you use in the Polestar app.
3. Optional: in **Cars to follow (VIN)**, list the VINs to follow, separated
   by commas. Empty means every car of the account.
4. **Refresh interval**: how often each car is read, in seconds (5 minutes by
   default, 2 minutes at least). The car itself only reports every few
   minutes: a shorter interval brings nothing.
5. **Low battery threshold**: the level under which the "Battery low" scene
   trigger fires (20 % by default).
6. Save: your cars appear in the **Discovery** tab, ready to be added.

The **Test the connection** button signs in and lists the cars found.

If Polestar ID refuses the password, the integration says so and **stops
trying** until you save the configuration again: repeated attempts with a
wrong password could lock your account.

## Scenes

The integration adds its own cards to the scene editor (Gladys 5.1 or later),
under the **Integrations** category. Each trigger can be limited to one car.

- **Charging started** (trigger) — a car started charging. Variables: car,
  battery (%), range (km).
- **Charging stopped** (trigger) — a car stopped charging: charge complete,
  unplugged or paused. The `completed` variable tells a complete charge
  apart.
- **Battery low** (trigger) — the battery went under the threshold of the
  configuration. Fires once per crossing, not at every refresh.
- **Service needed** (trigger) — the service became more urgent: soon, due,
  then overdue. Optionally filter on the urgency.
- **Read a Polestar now** (action) — reads the car right away and gives its
  values (battery, range, charging, odometer, service) to the next actions of
  the scene, for example to send you a message with the range.

The triggers compare each reading with the previous one: the first reading
after a restart of Gladys fires nothing.

## Dashboard

Add the **Polestar car** widget to a dashboard and pick a car in its settings.
It shows the battery, the range and the odometer live, the charging state
(with the time to full charge), the service, the fluid levels and the time of
the last report of the car. Its **Refresh** button reads the car right away.

## Cloud badge

The integration is tagged **cloud**: each car shows a **cloud** badge while the
Polestar cloud answers, and **unreachable** when it does not.

## Troubleshooting

- **"Polestar ID refused the e-mail or the password"**: sign in to the Polestar
  app with the same e-mail and password, then save the configuration again.
- **No value**: the car only sends data when it is online. Open the Polestar
  app: if it shows no recent data either, the integration cannot have any.
- **Logs**: check the integration logs from the Gladys interface (or
  `docker logs` on the host). Set `LOG_LEVEL=debug` on the container for more
  detail. The password and the tokens are never written in the logs.
