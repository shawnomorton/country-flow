// Run with: node tests/solver.test.js
globalThis.window = globalThis;
require('../js/config.js');
require('../js/csv.js');
require('../js/sample-catalog.js');
const CF = require('../js/solver.js');
const assert = require('assert');

const cat = CF.sampleCatalog();
const human = cat.filter(e => e.species === 'Human');
const mouse = cat.filter(e => e.species === 'Mouse');
const m = (names, bb = []) => names.map(n => ({ name: n, bb: bb.includes(n) }));

function check(res, label) {
  res.panels.forEach(p => {
    const dets = Object.keys(p.slots);
    assert.strictEqual(new Set(dets).size, dets.length, label + ': duplicate detector');
    dets.forEach(d => {
      const s = p.slots[d];
      if (!s.pi) assert.strictEqual(CF.detectorFor(s.entry.fluor), d, label + ': reagent in wrong detector');
    });
  });
}

// 1. Twelve human markers with PI fit on two panels (only 4 PE+APC slots, so pick a feasible set).
let r = CF.solve({ markers: m(['CD45','CD3','CD4','CD8','CD19','CD14','CD16','CD56','CD25','CD127','HLA-DR','CD11b']), catalog: human, nPanels: 2, pi: true });
check(r, 'twelve');
assert.ok(r.complete, 'twelve markers should fit in 2 panels: ' + JSON.stringify(r.unplaced));
assert.ok(r.panels.every(p => p.slots['PerCP-Cy5.5'] && p.slots['PerCP-Cy5.5'].pi), 'PI on every panel');

// 2. Backbone markers sit in the same detector on every panel.
r = CF.solve({ markers: m(['CD45','CD3','CD4','CD8','CD19','CD14','CD16','CD56'], ['CD45','CD3']), catalog: human, nPanels: 2, pi: true });
check(r, 'backbone');
['CD45','CD3'].forEach(bb => {
  const where = r.panels.map(p => Object.keys(p.slots).find(d => p.slots[d].marker === bb));
  assert.ok(where[0] && where[0] === where[1], bb + ' should be on both panels in one detector');
});

// 3. Too many markers -> unplaced with a reason, and panelsNeeded finds more.
const many = m(['CD45','CD3','CD4','CD8','CD19','CD14','CD16','CD56','CD25','CD127','HLA-DR','CD69','CD11c','CD11b']);
r = CF.solve({ markers: many, catalog: human, nPanels: 2, pi: true });
check(r, 'many');
assert.ok(!r.complete && r.unplaced.every(u => u.reason === 'no free detector'));
const need = CF.panelsNeeded({ markers: many, catalog: human, pi: true });
assert.ok(need === 3, 'expected 3 panels, got ' + need);
assert.ok(CF.solve({ markers: many, catalog: human, nPanels: need, pi: true }).complete);

// 4. Out-of-stock and unknown markers are reported, not placed.
const oos = human.map(e => e.marker === 'CD4' ? Object.assign({}, e, { status: 'Out' }) : e);
r = CF.solve({ markers: m(['CD4','CD3','Nope']), catalog: oos, nPanels: 2, pi: false });
assert.deepStrictEqual(r.unplaced.map(u => u.marker + ':' + u.reason).sort(), ['CD4:none in stock','Nope:none in stock']);

// 5. Mouse with CD11b and Ly6C as backbone.
r = CF.solve({ markers: m(['CD11b','Ly6C','Ly6G','F4/80','CD11c','MHC-II','CD45'], ['CD11b','Ly6C']), catalog: mouse, nPanels: 2, pi: true });
check(r, 'mouse');
assert.ok(r.complete, 'mouse set fits');

// 6. CSV round trip with loose headers.
const parsed = CF.rowsFromCsv('Antigen,Fluorochrome,Clone,Reactivity,Cat #,Stock\nCD4,"APC/Cy7",RPA-T4,human,300518,0\nCD8,FITC,SK1,mouse,,low\n');
assert.strictEqual(parsed.rows.length, 2);
assert.strictEqual(parsed.rows[0].status, 'Out');
assert.strictEqual(parsed.rows[0].catalog_number, '300518');
assert.strictEqual(parsed.rows[1].species, 'Mouse');
assert.strictEqual(CF.detectorFor(parsed.rows[0].fluor), 'APC-Cy7');

// 7. Big request finishes quickly.
const t0 = Date.now();
CF.solve({ markers: m(human.map(e => e.marker).filter((v, i, a) => a.indexOf(v) === i)), catalog: human, nPanels: 3, pi: true });
assert.ok(Date.now() - t0 < 3000, 'solver too slow');

console.log('All solver tests passed.');
