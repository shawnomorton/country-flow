/*
 * Panel solver.
 *
 * Places every chosen marker into a (panel, detector) slot using reagents that
 * are actually in the catalog. Backbone markers take the same detector and
 * reagent on every panel. PI, when on, takes its detector on every panel.
 *
 * The search is an exhaustive branch-and-bound with a node budget, scored as:
 *   1. place as many markers as possible,
 *   2. keep panels evenly loaded,
 *   3. avoid low-stock or expired vials, and avoid detectors PI spills into.
 * Works in the browser (window.CF) and in Node (module.exports) for tests.
 */
(function (root) {
  var CF = root.CF || (root.CF = {});

  function today() {
    var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  CF.isExpired = function (entry, onDate) {
    var e = String(entry.expires || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}/.test(e)) return false;
    return e.slice(0, 10) < (onDate || today());
  };

  // For one marker: best reagent per detector, with its cost.
  CF.optionsFor = function (marker, catalog, opts) {
    var key = marker.toLowerCase();
    var best = {};
    catalog.forEach(function (e) {
      if (String(e.marker).trim().toLowerCase() !== key) return;
      if (e.status === 'Out') return;
      var det = CF.detectorFor(e.fluor);
      if (!det) return;
      if (opts.pi && det === CF.VIABILITY.detector) return;
      var cost = (e.status === 'Low' ? 1 : 0) + (CF.isExpired(e, opts.runDate) ? 3 : 0);
      if (opts.pi && CF.PI_SPILL.indexOf(det) > -1) cost += 1;
      if (!best[det] || cost < best[det].cost) best[det] = { det: det, entry: e, cost: cost };
    });
    var order = CF.DETECTORS.map(function (d) { return d.id; });
    return Object.keys(best).map(function (k) { return best[k]; })
      .sort(function (a, b) { return a.cost - b.cost || order.indexOf(a.det) - order.indexOf(b.det); });
  };

  CF.panelId = function (i) { return String.fromCharCode(65 + i); };

  /*
   * input: { markers: [{name, bb}], catalog: [entries], nPanels, pi, runDate, nodeLimit }
   * output: { panels: [{id, slots: {detector: {marker, entry, bb} | {pi: true}}}],
   *           unplaced: [{marker, reason}], warnings: [string], complete, exhaustive }
   */
  CF.solve = function (input) {
    var n = input.nPanels, pi = !!input.pi;
    var dets = CF.DETECTORS.map(function (d) { return d.id; });
    var opts = { pi: pi, runDate: input.runDate };
    var limit = input.nodeLimit || 250000;

    var items = input.markers.map(function (m) {
      return { name: m.name, bb: !!m.bb, options: CF.optionsFor(m.name, input.catalog, opts) };
    });
    var noStock = items.filter(function (it) { return !it.options.length; });
    var work = items.filter(function (it) { return it.options.length; });
    work.sort(function (a, b) {
      if (a.bb !== b.bb) return a.bb ? -1 : 1;
      return a.options.length - b.options.length || a.name.localeCompare(b.name);
    });

    var used = [], load = [];
    for (var p = 0; p < n; p++) {
      used.push({});
      load.push(0);
      if (pi) used[p][CF.VIABILITY.detector] = true;
    }

    var choice = new Array(work.length);
    var best = { score: -Infinity, choice: null };
    var nodes = 0, cut = false;

    function leafScore(placed, cost) {
      var mx = Math.max.apply(null, load), mn = Math.min.apply(null, load);
      return placed * 1000 - (mx - mn) * 20 - cost * 5;
    }

    function dfs(i, placed, cost) {
      if (++nodes > limit) { cut = true; return; }
      if ((placed + (work.length - i)) * 1000 - cost * 5 <= best.score) return;
      if (i === work.length) {
        var s = leafScore(placed, cost);
        if (s > best.score) best = { score: s, choice: choice.slice() };
        return;
      }
      var it = work[i];
      if (it.bb) {
        it.options.forEach(function (o) {
          if (cut) return;
          for (var q = 0; q < n; q++) if (used[q][o.det]) return;
          for (q = 0; q < n; q++) { used[q][o.det] = true; load[q]++; }
          choice[i] = { all: true, opt: o };
          dfs(i + 1, placed + 1, cost + o.cost);
          for (q = 0; q < n; q++) { used[q][o.det] = false; load[q]--; }
        });
      } else {
        // Panels with no regular markers yet are interchangeable: only try the first one.
        var firstEmpty = n;
        for (var e = 0; e < n; e++) if (!regular[e]) { firstEmpty = e; break; }
        var moves = [];
        it.options.forEach(function (o) {
          for (var q = 0; q < n && q <= firstEmpty; q++) if (!used[q][o.det]) moves.push({ p: q, opt: o });
        });
        moves.sort(function (a, b) { return a.opt.cost - b.opt.cost || load[a.p] - load[b.p] || a.p - b.p; });
        moves.forEach(function (m) {
          if (cut) return;
          used[m.p][m.opt.det] = true; load[m.p]++; regular[m.p]++;
          choice[i] = { p: m.p, opt: m.opt };
          dfs(i + 1, placed + 1, cost + m.opt.cost);
          used[m.p][m.opt.det] = false; load[m.p]--; regular[m.p]--;
        });
      }
      if (cut) return;
      choice[i] = null;
      dfs(i + 1, placed, cost);
    }
    var regular = load.map(function () { return 0; });
    dfs(0, 0, 0);

    var panels = [];
    for (p = 0; p < n; p++) {
      panels.push({ id: CF.panelId(p), slots: {} });
      if (pi) panels[p].slots[CF.VIABILITY.detector] = { pi: true };
    }
    var unplaced = noStock.map(function (it) { return { marker: it.name, reason: 'none in stock' }; });
    (best.choice || []).forEach(function (c, i) {
      var it = work[i];
      if (!c) { unplaced.push({ marker: it.name, reason: 'no free detector' }); return; }
      var slot = { marker: it.name, entry: c.opt.entry, bb: it.bb };
      if (c.all) panels.forEach(function (pp) { pp.slots[c.opt.det] = slot; });
      else panels[c.p].slots[c.opt.det] = slot;
    });

    var warnings = [];
    var seen = {};
    panels.forEach(function (pp) {
      dets.forEach(function (d) {
        var s = pp.slots[d];
        if (!s || s.pi || seen[s.marker]) return;
        seen[s.marker] = true;
        var label = s.marker + ' ' + s.entry.fluor;
        if (pi && CF.PI_SPILL.indexOf(d) > -1) warnings.push('PI spills into ' + d + '. Compensate ' + d + ' carefully and gate ' + s.marker + ' on live cells.');
        if (s.entry.status === 'Low') warnings.push(label + ' is marked low in stock.');
        if (CF.isExpired(s.entry, input.runDate)) warnings.push(label + ' expired on ' + s.entry.expires + '.');
      });
    });

    return {
      panels: panels,
      unplaced: unplaced,
      warnings: warnings,
      complete: unplaced.length === 0,
      exhaustive: !cut
    };
  };

  // Smallest panel count that fits every marker that has stock, or null.
  CF.panelsNeeded = function (input) {
    for (var k = 1; k <= CF.MAX_PANELS; k++) {
      var r = CF.solve(Object.assign({}, input, { nPanels: k, nodeLimit: 40000 }));
      if (!r.unplaced.some(function (u) { return u.reason === 'no free detector'; })) return k;
    }
    return null;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = CF;
})(typeof window !== 'undefined' ? window : globalThis);
