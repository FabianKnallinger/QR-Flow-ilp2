// Renders the ilp2 business card (Visitenkarte) onto a canvas, following the
// fixed print layout from the InDesign template. The layout itself never
// changes - only the person-specific data (position, name, phone, e-mail,
// address) and the generated QR code are filled in from the form.
//
// All layout coordinates below are in millimeters on the 85 x 55 mm card and
// were measured from the reference card. The canvas is drawn at a fixed
// pixel-per-mm scale so the PNG export is print-resolution.
import { getRowRuns } from './qr-matrix.js'

export const CARD_WIDTH_MM = 85
export const CARD_HEIGHT_MM = 55

// White slug border around the trim area carrying the corner crop marks,
// like the designer's print PDF of the card.
export const SLUG_MM = 6.5
const CROP_MARK_GAP_MM = 1.8 // gap between the trim corner and the mark
const CROP_MARK_WIDTH_MM = 0.12

// ~600 dpi: 24 px/mm.
const PX_PER_MM = 24

const INK = '#000000'
const FONT = '"Karla"'

// Stamp aspect ratio (width/height) of the company stamp artwork - used for
// the fallback placeholder when the SVG has not loaded (yet).
const STAMP_ASPECT = 263.582 / 62.159

const LAYOUT = {
  marginLeft: 5,

  position: { size: 2.4, weight: 600, baseline: 7.4, tracking: 0.06 },
  rule: { y: 8.9, height: 0.18, extra: 1.2 },

  name: { size: 6.3, weight: 700, line1Baseline: 16.4, line2Baseline: 23.3, tracking: 0.01 },

  contact: { size: 2.75, weight: 400, firstBaseline: 30.8, lineHeight: 3.6 },

  // Company stamp (logo + wordmark as one fixed graphic), bottom-aligned
  // with the QR code like on the reference card.
  stamp: { x: 5, height: 6.6, bottom: 49.3 },

  qr: { size: 25.0, rightEdge: 82.0, bottomEdge: 49.3 },
}

/**
 * Loads the company stamp (logo + wordmark graphic, converted from the
 * print PDF) from the brand assets folder. Resolves to an HTMLImageElement
 * or null if the file is missing - the renderer then draws a placeholder.
 * @returns {Promise<HTMLImageElement | null>}
 */
export function loadCardStamp() {
  const candidates = ['brand/card-stamp.svg', 'brand/card-stamp.png']

  function tryLoad(index) {
    if (index >= candidates.length) return Promise.resolve(null)
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => resolve(tryLoad(index + 1))
      img.src = `${import.meta.env.BASE_URL}${candidates[index]}`
    })
  }

  return tryLoad(0)
}

/**
 * Position and size of the QR code on the card in millimeters (top-left
 * origin, y pointing down) - shared with the vector PDF export so the code
 * sits at exactly the same spot in every output format.
 * @returns {{ x: number, y: number, size: number }}
 */
export function getQrRectMm() {
  const { qr } = LAYOUT
  return { x: qr.rightEdge - qr.size, y: qr.bottomEdge - qr.size, size: qr.size }
}

// Uppercases like the card template: ß stays ß (JS toUpperCase would turn
// "Lißner" into "LISSNER", the printed cards keep the ß glyph).
export function cardUpperCase(value) {
  return [...value].map((ch) => (ch === 'ß' ? 'ß' : ch.toUpperCase())).join('')
}

function setFont(ctx, { size, weight, tracking = 0 }) {
  ctx.font = `${weight} ${size * PX_PER_MM}px ${FONT}`
  // Canvas letterSpacing expects a CSS length; not all browsers support it,
  // in which case the assignment is silently ignored.
  ctx.letterSpacing = `${tracking * size * PX_PER_MM}px`
}

function drawQr(ctx, matrix) {
  const { qr } = LAYOUT
  // Snap the module size to whole pixels so the code stays crisp (no
  // anti-aliased module edges that would hurt scan contrast).
  const moduleSize = Math.max(1, Math.floor((qr.size * PX_PER_MM) / matrix.size))
  const sizePx = moduleSize * matrix.size
  const x = Math.round(qr.rightEdge * PX_PER_MM) - sizePx
  const y = Math.round(qr.bottomEdge * PX_PER_MM) - sizePx

  ctx.fillStyle = INK
  for (const { row, col, span } of getRowRuns(matrix)) {
    ctx.fillRect(x + col * moduleSize, y + row * moduleSize, span * moduleSize, moduleSize)
  }
}

