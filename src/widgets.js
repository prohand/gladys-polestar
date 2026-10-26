// -----------------------------------------------------------------------------
// Dashboard widget (SDK v0.14+, Gladys 5.1+).
//
// The `car` widget shows one car, picked in the widget settings (a
// `"source": "devices"` select: the value is the device external_id):
//   - live tiles bound to the car features (battery, range, odometer): they
//     follow the published states, nothing to refresh;
//   - a status list computed here (charging, service, fluids, last report);
//   - a "Refresh" button that reads the car now.
//
// Every text is a `{ en, fr, de, es }` object: the core picks the reader's
// language. The content is declarative, the core renders it with its own
// theme — no HTML, no CSS. test/widgets.test.js checks it with the SDK's
// `validateWidgetContent`.
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { carIds, FEATURES } from './devices/car.js';
import { localize, pick } from './i18n.js';
import { CHARGING_STATES, FLUID_LEVELS, SERVICE_LEVELS } from './polestar/telemetry.js';

export const CAR_WIDGET = 'car';
export const WIDGET_ACTIONS = { REFRESH: 'refresh' };

const CHARGING_LABELS = {
  [CHARGING_STATES.CHARGING]: {
    text: { en: 'Charging', fr: 'En charge', de: 'Lädt', es: 'Cargando' },
    color: WIDGET_COLORS.SUCCESS,
  },
  [CHARGING_STATES.IDLE]: {
    text: { en: 'Not charging', fr: 'Pas en charge', de: 'Lädt nicht', es: 'No está cargando' },
    color: WIDGET_COLORS.NEUTRAL,
  },
  [CHARGING_STATES.DONE]: {
    text: {
      en: 'Charge complete',
      fr: 'Charge terminée',
      de: 'Vollständig geladen',
      es: 'Carga completa',
    },
    color: WIDGET_COLORS.SUCCESS,
  },
  [CHARGING_STATES.SCHEDULED]: {
    text: { en: 'Scheduled', fr: 'Programmée', de: 'Geplant', es: 'Programada' },
    color: WIDGET_COLORS.INFO,
  },
  [CHARGING_STATES.FAULT]: {
    text: { en: 'Charging fault', fr: 'Défaut de charge', de: 'Ladefehler', es: 'Fallo de carga' },
    color: WIDGET_COLORS.DANGER,
  },
  [CHARGING_STATES.UNKNOWN]: {
    text: { en: 'Unknown', fr: 'Inconnu', de: 'Unbekannt', es: 'Desconocido' },
    color: WIDGET_COLORS.NEUTRAL,
  },
};

const SERVICE_LABELS = {
  [SERVICE_LEVELS.OK]: {
    text: { en: 'OK', fr: 'OK', de: 'OK', es: 'OK' },
    color: WIDGET_COLORS.SUCCESS,
  },
  [SERVICE_LEVELS.SOON]: {
    text: { en: 'Soon', fr: 'Bientôt', de: 'Bald fällig', es: 'Pronto' },
    color: WIDGET_COLORS.WARNING,
  },
  [SERVICE_LEVELS.DUE]: {
    text: { en: 'Due', fr: 'À faire', de: 'Fällig', es: 'Necesario' },
    color: WIDGET_COLORS.WARNING,
  },
  [SERVICE_LEVELS.OVERDUE]: {
    text: { en: 'Overdue', fr: 'En retard', de: 'Überfällig', es: 'Atrasado' },
    color: WIDGET_COLORS.DANGER,
  },
  [SERVICE_LEVELS.UNKNOWN]: {
    text: { en: 'Unknown', fr: 'Inconnu', de: 'Unbekannt', es: 'Desconocido' },
    color: WIDGET_COLORS.NEUTRAL,
  },
};

const DAY_ABBREVIATION = { en: 'd', fr: 'j', de: 'T', es: 'd' };

