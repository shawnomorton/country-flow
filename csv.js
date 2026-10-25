/* CSV reading and writing, plus mapping loose spreadsheet headers onto catalog fields. */
window.CF = window.CF || {};

CF.CATALOG_FIELDS = ['marker', 'species', 'fluor', 'clone', 'vendor', 'catalog_number', 'lot', 'location', 'expires', 'status', 'notes'];

CF.csv = {
  parse: function (text) {
    var rows = [], row = [], field = '', q = false, i = 0, c;
    text = String(text || '').replace(/^﻿/, '');
    while (i < text.length) {
      c = text[i];
      if (q) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; } else q = false;
        } else field += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field); rows.push(row); row = []; field = '';
      } else field += c;
      i++;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (v) { return String(v).trim() !== ''; }); });
  },

  cell: function (v) {
    v = v == null ? '' : String(v);
    return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  },

  stringify: function (header, rows) {
    var out = [header.map(CF.csv.cell).join(',')];
    rows.forEach(function (r) { out.push(header.map(function (h) { return CF.csv.cell(r[h]); }).join(',')); });
    return out.join('\r\n') + '\r\n';
  }
};

// Header aliases so a lab's existing inventory sheet imports without renaming columns.
CF.HEADER_ALIASES = {
  marker: ['marker', 'antigen', 'target', 'specificity', 'antibody', 'surfacemarker'],
  species: ['species', 'reactivity', 'speciesreactivity', 'organism'],
  fluor: ['fluor', 'fluorochrome', 'fluorophore', 'conjugate', 'color', 'colour', 'dye', 'label'],
  clone: ['clone'],
  vendor: ['vendor', 'supplier', 'manufacturer', 'company', 'brand'],
  catalog_number: ['catalognumber', 'catalog', 'cat', 'catno', 'catnumber', 'catalogno', 'productnumber', 'sku'],
  lot: ['lot', 'lotnumber', 'lotno', 'batch'],
  location: ['location', 'storage', 'box', 'fridge', 'freezer', 'position'],
  expires: ['expires', 'expiry', 'expiration', 'expirationdate', 'expirydate', 'exp', 'bestbefore'],
  status: ['status', 'stock', 'instock', 'availability', 'quantity'],
  notes: ['notes', 'note', 'comments', 'comment', 'dilution', 'titer', 'titre']
};

CF.mapHeaders = function (header) {
  var norm = function (s) { return String(s).toLowerCase().replace(/[^a-z0-9]/g, ''); };
  var map = {};
  header.forEach(function (h, i) {
    var n = norm(h);
    Object.keys(CF.HEADER_ALIASES).forEach(function (f) {
      if (map[f] == null && CF.HEADER_ALIASES[f].indexOf(n) > -1) map[f] = i;
    });
  });
  return map;
};

CF.normSpecies = function (s) {
  s = String(s || '').trim().toLowerCase();
  if (/^(m|ms|mu|mouse|murine|mus)/.test(s)) return 'Mouse';
  if (/^(h|hu|hs|human|homo)/.test(s)) return 'Human';
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
};

CF.normStatus = function (s) {
  var v = String(s == null ? '' : s).trim().toLowerCase();
  if (v === '') return 'In stock';
  if (/^(out|none|empty|0|no|finished|gone|depleted)/.test(v)) return 'Out';
  if (/^(low|running low|almost)/.test(v)) return 'Low';
  if (/^\d+(\.\d+)?$/.test(v)) return parseFloat(v) > 0 ? 'In stock' : 'Out';
  return 'In stock';
};

// Spreadsheet text -> { rows, skipped, missing } where rows are catalog entries.
CF.rowsFromCsv = function (text, defaultSpecies) {
  var table = CF.csv.parse(text);
  if (!table.length) return { rows: [], skipped: 0, missing: ['marker', 'fluor'] };
  var map = CF.mapHeaders(table[0]);
  var missing = ['marker', 'fluor'].filter(function (f) { return map[f] == null; });
  if (missing.length) return { rows: [], skipped: table.length - 1, missing: missing };
  var rows = [], skipped = 0;
  table.slice(1).forEach(function (r) {
    var e = {};
    CF.CATALOG_FIELDS.forEach(function (f) { e[f] = map[f] == null ? '' : String(r[map[f]] == null ? '' : r[map[f]]).trim(); });
    if (!e.marker || !e.fluor) { skipped++; return; }
    e.species = CF.normSpecies(e.species) || defaultSpecies || 'Human';
    e.status = CF.normStatus(e.status);
    rows.push(e);
  });
  return { rows: rows, skipped: skipped, missing: [] };
};
