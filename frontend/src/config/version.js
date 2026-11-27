// Configuración centralizada de versión de PDFNauta.
// Para subir de versión (ej. a "V1.1"), actualizá APP_VERSION, APP_RELEASE_DATE y agregá una entrada al inicio de CHANGELOG.

export const APP_VERSION = "V1.0";
export const APP_RELEASE_DATE = "27/11/2026";

export const APP_VERSION_STATUS = {
  es: "Versión estable",
  en: "Stable release",
};

/**
 * @typedef {Object} ChangelogEntry
 * @property {string} version
 * @property {string} date
 * @property {{ es: string, en: string }} summary
 */

/** @type {ChangelogEntry[]} */
export const CHANGELOG = [
  {
    version: APP_VERSION,
    date: APP_RELEASE_DATE,
    summary: {
      es: "Conversión 100% en tu dispositivo, sin servidor, rapidísima. Soporte para OCR de fotos y PDFs escaneados. Funciona en celular y PC.",
      en: "100% on-device conversion, serverless and ultra-fast. OCR support for photos and scanned PDFs. Works on mobile and desktop.",
    },
  },
];