const FLUID_NAMES = {
  brake: { en: 'brake', fr: 'frein', de: 'Bremse', es: 'freno' },
  coolant: { en: 'coolant', fr: 'refroid.', de: 'Kühlmittel', es: 'refrig.' },
  oil: { en: 'oil', fr: 'huile', de: 'Öl', es: 'aceite' },
};

const T = {
  battery: { en: 'Battery', fr: 'Batterie', de: 'Akku', es: 'Batería' },
  range: { en: 'Range', fr: 'Autonomie', de: 'Reichweite', es: 'Autonomía' },
  odometer: { en: 'Odometer', fr: 'Compteur', de: 'Kilometerstand', es: 'Odómetro' },
  charge: { en: 'Charge', fr: 'Charge', de: 'Laden', es: 'Carga' },
  timeToFull: { en: 'Full in', fr: 'Pleine dans', de: 'Voll in', es: 'Llena en' },
  service: { en: 'Service', fr: 'Entretien', de: 'Wartung', es: 'Mantenimiento' },
  fluids: { en: 'Fluid levels', fr: 'Niveaux', de: 'Füllstände', es: 'Niveles' },
  lastReport: { en: 'Last report', fr: 'Dernier relevé', de: 'Letzte Meldung', es: 'Último dato' },
  refresh: { en: 'Refresh', fr: 'Actualiser', de: 'Aktualisieren', es: 'Actualizar' },
  pickCar: {
    en: 'Pick a car in the settings of this widget.',
    fr: 'Choisissez une voiture dans les réglages de ce widget.',
    de: 'Wähle in den Einstellungen dieses Widgets ein Auto aus.',
    es: 'Elija un coche en los ajustes de este widget.',
  },
  unknownCar: {
    en: 'This car is not on the Polestar account any more, or the integration is not connected.',
    fr: "Cette voiture n'est plus sur le compte Polestar, ou l'intégration n'est pas connectée.",
    de: 'Dieses Auto ist nicht mehr im Polestar-Konto, oder die Integration ist nicht verbunden.',
    es: 'Este coche ya no está en la cuenta Polestar, o la integración no está conectada.',
  },
  waiting: {
    en: 'Waiting for the first report…',
    fr: 'En attente du premier relevé…',
    de: 'Warte auf die erste Meldung…',
    es: 'Esperando el primer dato…',
  },
  fluidsOk: { en: 'OK', fr: 'OK', de: 'OK', es: 'OK' },
};

