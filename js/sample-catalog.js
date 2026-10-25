/*
 * Example catalog shown on first run so the app has something to work with.
 * These rows are examples, not anyone's real inventory: replace them with
 * Import CSV, Sync from Google Sheet, or Add antibody.
 */
window.CF = window.CF || {};

CF.sampleCatalog = function () {
  var human = [
    ['CD45', 'HI30', ['FITC', 'V450', 'V500']],
    ['CD3', 'UCHT1', ['FITC', 'APC', 'Pacific Blue']],
    ['CD4', 'RPA-T4', ['PE', 'APC']],
    ['CD8', 'SK1', ['PerCP-Cy5.5', 'APC-H7', 'FITC']],
    ['CD19', 'HIB19', ['PE', 'APC']],
    ['CD14', 'M5E2', ['FITC', 'Pacific Blue']],
    ['CD16', '3G8', ['APC-Cy7', 'PE']],
    ['CD56', 'HCD56', ['PE', 'APC']],
    ['CD25', 'BC96', ['PE', 'APC']],
    ['CD127', 'A019D5', ['FITC', 'Pacific Blue']],
    ['HLA-DR', 'L243', ['PerCP-Cy5.5', 'APC-Cy7']],
    ['CD69', 'FN50', ['FITC', 'PE']],
    ['CD11c', '3.9', ['APC', 'PerCP-Cy5.5']],
    ['CD11b', 'ICRF44', ['FITC', 'BV510']]
  ];
  var mouse = [
    ['CD45', '30-F11', ['FITC', 'V450', 'V500', 'APC-Cy7']],
    ['CD11b', 'M1/70', ['PE', 'APC', 'FITC']],
    ['Ly6C', 'HK1.4', ['FITC', 'PerCP-Cy5.5', 'APC', 'Pacific Blue']],
    ['Ly6G', '1A8', ['PE', 'APC-Cy7']],
    ['F4/80', 'BM8', ['PE', 'APC']],
    ['CD11c', 'N418', ['APC', 'PE', 'PerCP-Cy5.5']],
    ['MHC-II', 'M5/114.15.2', ['FITC', 'Pacific Blue', 'APC-Cy7']],
    ['CD3e', '145-2C11', ['FITC', 'PE', 'APC']],
    ['CD4', 'GK1.5', ['PE', 'APC', 'Pacific Blue']],
    ['CD8a', '53-6.7', ['PerCP-Cy5.5', 'APC', 'FITC']],
    ['B220', 'RA3-6B2', ['PerCP-Cy5.5', 'APC-Cy7', 'Pacific Blue']],
    ['NK1.1', 'PK136', ['PE', 'APC']],
    ['CD25', 'PC61', ['PE', 'APC']]
  ];
  var rows = [];
  function add(list, species, fridge) {
    var n = 0;
    list.forEach(function (r) {
      r[2].forEach(function (f) {
        n++;
        var bd = f === 'V450' || f === 'V500' || f === 'APC-H7';
        rows.push({
          marker: r[0], species: species, fluor: f, clone: r[1],
          vendor: bd ? 'BD Biosciences' : 'BioLegend',
          catalog_number: '', lot: '',
          location: fridge + ' · Box ' + String.fromCharCode(64 + Math.ceil(n / 9)) + (((n - 1) % 9) + 1),
          expires: '', status: 'In stock', notes: 'Example row'
        });
      });
    });
  }
  add(human, 'Human', 'Fridge 2');
  add(mouse, 'Mouse', 'Fridge 1');
  return rows;
};
