// Builds file names for vCard exports following ilp2's internal document
// naming convention (matches the pattern used for other company assets,
// e.g. "ILP2_ALL_0_00-000_Logo-RGB-Bi-s-w_3_260323"): a fixed prefix, the
// contact's name, a fixed "_V_" marker, and today's date as YYMMDD.
const QR_PREFIX = 'ILP2_ALL_0_00-000_QR-Code-'
const CARD_PREFIX = 'ILP2_ALL_0_00-000_Visitenkarte-'
const MIDDLE = '_V_'

function sanitizeNamePart(value) {
  return value
    .trim()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/Ä/g, 'Ae')
    .replace(/Ö/g, 'Oe')
    .replace(/Ü/g, 'Ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9-]/g, '')
}

function todayStamp() {
  const now = new Date()
  const yy = String(now.getFullYear()).slice(-2)
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${yy}${mm}${dd}`
}

function buildName(prefix, { firstName = '', lastName = '', org = '' }) {
  const nameParts = [firstName, lastName].filter(Boolean).map(sanitizeNamePart)
  const namePart = nameParts.length ? nameParts.join('-') : sanitizeNamePart(org) || 'Kontakt'
  return `${prefix}${namePart}${MIDDLE}${todayStamp()}`
}

/**
 * @param {{ firstName?: string, lastName?: string, org?: string }} fields
 * @returns {string} file base name, without extension
 */
export function buildVCardFilename(fields) {
  return buildName(QR_PREFIX, fields)
}

/**
 * Same convention as the QR export, but for the business card PNG.
 * @param {{ firstName?: string, lastName?: string, org?: string }} fields
 * @returns {string} file base name, without extension
 */
export function buildCardFilename(fields) {
  return buildName(CARD_PREFIX, fields)
}
