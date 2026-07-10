#!/usr/bin/env python3
"""Builds src/assets/visitenkarte-vorlage.pdf from the designer's print PDF.

Takes ILP2_Visitenkarte_260613_04.pdf (back + front page) and produces the
print-ready blank template the web app fills at runtime:

1. Removes the person-specific text and the QR code from the front page -
   logo, company stamp, position rule and the entire back page stay
   untouched.
2. Converts all colors to DeviceCMYK: black becomes pure 0/0/0/100 (the
   original was an RGB export, which print providers reject because black
   then separates onto all four plates).
3. Enlarges the page by 18 pt on every side and draws crop marks
   (Schnittmarken) in registration color: 0.25 pt strokes, 6 pt offset from
   the trim corners, 12 pt long - matching InDesign's marks. The TrimBox
   still marks the 85 x 55 mm card. Content coordinates are unchanged
   because the MediaBox origin simply moves to negative values.
4. Embeds the ISO Coated v2 300% (ECI) profile as the PDF/X output intent.

Run from the repo root:  python3 scripts/build-vorlage.py
Requires: pymupdf (pip install pymupdf)
"""
import fitz
import re

SRC = 'src/Vorlagevisitenkarte/ILP2_Visitenkarte_260613_04.pdf'
ICC = 'src/Vorlagevisitenkarte/ISOcoated_v2_300_eci.icc'
OUT = 'src/assets/visitenkarte-vorlage.pdf'

MARK_OFFSET = 6.0  # pt, gap between trim corner and mark (2.117 mm)
MARK_LENGTH = 12.0  # pt (4.233 mm)
MARK_WIDTH = 0.25  # pt
SLUG = MARK_OFFSET + MARK_LENGTH  # page grows by this much on every side

COLOR_FIXES = [
    (rb'\b0 0 0 rg\b', b'0 0 0 1 k'),  # black fill RGB -> CMYK
    (rb'\b1 1 1 rg\b', b'0 0 0 0 k'),  # white fill RGB -> CMYK
    (rb'\b0 g\b', b'0 0 0 1 k'),       # black fill gray -> CMYK
    (rb'\b1 g\b', b'0 0 0 0 k'),       # white fill gray -> CMYK
    (rb'\b0 0 0 RG\b', b'0 0 0 1 K'),  # black stroke RGB -> CMYK
    (rb'\b0 G\b', b'0 0 0 1 K'),       # black stroke gray -> CMYK
]


def redact_front(doc):
    page = doc[1]
    # All text spans (person data) ...
    for block in page.get_text('dict')['blocks']:
        if block['type'] != 0:
            continue
        for line in block['lines']:
            for span in line['spans']:
                page.add_redact_annot(fitz.Rect(span['bbox']))
    page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE,
                          graphics=fitz.PDF_REDACT_LINE_ART_NONE,
                          text=fitz.PDF_REDACT_TEXT_REMOVE)

    # ... then the QR code's vector modules (everything fully inside its
    # frame; the frame position is re-detected so this stays robust).
    MM = 25.4 / 72
    small = [d for d in page.get_drawings() if d['rect'].x0 * MM > 40 and d['rect'].width * MM < 3]
    qr = fitz.Rect(min(d['rect'].x0 for d in small), min(d['rect'].y0 for d in small),
                   max(d['rect'].x1 for d in small), max(d['rect'].y1 for d in small))
    print(f'QR-Rahmen: {qr}')
    page.add_redact_annot(qr)
    page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE,
                          graphics=fitz.PDF_REDACT_LINE_ART_REMOVE_IF_COVERED,
                          text=fitz.PDF_REDACT_TEXT_NONE)


def fix_colors(doc):
    for page in doc:
        for xref in page.get_contents():
            stream = doc.xref_stream(xref)
            fixed = stream
            for pattern, repl in COLOR_FIXES:
                fixed = re.sub(pattern, repl, fixed)
            if fixed != stream:
                doc.update_stream(xref, fixed)


def add_marks_and_boxes(doc):
    for page in doc:
        w, h = page.rect.width, page.rect.height  # trim size
        doc.xref_set_key(page.xref, 'MediaBox', f'[{-SLUG} {-SLUG} {w + SLUG} {h + SLUG}]')
        doc.xref_set_key(page.xref, 'CropBox', f'[{-SLUG} {-SLUG} {w + SLUG} {h + SLUG}]')
        doc.xref_set_key(page.xref, 'TrimBox', f'[0 0 {w} {h}]')
        doc.xref_set_key(page.xref, 'BleedBox', f'[0 0 {w} {h}]')

    # Reload so pymupdf picks up the new geometry before drawing the marks.
    doc = fitz.open('pdf', doc.tobytes())
    for page in doc:
        # page.rect now covers the whole media box; PDF (0,0) sits SLUG
        # points inside. pymupdf y runs downward from the top-left corner.
        top = page.rect.height  # media height
        w = page.rect.width - 2 * SLUG
        h = page.rect.height - 2 * SLUG

        def pt(x, y):  # PDF coords -> pymupdf page coords
            return fitz.Point(x + SLUG, top - SLUG - y)

        marks = []
        for cx in (0, w):
            for cy in (0, h):
                sx = -1 if cx == 0 else 1  # horizontal direction away from card
                sy = -1 if cy == 0 else 1  # vertical direction away from card
                marks.append((pt(cx + sx * MARK_OFFSET, cy), pt(cx + sx * SLUG, cy)))
                marks.append((pt(cx, cy + sy * MARK_OFFSET), pt(cx, cy + sy * SLUG)))

        shape = page.new_shape()
        for p1, p2 in marks:
            shape.draw_line(p1, p2)
        # Registration color: 100% on all four plates, like InDesign's marks.
        shape.finish(color=(1, 1, 1, 1), width=MARK_WIDTH)
        shape.commit()
    return doc


def add_output_intent(doc):
    icc = open(ICC, 'rb').read()
    icc_xref = doc.get_new_xref()
    doc.update_object(icc_xref, '<</N 4>>')
    doc.update_stream(icc_xref, icc)

    oi_xref = doc.get_new_xref()
    doc.update_object(oi_xref, (
        '<</Type/OutputIntent/S/GTS_PDFX'
        '/OutputConditionIdentifier(FOGRA39)'
        '/OutputCondition(ISO Coated v2 300% \\(ECI\\))'
        '/RegistryName(http://www.color.org)'
        '/Info(ISO Coated v2 300% \\(ECI\\))'
        f'/DestOutputProfile {icc_xref} 0 R>>'
    ))
    doc.xref_set_key(doc.pdf_catalog(), 'OutputIntents', f'[{oi_xref} 0 R]')


def main():
    doc = fitz.open(SRC)
    redact_front(doc)
    fix_colors(doc)
    doc = add_marks_and_boxes(doc)
    add_output_intent(doc)
    doc.save(OUT, garbage=3, deflate=True)

    check = fitz.open(OUT)
    for i, page in enumerate(check):
        raw = page.read_contents().decode('latin-1')
        rgb_left = re.findall(r'[\d.]+ [\d.]+ [\d.]+ (?:rg|RG)\b|[\d.]+ (?:g|G)\b', raw)
        print(f'Seite {i}: MediaBox={page.mediabox} TrimBox={page.trimbox} '
              f'Text={len(page.get_text().strip())} RGB/Gray-Reste={rgb_left or "keine"}')
    import os
    print('OK ->', OUT, os.path.getsize(OUT), 'bytes')


if __name__ == '__main__':
    main()
