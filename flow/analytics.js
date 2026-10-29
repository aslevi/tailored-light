// Hello Shade visitor analytics (GoatCounter: free, no cookies, no consent banner needed).
// To turn on: create a free site at https://www.goatcounter.com and put its code below
// (the "hello-shade" part of hello-shade.goatcounter.com). Empty = off, nothing loads.
(function () {
  var CODE = '';
  if (!CODE || location.hostname === 'localhost' || location.hostname === '127.0.0.1') return;

  window.goatcounter = { path: function (p) { return location.pathname.replace(/^\/tailored-light/, '') + location.search.replace(/[?&](phone|name|email)=[^&]*/g, ''); } };
  var s = document.createElement('script');
  s.async = true;
  s.dataset.goatcounter = 'https://' + CODE + '.goatcounter.com/count';
  s.src = 'https://gc.zgo.at/count.js';
  document.head.appendChild(s);

  // Key steps in the funnel, counted as events.
  function eventFor(a) {
    var h = a.getAttribute('href') || '';
    if (h.indexOf('sms:') === 0 || a.hasAttribute('data-dana') || a.hasAttribute('data-text-sheet')) return 'text-a-designer';
    if (a.hasAttribute('data-swatch-kit')) return 'samples-request';
    if (/swatch-kit\//.test(h)) return 'samples-page';
    if (/try-your-window\//.test(h)) return 'try-your-window';
    if (/studio\//.test(h)) return 'try-on';
    if (/how-to-measure\//.test(h)) return 'how-to-measure';
    return null;
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a');
    if (!a) return;
    var name = eventFor(a);
    if (!name || !window.goatcounter || !window.goatcounter.count) return;
    window.goatcounter.count({ path: name, title: location.pathname, event: true });
  }, true);
})();
