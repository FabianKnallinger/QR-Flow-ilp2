// Renders the ilp2 business card (Visitenkarte) onto a canvas for the live
// preview and the PNG download. The layout replicates the designer's print
// PDF template (ILP2_Visitenkarte_260613_04.pdf, front page) exactly: every
// coordinate below was read from the template's PDF content stream and
// converted from points to millimeters. The PDF download in
// card-exports.js uses the original template file itself - this canvas
// mirrors it so preview, PNG and PDF all look the same.
//
// All text is Karla Regular, like in the template.
import { getRowRuns } from './qr-matrix.js'

export const CARD_WIDTH_MM = 85
export const CARD_HEIGHT_MM = 55

// ~600 dpi: 24 px/mm.
const PX_PER_MM = 24

const INK = '#000000'
const FONT = '"Karla"'

// Stamp aspect ratio (width/height) of the company stamp artwork - used for
// the fallback placeholder when the SVG has not loaded (yet).
const STAMP_ASPECT = 263.582 / 62.159

// Template geometry in millimeters from the top-left trim corner; y values
// on text entries are baselines, exactly as in the template PDF.
const LAYOUT = {
  position: { x: 4.8803, size: 2.4694, baseline: 6.5591 },

  // The rule under the position line is a fixed part of the template: it
  // always runs from the left margin up to the QR frame, independent of how
  // long the position text is.
  rule: { x0: 4.9642, x1: 59.9644, y: 7.8791, stroke: 0.169 },

  // The name is set in Karla Bold, everything else in Karla Regular.
  name: { x: 4.5361, size: 8.4515, weight: 700, line1Baseline: 16.7502, line2Baseline: 24.3565 },

  contact: { x: 5.0, size: 3.175, firstBaseline: 31.8861, lineHeight: 3.8798 },

  // Company stamp (logo + wordmark as one fixed graphic).
  stamp: { x: 5, height: 7.0, bottom: 50.0 },

  // Frame of the QR code in the template.
  qr: { x: 60.0003, y: 30.0002, size: 19.9337 },
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

// Uppercases like the card template: ß stays ß (JS toUpperCase would turn
// "Lißner" into "LISSNER", the printed cards keep the ß glyph).
export function cardUpperCase(value) {
  return [...value].map((ch) => (ch === 'ß' ? 'ß' : ch.toUpperCase())).join('')
}

/**
 * The contact block lines (phone / e-mail / address) exactly as they appear
 * on the card - shared between the canvas renderer and the PDF export.
 * @returns {string[]}
 */
export function buildContactLines(fields) {
  const address = [fields.street, [fields.zip, fields.city].filter(Boolean).join(' ')]
    .filter((part) => part && part.trim())
    .join(', ')

  return [fields.phone, (fields.email || '').trim(), address].filter(Boolean)
}

function setFont(ctx, sizeMm, weight = 400) {
  ctx.font = `${weight} ${sizeMm * PX_PER_MM}px ${FONT}`
}

function drawQr(ctx, matrix) {
  const { qr } = LAYOUT
  // The QR always fills the template's frame exactly, so the module size is
  // fractional. Runs get a tiny overlap so no white hairline seams appear
  // between rows at fractional pixel positions.
  const moduleSize = (qr.size * PX_PER_MM) / matrix.size
  const x0 = qr.x * PX_PER_MM
  const y0 = qr.y * PX_PER_MM
  const overlap = 0.4

  ctx.fillStyle = INK
  for (const { row, col, span } of getRowRuns(matrix)) {
    ctx.fillRect(
      x0 + col * moduleSize,
      y0 + row * moduleSize,
      span * moduleSize + overlap,
      moduleSize + overlap,
    )
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
  setFont(ctx, stamp.height * 0.42)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('iL2', x + height / 2, y + height * 0.54)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
}

/**
 * Draws the complete card front. Static layout + fixed company stamp;
 * dynamic person data and QR code from the form.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {{
 *   fields: { firstName?: string, lastName?: string, title?: string, phone?: string,
 *             email?: string, street?: string, zip?: string, city?: string },
 *   matrix: object | null,
 *   stampImage: HTMLImageElement | null,
 * }} options
 */
export function drawBusinessCard(canvas, { fields, matrix, stampImage }) {
  canvas.width = CARD_WIDTH_MM * PX_PER_MM
  canvas.height = CARD_HEIGHT_MM * PX_PER_MM

  const ctx = canvas.getContext('2d')
  const mm = (value) => value * PX_PER_MM

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = INK

  // Position line - the rule below it is static template art and is always
  // drawn in full length, even when the position text is short or empty.
  const position = cardUpperCase((fields.title || '').trim())
  if (position) {
    setFont(ctx, LAYOUT.position.size)
    ctx.fillText(position, mm(LAYOUT.position.x), mm(LAYOUT.position.baseline))
  }
  const { rule } = LAYOUT
  ctx.fillRect(mm(rule.x0), mm(rule.y - rule.stroke / 2), mm(rule.x1 - rule.x0), mm(rule.stroke))

  // Name: first name and last name on their own lines, uppercase.
  setFont(ctx, LAYOUT.name.size, LAYOUT.name.weight)
  const firstName = cardUpperCase((fields.firstName || '').trim())
  const lastName = cardUpperCase((fields.lastName || '').trim())
  if (firstName) ctx.fillText(firstName, mm(LAYOUT.name.x), mm(LAYOUT.name.line1Baseline))
  if (lastName) ctx.fillText(lastName, mm(LAYOUT.name.x), mm(LAYOUT.name.line2Baseline))

  // Contact block: phone / e-mail / address.
  setFont(ctx, LAYOUT.contact.size)
  buildContactLines(fields).forEach((line, index) => {
    ctx.fillText(
      line,
      mm(LAYOUT.contact.x),
      mm(LAYOUT.contact.firstBaseline + index * LAYOUT.contact.lineHeight),
    )
  })

  // Fixed company stamp (logo + wordmark as one graphic from the print PDF).
  drawStamp(ctx, stampImage, mm)

  if (matrix) drawQr(ctx, matrix)
}
