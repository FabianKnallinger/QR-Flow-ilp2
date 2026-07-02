// Triggers a browser file download for a Blob without navigating away.
export function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function downloadText(filename, text, mime) {
  downloadBlob(filename, new Blob([text], { type: mime }))
}

export function slugify(value) {
  return (
    String(value)
      .trim()
      .toLowerCase()
      .replace(/[äöüß]/g, (c) => ({ ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' }[c]))
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'qr-code'
  )
}
