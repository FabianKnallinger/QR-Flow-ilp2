// Heuristics that estimate how reliably a QR code will scan.
// These are rules of thumb (not a guarantee) based on common print/scan
// guidance: more modules = smaller details = harder to scan when printed
// small; and each module should stay above roughly 0.3-0.4mm at typical
// phone-camera scanning distances.

const DENSITY_LEVELS = [
  { maxVersion: 6, label: 'Niedrig', tone: 'good', hint: 'Wenig Daten – der QR-Code bleibt auch bei kleinen Druckgrößen gut lesbar.' },
  { maxVersion: 12, label: 'Mittel', tone: 'good', hint: 'Moderate Datenmenge – in den meisten Druckgrößen gut lesbar.' },
  { maxVersion: 22, label: 'Erhöht', tone: 'warn', hint: 'Viele Daten – bei sehr kleinen Druckgrößen kann die Lesbarkeit leiden. Eher größer drucken.' },
  { maxVersion: 40, label: 'Hoch', tone: 'bad', hint: 'Sehr viele Daten – der Code hat viele kleine Module. Ausreichend groß drucken (empfohlen ≥ 3-4 cm) oder Inhalt kürzen.' },
]

/**
 * Rates how much data is packed into the code, independent of any target size.
 * @param {number} version - QR version (1-40) as returned by buildMatrix()
 */
export function assessDataDensity(version) {
  return DENSITY_LEVELS.find((level) => version <= level.maxVersion) ?? DENSITY_LEVELS[DENSITY_LEVELS.length - 1]
}

const MIN_RELIABLE_MODULE_MM = 0.4
const MIN_USABLE_MODULE_MM = 0.3

/**
 * Estimates whether a given physical print size will scan reliably.
 * @param {number} matrixSize - modules per side
 * @param {number} targetSizeMm - planned edge length of the printed code in mm
 */
export function assessTargetSize(matrixSize, targetSizeMm) {
  if (!targetSizeMm || targetSizeMm <= 0) return null

  const moduleSizeMm = targetSizeMm / matrixSize
  let tone
  let label

  if (moduleSizeMm >= MIN_RELIABLE_MODULE_MM) {
    tone = 'good'
    label = 'Voraussichtlich gut scanbar'
  } else if (moduleSizeMm >= MIN_USABLE_MODULE_MM) {
    tone = 'warn'
    label = 'Eingeschränkt scanbar'
  } else {
    tone = 'bad'
    label = 'Vermutlich nicht zuverlässig scanbar'
  }

  return {
    tone,
    label,
    moduleSizeMm,
    hint: `Bei ${targetSizeMm} mm Kantenlänge ist jedes Modul ca. ${moduleSizeMm.toFixed(2)} mm groß.`,
  }
}