function drawStamp(ctx, stampImage, mm) {
  const { stamp } = LAYOUT
  const x = mm(stamp.x)
  const height = mm(stamp.height)
  const y = mm(stamp.bottom) - height
  const aspect = stampImage ? stampImage.width / stampImage.height : STAMP_ASPECT

  if (stampImage) {
    ctx.drawImage(stampImage, x, y, height * aspect, height)
    return
  }

  // Placeholder until brand/card-stamp.svg is available.
  ctx.fillStyle = INK
  ctx.fillRect(x, y, height, height)
  ctx.fillStyle = '#ffffff'
  setFont(ctx, { size: stamp.height * 0.42, weight: 700 })
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('iL2', x + height / 2, y + height * 0.54)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
}

// Two short lines per corner marking the trim edges, like the crop marks in
// the designer's print PDF. Drawn in untranslated page coordinates.
function drawCropMarks(ctx, mm) {
  const slug = mm(SLUG_MM)
  const markLength = mm(SLUG_MM - CROP_MARK_GAP_MM)
  const w = Math.max(1, Math.round(mm(CROP_MARK_WIDTH_MM)))
  const pageW = mm(CARD_WIDTH_MM + 2 * SLUG_MM)
  const pageH = mm(CARD_HEIGHT_MM + 2 * SLUG_MM)

  ctx.fillStyle = INK
  for (const trimX of [slug, pageW - slug]) {
    ctx.fillRect(Math.round(trimX - w / 2), 0, w, markLength)
    ctx.fillRect(Math.round(trimX - w / 2), pageH - markLength, w, markLength)
  }
  for (const trimY of [slug, pageH - slug]) {
    ctx.fillRect(0, Math.round(trimY - w / 2), markLength, w)
    ctx.fillRect(pageW - markLength, Math.round(trimY - w / 2), markLength, w)
  }
}

/**
 * Draws the complete card. Static layout + fixed company block; dynamic
 * person data and QR code from the form.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {{
 *   fields: { firstName?: string, lastName?: string, title?: string, phone?: string,
 *             email?: string, street?: string, zip?: string, city?: string },
 *   matrix: object | null,
 *   stampImage: HTMLImageElement | null,
 *   omitQr?: boolean, - skip the raster QR (the PDF export draws it as vector instead)
 * }} options
 */
export function drawBusinessCard(canvas, { fields, matrix, stampImage, omitQr = false }) {
  canvas.width = (CARD_WIDTH_MM + 2 * SLUG_MM) * PX_PER_MM
  canvas.height = (CARD_HEIGHT_MM + 2 * SLUG_MM) * PX_PER_MM

  const ctx = canvas.getContext('2d')
  const mm = (value) => value * PX_PER_MM
  const left = mm(LAYOUT.marginLeft)

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = INK

  drawCropMarks(ctx, mm)

  // Everything below is drawn in trim coordinates (origin = top-left trim
  // corner), so the layout values stay plain card millimeters.
  ctx.translate(mm(SLUG_MM), mm(SLUG_MM))

  // Position line with rule underneath - hidden when no position is set.
  const position = cardUpperCase((fields.title || '').trim())
  if (position) {
    setFont(ctx, LAYOUT.position)
    ctx.fillText(position, left, mm(LAYOUT.position.baseline))
    const textWidth = ctx.measureText(position).width
    ctx.fillRect(left, mm(LAYOUT.rule.y), textWidth + mm(LAYOUT.rule.extra), mm(LAYOUT.rule.height))
  }

  // Name: first name and last name on their own lines, uppercase.
  setFont(ctx, LAYOUT.name)
  const firstName = cardUpperCase((fields.firstName || '').trim())
  const lastName = cardUpperCase((fields.lastName || '').trim())
  if (firstName) ctx.fillText(firstName, left, mm(LAYOUT.name.line1Baseline))
  if (lastName) ctx.fillText(lastName, left, mm(LAYOUT.name.line2Baseline))

  // Contact block: phone / e-mail / address.
  setFont(ctx, LAYOUT.contact)
  const addressParts = [fields.street, [fields.zip, fields.city].filter(Boolean).join(' ')]
  const contactLines = [
    fields.phone,
    (fields.email || '').trim(),
    addressParts.filter((part) => part && part.trim()).join(', '),
  ].filter(Boolean)

  contactLines.forEach((line, index) => {
    ctx.fillText(line, left, mm(LAYOUT.contact.firstBaseline + index * LAYOUT.contact.lineHeight))
  })

  // Fixed company stamp (logo + wordmark as one graphic from the print PDF).
  drawStamp(ctx, stampImage, mm)

  if (matrix && !omitQr) drawQr(ctx, matrix)

  ctx.resetTransform()
}
