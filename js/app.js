/* Country Flow app: state, storage, and the three tabs. */
(function () {
  var CF = window.CF;
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var today = function () {
    var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  };

  /* ---------- storage (this browser only) ---------- */
  var KEYS = { catalog: 'countryflow.catalog.v1', exp: 'countryflow.experiment.v1', sheet: 'countryflow.sheetUrl.v1', tab: 'countryflow.tab.v1' };
  var store = {
    get: function (k, fallback) {
      try { var v = localStorage.getItem(k); return v == null ? fallback : JSON.parse(v); } catch (e) { return fallback; }
    },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked: keep working in memory */ } },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
  };

  var blankExp = function () {
    return { name: '', species: 'Human', pi: true, nPanels: 2, sel: [], operator: '', runDate: '' };
  };
  var state = {
    tab: store.get(KEYS.tab, 'design'),
    catalog: store.get(KEYS.catalog, null),
    exp: Object.assign(blankExp(), store.get(KEYS.exp, {})),
    query: '', active: 0,
    catSpecies: 'All', catQuery: '',
    editIndex: -1, syncMode: 'replace',
    result: null
  };
  if (!Array.isArray(state.catalog)) state.catalog = CF.sampleCatalog();
  // Operator persists across "New experiment".
  var saveCatalog = function () { store.set(KEYS.catalog, state.catalog); };
  var saveExp = function () { store.set(KEYS.exp, state.exp); };

  /* ---------- feedback ---------- */
  var toastTimer;
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 3200);
  }

  /* ---------- files out ---------- */
  var claudeDownloads = null;
  if (window.claude && typeof window.claude.use === 'function') {
    window.claude.use('downloads').then(function (d) { claudeDownloads = d; }).catch(function () {});
  }
  var embedded = !!(window.claude && typeof window.claude.use === 'function');

  function saveFile(filename, data, mime) {
    if (claudeDownloads) {
      return claudeDownloads.save({ filename: filename, data: data }).then(function () {
        toast('Saved ' + filename);
      }).catch(function (err) {
        if (err && err.code === 'declined') return;
        toast('Could not save ' + filename + (err && err.message ? ': ' + err.message : ''));
      });
    }
    var blob = data instanceof Blob ? data : new Blob([data], { type: mime || 'text/plain' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    toast('Downloaded ' + filename);
    return Promise.resolve();
  }

  var slug = function (s) { return String(s || 'untitled').trim().replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'untitled'; };

  /* ---------- derived data ---------- */
  function speciesCatalog() {
    return state.catalog.filter(function (e) { return e.species === state.exp.species; });
  }
  function markersInCatalog() {
    var seen = {}, out = [];
    speciesCatalog().forEach(function (e) {
      var k = e.marker.toLowerCase();
      if (!seen[k]) { seen[k] = true; out.push(e.marker); }
    });
    return out.sort(function (a, b) { return a.localeCompare(b, undefined, { numeric: true }); });
  }
  function stockSummary(marker) {
    var key = marker.toLowerCase();
    var es = speciesCatalog().filter(function (e) { return e.marker.toLowerCase() === key; });
    var usable = es.filter(function (e) { return e.status !== 'Out' && CF.detectorFor(e.fluor); });
    if (!es.length) return 'not in catalog';
    if (!usable.length) return 'none in stock';
    return usable.map(function (e) { return e.fluor; }).join(', ');
  }

  function solve() {
    var ex = state.exp;
    state.result = CF.solve({
      markers: ex.sel.map(function (s) { return { name: s.name, bb: s.bb }; }),
      catalog: speciesCatalog(), nPanels: ex.nPanels, pi: ex.pi, runDate: ex.runDate || today()
    });
    return state.result;
  }

  function panelRows(p) {
    var used = 0;
    var rows = CF.DETECTORS.map(function (d) {
      var s = p.slots[d.id];
      var base = { detector: d.id, optics: d.laser + ' · ' + d.filter, color: d.color };
      if (!s) return Object.assign(base, { kind: 'open', marker: '', fluor: '', clone: '', vendor: '', entry: null });
      if (s.pi) return Object.assign(base, { kind: 'pi', marker: CF.VIABILITY.name, fluor: CF.VIABILITY.name, clone: '', vendor: '', entry: null });
      used++;
      return Object.assign(base, { kind: 'marker', marker: s.marker, fluor: s.entry.fluor, clone: s.entry.clone, vendor: s.entry.vendor, bb: s.bb, entry: s.entry });
    });
    var open = rows.filter(function (r) { return r.kind === 'open'; }).length;
    return { rows: rows, summary: used + ' marker' + (used === 1 ? '' : 's') + (state.exp.pi ? ' + PI' : '') + ' · ' + open + ' open' };
  }

  /* ---------- tabs ---------- */
  function setTab(t) {
    state.tab = t;
    store.set(KEYS.tab, t);
    ['design', 'catalog', 'export'].forEach(function (k) {
      $('view-' + k).hidden = k !== t;
      $('tab-' + k).setAttribute('aria-selected', String(k === t));
    });
    if (t === 'design') renderDesign();
    if (t === 'catalog') renderCatalog();
    if (t === 'export') renderExport();
    window.scrollTo(0, 0);
  }
  document.querySelectorAll('.tab').forEach(function (b) {
    b.addEventListener('click', function () { setTab(b.dataset.tab); });
  });

  /* ---------- design tab ---------- */
  function renderSetup() {
    var ex = state.exp;
    if ($('exp-name').value !== ex.name) $('exp-name').value = ex.name;
    $('sp-human').setAttribute('aria-pressed', String(ex.species === 'Human'));
    $('sp-mouse').setAttribute('aria-pressed', String(ex.species === 'Mouse'));
    $('pi-toggle').checked = ex.pi;
  }

  function renderResults() {
    var q = state.query.trim().toLowerCase();
    var box = $('results'), none = $('no-results');
    if (!q) { box.hidden = true; none.hidden = true; $('marker-q').setAttribute('aria-expanded', 'false'); return; }
    var chosen = {};
    state.exp.sel.forEach(function (s) { chosen[s.name.toLowerCase()] = true; });
    var list = markersInCatalog().filter(function (m) { return !chosen[m.toLowerCase()] && m.toLowerCase().indexOf(q) > -1; })
      .sort(function (a, b) { return (a.toLowerCase().indexOf(q) === 0 ? 0 : 1) - (b.toLowerCase().indexOf(q) === 0 ? 0 : 1); })
      .slice(0, 8);
    state.results = list;
    if (state.active >= list.length) state.active = 0;
    if (!list.length) {
      box.hidden = true;
      none.hidden = false;
      none.innerHTML = 'Nothing in the ' + state.exp.species.toLowerCase() + ' catalog matches "' + esc(state.query.trim()) + '". <button type="button" class="btn btn-quiet btn-sm" id="add-from-search">Add it to the catalog</button>';
      $('marker-q').setAttribute('aria-expanded', 'false');
      return;
    }
    none.hidden = true;
    box.hidden = false;
    $('marker-q').setAttribute('aria-expanded', 'true');
    box.innerHTML = list.map(function (m, i) {
      return '<button type="button" class="result' + (i === state.active ? ' active' : '') + '" role="option" aria-selected="' + (i === state.active) + '" data-add="' + esc(m) + '"><b>' + esc(m) + '</b><span>' + esc(stockSummary(m)) + '</span><em>Add +</em></button>';
    }).join('');
  }

  function addMarker(m) {
    state.exp.sel.push({ name: m, bb: false });
    state.query = ''; state.active = 0;
    $('marker-q').value = '';
    saveExp();
    renderDesign();
    $('marker-q').focus();
  }

  function renderPicked() {
    var sel = state.exp.sel;
    var res = state.result;
    var perPanel = CF.DETECTORS.length - (state.exp.pi ? 1 : 0);
    var need = 0;
    sel.forEach(function (s) { need += s.bb ? state.exp.nPanels : 1; });
    $('sel-count').textContent = sel.length + ' picked · ' + need + ' of ' + perPanel * state.exp.nPanels + ' slots';
    $('sel-help').textContent = sel.length
      ? 'Mark a marker as backbone to put it on every panel in the same fluor.'
      : 'No markers picked yet. Search above and add the ones you want to look at.';
    $('sel-actions').hidden = !sel.length;
    var where = {};
    if (res) res.panels.forEach(function (p) {
      Object.keys(p.slots).forEach(function (d) {
        var s = p.slots[d];
        if (s.pi) return;
        where[s.marker] = s.bb ? 'all panels · ' + s.entry.fluor : 'Panel ' + p.id + ' · ' + s.entry.fluor;
      });
    });
    var unplaced = {};
    if (res) res.unplaced.forEach(function (u) { unplaced[u.marker] = u.reason; });
    $('picked').innerHTML = sel.map(function (s, i) {
      var info = where[s.name] || (unplaced[s.name] ? 'not placed: ' + unplaced[s.name] : stockSummary(s.name));
      return '<div class="pick"><b>' + esc(s.name) + '</b><span title="' + esc(info) + '">' + esc(info) + '</span>' +
        '<button type="button" class="bb" aria-pressed="' + s.bb + '" data-bb="' + i + '">Backbone</button>' +
        '<button type="button" class="x" data-rm="' + i + '" aria-label="Remove ' + esc(s.name) + '">×</button></div>';
    }).join('');
  }

  function renderBoard() {
    var ex = state.exp, res = state.result;
    var title = ex.name.trim() || 'Untitled experiment';
    $('board-title').textContent = title;
    $('board-sub').textContent = ex.nPanels + ' panels · from ' + speciesCatalog().length + ' ' + ex.species.toLowerCase() + ' antibodies in the catalog';
    $('remove-panel').hidden = ex.nPanels <= 1;
    $('add-panel').disabled = ex.nPanels >= CF.MAX_PANELS;

    var full = res.unplaced.filter(function (u) { return u.reason === 'no free detector'; });
    var nostock = res.unplaced.filter(function (u) { return u.reason !== 'no free detector'; });
    var err = $('error');
    if (full.length) {
      err.hidden = false;
      $('error-text').textContent = 'Error, you selected more fluors than there are available channels for ' + ex.nPanels + ' panel' + (ex.nPanels === 1 ? '' : 's') + '. Add another panel?';
      var need = CF.panelsNeeded({ markers: ex.sel.map(function (s) { return { name: s.name, bb: s.bb }; }), catalog: speciesCatalog(), pi: ex.pi, runDate: ex.runDate || today() });
      $('error-detail').textContent = 'Couldn’t place ' + full.map(function (u) { return u.marker + ' (' + stockSummary(u.marker) + ')'; }).join('; ') + '.' +
        (need && need > ex.nPanels ? ' These markers fit on ' + need + ' panels.' : need === null ? ' Even ' + CF.MAX_PANELS + ' panels won’t fit them: try fewer backbone markers.' : '');
      var b = $('error-add');
      b.textContent = 'Add Panel ' + CF.panelId(ex.nPanels);
      b.hidden = ex.nPanels >= CF.MAX_PANELS;
    } else err.hidden = true;

    var sn = $('stock-note');
    if (nostock.length) {
      sn.hidden = false;
      sn.innerHTML = '<strong>No usable reagent</strong><ul>' + nostock.map(function (u) {
        return '<li>' + esc(u.marker) + ': ' + esc(stockSummary(u.marker)) + ' for ' + esc(ex.species.toLowerCase()) + '. Add it in the Antibody catalog or mark a vial In stock.</li>';
      }).join('') + '</ul>';
    } else sn.hidden = true;

    var w = $('warnings');
    var warns = res.warnings.slice();
    if (!res.exhaustive) warns.push('This was a big search, so the layout is very good but may not be the single best one.');
    if (warns.length) {
      w.hidden = false;
      w.innerHTML = '<strong>Things to check</strong><ul>' + warns.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
    } else w.hidden = true;

    if (!ex.sel.length) {
      $('panels').innerHTML = '<div class="empty" style="grid-column: 1 / -1;"><b>Your panels will appear here</b>Pick surface markers on the left and Country Flow assigns each one to a panel and a detector using antibodies from your catalog.</div>';
      return;
    }
    $('panels').innerHTML = res.panels.map(function (p) {
      var pr = panelRows(p);
      return '<div class="panel"><div class="panel-head"><span class="panel-badge">' + p.id + '</span><b>Panel ' + p.id + '</b><span class="panel-sum">' + esc(pr.summary) + '</span></div>' +
        '<div class="scroll"><table><thead><tr><th>Detector</th><th>Marker</th><th>Reagent</th><th>Location</th></tr></thead><tbody>' +
        pr.rows.map(function (r) {
          var det = '<span class="det"><span class="swatch" style="background:' + r.color + '"></span>' + esc(r.detector) + '</span>';
          if (r.kind === 'open') return '<tr><td>' + det + '</td><td class="open">Open</td><td class="open">—</td><td></td></tr>';
          if (r.kind === 'pi') return '<tr><td>' + det + '</td><td><b>PI</b><span class="tag tag-pi">live/dead</span></td><td class="sub">Propidium iodide</td><td class="sub">' + esc(CF.VIABILITY.note) + '</td></tr>';
          return '<tr><td>' + det + '</td><td><b>' + esc(r.marker) + '</b>' + (r.bb ? '<span class="tag">backbone</span>' : '') + '</td>' +
            '<td class="sub">' + esc(r.fluor) + (r.clone ? ' · ' + esc(r.clone) : '') + (r.vendor ? ' · ' + esc(r.vendor) : '') + '</td><td class="sub">' + esc(r.entry.location || '') + '</td></tr>';
        }).join('') + '</tbody></table></div></div>';
    }).join('');
  }

  function renderDesign() {
    solve();
    renderSetup();
    renderResults();
    renderPicked();
    renderBoard();
  }

  $('exp-name').addEventListener('input', function (e) { state.exp.name = e.target.value; saveExp(); renderBoard(); });
  $('sp-human').addEventListener('click', function () { setSpecies('Human'); });
  $('sp-mouse').addEventListener('click', function () { setSpecies('Mouse'); });
  function setSpecies(sp) {
    if (state.exp.species === sp) return;
    var had = state.exp.sel.length;
    state.exp.species = sp;
    state.exp.sel = [];
    saveExp();
    renderDesign();
    if (had) toast('Switched to ' + sp.toLowerCase() + '. Marker picks were cleared.');
  }
  $('pi-toggle').addEventListener('change', function (e) { state.exp.pi = e.target.checked; saveExp(); renderDesign(); });
  $('marker-q').addEventListener('input', function (e) { state.query = e.target.value; state.active = 0; renderResults(); });
  $('marker-q').addEventListener('keydown', function (e) {
    var list = state.results || [];
    if (e.key === 'ArrowDown' && list.length) { e.preventDefault(); state.active = (state.active + 1) % list.length; renderResults(); }
    else if (e.key === 'ArrowUp' && list.length) { e.preventDefault(); state.active = (state.active - 1 + list.length) % list.length; renderResults(); }
    else if (e.key === 'Enter' && list.length && state.query.trim()) { e.preventDefault(); addMarker(list[state.active]); }
    else if (e.key === 'Escape') { state.query = ''; e.target.value = ''; renderResults(); }
  });
  $('results').addEventListener('click', function (e) {
    var b = e.target.closest('[data-add]');
    if (b) addMarker(b.dataset.add);
  });
  $('no-results').addEventListener('click', function (e) {
    if (e.target.id !== 'add-from-search') return;
    var name = state.query.trim();
    setTab('catalog');
    openForm(-1, { marker: name, species: state.exp.species });
  });
  $('picked').addEventListener('click', function (e) {
    var bb = e.target.closest('[data-bb]'), rm = e.target.closest('[data-rm]');
    if (bb) { var s = state.exp.sel[+bb.dataset.bb]; s.bb = !s.bb; }
    else if (rm) state.exp.sel.splice(+rm.dataset.rm, 1);
    else return;
    saveExp();
    renderDesign();
  });
  $('clear-sel').addEventListener('click', function () { state.exp.sel = []; saveExp(); renderDesign(); toast('Cleared all markers.'); });
  $('add-panel').addEventListener('click', addPanel);
  $('error-add').addEventListener('click', addPanel);
  function addPanel() {
    if (state.exp.nPanels >= CF.MAX_PANELS) return;
    state.exp.nPanels++;
    saveExp();
    renderDesign();
    toast('Added Panel ' + CF.panelId(state.exp.nPanels - 1) + '.');
  }
  $('remove-panel').addEventListener('click', function () {
    if (state.exp.nPanels <= 1) return;
    state.exp.nPanels--;
    saveExp();
    renderDesign();
    toast('Removed Panel ' + CF.panelId(state.exp.nPanels) + '.');
  });
  $('to-export').addEventListener('click', function () { setTab('export'); });
  $('new-exp').addEventListener('click', function () {
    var op = state.exp.operator;
    state.exp = blankExp();
    state.exp.operator = op;
    saveExp();
    renderDesign();
    $('exp-name').focus();
    toast('Started a new experiment.');
  });

  /* ---------- catalog tab ---------- */
  function catalogView() {
    var q = state.catQuery.trim().toLowerCase();
    return state.catalog.map(function (e, i) { return { e: e, i: i }; }).filter(function (r) {
      if (state.catSpecies !== 'All' && r.e.species !== state.catSpecies) return false;
      if (!q) return true;
      return [r.e.marker, r.e.fluor, r.e.clone, r.e.vendor, r.e.location, r.e.catalog_number, r.e.lot].join(' ').toLowerCase().indexOf(q) > -1;
    });
  }

  function renderCatalog() {
    var counts = { Human: 0, Mouse: 0 };
    state.catalog.forEach(function (e) { counts[e.species] = (counts[e.species] || 0) + 1; });
    var examples = state.catalog.some(function (e) { return e.notes === 'Example row'; });
    $('cat-sub').textContent = state.catalog.length + ' antibodies · ' + counts.Human + ' human, ' + counts.Mouse + ' mouse' + (examples ? ' · includes example rows' : '');
    ['All', 'Human', 'Mouse'].forEach(function (s) { $('cf-' + s.toLowerCase()).setAttribute('aria-pressed', String(state.catSpecies === s)); });
    var rows = catalogView();
    $('cat-empty').hidden = rows.length > 0;
    $('cat-body').innerHTML = rows.map(function (r) {
      var e = r.e, det = CF.detectorFor(e.fluor);
      var dObj = CF.DETECTORS.filter(function (d) { return d.id === det; })[0];
      var expired = CF.isExpired(e);
      var pill = e.status === 'Out' ? 'pill-out' : e.status === 'Low' ? 'pill-low' : 'pill-ok';
      return '<tr><td><b>' + esc(e.marker) + '</b></td><td>' + esc(e.species) + '</td><td>' + esc(e.fluor) + '</td>' +
        '<td>' + (dObj ? '<span class="det" style="font-weight:500"><span class="swatch" style="background:' + dObj.color + '"></span>' + esc(det) + '</span>' : '<span class="pill pill-out" title="This fluor isn’t read by any detector in config.js">no detector</span>') + '</td>' +
        '<td class="sub">' + esc(e.clone) + '</td><td>' + esc(e.vendor) + '</td><td class="sub">' + esc(e.catalog_number) + '</td><td class="sub">' + esc(e.lot) + '</td>' +
        '<td>' + esc(e.location) + '</td><td class="sub"' + (expired ? ' style="color: var(--danger)"' : '') + '>' + esc(e.expires) + (expired ? ' (expired)' : '') + '</td>' +
        '<td><span class="pill ' + pill + '">' + esc(e.status) + '</span></td>' +
        '<td class="actions"><button type="button" class="btn btn-sm" data-edit="' + r.i + '" aria-label="Edit ' + esc(e.marker + ' ' + e.fluor) + '">Edit</button>' +
        '<button type="button" class="btn btn-sm btn-quiet" data-del="' + r.i + '" aria-label="Delete ' + esc(e.marker + ' ' + e.fluor) + '">Delete</button></td></tr>';
    }).join('');
    $('sheet-url').value = $('sheet-url').value || store.get(KEYS.sheet, '');
    $('mode-replace').setAttribute('aria-pressed', String(state.syncMode === 'replace'));
    $('mode-merge').setAttribute('aria-pressed', String(state.syncMode === 'merge'));
  }

  ['All', 'Human', 'Mouse'].forEach(function (s) {
    $('cf-' + s.toLowerCase()).addEventListener('click', function () { state.catSpecies = s; renderCatalog(); });
  });
  $('cat-q').addEventListener('input', function (e) { state.catQuery = e.target.value; renderCatalog(); });

  // Fluor dropdown: every known fluor name, grouped by detector.
  $('f-fluor').innerHTML = CF.DETECTORS.map(function (d) {
    return '<optgroup label="' + esc(d.id + ' detector') + '">' + CF.FLUOR_CHOICES.filter(function (f) { return CF.FLUOR_TO_DETECTOR[f] === d.id; })
      .map(function (f) { return '<option>' + esc(f) + '</option>'; }).join('') + '</optgroup>';
  }).join('');

  var FORM = { marker: 'f-marker', fluor: 'f-fluor', species: 'f-species', clone: 'f-clone', vendor: 'f-vendor', catalog_number: 'f-cat', lot: 'f-lot', location: 'f-loc', expires: 'f-exp', status: 'f-status', notes: 'f-notes' };
  function openForm(index, preset) {
    state.editIndex = index;
    var e = index > -1 ? state.catalog[index] : Object.assign({ fluor: 'PE', species: state.catSpecies !== 'All' ? state.catSpecies : state.exp.species, status: 'In stock' }, preset || {});
    Object.keys(FORM).forEach(function (k) {
      var el = $(FORM[k]);
      var v = e[k] || '';
      if (k === 'fluor' && v && !Array.prototype.some.call(el.options, function (o) { return o.value === v; })) {
        var o = document.createElement('option'); o.textContent = v; el.appendChild(o);
      }
      el.value = v || (k === 'status' ? 'In stock' : k === 'species' ? 'Human' : '');
    });
    $('ab-form-title').textContent = index > -1 ? 'Edit ' + e.marker + ' ' + e.fluor : 'New antibody';
    $('f-save').textContent = index > -1 ? 'Save changes' : 'Save antibody';
    $('f-error').hidden = true;
    $('ab-form').hidden = false;
    $('add-toggle').setAttribute('aria-expanded', 'true');
    $('f-marker').focus();
  }
  function closeForm() {
    $('ab-form').hidden = true;
    $('add-toggle').setAttribute('aria-expanded', 'false');
    state.editIndex = -1;
  }
  $('add-toggle').addEventListener('click', function () {
    if (!$('ab-form').hidden && state.editIndex === -1) closeForm(); else openForm(-1);
  });
  $('f-cancel').addEventListener('click', closeForm);
  $('ab-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var e = {};
    Object.keys(FORM).forEach(function (k) { e[k] = $(FORM[k]).value.trim(); });
    if (!e.marker) { $('f-error').hidden = false; $('f-error').textContent = 'Enter a marker name, for example CD4.'; $('f-marker').focus(); return; }
    var dupe = state.catalog.some(function (x, i) {
      return i !== state.editIndex && x.species === e.species && x.marker.toLowerCase() === e.marker.toLowerCase() && CF.normFluor(x.fluor) === CF.normFluor(e.fluor) && (x.lot || '') === (e.lot || '');
    });
    if (state.editIndex > -1) state.catalog[state.editIndex] = e; else state.catalog.push(e);
    saveCatalog();
    toast((state.editIndex > -1 ? 'Updated ' : 'Added ') + e.marker + ' ' + e.fluor + (dupe ? '. You already had this one, so it is listed twice.' : '.'));
    closeForm();
    renderCatalog();
  });

  function askConfirm(html, onYes) {
    var c = $('cat-confirm');
    c.innerHTML = '<span>' + html + '</span><button type="button" class="btn btn-sm btn-danger" id="cc-yes">Yes, do it</button><button type="button" class="btn btn-sm" id="cc-no">Cancel</button>';
    c.hidden = false;
    $('cc-yes').onclick = function () { c.hidden = true; onYes(); };
    $('cc-no').onclick = function () { c.hidden = true; };
    $('cc-no').focus();
  }

  $('cat-body').addEventListener('click', function (ev) {
    var ed = ev.target.closest('[data-edit]'), del = ev.target.closest('[data-del]');
    if (ed) { openForm(+ed.dataset.edit); $('ab-form').scrollIntoView({ block: 'nearest' }); }
    if (del) {
      var i = +del.dataset.del, e = state.catalog[i];
      askConfirm('Delete ' + esc(e.marker + ' ' + e.fluor) + (e.lot ? ' (lot ' + esc(e.lot) + ')' : '') + ' from the catalog?', function () {
        state.catalog.splice(i, 1);
        saveCatalog();
        renderCatalog();
        toast('Deleted ' + e.marker + ' ' + e.fluor + '.');
      });
    }
  });

  function applyImport(rows, mode, source) {
    if (mode === 'replace') state.catalog = rows;
    else state.catalog = state.catalog.concat(rows);
    saveCatalog();
    renderCatalog();
    var unknown = rows.filter(function (r) { return !CF.detectorFor(r.fluor); }).length;
    return rows.length + ' antibodies ' + (mode === 'replace' ? 'loaded' : 'added') + ' from ' + source + (unknown ? '. ' + unknown + ' use a fluor no detector reads; check those rows.' : '.');
  }

  $('import-btn').addEventListener('click', function () { $('import-file').value = ''; $('import-file').click(); });
  $('import-file').addEventListener('change', function (ev) {
    var f = ev.target.files && ev.target.files[0];
    if (!f) return;
    var reader = new FileReader();
    reader.onload = function () {
      var r = CF.rowsFromCsv(reader.result, state.exp.species);
      if (r.missing.length) { toast('That file has no ' + r.missing.join(' or ') + ' column. Use the blank template for the column names.'); return; }
      if (!r.rows.length) { toast('No antibodies found in ' + f.name + '.'); return; }
      var exampleOnly = state.catalog.every(function (e) { return e.notes === 'Example row'; });
      var msg = applyImport(r.rows, exampleOnly ? 'replace' : 'merge', f.name);
      toast(msg + (r.skipped ? ' Skipped ' + r.skipped + ' rows missing a marker or fluor.' : '') + (exampleOnly ? ' Example rows were removed.' : ''));
    };
    reader.onerror = function () { toast('Could not read ' + f.name + '.'); };
    reader.readAsText(f);
  });

  $('sheet-toggle').addEventListener('click', function () {
    var c = $('sheet-card');
    c.hidden = !c.hidden;
    $('sheet-toggle').setAttribute('aria-expanded', String(!c.hidden));
    if (!c.hidden) $('sheet-url').focus();
  });
  $('mode-replace').addEventListener('click', function () { state.syncMode = 'replace'; renderCatalog(); });
  $('mode-merge').addEventListener('click', function () { state.syncMode = 'merge'; renderCatalog(); });
  $('sheet-forget').addEventListener('click', function () {
    store.del(KEYS.sheet);
    $('sheet-url').value = '';
    $('sheet-status').textContent = 'Link removed from this browser.';
  });
  $('sheet-sync').addEventListener('click', function () {
    var url = $('sheet-url').value.trim();
    var st = $('sheet-status');
    if (!/^https:\/\/docs\.google\.com\/spreadsheets\//.test(url)) {
      st.textContent = 'Paste the link from File › Share › Publish to web. It starts with https://docs.google.com/spreadsheets/.';
      return;
    }
    // A normal sharing link can be turned into its CSV export link.
    var m = url.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]+)\/(edit|view)/);
    if (m) {
      var gid = (url.match(/[#&?]gid=(\d+)/) || [])[1];
      url = 'https://docs.google.com/spreadsheets/d/' + m[1] + '/export?format=csv' + (gid ? '&gid=' + gid : '');
    }
    store.set(KEYS.sheet, $('sheet-url').value.trim());
    st.textContent = 'Syncing…';
    $('sheet-sync').disabled = true;
    fetch(url, { credentials: 'omit' }).then(function (r) {
      if (!r.ok) throw new Error('The Sheet answered ' + r.status + '. Check that the tab is published to the web as CSV.');
      return r.text();
    }).then(function (text) {
      if (/^\s*<!doctype html|^\s*<html/i.test(text)) throw new Error('That link returns a web page, not CSV. Publish the tab as "Comma-separated values (.csv)".');
      var res = CF.rowsFromCsv(text, state.exp.species);
      if (res.missing.length) throw new Error('The Sheet has no ' + res.missing.join(' or ') + ' column.');
      var msg = applyImport(res.rows, state.syncMode, 'your Sheet');
      st.textContent = 'Synced ' + new Date().toLocaleTimeString() + '. ' + msg;
    }).catch(function (err) {
      var blocked = err instanceof TypeError;
      st.textContent = blocked
        ? (embedded ? 'This preview can’t reach Google. Sync works on the hosted app; here, download the tab as CSV and use Import CSV.' : 'Couldn’t reach the Sheet. Check your connection and that the tab is published to the web.')
        : err.message;
    }).then(function () { $('sheet-sync').disabled = false; });
  });

  var TEMPLATE_HEADER = ['marker', 'species', 'fluor', 'clone', 'vendor', 'catalog_number', 'lot', 'location', 'expires', 'status', 'notes'];
  $('cat-download').addEventListener('click', function () {
    saveFile('country-flow-catalog-' + today() + '.csv', CF.csv.stringify(TEMPLATE_HEADER, state.catalog), 'text/csv');
  });
  $('cat-template').addEventListener('click', function () {
    var example = [{ marker: 'CD4', species: 'Human', fluor: 'APC', clone: 'RPA-T4', vendor: 'BioLegend', catalog_number: '300514', lot: 'B123456', location: 'Fridge 2 · Box B4', expires: '2027-06-30', status: 'In stock', notes: '1:100' }];
    saveFile('country-flow-catalog-template.csv', CF.csv.stringify(TEMPLATE_HEADER, example), 'text/csv');
  });
  $('cat-samples').addEventListener('click', function () {
    var have = state.catalog.some(function (e) { return e.notes === 'Example row'; });
    if (have) { toast('Example rows are already in the catalog.'); return; }
    state.catalog = state.catalog.concat(CF.sampleCatalog());
    saveCatalog(); renderCatalog();
    toast('Added example rows. Their notes say "Example row".');
  });
  $('cat-clear').addEventListener('click', function () {
    askConfirm('Remove all ' + state.catalog.length + ' antibodies from this browser? Download the catalog CSV first if you want a copy.', function () {
      state.catalog = [];
      saveCatalog(); renderCatalog();
      toast('Catalog cleared.');
    });
  });

  /* ---------- export tab ---------- */
  var hatImg = new Image();
  hatImg.src = 'assets/hat.png';

  function record() {
    var ex = state.exp, res = solve();
    var notes = [];
    if (res.unplaced.length) notes.push('Not placed: ' + res.unplaced.map(function (u) { return u.marker + ' (' + u.reason + ')'; }).join(', '));
    notes = notes.concat(res.warnings);
    return {
      title: ex.name.trim() || 'Untitled experiment',
      instrument: CF.INSTRUMENT, species: ex.species, pi: ex.pi,
      runDate: ex.runDate, operator: ex.operator.trim(),
      generated: today(),
      panels: res.panels.map(function (p) { var pr = panelRows(p); return { id: p.id, rows: pr.rows, summary: pr.summary }; }),
      notes: notes
    };
  }

  var drawQueued = false;
  function renderExport() {
    var ex = state.exp;
    if ($('op-name').value !== ex.operator) $('op-name').value = ex.operator;
    if ($('run-date').value !== ex.runDate) $('run-date').value = ex.runDate;
    $('print-fig').hidden = embedded;
    if (drawQueued) return;
    drawQueued = true;
    var go = function () { drawQueued = false; CF.drawFigure($('figure'), record(), hatImg); };
    if (document.fonts && document.fonts.load) {
      Promise.all([
        document.fonts.load("700 34px 'Source Serif 4'"), document.fonts.load("400 12px 'Source Serif 4'"),
        document.fonts.load("italic 400 14px 'Source Serif 4'"), document.fonts.load("400 11px 'IBM Plex Mono'")
      ]).then(go, go);
    } else go();
  }
  hatImg.onload = function () { if (state.tab === 'export') renderExport(); };

  $('op-name').addEventListener('input', function (e) { state.exp.operator = e.target.value; saveExp(); renderExport(); });
  $('run-date').addEventListener('change', function (e) { state.exp.runDate = e.target.value; saveExp(); renderExport(); });
  $('today').addEventListener('click', function () { state.exp.runDate = today(); saveExp(); renderExport(); toast('Run date set to ' + state.exp.runDate + '.'); });

  $('dl-csv').addEventListener('click', function () {
    var rec = record();
    var header = ['experiment', 'run_date', 'operator', 'instrument', 'species', 'panel', 'detector', 'laser_filter', 'marker', 'fluor', 'backbone', 'clone', 'vendor', 'catalog_number', 'lot', 'location', 'expires', 'viability'];
    var rows = [];
    rec.panels.forEach(function (p) {
      p.rows.forEach(function (r) {
        var e = r.entry || {};
        rows.push({
          experiment: rec.title, run_date: rec.runDate, operator: rec.operator, instrument: rec.instrument, species: rec.species,
          panel: p.id, detector: r.detector, laser_filter: r.optics,
          marker: r.kind === 'open' ? '' : r.marker, fluor: r.kind === 'pi' ? 'Propidium iodide' : r.fluor,
          backbone: r.kind === 'marker' ? (r.bb ? 'yes' : 'no') : '',
          clone: r.clone, vendor: r.vendor, catalog_number: e.catalog_number || '', lot: e.lot || '', location: r.kind === 'pi' ? CF.VIABILITY.note : (e.location || ''),
          expires: e.expires || '', viability: rec.pi ? 'PI' : 'none'
        });
      });
    });
    saveFile(slug(rec.title) + '_' + (rec.runDate || today()) + '_panels.csv', CF.csv.stringify(header, rows), 'text/csv');
  });
  $('dl-png').addEventListener('click', function () {
    var rec = record();
    CF.drawFigure($('figure'), rec, hatImg);
    $('figure').toBlob(function (blob) {
      if (!blob) { toast('Could not draw the figure.'); return; }
      saveFile(slug(rec.title) + '_' + (rec.runDate || today()) + '_panels.png', blob, 'image/png');
    }, 'image/png');
  });
  $('print-fig').addEventListener('click', function () {
    if (!state.exp.runDate) toast('Tip: set the run date so the printout is dated.');
    window.print();
  });

  /* ---------- minigame hookup ---------- */
  $('hat-btn').addEventListener('click', function () {
    CF.game.open(function () {
      var ex = state.exp, res = state.result || solve();
      var placed = [];
      res.panels.forEach(function (p) {
        Object.keys(p.slots).forEach(function (d) {
          var s = p.slots[d];
          if (!s.pi) placed.push({ marker: s.marker, panel: s.bb ? null : p.id, fluor: s.entry.fluor });
        });
      });
      return {
        firstName: (ex.operator.trim().split(/\s+/)[0] || ''),
        experiment: ex.name.trim(),
        markers: ex.sel.map(function (s) { return s.name; }),
        placed: placed
      };
    });
  });

  /* ---------- boot ---------- */
  var hash = (location.hash || '').replace('#', '');
  if (['design', 'catalog', 'export'].indexOf(hash) > -1) state.tab = hash;
  setTab(state.tab);
})();
