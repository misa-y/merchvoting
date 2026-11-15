# Mustang Market — Design Lab

A student-centered evolution of the ASIJ Mustang Market merchandise voting platform, prepared as an interactive visual aid for a University of Tokyo College of Design application video.

The original version remains on `main` at `0bca1f01d4d3e85a4f724ee825a0c4a943b33ccc`. All prototype development belongs on `utokyo-design-lab`. Original PNG artwork is unchanged.

## Run locally

From this repository on `utokyo-design-lab`:

```sh
git branch --show-current
python3 -m http.server 8765 --bind 127.0.0.1
```

Open http://127.0.0.1:8765 for the studio, or http://127.0.0.1:8765/admin.html for Student Insights. Keep the terminal open; Ctrl+C stops the server. No build, package installation, backend, or external service is required to run the app. Use a modern browser. Serve over localhost or HTTPS, rather than opening the HTML file directly.

Use the same browser profile and exact origin each time: `localhost` and `127.0.0.1`, different ports, and a hosted site each have separate browser storage. A Git branch is not a website deployment. Pushing this branch does not change a production deployment that uses `main`.

## A short demonstration

1. Open **Design studio**. Introduce this as an evolution of your original swipe voting system.
2. Choose **ASIJ Hoodie**. Select **Navy**, **Oversized**, and **M**. Change colors to show the small concept silhouette updating while the original artwork stays intact.
3. Swipe the image **up** to love that combination (or use the Love button). Left rejects; right likes. Arrow keys work when the image or page has focus, but do not cast votes while a control is focused.
4. Open **Student insights**. The hoodie has a +3 score and the selected attributes appear in its preference charts and combinations. Select any ranked product to inspect it.
5. Switch to **Demonstration data** for a fuller dashboard. Its 368 synthetic votes are explicitly labeled as simulated and are never merged into prototype responses. Switch back to **Prototype results** to show your own vote.
6. Explain the distinction: “The original system showed which designs students liked. This prototype also explores which versions they would want.” Preference selections are feedback, not verified demand or purchase commitments.

For a laptop recording, use the browser at roughly 1280–1440 pixels wide. The studio compacts on shorter laptop displays; the dashboard may need a short scroll to show combinations. Keep the demonstration-data banner visible when showing synthetic results.

## Features and interpretation

- All 12 original designs and images; direct product selection plus sequential voting.
- Product-specific color palettes and fits. Pants offer Regular / Relaxed / Wide leg; tanks offer Regular / Cropped; other tops offer Regular / Oversized / Cropped. All offer XS–XXL.
- Preferences are optional and have no defaults. Clicking a selected option clears it. They reset between votes so a previous student's selections are not silently reused.
- Color previews are explicitly labeled generic concepts. They do not recolor the original image, reproduce its print, or simulate fit/size. These options describe possible variants, not available stock or validated sizing.
- Each new vote saves product ID, decision, selected attributes (or null), timestamp, cycle number, unique record ID, and source.
- Original score formula: `like + 3 × love − reject`. Only products with votes are ranked; tied scores share a rank. Counts and a weighted score are shown separately.
- Preference charts count **likes and loves once each**. Reject attributes are preserved in the export but excluded from positive-preference charts. A missing preference is not inferred.
- Each attribute's percentages use its own selected positive votes as the denominator. Coverage shows positive votes with at least one attribute / all positive votes. Combinations require all three attributes; the dashboard shows the top three.
- Results refresh when the window regains focus and when another prototype tab saves a vote. Repeated keydown events and input during saving/animation are ignored. Pointer cancellation does not cast a vote.
- Deck-cycle counters remain in data tools and exports. Manually selecting a product can skip part of a cycle; cycles are not unique voters or completed student ballots.

## Storage and preserving original records

Production uses IndexedDB `merch-mockup-voter`, object store `state`, key `merch-mockup-voter:v1`. The prototype uses a separate database, `mustang-market-utokyo-design-lab-v1`, object store `state`, key `prototype`.

The prototype never writes to the production database or its legacy localStorage key. **Prototype data tools → Copy original records** reads the original records on this exact browser origin and preserves a verbatim, one-time snapshot in prototype storage. It can fall back to the original localStorage format. Import is explicit, duplicate imports are blocked, and unavailable originals produce a clear message. This is a snapshot, not ongoing synchronization.

Original counts contribute to prototype rankings after import, but are not assigned fictional customization preferences. Their original history, progress, additional fields, and records for products outside the active catalog remain in the snapshot/export. The original database itself is untouched.

**Reset prototype votes** confirms before clearing only newly recorded prototype votes and generated demo votes. It keeps the copied original snapshot and all production data. Export JSON before resetting if you want to retain prototype responses. Export contains both labeled datasets, the original snapshot, progress, and a summary of the selected view.

Browser data is local to a device/profile/origin. It is not stored in GitHub and can be lost if browser/site data is cleared. There is no login, unique-student verification, cross-device syncing, or protected admin access. Multiple votes by one person are possible, as in the original kiosk. IndexedDB transactions protect concurrent prototype saves from overwriting one another.

## Files and tests

- `catalog.js`: original products plus proposed attributes.
- `index.html`, `app.js`: studio, customization, gestures, and voting.
- `admin.html`, `admin.js`: rankings, charts, demo data, export, import, and reset controls.
- `store.js`: isolated IndexedDB storage and shared summaries.
- `styles.css`: responsive styling, keyboard focus, and reduced-motion support.
- `tests/storage.test.cjs`: storage isolation, import, concurrency, rollback, scoring, and demo separation.

Tests only (Node.js and npm required; no runtime dependency):

```sh
npm ci --ignore-scripts
npm test
```

Tests use an in-memory IndexedDB emulator; they never touch browser or production records.
