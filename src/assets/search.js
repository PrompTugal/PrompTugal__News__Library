// The catalogue search on library.promptugal.news. Reads the same-origin /api/v1/items/index.json once and
// filters it in the browser. Builds results with createElement and textContent only (catalogue text is
// untrusted material). Without JavaScript the form submits to /catalogue/, which lists every item.
(function () {
  'use strict';
  var form = document.getElementById('search');
  var input = document.getElementById('q');
  var out = document.getElementById('results');
  if (!form || !input || !out) return;
  var items = null;
  var ITEM = /^\/item\/[A-Za-z0-9-]{1,64}\/$/;
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function clear() { while (out.firstChild) out.removeChild(out.firstChild); }
  function line(text, cls) { var li = document.createElement('li'); li.className = cls || ''; li.textContent = text; out.appendChild(li); }
  function show(q) {
    clear();
    var words = norm(q).split(/\s+/).filter(Boolean);
    if (!words.length) return;
    var hits = items.filter(function (it) {
      var hay = norm([it.call_number, it.title, it.kind, it.publisher, it.published, (it.tags || []).join(' '), (it.about || []).join(' ')].join(' '));
      return words.every(function (w) { return hay.indexOf(w) !== -1; });
    }).slice(0, 25);
    if (!hits.length) { line('Nothing in the catalogue matches. Try a call number such as WS26 2026/0001, a publisher, or a word from a title.', 'none'); return; }
    hits.forEach(function (it) {
      if (!ITEM.test(it.page)) return;
      var li = document.createElement('li');
      var cn = document.createElement('span'); cn.className = 'cn'; cn.textContent = it.call_number;
      var a = document.createElement('a'); a.setAttribute('href', it.page); a.textContent = it.title;
      li.appendChild(cn); li.appendChild(a); out.appendChild(li);
    });
  }
  function load(then) {
    if (items) return then();
    fetch('/api/v1/items/index.json', { credentials: 'omit' }).then(function (r) { return r.json(); }).then(function (d) {
      items = Array.isArray(d.items) ? d.items : []; then();
    }).catch(function () { clear(); line('The catalogue could not be loaded; browse it at /catalogue/.', 'none'); });
  }
  form.addEventListener('submit', function (e) { e.preventDefault(); load(function () { show(input.value); }); });
  input.addEventListener('input', function () { load(function () { show(input.value); }); });
})();
