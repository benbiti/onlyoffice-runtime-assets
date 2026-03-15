(function () {
  "use strict";

  var STYLE_ID = "oo-runtime-about-style";

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = [
      "#left-btn-about,",
      "#menu-about {",
      "  display: none !important;",
      "}"
    ].join("\n");

    (document.head || document.documentElement).appendChild(style);
  }

  function applyOverrides() {
    ensureStyle();
  }

  applyOverrides();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyOverrides);
  }

  window.addEventListener("load", applyOverrides);
})();
