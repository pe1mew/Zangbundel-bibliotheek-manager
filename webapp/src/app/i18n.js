// SPDX-License-Identifier: Apache-2.0
// Texts in Dutch, English and German (FDS 7.9, webappGUI GD-17, GD-26). Only the texts the
// current screens use; the rest comes with the screens (M4 onwards).

const TEXTS = {
  nl: {
    appName: 'Zangbundel bibliotheek-manager',
    tagline: 'Liedbibliotheken maken voor de Zangbundel-app',
    version: 'versie {v}',
    clickToContinue: 'Klik om door te gaan',
    testBanner: 'TESTVERSIE — niet voor echte bibliotheken of sleutels',
    buildingTitle: 'In aanbouw',
    buildingText: 'Deze versie toont alleen het startscherm. De bibliotheek-manager wordt nu gebouwd.',
    privacy: 'Je liedjes en je sleutel blijven op je eigen computer; niets ervan gaat naar deze server.',
  },
  en: {
    appName: 'Zangbundel library manager',
    tagline: 'Making song libraries for the Zangbundel app',
    version: 'version {v}',
    clickToContinue: 'Click to continue',
    testBanner: 'TEST VERSION — not for real libraries or keys',
    buildingTitle: 'Being built',
    buildingText: 'This version shows only the start screen. The library manager is being built now.',
    privacy: 'Your songs and your key stay on your own computer; nothing of them goes to this server.',
  },
  de: {
    appName: 'Zangbundel Bibliotheksverwaltung',
    tagline: 'Liederbibliotheken für die Zangbundel-App erstellen',
    version: 'Version {v}',
    clickToContinue: 'Klicken zum Fortfahren',
    testBanner: 'TESTVERSION — nicht für echte Bibliotheken oder Schlüssel',
    buildingTitle: 'Im Aufbau',
    buildingText: 'Diese Version zeigt nur den Startbildschirm. Die Bibliotheksverwaltung wird gerade gebaut.',
    privacy: 'Deine Lieder und dein Schlüssel bleiben auf deinem eigenen Computer; nichts davon geht an diesen Server.',
  },
};

export const LANGUAGES = Object.freeze(Object.keys(TEXTS));

/** The first of the browser's languages that the manager offers, else English (EDT-80, EDT-81). */
export function pickLanguage(preferred) {
  for (const tag of preferred || []) {
    const base = String(tag).toLowerCase().split('-')[0];
    if (LANGUAGES.includes(base)) {
      return base;
    }
  }
  return 'en';
}

/** The text for a key in a language, with {name} placeholders filled in. */
export function t(lang, key, params) {
  const text = (TEXTS[lang] || TEXTS.en)[key];
  if (text === undefined) {
    throw new Error(`i18n: no text for ${key}`);
  }
  return text.replace(/\{(\w+)\}/g, (_, name) => String((params || {})[name] ?? ''));
}
