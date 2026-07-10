// Fills the designer's print PDF template with the person's data.
//
// The base is src/assets/visitenkarte-vorlage.pdf, built from the original
// print PDF by scripts/build-vorlage.py: person text and QR removed, all
// colors converted to CMYK, crop marks and TrimBox added, ISO Coated v2
// output intent embedded. Logo, stamp, position rule and the back page
// come unchanged from the original. At export time the new text is set in
// embedded Karla Regular/Bold at exactly the measured template coordinates
// and the QR code is drawn as vector rectangles into the original QR frame
// - everything in pure CMYK black (0/0/0/100) so nothing separates onto
// the CMY plates. The result is stamped as PDF/X-3:2002 for the printer.
import { PDFDocument, PDFName, PDFString, cmyk } from 'pdf-lib'
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

  // PDF/X-3:2002 document identification (the output intent with the ISO
  // Coated v2 profile is already part of the template).
  const now = new Date()
  pdf.setTitle('ilp2 Visitenkarte')
  pdf.setProducer('QR-Flow ilp2')
  pdf.setCreator('QR-Flow ilp2')
  pdf.setCreationDate(now)
  pdf.setModificationDate(now)
  const info = pdf.context.lookup(pdf.context.trailerInfo.Info)
  info.set(PDFName.of('GTS_PDFXVersion'), PDFString.of('PDF/X-3:2002'))
  info.set(PDFName.of('Trapped'), PDFName.of('False'))

  // Page 0 is the card's back (stays untouched), page 1 the front.
  const page = pdf.getPage(1)
  const black = cmyk(0, 0, 0, 1)
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

  // Object streams are a PDF 1.5 feature - PDF/X-3:2002 is based on 1.3/1.4,
  // so save with a classic cross-reference table.
  const bytes = await pdf.save({ useObjectStreams: false })
  return finalizePdfX3(bytes)
}

// One byte-level fix pdf-lib cannot do itself: PDF/X-3:2002 requires a
// header version <= 1.4, pdf-lib always writes 1.7. The replacement is
// same-length, so no byte offsets shift. (The trailer /ID that PDF/X also
// requires is written by pdf-lib itself.)
function finalizePdfX3(bytes) {
  const header = '%PDF-1.3'
  for (let i = 0; i < header.length; i++) bytes[i] = header.charCodeAt(i)
  return bytes
}
