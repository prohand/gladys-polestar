// -----------------------------------------------------------------------------
// User-facing messages: connection status and action answers.
// Every text is `{ en, fr, de, es }` (see src/i18n.js).
// -----------------------------------------------------------------------------

import { localize, pick } from './i18n.js';

export const MESSAGES = {
  missingCredentials: {
    en: 'Enter the e-mail and password of your Polestar ID account.',
    fr: 'Renseignez l’e-mail et le mot de passe de votre compte Polestar ID.',
    de: 'Gib die E-Mail-Adresse und das Passwort deines Polestar-ID-Kontos ein.',
    es: 'Introduzca el correo y la contraseña de su cuenta Polestar ID.',
  },
  badCredentials: {
    en: 'Polestar ID refused the e-mail or the password. Fix them and save.',
    fr: 'Polestar ID a refusé l’e-mail ou le mot de passe. Corrigez-les puis enregistrez.',
    de: 'Polestar ID hat E-Mail oder Passwort abgelehnt. Korrigiere sie und speichere.',
    es: 'Polestar ID rechazó el correo o la contraseña. Corríjalos y guarde.',
  },
  unreachable: {
    en: 'The Polestar cloud does not answer. New try at the next refresh.',
    fr: 'Le cloud Polestar ne répond pas. Nouvel essai au prochain rafraîchissement.',
    de: 'Die Polestar-Cloud antwortet nicht. Neuer Versuch bei der nächsten Aktualisierung.',
    es: 'La nube de Polestar no responde. Nuevo intento en la próxima actualización.',
  },
  noCar: {
    en: 'Signed in, but no car was found on this Polestar account.',
    fr: 'Connecté, mais aucune voiture trouvée sur ce compte Polestar.',
    de: 'Angemeldet, aber in diesem Polestar-Konto wurde kein Auto gefunden.',
    es: 'Conectado, pero no se encontró ningún coche en esta cuenta Polestar.',
  },
  unknownCar: {
    en: 'This car is not on the Polestar account.',
    fr: 'Cette voiture n’est pas sur le compte Polestar.',
    de: 'Dieses Auto ist nicht im Polestar-Konto.',
    es: 'Este coche no está en la cuenta Polestar.',
  },
};

const CONNECTED = {
  en: (count, names) => `Connected: ${count} car(s) — ${names}.`,
  fr: (count, names) => `Connecté : ${count} voiture(s) — ${names}.`,
  de: (count, names) => `Verbunden: ${count} Auto(s) — ${names}.`,
  es: (count, names) => `Conectado: ${count} coche(s) — ${names}.`,
};

/** "Connected: 2 car(s) — Polestar 2 (AB-123-CD), Polestar 4 (…)." */
export function connectedMessage(cars) {
  const names = cars.map((car) => car.name).join(', ');
  return localize((language) => pick(language, CONNECTED)(cars.length, names));
}

/** The VINs of the configuration that the account does not have. */
export function missingVinsMessage(vins) {
  const list = vins.join(', ');
  return localize((language) =>
    pick(language, {
      en: `VIN not found on the account: ${list}.`,
      fr: `VIN introuvable sur le compte : ${list}.`,
      de: `VIN im Konto nicht gefunden: ${list}.`,
      es: `VIN no encontrado en la cuenta: ${list}.`,
    }),
  );
}
