/*
 * Instrument configuration.
 *
 * Country Flow ships set up for a 7-detector BD FACSCanto II (3 lasers).
 * If your cytometer is different, edit DETECTORS and FLUOR_TO_DETECTOR
 * below; nothing else in the app hard-codes channel names.
 */
window.CF = window.CF || {};

CF.INSTRUMENT = 'BD FACSCanto II';

// Order here is the row order used in panels, the figure and the CSV.
CF.DETECTORS = [
  { id: 'FITC',         laser: '488 nm', filter: '530/30', color: '#3E9B4F' },
  { id: 'PE',           laser: '488 nm', filter: '585/42', color: '#E0A526' },
  { id: 'PerCP-Cy5.5',  laser: '488 nm', filter: '670LP',  color: '#C2412D' },
  { id: 'APC',          laser: '633 nm', filter: '660/20', color: '#A3324F' },
  { id: 'APC-Cy7',      laser: '633 nm', filter: '780/60', color: '#5B2A4A' },
  { id: 'Pacific Blue', laser: '405 nm', filter: '450/50', color: '#2F5BD3' },
  { id: 'AmCyan',       laser: '405 nm', filter: '510/50', color: '#4E9CC4' }
];

// Every fluor name the catalog may use, mapped to the detector that reads it.
// Matching ignores case, spaces, dashes and slashes, so "APC/Cy7",
// "apc-cy7" and "APC Cy7" all work.
CF.FLUOR_TO_DETECTOR = {
  'FITC': 'FITC', 'Alexa Fluor 488': 'FITC', 'AF488': 'FITC', 'GFP': 'FITC',
  'PE': 'PE',
  'PerCP-Cy5.5': 'PerCP-Cy5.5', 'PerCP': 'PerCP-Cy5.5', 'PerCP-eFluor 710': 'PerCP-Cy5.5', 'PE-Cy5': 'PerCP-Cy5.5',
  'APC': 'APC', 'Alexa Fluor 647': 'APC', 'AF647': 'APC',
  'APC-Cy7': 'APC-Cy7', 'APC-H7': 'APC-Cy7', 'APC-eFluor 780': 'APC-Cy7', 'APC-Fire 750': 'APC-Cy7',
  'Pacific Blue': 'Pacific Blue', 'V450': 'Pacific Blue', 'BV421': 'Pacific Blue', 'eFluor 450': 'Pacific Blue', 'BD Horizon V450': 'Pacific Blue',
  'AmCyan': 'AmCyan', 'V500': 'AmCyan', 'BV510': 'AmCyan', 'Pacific Orange': 'AmCyan', 'Zombie Aqua': 'AmCyan'
};

// Live/dead dye. PI is excited at 488 nm and read in PerCP-Cy5.5 on this Canto.
CF.VIABILITY = { name: 'PI', reagent: 'Propidium iodide', detector: 'PerCP-Cy5.5', note: 'Add just before acquisition' };

// Detectors that PI spills into noticeably; markers there get a compensation note.
CF.PI_SPILL = ['PE'];

CF.MAX_PANELS = 8;

CF.normFluor = function (s) { return String(s || '').toLowerCase().replace(/[\s\-\/_]+/g, ''); };
(function () {
  var idx = {};
  Object.keys(CF.FLUOR_TO_DETECTOR).forEach(function (k) { idx[CF.normFluor(k)] = CF.FLUOR_TO_DETECTOR[k]; });
  CF.detectorFor = function (fluor) { return idx[CF.normFluor(fluor)] || null; };
  CF.FLUOR_CHOICES = Object.keys(CF.FLUOR_TO_DETECTOR);
})();
