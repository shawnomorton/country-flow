# Country Flow

*Take me home, to the fluor, that I belong.*

Country Flow is a flow cytometry panel designer. You pick the surface markers you want to look at, it checks your lab's antibody catalog for the fluors you actually have, and it splits the markers across panels (A, B, C…) so every marker lands in a free detector. Then it exports a printable panel figure for your lab notebook and a CSV for digital archiving.

It ships set up for a 7-detector **BD FACSCanto II** (FITC, PE, PerCP-Cy5.5, APC, APC-Cy7, Pacific Blue, AmCyan), with PI read in PerCP-Cy5.5 for live/dead.

There is no server and no login. It is a static web page, so you can host it free on GitHub Pages or open `index.html` from a folder.

## What it does

- **Design panels:** name the experiment, pick Human or Mouse, turn PI on or off, and search your catalog to add markers. Mark any marker as **backbone** to put it on every panel in the same fluor (for example CD45 and CD3, or CD11b and Ly6C for mouse work).
- **Automatic assignment:** the solver tries every arrangement (branch and bound) and picks the one that places the most markers, keeps panels evenly loaded, avoids low-stock or expired vials, and avoids PE when PI is on because PI spills into PE.
- **Too many markers:** you get the red error "Error, you selected more fluors than there are available channels for 2 panels. Add another panel?" with a button to add the next panel, and it tells you how many panels the set needs.
- **Antibody catalog:** add, edit and delete antibodies; import a CSV; sync from a Google Sheet; download the catalog as CSV; download a blank template. Fields: marker, species, fluor, clone, vendor, catalog number, lot, location, expiry date, status (In stock, Low, Out), notes. Out-of-stock vials are never used.
- **Export record:** operator name, run date (with a Today button), **Download CSV** (one row per panel × detector), **Download figure (PNG)**, and **Print figure**.
- **The hat:** click the cowboy hat. Arrow keys or WASD to move, Space to shoot, P to pause. The lab chatter uses your first name, experiment name and markers.

## Where your data lives

Your catalog and current experiment are saved in **your browser's local storage**, on your computer only. Nothing is sent anywhere. That means:

- Other people who use your hosted copy start with an empty catalog (plus example rows) and never see yours.
- Clearing your browser data clears the catalog, so keep the real copy in a spreadsheet and use **Download catalog CSV** as a backup.

### Keeping your inventory in a Google Sheet

1. Make a Sheet with columns like the ones in [`data/catalog-template.csv`](data/catalog-template.csv). Only `marker` and `fluor` are required; common header names such as "Antigen", "Fluorochrome", "Cat #" or "Expiration" are recognized.
2. In the Sheet: **File › Share › Publish to web**, choose just the inventory tab and **Comma-separated values (.csv)**, then Publish.
3. In Country Flow: **Antibody catalog › Sync from Google Sheet**, paste the link, and press **Sync now**.

The link is stored in your browser only. It is never written into the code or the repository. Anyone who has the published link can read that one tab, so publish only the inventory tab, not the whole workbook. If you would rather not publish anything, use **File › Download › CSV** in Sheets and then **Import CSV** in Country Flow.

## Run it

**On GitHub Pages:** push this folder to a repository, then in the repository open **Settings › Pages**, set the source to the `main` branch and the root folder, and save. Your app will be at `https://<your-username>.github.io/<repo-name>/`.

**Locally:** open `index.html` in a browser. Google Sheet sync needs the page to be served over http(s), so for that run a small server from this folder:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

## Use it with a different cytometer

All instrument details are in [`js/config.js`](js/config.js):

- `DETECTORS`: the detectors, in display order, with laser, filter and swatch color.
- `FLUOR_TO_DETECTOR`: every fluor name the catalog may use and the detector that reads it.
- `VIABILITY`: the live/dead dye and its detector.
- `PI_SPILL`: detectors the viability dye spills into, which the solver avoids when it can.

Edit those and the rest of the app follows.

## Project layout

```
index.html              the app
css/app.css             styles (light and dark)
js/config.js            instrument setup
js/solver.js            panel assignment
js/csv.js               CSV import and export
js/sample-catalog.js    example rows for first run
js/figure.js            the printable figure
js/game.js              the minigame
js/app.js               the UI
assets/                 pixel art
data/                   catalog template and example catalog
tests/solver.test.js    solver tests: node tests/solver.test.js
```

## License

MIT. See [LICENSE](LICENSE).
