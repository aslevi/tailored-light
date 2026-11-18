// Coming-soon gate. Every page loads this first; without the team key the visitor goes to /coming-soon/.
// This hides the site from casual visitors only: the pages are still public files. Remove this script
// (and the tag in each page's head) at launch.
(function () {
  var KEY = 'hs_preview', TOKEN = '201717ae3b819a28eec7d3bfd11a09941a681a7abf361123e02425277599ee77';
  var p = location.pathname;
  if (p.indexOf('/coming-soon') === 0) return;
  if (/[?&]logout\b/.test(location.search)) {
    try { localStorage.removeItem(KEY); } catch (e) {}
    document.documentElement.style.display = 'none';
    location.replace('/coming-soon/');
    return;
  }
  var ok = false;
  try { ok = localStorage.getItem(KEY) === TOKEN; } catch (e) {}
  if (!ok) {
    document.documentElement.style.display = 'none';
    location.replace('/coming-soon/?next=' + encodeURIComponent(p + location.search + location.hash));
  }
})();
