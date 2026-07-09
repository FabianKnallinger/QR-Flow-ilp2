// Fills the designer's print PDF template with the person's data.
//
// The base is src/assets/visitenkarte-vorlage.pdf - the ORIGINAL print PDF
// (ILP2_Visitenkarte_260613_04.pdf, back + front page) with only the
// person-specific text and the QR code removed. Logo, company stamp, the
// rule under the position line and the back side stay byte-identical to
// the original. At export time the new text is set in the embedded Karla
// Regular at exactly the coordinates measured from the original PDF, and
// the QR code is drawn as vector rectangles into exactly the frame the
// original QR occupied.
import { PDFDocument, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { getRowRuns } from './qr-matrix.js'
import { cardUpperCase, buildContactLines } from './business-card.js'
import templateUrl from '../assets/visitenkarte-vorlage.pdf?url'
import karlaUrl from '../assets/Karla-Regular.ttf?url'
import karlaBoldUrl from '../assets/Karla-Bold.ttf?url'

// Exact text/QR geometry read from the original template's PDF content
// stream. Coordinates are PDF points with the origin at the BOTTOM-left
// page corner (PDF convention); the y values are text baselines.
const TPL = {
  position: { x: 13.8339, size: 7, baseline: 137.3133 },
  name: { x: 12.8583, size: 23.9571, baseline1: 108.4252, baseline2: 86.8638 },
  contact: { x: 14.1732, size: 9, baseline1: 65.5201, leading: 10.998 },
  // The frame of the original QR code (points, from the bottom-left).
  qr: { x: 170.078, yBottom: 14.362, size: 56.505 },
}

// Template + font are fetched once and reused across exports.
let assetsPromise = null

function loadAssets() {
  if (!assetsPromise) {
    assetsPromise = Promise.all(
      [templateUrl, karlaUrl, karlaBoldUrl].map(async (url) => {
        const response = await fetch(url)
        if (!response.ok) throw new Error(`Vorlage konnte nicht geladen werden (${response.status})`)
        return response.arrayBuffer()
      }),
    )
  }
  return assetsPromise
}

/**
 * Builds the print PDF: the original two-page template (back + front) with
 * the person's data and QR code filled in on the front.
 * @param {{ fields: object, matrix: object | null }} options
 * @returns {Promise<Uint8Array>} the PDF bytes
 */
export async function buildCardPdf({ fields, matrix }) {
  const [templateBytes, karlaBytes, karlaBoldBytes] = await loadAssets()

  const pdf = await PDFDocument.load(templateBytes)
  pdf.registerFontkit(fontkit)
  // Like in the original: the name is Karla Bold, everything else Regular.
  const karla = await pdf.embedFont(karlaBytes, { subset: true })
  const karlaBold = await pdf.embedFont(karlaBoldBytes, { subset: true })
  pdf.setTitle('ilp2 Visitenkarte')
  pdf.setProducer('QR-Flow ilp2')

  // Page 0 is the card's back (stays untouched), page 1 the front.
  const page = pdf.getPage(1)
  const black = rgb(0, 0, 0)
  const text = (value, x, y, size, font = karla) =>
    page.drawText(value, { x, y, size, font, color: black })

  const position = cardUpperCase((fields.title || '').trim())
  if (position) text(position, TPL.position.x, TPL.position.baseline, TPL.position.size)

  const firstName = cardUpperCase((fields.firstName || '').trim())
  const lastName = cardUpperCase((fields.lastName || '').trim())
  if (firstName) text(firstName, TPL.name.x, TPL.name.baseline1, TPL.name.size, karlaBold)
  if (lastName) text(lastName, TPL.name.x, TPL.name.baseline2, TPL.name.size, karlaBold)

  buildContactLines(fields).forEach((line, index) => {
    text(line, TPL.contact.x, TPL.contact.baseline1 - index * TPL.contact.leading, TPL.contact.size)
  })

  if (matrix) {
    const moduleSize = TPL.qr.size / matrix.size
    for (const { row, col, span } of getRowRuns(matrix)) {
      page.drawRectangle({
        x: TPL.qr.x + col * moduleSize,
        // PDF y points up, so rows are measured down from the frame top.
        y: TPL.qr.yBottom + TPL.qr.size - (row + 1) * moduleSize,
        width: span * moduleSize,
        height: moduleSize,
        color: black,
      })
    }
  }

  return pdf.save()
}
