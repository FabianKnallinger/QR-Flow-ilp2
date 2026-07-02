# QR-Flow ilp2

Moderne WebApp zur automatischen Erstellung von druckfertigen QR-Codes –
für Kontaktkarten (vCard), Webseitenlinks, Telefonnummern, E-Mails und
freien Text. Läuft komplett im Browser, es werden keine Daten an einen
Server übertragen.

## Funktionen

- Eingabemaske mit fünf QR-Typen: vCard, Webseitenlink, Telefonnummer,
  E-Mail, freier Text.
- Bei der vCard werden nur ausgefüllte Felder in den QR-Code geschrieben.
- Live-Vorschau bei jeder Eingabe.
- QR-Code ohne Rand (keine Quiet Zone im Export), transparenter
  Hintergrund, reines Schwarz (`#000000`).
- Export als PNG (mit echtem Alphakanal), SVG (Vektor) und EPS
  (PostScript, für Druckvorstufen-Workflows).
- Qualitätsanzeige: warnt bei viel Dateninhalt (kleine Module) und schätzt
  anhand einer optionalen Ziel-Druckgröße (mm), ob der Code voraussichtlich
  gut scanbar ist.
- Responsive Layout für Desktop und Smartphone.

## Technik

- Vanilla JavaScript (ES-Module) + [Vite](https://vitejs.dev/) als
  Dev-Server/Build-Tool, kein UI-Framework nötig für diesen Funktionsumfang.
- [`qrcode`](https://www.npmjs.com/package/qrcode) übernimmt nur die
  Kodierung (Reed-Solomon-Fehlerkorrektur, Maskierung, Segmentierung) und
  liefert die rohe Modul-Matrix (`src/modules/qr-matrix.js`).
- Das Rendering (SVG/Canvas-PNG/EPS) ist selbst geschrieben
  (`src/modules/qr-renderers.js`), damit Rand, Farbe und Transparenz exakt
  kontrolliert werden können – die Bibliothek selbst fügt sonst standardmäßig
  einen weißen Rand (Quiet Zone) hinzu.
- **EPS-Export:** QR-Codes bestehen nur aus schwarzen Rechtecken auf
  transparentem Grund. Das lässt sich direkt als PostScript beschreiben
  (Rechtecke pro Zeile zu Balken zusammengefasst), ganz ohne
  SVG-zu-EPS-Konvertierung oder Server. Siehe `matrixToEps()` in
  `src/modules/qr-renderers.js`.

### Projektstruktur

```
index.html                    Grundgerüst, zweispaltiges Layout
src/main.js                   App-Logik: Formular ↔ Vorschau ↔ Downloads
src/style.css                 Design
src/modules/
  qr-matrix.js                Kodierung (wrapt die qrcode-Bibliothek)
  qr-renderers.js              SVG-, PNG(Canvas)-, EPS-Renderer
  vcard.js                     vCard-3.0-Generator
  content-builders.js          Payload-Aufbau für URL/Tel/E-Mail/Text
  quality.js                   Scanbarkeits-Heuristiken
  download.js                  Datei-Download-Helfer
```

## Lokal starten

Voraussetzung: [Node.js](https://nodejs.org/) (Version 18 oder neuer).

```bash
npm install
npm run dev
```

Danach im Terminal die angezeigte lokale Adresse öffnen (in der Regel
`http://localhost:5173`). Änderungen am Code werden per Hot-Reload sofort
übernommen.

Für einen reinen Produktions-Build lokal testen:

```bash
npm run build     # erzeugt das statische Ergebnis in dist/
npm run preview   # startet einen lokalen Server für den Build
```

## Online veröffentlichen

Das Build-Ergebnis in `dist/` ist eine vollständig statische Webseite und
kann auf jedem Webserver oder Hosting-Dienst bereitgestellt werden.

### GitHub Pages

1. Build erzeugen: `npm run build`
2. Den Inhalt von `dist/` auf den `gh-pages`-Branch des Repositories
   veröffentlichen, z. B. mit dem Hilfstool
   [`gh-pages`](https://www.npmjs.com/package/gh-pages):
   ```bash
   npm install -D gh-pages
   npx gh-pages -d dist
   ```
3. In den Repository-Einstellungen unter **Settings → Pages** die Quelle auf
   den `gh-pages`-Branch stellen.

Die App verwendet in `vite.config.js` einen relativen Basispfad
(`base: './'`), daher funktioniert sie sowohl unter einer Domain-Root als
auch unter einem Unterpfad wie `https://<user>.github.io/<repo>/` ohne
weitere Anpassung.

### Beliebiger Webserver

Den Inhalt von `dist/` einfach per FTP/SCP/rsync in das Webroot-Verzeichnis
kopieren – es ist keine serverseitige Logik nötig (reines HTML/CSS/JS).

## Hinweis zur Scanbarkeit

Die Exportdateien werden bewusst **ohne** hellen Rand (Quiet Zone) erzeugt,
wie in den Projektanforderungen gewünscht. Der ISO/IEC-18004-Standard sieht
für zuverlässiges Scannen eigentlich einen Rand von mindestens 4 Modulen
vor. Da dieser Rand hier fehlt, sollte er beim späteren Platzieren des
QR-Codes im Layout (z. B. in InDesign, Illustrator oder PowerPoint) manuell
als Weißraum um den Code herum eingeplant werden, damit der Code
zuverlässig scannt.
