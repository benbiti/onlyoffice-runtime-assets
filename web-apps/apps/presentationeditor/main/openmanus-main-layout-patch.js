(function () {
  'use strict';

  if (window.__omPresentationMainLayoutPatch) {
    return;
  }

  window.__omPresentationMainLayoutPatch = true;

  var STATUSBAR_HEIGHT = 48;
  var scheduled = false;
  var lastAppliedSignature = '';

  function px(value) {
    return Math.max(0, Math.round(value)) + 'px';
  }

  function getDirectMiddle(layout) {
    var children = layout ? layout.children : [];

    for (var index = 0; index < children.length; index += 1) {
      var child = children[index];

      if (child.classList && child.classList.contains('layout-item') && child.classList.contains('middle')) {
        return child;
      }
    }

    return null;
  }

  function setStyleValue(element, property, value) {
    if (element && element.style[property] !== value) {
      element.style[property] = value;
      return true;
    }

    return false;
  }

  function setStyleProperty(element, property, value) {
    if (
      !element ||
      (element.style.getPropertyValue(property) === value && element.style.getPropertyPriority(property) === 'important')
    ) {
      return false;
    }

    element.style.setProperty(property, value, 'important');
    return true;
  }

  function applyHeight(element, height) {
    return setStyleProperty(element, 'height', px(height));
  }

  function applyOverflowClip(element) {
    return setStyleProperty(element, 'overflow', 'hidden');
  }

  function getLayoutHeight(layout) {
    var computedHeight = parseFloat(window.getComputedStyle(layout).height);

    return layout.clientHeight || computedHeight || 0;
  }

  function applyEditorSdkLayout(middleHeight) {
    var changed = false;
    var hbox = document.getElementById('viewport-hbox-layout');
    var editorContainer = document.getElementById('editor-container');
    var editorSdk = document.getElementById('editor_sdk');
    var thumbnails = document.getElementById('id_panel_thumbnails');
    var thumbnailsSplit = document.getElementById('id_panel_thumbnails_split');
    var thumbnailsBackground = document.getElementById('id_thumbnails_background');
    var thumbnailsCanvas = document.getElementById('id_thumbnails');
    var thumbnailsScroll = document.getElementById('id_vertical_scroll_thmbnl');
    var mainParent = document.getElementById('id_main_parent');
    var areaMain = document.getElementById('area_id_main');
    var hboxItems = hbox ? hbox.children : [];

    changed = applyHeight(hbox, middleHeight) || changed;
    changed = applyOverflowClip(hbox) || changed;
    changed = applyHeight(editorContainer, middleHeight) || changed;
    changed = applyOverflowClip(editorContainer) || changed;
    changed = applyHeight(editorSdk, middleHeight) || changed;
    changed = applyOverflowClip(editorSdk) || changed;
    changed = applyHeight(thumbnails, middleHeight) || changed;
    changed = applyHeight(thumbnailsSplit, middleHeight) || changed;
    changed = applyHeight(thumbnailsBackground, middleHeight) || changed;
    changed = applyHeight(thumbnailsCanvas, middleHeight) || changed;
    changed = applyHeight(thumbnailsScroll, middleHeight) || changed;
    changed = applyHeight(mainParent, middleHeight) || changed;
    changed = applyHeight(areaMain, middleHeight) || changed;

    for (var index = 0; index < hboxItems.length; index += 1) {
      if (hboxItems[index].classList && hboxItems[index].classList.contains('layout-item')) {
        changed = applyHeight(hboxItems[index], middleHeight) || changed;
        changed = applyOverflowClip(hboxItems[index]) || changed;
      }
    }

    return changed;
  }

  function applyStatusbarLayout() {
    var layout = document.getElementById('viewport-vbox-layout');
    var statusbar = document.getElementById('statusbar');
    var middle = getDirectMiddle(layout);

    if (!layout || !statusbar || !middle) {
      return;
    }

    var layoutHeight = getLayoutHeight(layout);

    if (!layoutHeight) {
      return;
    }

    var middleTop = parseFloat(middle.style.top) || middle.offsetTop || 0;
    var statusbarTop = Math.max(0, layoutHeight - STATUSBAR_HEIGHT);
    var middleHeight = Math.max(0, statusbarTop - middleTop);
    var changed = false;

    changed = setStyleValue(statusbar, 'top', px(statusbarTop)) || changed;
    changed = setStyleValue(statusbar, 'height', px(STATUSBAR_HEIGHT)) || changed;
    changed = setStyleValue(statusbar, 'zIndex', '30') || changed;
    changed = applyOverflowClip(statusbar) || changed;
    changed = setStyleValue(middle, 'height', px(middleHeight)) || changed;
    changed = applyOverflowClip(middle) || changed;
    changed = applyEditorSdkLayout(middleHeight) || changed;

    var signature = [layoutHeight, middleTop, statusbarTop, middleHeight].join(':');

    if (changed && signature !== lastAppliedSignature) {
      lastAppliedSignature = signature;
      dispatchResize();
    }
  }

  function dispatchResize() {
    var event;

    if (typeof Event === 'function') {
      event = new Event('resize');
    } else {
      event = document.createEvent('Event');
      event.initEvent('resize', true, true);
    }

    window.dispatchEvent(event);
  }

  function scheduleApply() {
    if (scheduled) {
      return;
    }

    scheduled = true;
    (window.requestAnimationFrame || window.setTimeout).call(window, function () {
      scheduled = false;
      applyStatusbarLayout();
    });
  }

  window.addEventListener('resize', scheduleApply);
  window.addEventListener('load', scheduleApply);
  document.addEventListener('DOMContentLoaded', scheduleApply);

  if (window.MutationObserver) {
    new MutationObserver(scheduleApply).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style'],
      childList: true,
      subtree: true
    });
  }

  scheduleApply();
  window.setTimeout(scheduleApply, 250);
  window.setTimeout(scheduleApply, 1000);

  var steadyRuns = 0;
  var steadyInterval = window.setInterval(function () {
    steadyRuns += 1;
    scheduleApply();

    if (steadyRuns >= 40) {
      window.clearInterval(steadyInterval);
    }
  }, 250);
})();