/** "in 3 h 20 min" style duration, per language. */
function formatMinutes(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return localize(() => (h > 0 ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`));
}

/** "5 minutes ago", in every language. */
export function formatAge(iso, now = Date.now()) {
  if (!iso) {
    return CHARGING_LABELS.unknown.text;
  }
  const seconds = Math.round((Date.parse(iso) - now) / 1000);
  const [value, unit] =
    Math.abs(seconds) < 60
      ? [seconds, 'second']
      : Math.abs(seconds) < 3600
        ? [Math.round(seconds / 60), 'minute']
        : Math.abs(seconds) < 86_400
          ? [Math.round(seconds / 3600), 'hour']
          : [Math.round(seconds / 86_400), 'day'];
  return localize((language) =>
    new Intl.RelativeTimeFormat(language, { numeric: 'auto' }).format(value, unit),
  );
}

function serviceStatus(telemetry) {
  const { text, color } = SERVICE_LABELS[telemetry.service] ?? SERVICE_LABELS.unknown;
  return {
    color,
    value: localize((language) => {
      const parts = [pick(language, text)];
      if (telemetry.daysToService !== null) {
        parts.push(`${telemetry.daysToService} ${pick(language, DAY_ABBREVIATION)}`);
      }
      if (telemetry.distanceToServiceKm !== null) {
        parts.push(`${telemetry.distanceToServiceKm} km`);
      }
      return parts.join(' · ');
    }),
  };
}

function fluidsStatus(telemetry) {
  const issues = Object.entries(telemetry.fluids).filter(
    ([, level]) => level === FLUID_LEVELS.LOW || level === FLUID_LEVELS.HIGH,
  );
  if (issues.length === 0) {
    const unknown = Object.values(telemetry.fluids).every(
      (level) => level === FLUID_LEVELS.UNKNOWN,
    );
    return unknown
      ? { value: SERVICE_LABELS.unknown.text, color: WIDGET_COLORS.NEUTRAL }
      : { value: T.fluidsOk, color: WIDGET_COLORS.SUCCESS };
  }
  return {
    color: WIDGET_COLORS.DANGER,
    value: localize((language) =>
      issues
        .map(
          ([fluid, level]) =>
            `${pick(language, FLUID_NAMES[fluid])} ${level === FLUID_LEVELS.LOW ? '↓' : '↑'}`,
        )
        .join(', '),
    ),
  };
}

/**
 * The widget content for one car.
 * @param {object} gladys
 * @param {{ car: object|null, telemetry: object|null, now?: number, configured: boolean }} state
 */
export function buildCarWidget(gladys, { car, telemetry, now = Date.now(), configured }) {
  if (!configured) {
    return { ttl_seconds: 300, components: [{ type: 'text', text: T.pickCar }] };
  }
  if (!car) {
    return { ttl_seconds: 300, components: [{ type: 'text', text: T.unknownCar }] };
  }
  const ids = carIds(gladys, car.vin);
  const components = [
    { type: 'text', variant: 'heading', text: car.name },
    {
      type: 'gauge',
      label: T.battery,
      icon: 'battery-charging',
      device_feature: ids.feature(FEATURES.BATTERY_LEVEL),
    },
    {
      type: 'value',
      label: T.range,
      icon: 'navigation',
      device_feature: ids.feature(FEATURES.RANGE),
    },
    {
      type: 'value',
      label: T.odometer,
      icon: 'activity',
      device_feature: ids.feature(FEATURES.ODOMETER),
    },
  ];

  if (telemetry) {
    const charging = CHARGING_LABELS[telemetry.chargingState] ?? CHARGING_LABELS.unknown;
    const items = [{ label: T.charge, icon: 'zap', value: charging.text, color: charging.color }];
    if (telemetry.charging && telemetry.timeToFullMinutes) {
      items.push({
        label: T.timeToFull,
        icon: 'clock',
        value: formatMinutes(telemetry.timeToFullMinutes),
        color: WIDGET_COLORS.INFO,
      });
    }
    items.push(
      { label: T.service, icon: 'tool', ...serviceStatus(telemetry) },
      { label: T.fluids, icon: 'droplet', ...fluidsStatus(telemetry) },
      {
        label: T.lastReport,
        icon: 'radio',
        value: formatAge(telemetry.updatedAt, now),
        color: WIDGET_COLORS.NEUTRAL,
      },
    );
    components.push({ type: 'status', items });
  } else {
    components.push({ type: 'text', variant: 'caption', text: T.waiting });
  }

  // `params` are declared HERE and come back as-is: never user input.
  components.push({
    type: 'button',
    label: T.refresh,
    icon: 'refresh-cw',
    style: 'secondary',
    action: { key: WIDGET_ACTIONS.REFRESH, params: { car: ids.device } },
  });

  return {
    // The tiles are live; the status rows follow the reads, and the
    // integration nudges the widget after each one (requestWidgetRefresh):
    // the TTL is a safety net.
    ttl_seconds: 300,
    components,
  };
}

/** Toast after the Refresh button. */
export const REFRESH_TOASTS = {
  done: {
    en: 'Car data refreshed.',
    fr: 'Données de la voiture actualisées.',
    de: 'Fahrzeugdaten aktualisiert.',
    es: 'Datos del coche actualizados.',
  },
};

/** Ask the core to re-pull the widget now (rate-limited core-side). */
export function refreshWidgets(gladys) {
  gladys.requestWidgetRefresh(CAR_WIDGET);
}
