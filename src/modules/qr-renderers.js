// Renders a QR matrix (see qr-matrix.js) to SVG, Canvas/PNG and EPS.
// All three renderers share the same design rules required for print-ready
// output: no quiet zone/border, pure black modules, transparent background.
import { getRowRuns } from './qr-matrix.js'

const DARK = '#000000'
const PT_PER_MM = 2.834645669

// --- SVG (vector, transparent background by omission of any bg rect) -----

export function matrixToSvgString(matrix) {
  const runs = getRowRuns(matrix)
  const d = runs.map(({ row, col, span }) => `M${col} ${row}h${span}v1h-${span}z`).join('')

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${matrix.size} ${matrix.size}" ` +
    `shape-rendering="crispEdges">` +
    `<path d="${d}" fill="${DARK}"/>` +
    `</svg>`
  )
}

// --- Canvas / PNG ----------------------------------------------------------

/**
 * Snaps a requested pixel size to the nearest exact multiple of the module
 * count. This keeps every module an integer number of pixels wide/tall so
 * edges stay crisp (no anti-aliased seams that could hurt scan contrast).
 */
export function snapPixelSize(matrixSize, requestedPixelSize) {
  const scale = Math.max(1, Math.round(requestedPixelSize / matrixSize))
  return scale * matrixSize
}

/**
 * Draws the matrix onto `canvas` at exactly `pixelSize` x `pixelSize` with a
 * fully transparent background and pure black modules.
 */
export function drawMatrixToCanvas(matrix, canvas, pixelSize) {
  const size = snapPixelSize(matrix.size, pixelSize)
  const moduleSize = size / matrix.size

  canvas.width = size
  canvas.height = size

  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, size, size)
  ctx.fillStyle = DARK

  for (const { row, col, span } of getRowRuns(matrix)) {
    ctx.fillRect(col * moduleSize, row * moduleSize, span * moduleSize, moduleSize)
  }

  return { canvas, size }
}

// --- EPS (PostScript vector, for print workflows) ---------------------------

/**
 * Builds an Encapsulated PostScript (EPS) file directly from the matrix.
 * Only filled black rectangles are emitted - nothing is painted for light
 * modules, so placing the EPS in a layout tool behaves like a knockout
 * (no white box) instead of an opaque background.
 *
 * @param {object} matrix
 * @param {{ sizeMm?: number }} options - physical output size in millimeters
 */
export function matrixToEps(matrix, { sizeMm = 40 } = {}) {
  const sizePt = sizeMm * PT_PER_MM
  const moduleSizePt = sizePt / matrix.size

  const body = getRowRuns(matrix)
    .map(({ row, col, span }) => {
      const x = (col * moduleSizePt).toFixed(3)
      // PostScript's origin is bottom-left with Y pointing up, so rows are flipped.
      const y = (sizePt - (row + 1) * moduleSizePt).toFixed(3)
      const w = (span * moduleSizePt).toFixed(3)
      const h = moduleSizePt.toFixed(3)
      return `${x} ${y} ${w} ${h} box`
    })
    .join('\n')

  const bbox = Math.ceil(sizePt)

  return `%!PS-Adobe-3.0 EPSF-3.0
%%Creator: QR-Flow ilp2
%%Title: qr-code.eps
%%CreationDate: (generated client-side)
%%BoundingBox: 0 0 ${bbox} ${bbox}
%%HiResBoundingBox: 0 0 ${sizePt.toFixed(3)} ${sizePt.toFixed(3)}
%%LanguageLevel: 2
%%Pages: 1
%%EndComments
/box { % x y w h box -> fills one module rectangle
  4 dict begin
  /h exch def
  /w exch def
  /y exch def
  /x exch def
  x y moveto
  w 0 rlineto
  0 h rlineto
  w neg 0 rlineto
  closepath
  fill
  end
} def
0 0 0 setrgbcolor
${body}
%%EOF
`
}
