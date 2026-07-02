import './style.css'
import { buildMatrix } from './modules/qr-matrix.js'
import { matrixToSvgString, drawMatrixToCanvas, matrixToEps } from './modules/qr-renderers.js'
import { buildVCard, isVCardEmpty } from './modules/vcard.js'
import { buildUrlPayload, buildPhonePayload, buildEmailPayload, buildTextPayload } from './modules/content-builders.js'
import { assessDataDensity, assessTargetSize } from './modules/quality.js'
import { downloadBlob, downloadText, slugify } from './modules/download.js'
import { initAuthGate } from './modules/auth-gate.js'

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

  const vcardFieldIds = [
    'firstName', 'lastName', 'org', 'title',
    'phone', 'mobile', 'email', 'website',
    'street', 'zip', 'city', 'country',
  ]

  // Holds the most recently rendered matrix + a filename hint for downloads.
  let currentMatrix = null
  let currentFileBase = 'qr-code'

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
    return fields
  }

  /** @returns {{ payload: string, fileBase: string }} */
  function buildPayload() {
    const type = qrTypeSelect.value

    if (type === 'vcard') {
      const fields = getVCardFields()
      if (isVCardEmpty(fields)) return { payload: '', fileBase: 'kontakt' }
      const name = [fields.firstName, fields.lastName].filter(Boolean).join('-') || fields.org || 'kontakt'
      return { payload: buildVCard(fields), fileBase: `vcard-${slugify(name)}` }
    }

    if (type === 'url') {
      const raw = document.getElementById('url-value').value
      return { payload: buildUrlPayload(raw), fileBase: 'webseite' }
    }

    if (type === 'phone') {
      const raw = document.getElementById('phone-value').value
      return { payload: buildPhonePayload(raw), fileBase: 'telefonnummer' }
    }

    if (type === 'email') {
      const raw = document.getElementById('email-value').value
      return { payload: buildEmailPayload(raw), fileBase: 'email' }
    }

    // text
    const raw = document.getElementById('text-value').value
    return { payload: buildTextPayload(raw), fileBase: 'text' }
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
      return
    }

    const errorCorrectionLevel = errorCorrectionSelect.value
    currentMatrix = buildMatrix(payload, errorCorrectionLevel)

    previewWrap.classList.remove('is-empty')
    previewEl.innerHTML = matrixToSvgString(currentMatrix)

    renderQualityBox(currentMatrix)
    setDownloadsEnabled(true)
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
      downloadBlob(`qrflow-${currentFileBase}-${size}px.png`, blob)
    }, 'image/png')
  })

  downloadSvgBtn.addEventListener('click', () => {
    if (!currentMatrix) return
    const svg = matrixToSvgString(currentMatrix)
    downloadText(`qrflow-${currentFileBase}.svg`, svg, 'image/svg+xml')
  })

  downloadEpsBtn.addEventListener('click', () => {
    if (!currentMatrix) return
    const targetSizeMm = Number(targetSizeInput.value)
    const eps = matrixToEps(currentMatrix, { sizeMm: targetSizeMm > 0 ? targetSizeMm : 40 })
    downloadText(`qrflow-${currentFileBase}.eps`, eps, 'application/postscript')
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
