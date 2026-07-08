// Print PDF export for the business card, matching the designer's print PDF:
// trim area 85 x 55 mm plus a white slug border with corner crop marks. The
// card artwork is embedded as a ~600 dpi raster (exactly what the on-screen
// preview shows), while the QR code is drawn on top as pure vector
// rectangles so it stays razor sharp in print.
import { PDFDocument, rgb } from 'pdf-lib'
import { getRowRuns } from './qr-matrix.js'
import {
  drawBusinessCard,
  getQrRectMm,
  CARD_WIDTH_MM,
  CARD_HEIGHT_MM,
  SLUG_MM,
} from './business-card.js'

const PT_PER_MM = 72 / 25.4

function canvasToPngBytes(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error('Canvas-Export fehlgeschlagen'))
      blob.arrayBuffer().then(resolve, reject)
    }, 'image/png')
  })
}

/**
 * Builds the print PDF for the card.
 * @param {{ fields: object, matrix: object, stampImage: HTMLImageElement | null }} options
 * @returns {Promise<Uint8Array>} the PDF bytes
 */
export async function buildCardPdf({ fields, matrix, stampImage }) {
  // Render the card without the QR - the QR goes in as vector below, and a
  // raster copy underneath would peek out from behind the vector modules.
  const canvas = document.createElement('canvas')
  drawBusinessCard(canvas, { fields, matrix, stampImage, omitQr: true })
  const pngBytes = await canvasToPngBytes(canvas)

  const pdf = await PDFDocument.create()
  pdf.setTitle('ilp2 Visitenkarte')
  pdf.setProducer('QR-Flow ilp2')

  const pageWidthMm = CARD_WIDTH_MM + 2 * SLUG_MM
  const pageHeightMm = CARD_HEIGHT_MM + 2 * SLUG_MM
  const page = pdf.addPage([pageWidthMm * PT_PER_MM, pageHeightMm * PT_PER_MM])
  const png = await pdf.embedPng(pngBytes)
  page.drawImage(png, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() })

  if (matrix) {
    const qr = getQrRectMm()
    const moduleMm = qr.size / matrix.size
    const black = rgb(0, 0, 0)

    for (const { row, col, span } of getRowRuns(matrix)) {
      page.drawRectangle({
        x: (SLUG_MM + qr.x + col * moduleMm) * PT_PER_MM,
        // PDF's origin is bottom-left with y pointing up, so rows are flipped.
        y: (pageHeightMm - SLUG_MM - qr.y - (row + 1) * moduleMm) * PT_PER_MM,
        width: span * moduleMm * PT_PER_MM,
        height: moduleMm * PT_PER_MM,
        color: black,
      })
    }
  }

  return pdf.save()
}
