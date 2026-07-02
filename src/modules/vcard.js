// Builds an RFC 6350 (vCard 3.0) payload from contact fields.
// Only fields that were actually filled in end up as lines in the output.

function esc(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
}

/**
 * @param {{
 *   firstName?: string, lastName?: string, org?: string, title?: string,
 *   phone?: string, mobile?: string, email?: string, website?: string,
 *   street?: string, zip?: string, city?: string, country?: string,
 * }} fields
 * @returns {string} vCard 3.0 text with CRLF line endings
 */
export function buildVCard(fields) {
  const {
    firstName = '', lastName = '', org = '', title = '',
    phone = '', mobile = '', email = '', website = '',
    street = '', zip = '', city = '', country = '',
  } = fields

  const lines = ['BEGIN:VCARD', 'VERSION:3.0']

  if (firstName || lastName) {
    lines.push(`N:${esc(lastName)};${esc(firstName)};;;`)
  }

  // FN is mandatory in the vCard spec - fall back to org/name so the card stays valid.
  const fullName = [firstName, lastName].filter(Boolean).join(' ') || org || 'Kontakt'
  lines.push(`FN:${esc(fullName)}`)

  if (org) lines.push(`ORG:${esc(org)}`)
  if (title) lines.push(`TITLE:${esc(title)}`)
  if (phone) lines.push(`TEL;TYPE=WORK,VOICE:${esc(phone)}`)
  if (mobile) lines.push(`TEL;TYPE=CELL:${esc(mobile)}`)
  if (email) lines.push(`EMAIL;TYPE=INTERNET:${esc(email)}`)
  if (website) lines.push(`URL:${esc(website)}`)

  if (street || zip || city || country) {
    // ADR;TYPE=WORK:PoBox;Extended;Street;City;Region;PostalCode;Country
    const adr = ['', '', street, city, '', zip, country].map(esc).join(';')
    lines.push(`ADR;TYPE=WORK:${adr}`)
  }

  lines.push('END:VCARD')
  return lines.join('\r\n')
}

export function isVCardEmpty(fields) {
  return Object.values(fields).every((value) => !value || !String(value).trim())
}
