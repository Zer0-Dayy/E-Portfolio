# Mohamed Aziz Missaoui’s Engineering Portfolio

The root `index.html` is the standalone GitHub Pages entry point. Open it in a browser to view the portfolio offline. The editable pages in `dist/` also run without a server or package installation.

| Path | What to edit |
| --- | --- |
| `dist/index.html` | About cover, portrait, copper-layer comparison, three engineering practice examples, and open-source link |
| `dist/projects.html` | Project index, case studies, PCB markers, DropLock photo callouts, process diagrams, and driver directory |
| `dist/cv.html` | Internship, education, project highlights, skills, languages, and contact |
| `dist/styles.css` | Colors and type at the top, followed by shared UI, About, Projects, CV, responsive layouts, and print |
| `dist/interactions.js` | Tab selection, project index, photo callouts, visitor-controlled playback, and the CV print button |
| `dist/pcb-explorer.js` | Top view and 3D controls, component picker, and selection state |
| `dist/assets/` | The portrait, project pictures, and bundled web fonts. Font notices sit beside the font files. |
| `tools/make_preview.py` | Builds the single `index.html` for offline use or publishing |
| `tools/pack_board_model.py` | Packs a binary glTF export into the site for offline use |
| `tools/render_copper.py` | Regenerates the two small images of routed copper from aligned KiCad plots |
| `tools/pcb-renderer.js` | Editable source for the 3D viewer bundled in `dist/assets/pcb-renderer.js` |

All copy lives in the three HTML files. The header and footer markup are repeated in those files so each page works independently. Update all three copies when changing the navigation or contact links.

To replace an image, put it in `dist/assets/` and update its `src`, intrinsic `width` and `height`, and `alt` text. The About page displays the full portrait and crops the HomeGuard collage to its rover photo. Projects displays the whole collage.

The About stories, PCB markers, and process diagrams use the same tab controller. Inside each `data-tabs` group, a button in `data-tab-list` points to its panel through `aria-controls`. The panel’s `aria-labelledby` points back to the button. All IDs must be unique across the three pages because the offline export combines them in one document. Without JavaScript, all explanations are visible. The CSS respects the visitor’s reduced-motion preference.

The About cover and circuit-design story use the actual front and back routing from the hydroponics PCB. The native radio controls switch the layer and caption in CSS, which flips the back plot to show it as viewed from the back. To update the artwork, plot the front copper and Edge.Cuts to one colour SVG and the back copper and Edge.Cuts to another, both viewed from the front and using the same board origin. Use actual drill marks, the same page size, and a copy with unfilled zones. With Pillow and PyMuPDF installed, run `python3 tools/render_copper.py front.svg back.svg dist/assets`.

The Projects index links each title to the matching case-study ID. The mobile project picker, Go button, and highlighted project come from those same links. Each DropLock step defines its photo label in `data-part` and its target in `data-x` and `data-y`, as percentages of the whole photograph. The marker moves when a visitor selects a stage or plays the sequence. Playback gives longer explanations more reading time and pauses when the diagram leaves the viewport.

The PCB view uses numbered markers in `projects.html`. Each marker defines two positions. The `--x` and `--y` CSS values are percentages of the top-view image. For 3D, `data-pcb-nodes` names components by KiCad reference and the viewer uses their exported bounds. `data-pcb-at` supplies the two board coordinates in millimeters for footprints without a mesh. Update both positions if the board layout changes. The driver directory uses native HTML `details` elements. Each contains its own description, guide link, and example link.

The Rev 1.8 service map is cropped from the [published port and LED map](https://github.com/Zer0-Dayy/Hydroponics-Monitoring-System/blob/3e248f5aeab8a3866d7c6e234ebc43bf2f8ab32a/PCB%20Design/Documentation/Port%20And%20LED%20Map.pdf). The copper comparison, interactive PCB explorer, and service map all use Rev 1.8. The top-view image is an orthographic render of the 3D model. It spans 180 × 108 mm from board coordinate (58 mm, 45.25 mm) at the top left.

The [Rev 1.8 KiCad board](https://github.com/Zer0-Dayy/Hydroponics-Monitoring-System/blob/3e248f5aeab8a3866d7c6e234ebc43bf2f8ab32a/PCB%20Design/Hardware/PCB%20Design.kicad_pcb) was exported with KiCad 10.0.8 at origin (0 mm, 0 mm), with pads, silkscreen, and populated components. The web geometry uses standard KiCad models for the J15/J16 sockets and simplified housings based on the [Amphenol Micro-B drawing](https://cdn.amphenol-cs.com/media/wysiwyg/files/drawing/10118194.pdf) and [Littelfuse 395 datasheet](https://www.littelfuse.com/assetdocs/littelfuse_fuse_395_datasheet.pdf?assetguid=1a080a7b-ecc7-4444-828d-ed670b012fa7). The installer-supplied modules at J9, J10, and J12 appear as footprints. The KiCad libraries and Three.js license notices are in `dist/assets/`.

The viewer uses WebGL when available and a lighter mesh for software rendering in browsers without it. A device that cannot initialize the viewer still has the annotated top view and all descriptions.

To update the model, export a GLB from KiCad with the board origin at X = 0 mm and Y = 0 mm. Keep component names when optimizing the file, then run:

```bash
python3 tools/pack_board_model.py board.glb dist/assets/pcb-model.js
```

Pass `--light-model board-light.glb` if you also have a smaller export at the same origin for software rendering.

The viewer is bundled already. If you edit its source, install `three@0.180.0` and `esbuild@0.25.12` in the extracted project and rebuild it:

```bash
npm install --no-save three@0.180.0 esbuild@0.25.12
npx esbuild tools/pcb-renderer.js --bundle --minify --format=iife --target=es2022 --legal-comments=inline --outfile=dist/assets/pcb-renderer.js
```

To rebuild the standalone entry point from the editable pages with Python 3.9 or later, run this from the repository root.

```bash
python3 tools/make_preview.py index.html
```

The output contains the three page views, fonts, images, styles, and scripts. Use the files in `dist/` as the source of truth for edits.
