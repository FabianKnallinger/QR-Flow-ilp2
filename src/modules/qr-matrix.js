// Thin wrapper around the `qrcode` package's low-level encoder.
// We only use it for the encoding/error-correction math (Reed-Solomon, mask
// selection, segment mode). The actual pixel/vector output is produced by
// our own renderers in qr-renderers.js so we have full control over the
// quiet zone (none), colors (pure black) and transparency.
import QRCode from 'qrcode'

/**
 * Encodes `data` into a QR matrix.
 * @param {string} data - payload to encode (vCard, URL, tel:, mailto:, text ...)
 * @param {'L'|'M'|'Q'|'H'} errorCorrectionLevel
 * @returns {{ size: number, isDark: (row: number, col: number) => boolean, version: number, errorCorrectionLevel: string }}
 */
export function buildMatrix(data, errorCorrectionLevel = 'M') {
  const qr = QRCode.create(data, { errorCorrectionLevel })
  const { size, data: bits } = qr.modules

  return {
    size,
    isDark: (row, col) => Boolean(bits[row * size + col] & 1),
    version: qr.version,
    errorCorrectionLevel: qr.errorCorrectionLevel.level ?? errorCorrectionLevel,
  }
}

/**
 * Merges each row's dark modules into horizontal runs. This keeps SVG paths
 * and EPS output small and avoids hairline anti-aliasing seams between
 * adjacent modules when rendering to canvas.
 * @returns {{ row: number, col: number, span: number }[]}
 */
export function getRowRuns(matrix) {
  const runs = []
  for (let row = 0; row < matrix.size; row++) {
    let col = 0
    while (col < matrix.size) {
      if (matrix.isDark(row, col)) {
        const start = col
        while (col < matrix.size && matrix.isDark(row, col)) col++
        runs.push({ row, col: start, span: col - start })
      } else {
        col++
      }
    }
  }
  return runs
}
