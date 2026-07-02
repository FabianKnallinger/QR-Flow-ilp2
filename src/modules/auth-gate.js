// Simple client-side access gate. This is NOT real security - the app is a
// static site with no backend, so a determined visitor can always read the
// source. It only stops casual/accidental access before launch (e.g. a
// shared preview link). Do not put anything genuinely secret behind this.
const PASSWORD_HASH = '47920e9140aded869a82f42f112dfb417a96b141ab07b7bda8f8e0355a0c6887'
const STORAGE_KEY = 'qrflow-ilp2-unlocked'

async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Shows a password screen until the correct password is entered, then reveals
 * #appContent and remembers the unlock in this browser via localStorage.
 * @param {{ onUnlock: () => void }} options
 */
export function initAuthGate({ onUnlock }) {
  const lockScreen = document.getElementById('lockScreen')
  const appContent = document.getElementById('appContent')
  const form = document.getElementById('lockForm')
  const input = document.getElementById('lockPassword')
  const error = document.getElementById('lockError')

  function unlock() {
    lockScreen.hidden = true
    appContent.hidden = false
    onUnlock()
  }

  if (localStorage.getItem(STORAGE_KEY) === '1') {
    unlock()
    return
  }

  input.focus()

  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    const hash = await sha256Hex(input.value)

    if (hash === PASSWORD_HASH) {
      localStorage.setItem(STORAGE_KEY, '1')
      unlock()
    } else {
      error.hidden = false
      input.value = ''
      input.focus()
    }
  })
}
