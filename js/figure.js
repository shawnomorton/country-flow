/*
 * Draws the printable panel figure onto a canvas. The same canvas is the
 * on-screen preview and the downloadable PNG, so what you see is what you file.
 */
window.CF = window.CF || {};

CF.drawFigure = function (canvas, rec, hatImg) {
  var SERIF = "'Source Serif 4', 'Times New Roman', Georgia, serif";
  var MONO = "'IBM Plex Mono', ui-monospace, Menlo, monospace";
  var INK = '#1B1A1F', MUTED = '#5E5A63', RULE = '#DDD7D2', ACC = '#AD6B4B', TINT = '#F6ECE6', PAPER = '#FFFFFF';

  var W = 1100, M = 48, scale = 2;
  var cols = Math.min(rec.panels.length, rec.panels.length === 4 ? 2 : 3) || 1;
  var gap = 24;
  var colW = (W - M * 2 - gap * (cols - 1)) / cols;
  var rowH = 46, headH = 44;
  var panelH = headH + rowH * CF.DETECTORS.length + 8;
  var gridRows = Math.ceil(rec.panels.length / cols);
  var notes = rec.notes || [];
  var notesH = notes.length ? 40 + notes.length * 22 : 0;
  var H = M + 150 + gridRows * (panelH + gap) + notesH + 60;

  canvas.width = W * scale;
  canvas.height = H * scale;
  var x = canvas.getContext('2d');
  x.setTransform(scale, 0, 0, scale, 0, 0);
  x.fillStyle = PAPER; x.fillRect(0, 0, W, H);
  x.textBaseline = 'alphabetic';

  function text(s, px, py, font, color, align, maxW) {
    x.font = font; x.fillStyle = color; x.textAlign = align || 'left';
    s = String(s);
    if (maxW && x.measureText(s).width > maxW) {
      while (s.length > 1 && x.measureText(s + '…').width > maxW) s = s.slice(0, -1);
      s += '…';
    }
    x.fillText(s, px, py);
  }

  // Header
  var y = M;
  if (hatImg && hatImg.complete && hatImg.naturalWidth) {
    x.imageSmoothingEnabled = false;
    x.drawImage(hatImg, M, y, 46, 32);
  }
  text('COUNTRY FLOW  ·  PANEL RECORD', M + 58, y + 22, '600 12px ' + SERIF, ACC);
  text(rec.instrument, W - M, y + 22, '400 12px ' + MONO, MUTED, 'right');
  y += 74;
  text(rec.title, M, y, '700 34px ' + SERIF, INK, 'left', W - M * 2);
  y += 34;
  var meta = [
    ['Run date', rec.runDate || '—'],
    ['Operator', rec.operator || '—'],
    ['Species', rec.species],
    ['Viability', rec.pi ? 'PI · ' + CF.VIABILITY.detector : 'none'],
    ['Panels', String(rec.panels.length)]
  ];
  var mx = M;
  meta.forEach(function (m) {
    text(m[0].toUpperCase(), mx, y, '600 10px ' + SERIF, MUTED);
    text(m[1], mx, y + 18, '500 15px ' + SERIF, INK);
    x.font = '500 15px ' + SERIF;
    mx += Math.max(x.measureText(m[1]).width, 70) + 36;
  });
  y += 42;
  x.fillStyle = INK; x.fillRect(M, y, W - M * 2, 2);
  y += 24;

  // Panels
  rec.panels.forEach(function (p, i) {
    var cx = M + (i % cols) * (colW + gap);
    var cy = y + Math.floor(i / cols) * (panelH + gap);
    x.strokeStyle = RULE; x.lineWidth = 1;
    x.strokeRect(cx + 0.5, cy + 0.5, colW - 1, panelH - 1);
    x.fillStyle = INK; x.fillRect(cx, cy, colW, headH);
    text('Panel ' + p.id, cx + 14, cy + 29, '700 18px ' + SERIF, '#FFFFFF');
    text(p.summary, cx + colW - 14, cy + 28, '400 12px ' + SERIF, '#D9D3CF', 'right');
    p.rows.forEach(function (r, j) {
      var ry = cy + headH + j * rowH;
      if (j) { x.fillStyle = RULE; x.fillRect(cx + 10, ry, colW - 20, 1); }
      x.fillStyle = r.color; x.fillRect(cx + 14, ry + 15, 12, 12);
      text(r.detector, cx + 34, ry + 26, '600 13px ' + SERIF, INK, 'left', colW * 0.3);
      var mxp = cx + colW * 0.38;
      if (r.kind === 'open') {
        text('open', mxp, ry + 26, 'italic 400 14px ' + SERIF, '#9A949C');
      } else {
        text(r.marker, mxp, ry + 22, '700 15px ' + SERIF, INK, 'left', colW * 0.6 - 14);
        var sub = r.kind === 'pi' ? 'Propidium iodide · live/dead' : r.fluor + (r.clone ? ' · ' + r.clone : '') + (r.bb ? ' · backbone' : '');
        text(sub, mxp, ry + 38, '400 11px ' + MONO, r.bb ? ACC : MUTED, 'left', colW * 0.6 - 14);
      }
    });
  });
  y += gridRows * (panelH + gap);

  if (notes.length) {
    x.fillStyle = TINT; x.fillRect(M, y, W - M * 2, notesH - 8);
    text('NOTES', M + 14, y + 24, '600 10px ' + SERIF, ACC);
    notes.forEach(function (n, k) { text('• ' + n, M + 14, y + 46 + k * 22, '400 13px ' + SERIF, INK, 'left', W - M * 2 - 28); });
    y += notesH;
  }
  text('Controls: unstained · single-stain compensation beads per fluor · FMOs as needed', M, H - 30, '400 11px ' + SERIF, MUTED);
  text('Generated ' + rec.generated + ' with Country Flow', W - M, H - 30, '400 11px ' + MONO, MUTED, 'right');
};
