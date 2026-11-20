// The library's places map: reads the places from the map element's data-places attribute (JSON, written by the build)
// and draws them with the shared map (ptmap, vendored and pinned). No network; nothing from the page is run.
(function () {
  var host = document.getElementById('places-map');
  if (!host || !window.PTMap) return;
  var o; try { o = JSON.parse(host.getAttribute('data-places') || ''); } catch (e) { return; }
  window.PTMap.render(host, o);
})();
