// Turns raw form input into the final string that gets encoded into the QR code.

export function buildUrlPayload(value) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  // Add a scheme if the user typed a bare domain like "example.com".
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

export function buildPhonePayload(value) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  return `tel:${trimmed.replace(/[^\d+]/g, '')}`
}

export function buildEmailPayload(value) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  return `mailto:${trimmed}`
}

export function buildTextPayload(value) {
  return value.trim()
}
