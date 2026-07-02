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
