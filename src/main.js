import './style.css'
import { buildMatrix } from './modules/qr-matrix.js'
import { matrixToSvgString, drawMatrixToCanvas, matrixToEps } from './modules/qr-renderers.js'
import { buildVCard, isVCardEmpty } from './modules/vcard.js'
import { buildUrlPayload, buildPhonePayload, buildEmailPayload, buildTextPayload } from './modules/content-builders.js'
import { assessDataDensity, assessTargetSize } from './modules/quality.js'
import { downloadBlob, downloadText } from './modules/download.js'
import { initAuthGate } from './modules/auth-gate.js'
import {
  COMPANY_NAME,
  COMPANY_WEBSITE,
  COMPANY_COUNTRY,
  PHONE_PREFIX,
  OFFICE_LOCATIONS,
  POSITION_OPTIONS,
} from './modules/company-data.js'
import { buildVCardFilename, buildCardFilename } from './modules/filename.js'
import { drawBusinessCard, loadCardStamp } from './modules/business-card.js'
import { buildCardPdf } from './modules/card-exports.js'

initAuthGate({ onUnlock: initApp })

const TONE_LABEL = { good: 'Gut', warn: 'Prüfen', bad: 'Kritisch' }

function initApp() {
  // ---------------------------------------------------------------------------
  // DOM references
  // ---------------------------------------------------------------------------

  const qrTypeSelect = document.getElementById('qrType')
  const form = document.getElementById('qrForm')
  const fieldsets = form.querySelectorAll('fieldset[data-type]')

  const errorCorrectionSelect = document.getElementById('errorCorrection')
  const targetSizeInput = document.getElementById('targetSize')
  const pngResolutionSelect = document.getElementById('pngResolution')

  const previewWrap = document.getElementById('qrPreviewWrap')
  const previewEl = document.getElementById('qrPreview')
  const qualityBox = document.getElementById('qualityBox')

  const downloadPngBtn = document.getElementById('downloadPng')
  const downloadSvgBtn = document.getElementById('downloadSvg')
  const downloadEpsBtn = document.getElementById('downloadEps')

  const cardPanel = document.getElementById('cardPanel')
  const cardPreviewWrap = document.getElementById('cardPreviewWrap')
  const cardCanvas = document.getElementById('cardCanvas')
  const downloadCardBtn = document.getElementById('downloadCard')
  const downloadCardPdfBtn = document.getElementById('downloadCardPdf')

  const vcardFieldIds = [
    'firstName', 'lastName', 'org', 'title',
    'mobile', 'email', 'website',
    'street', 'zip', 'city', 'country',
  ]

  // Holds the most recently rendered matrix + a filename hint for downloads.
  let currentMatrix = null
  let currentFileBase = 'qr-code'

  // ---------------------------------------------------------------------------
  // ilp2 presets: Standort (office) autofill, Position dropdown, phone prefix
  // ---------------------------------------------------------------------------

  const standortSelect = document.getElementById('vc-standort')
  const positionDatalist = document.getElementById('position-options')
  const phonePrefixEl = document.getElementById('vc-phonePrefix')
  const phoneExtInput = document.getElementById('vc-phoneExt')
  const orgInput = document.getElementById('vc-org')
  const websiteInput = document.getElementById('vc-website')
  const streetInput = document.getElementById('vc-street')
  const zipInput = document.getElementById('vc-zip')
  const cityInput = document.getElementById('vc-city')
  const countryInput = document.getElementById('vc-country')
  const firstNameInput = document.getElementById('vc-firstName')
  const lastNameInput = document.getElementById('vc-lastName')
  const emailInput = document.getElementById('vc-email')

  for (const location of OFFICE_LOCATIONS) {
    const option = document.createElement('option')
    option.value = location.id
    option.textContent = location.label
    standortSelect.appendChild(option)
  }

  // Position is a free-text field with suggestions, not a locked dropdown.
  for (const position of POSITION_OPTIONS) {
    const option = document.createElement('option')
    option.value = position
    positionDatalist.appendChild(option)
  }

  phonePrefixEl.textContent = `${PHONE_PREFIX} -`

  standortSelect.addEventListener('change', () => {
    const location = OFFICE_LOCATIONS.find((loc) => loc.id === standortSelect.value)
    if (!location) return
    orgInput.value = COMPANY_NAME
    websiteInput.value = COMPANY_WEBSITE
    streetInput.value = location.street
    zipInput.value = location.zip
    cityInput.value = location.city
    countryInput.value = COMPANY_COUNTRY
    render()
  })

  // Only digits, max 3 characters, in the extension field.
  phoneExtInput.addEventListener('input', () => {
    phoneExtInput.value = phoneExtInput.value.replace(/\D/g, '').slice(0, 3)
  })

  // Auto-fill the email as vorname.nachname@ilp2.de, but stop overwriting it
  // the moment the user types their own value in instead.
  let lastAutoEmail = ''

  function emailLocalPart(value) {
    return value
      .trim()
      .toLowerCase()
      .replace(/ä/g, 'ae')
      .replace(/ö/g, 'oe')
      .replace(/ü/g, 'ue')
      .replace(/ß/g, 'ss')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/\s+/g, '')
      .replace(/[^a-z0-9-]/g, '')
  }

  function updateAutoEmail() {
    const first = firstNameInput.value.trim()
    const last = lastNameInput.value.trim()
    if (!first || !last) return

    const candidate = `${emailLocalPart(first)}.${emailLocalPart(last)}@ilp2.de`
    if (emailInput.value.trim() === '' || emailInput.value.trim() === lastAutoEmail) {
      emailInput.value = candidate
      lastAutoEmail = candidate
      render()
    }
  }

  firstNameInput.addEventListener('input', updateAutoEmail)
  lastNameInput.addEventListener('input', updateAutoEmail)

  // ---------------------------------------------------------------------------
  // Type switching
  // ---------------------------------------------------------------------------

  function updateVisibleFieldset() {
    const type = qrTypeSelect.value
    fieldsets.forEach((fieldset) => {
      fieldset.hidden = fieldset.dataset.type !== type
    })
  }

  qrTypeSelect.addEventListener('change', () => {
    updateVisibleFieldset()
    render()
  })

  // ---------------------------------------------------------------------------
  // Payload building
  // ---------------------------------------------------------------------------

  function getVCardFields() {
    const fields = {}
    for (const id of vcardFieldIds) {
      fields[id] = document.getElementById(`vc-${id}`).value.trim()
    }
    // The base number is fixed for everyone - only the extension varies.
    const ext = phoneExtInput.value.trim()
    fields.phone = ext ? `${PHONE_PREFIX} - ${ext}` : PHONE_PREFIX
    return fields
  }

  /** @returns {{ payload: string, fileBase: string }} */
  function buildPayload() {
    const type = qrTypeSelect.value

    if (type === 'vcard') {
      const fields = getVCardFields()
      // The phone preset is always present, so ignore it when deciding
      // whether the card still counts as "empty" (otherwise the preview
      // would render a near-blank card as soon as the vCard type is picked).
      if (isVCardEmpty({ ...fields, phone: '' })) return { payload: '', fileBase: 'kontakt' }
      return { payload: buildVCard(fields), fileBase: buildVCardFilename(fields) }
    }

    if (type === 'url') {
      const raw = document.getElementById('url-value').value
      return { payload: buildUrlPayload(raw), fileBase: 'qrflow-webseite' }
    }

    if (type === 'phone') {
      const raw = document.getElementById('phone-value').value
      return { payload: buildPhonePayload(raw), fileBase: 'qrflow-telefonnummer' }
    }

    if (type === 'email') {
      const raw = document.getElementById('email-value').value
      return { payload: buildEmailPayload(raw), fileBase: 'qrflow-email' }
    }

    // text
    const raw = document.getElementById('text-value').value
    return { payload: buildTextPayload(raw), fileBase: 'qrflow-text' }
  }

  // ---------------------------------------------------------------------------
  // Quality panel
  // ---------------------------------------------------------------------------

  function qualityRow(tone, title, meta, hint) {
    return `<div class="quality-row tone-${tone}">
      <span class="status-pill">${TONE_LABEL[tone]}</span>
      <div>
        <p class="quality-label">${title}${meta ? ` <span class="mono">${meta}</span>` : ''}</p>
        <p class="quality-hint">${hint}</p>
      </div>
    </div>`
  }

  function renderQualityBox(matrix) {
    const density = assessDataDensity(matrix.version)
    const targetSizeMm = Number(targetSizeInput.value)
    const sizeAssessment = assessTargetSize(matrix.size, targetSizeMm)

    const rows = [
      qualityRow(
        density.tone,
        'Dateninhalt',
        `V${matrix.version} · ${matrix.size}×${matrix.size}`,
        density.hint,
      ),
    ]

    if (sizeAssessment) {
      rows.push(qualityRow(sizeAssessment.tone, sizeAssessment.label, null, sizeAssessment.hint))
    }

    qualityBox.innerHTML = rows.join('')
    qualityBox.hidden = false
  }

  // ---------------------------------------------------------------------------
  // Business card preview
  // ---------------------------------------------------------------------------

  // Re-render once the company stamp graphic and the webfonts used on the
  // card are available.
  let cardStampImage = null
  loadCardStamp().then((img) => {
    cardStampImage = img
    renderCard()
  })
  document.fonts.ready.then(renderCard)

  function renderCard() {
    const isVCard = qrTypeSelect.value === 'vcard'
    cardPanel.hidden = !isVCard
    if (!isVCard) return

    const fields = getVCardFields()
    const hasContent = Boolean(fields.firstName || fields.lastName)

    cardPreviewWrap.classList.toggle('is-empty', !hasContent)
    downloadCardBtn.disabled = !hasContent
    // The PDF export needs the QR code as well.
    downloadCardPdfBtn.disabled = !hasContent || !currentMatrix
    if (!hasContent) return

    drawBusinessCard(cardCanvas, { fields, matrix: currentMatrix, stampImage: cardStampImage })
  }

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------

  function render() {
    const { payload, fileBase } = buildPayload()
    currentFileBase = fileBase

    if (!payload) {
      currentMatrix = null
      previewWrap.classList.add('is-empty')
      previewEl.innerHTML = ''
      qualityBox.hidden = true
      setDownloadsEnabled(false)
      renderCard()
      return
    }

    const errorCorrectionLevel = errorCorrectionSelect.value
    currentMatrix = buildMatrix(payload, errorCorrectionLevel)

    previewWrap.classList.remove('is-empty')
    previewEl.innerHTML = matrixToSvgString(currentMatrix)

    renderQualityBox(currentMatrix)
    setDownloadsEnabled(true)
    renderCard()
  }

  function setDownloadsEnabled(enabled) {
    downloadPngBtn.disabled = !enabled
    downloadSvgBtn.disabled = !enabled
    downloadEpsBtn.disabled = !enabled
  }

  // ---------------------------------------------------------------------------
  // Downloads
  // ---------------------------------------------------------------------------

  downloadPngBtn.addEventListener('click', () => {
    if (!currentMatrix) return
    const requested = Number(pngResolutionSelect.value)
    const canvas = document.createElement('canvas')
    const { size } = drawMatrixToCanvas(currentMatrix, canvas, requested)
    canvas.toBlob((blob) => {
      downloadBlob(`${currentFileBase}-${size}px.png`, blob)
    }, 'image/png')
  })

  downloadSvgBtn.addEventListener('click', () => {
    if (!currentMatrix) return
    const svg = matrixToSvgString(currentMatrix)
    downloadText(`${currentFileBase}.svg`, svg, 'image/svg+xml')
  })

  downloadEpsBtn.addEventListener('click', () => {
    if (!currentMatrix) return
    const targetSizeMm = Number(targetSizeInput.value)
    const eps = matrixToEps(currentMatrix, { sizeMm: targetSizeMm > 0 ? targetSizeMm : 40 })
    downloadText(`${currentFileBase}.eps`, eps, 'application/postscript')
  })

  downloadCardBtn.addEventListener('click', () => {
    const fields = getVCardFields()
    if (!fields.firstName && !fields.lastName) return
    cardCanvas.toBlob((blob) => {
      downloadBlob(`${buildCardFilename(fields)}.png`, blob)
    }, 'image/png')
  })

  // Wraps the async card exports: disables the button while generating and
  // restores its label afterwards (or shows the error briefly on failure).
  function handleCardExport(button, exportFn) {
    button.addEventListener('click', async () => {
      const fields = getVCardFields()
      if ((!fields.firstName && !fields.lastName) || !currentMatrix) return

      const label = button.textContent
      button.disabled = true
      button.textContent = 'Wird erstellt …'
      try {
        await exportFn(fields)
      } catch (error) {
        console.error('Visitenkarten-Export fehlgeschlagen:', error)
        alert(`Export fehlgeschlagen: ${error.message}`)
      } finally {
        button.textContent = label
        button.disabled = false
      }
    })
  }

  handleCardExport(downloadCardPdfBtn, async (fields) => {
    const bytes = await buildCardPdf({ fields, matrix: currentMatrix, stampImage: cardStampImage })
    downloadBlob(`${buildCardFilename(fields)}.pdf`, new Blob([bytes], { type: 'application/pdf' }))
  })

  // ---------------------------------------------------------------------------
  // Live updates
  // ---------------------------------------------------------------------------

  form.addEventListener('input', render)
  errorCorrectionSelect.addEventListener('change', render)
  targetSizeInput.addEventListener('input', render)

  updateVisibleFieldset()
  render()
}
