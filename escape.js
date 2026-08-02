/**
 * escape.js — one-click-to-App-Store helper for Rhino Lab
 * -------------------------------------------------------
 * Scope: iOS only, no Android app, no attribution service (per project setup).
 *
 * Honesty note (read before you trust this in production):
 * There is no code-level trick that reliably, silently escapes Instagram's
 * or Facebook's in-app browser 100% of the time. Every "magic scheme" below
 * is undocumented, unofficial, and has been reported to stop working without
 * notice as these apps update. We include them as free, best-effort attempts
 * because they cost nothing to try and do nothing visible if unsupported —
 * but the ONLY escape path proven to work every time in this project's own
 * testing is the manual one: Instagram's "..." menu -> Open in Safari, or
 * press-and-hold the link -> Open Link. This module always falls back to
 * showing that manual path if the automatic attempt doesn't visibly work
 * within ~1.5s. Do not remove the fallback modal; it is not a nice-to-have,
 * it is the part that actually works.
 */
(function (global) {
  "use strict";

  function isIOS() {
    var ua = navigator.userAgent || "";
    return /iPad|iPhone|iPod/.test(ua) && !global.MSStream;
  }

  // Instagram + Threads. Threads has historically identified itself with
  // "Barcelona" in its UA string in addition to app-specific tokens.
  function isInstagramInApp() {
    var ua = navigator.userAgent || "";
    return /Instagram|Barcelona/i.test(ua);
  }

  // Facebook + Messenger.
  function isFacebookInApp() {
    var ua = navigator.userAgent || "";
    return /FBAN|FBAV|FB_IAB|FBIOS|Messenger/i.test(ua);
  }

  // Broader net for other common in-app browsers, used only for messaging
  // (not for picking an escape scheme, since we don't have verified tricks
  // for these).
  function isOtherInApp() {
    var ua = navigator.userAgent || "";
    return /TikTok|musical_ly|Line\/|MicroMessenger|Twitter|Snapchat/i.test(ua);
  }

  function isInAppBrowser() {
    return isInstagramInApp() || isFacebookInApp() || isOtherInApp();
  }

  /**
   * Best-effort escape attempt. MUST be called synchronously from inside
   * the click handler — any await/setTimeout/promise tick before this runs
   * loses iOS's "user activation" flag and the navigation gets silently
   * dropped. Returns nothing meaningful; success/failure is inferred by the
   * caller via visibilitychange/pagehide, not a return value, because there
   * is no reliable way for JS to know if a scheme navigation was honored.
   */
  function attemptEscape(url) {
    if (!isIOS()) return;

    if (isInstagramInApp()) {
      // Unverified / possibly deprecated Instagram scheme reported in some
      // developer write-ups to hand the URL to Safari. Harmless no-op if
      // unsupported by the current IG build — Instagram owns the
      // "instagram://" prefix so an unrecognized sub-path should not throw
      // a system-level error the way an unrelated app's scheme would.
      global.location.href = "instagram://extbrowser/?url=" + encodeURIComponent(url);
    } else if (isFacebookInApp()) {
      // Also unverified / reported unreliable (window.open is commonly
      // blocked inside Facebook's in-app browser). Free to try.
      try {
        global.open("x-safari-" + url, "_blank");
      } catch (e) {
        /* swallow — fallback modal handles it */
      }
    }
    // No known attempt for TikTok/Line/WeChat/etc. — falls straight through
    // to the manual-instructions modal.
  }

  var FALLBACK_TIMEOUT_MS = 1500;
  var modalEl = null;

  function buildModal(url) {
    if (modalEl) return modalEl;

    var style = document.createElement("style");
    style.textContent =
      ".rl-escape-overlay{position:fixed;inset:0;background:rgba(0,0,0,.72);" +
      "display:flex;align-items:flex-end;justify-content:center;z-index:9999;" +
      "font-family:Inter,Arial,sans-serif;}" +
      ".rl-escape-sheet{width:100%;max-width:480px;background:#141414;" +
      "color:#fff;border-radius:20px 20px 0 0;padding:24px 22px calc(24px + env(safe-area-inset-bottom));" +
      "box-shadow:0 -10px 40px rgba(0,0,0,.5);}" +
      ".rl-escape-sheet h3{font-size:1.1rem;margin:0 0 8px;}" +
      ".rl-escape-sheet p{color:#c4c4c4;font-size:.92rem;line-height:1.5;margin:0 0 14px;}" +
      ".rl-escape-sheet ol{color:#c4c4c4;font-size:.92rem;line-height:1.6;margin:0 0 18px 18px;padding:0;}" +
      ".rl-escape-row{display:flex;gap:10px;flex-wrap:wrap;}" +
      ".rl-escape-btn{flex:1;min-width:120px;padding:13px 16px;border-radius:12px;" +
      "font-weight:700;font-size:.95rem;text-align:center;border:none;cursor:pointer;}" +
      ".rl-escape-btn-primary{background:#fff;color:#111;}" +
      ".rl-escape-btn-secondary{background:transparent;color:#fff;border:1px solid rgba(255,255,255,.22);}" +
      ".rl-escape-close{position:absolute;top:14px;right:16px;background:none;border:none;" +
      "color:#8a8a8a;font-size:1.2rem;cursor:pointer;}";
    document.head.appendChild(style);

    var overlay = document.createElement("div");
    overlay.className = "rl-escape-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.style.display = "none";

    overlay.innerHTML =
      '<div class="rl-escape-sheet" style="position:relative;">' +
      '<button class="rl-escape-close" type="button" aria-label="Close">✕</button>' +
      "<h3>Didn't open?</h3>" +
      "<p>This preview browser sometimes blocks the App Store link. Two ways around it:</p>" +
      "<ol>" +
      '<li>Tap <strong>⋯</strong> (or <strong>•••</strong>) in the top corner, then choose <strong>Open in Safari / Open in Browser</strong>.</li>' +
      '<li>Press and hold the download button, then choose <strong>Open Link</strong>.</li>' +
      "</ol>" +
      '<div class="rl-escape-row">' +
      '<button class="rl-escape-btn rl-escape-btn-primary" type="button" data-rl-retry>Try again</button>' +
      '<button class="rl-escape-btn rl-escape-btn-secondary" type="button" data-rl-copy>Copy App Store link</button>' +
      "</div>" +
      "</div>";

    document.body.appendChild(overlay);

    overlay.querySelector("[data-rl-close], .rl-escape-close").addEventListener("click", function () {
      overlay.style.display = "none";
    });
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) overlay.style.display = "none";
    });
    overlay.querySelector("[data-rl-retry]").addEventListener("click", function () {
      // Re-attempt synchronously inside this click handler.
      attemptEscape(url);
      armFallback(url);
    });
    overlay.querySelector("[data-rl-copy]").addEventListener("click", function (e) {
      copyToClipboard(url);
      var btn = e.currentTarget;
      var original = btn.textContent;
      btn.textContent = "Copied!";
      setTimeout(function () {
        btn.textContent = original;
      }, 1500);
    });

    modalEl = overlay;
    return overlay;
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(function () {
        legacyCopy(text);
      });
    } else {
      legacyCopy(text);
    }
  }

  function legacyCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
      document.execCommand("copy");
    } catch (e) {
      /* no-op */
    }
    document.body.removeChild(ta);
  }

  var fallbackTimer = null;
  var leftPage = false;

  function armFallback(url) {
    leftPage = false;
    clearTimeout(fallbackTimer);

    function markLeft() {
      leftPage = true;
    }
    document.addEventListener("visibilitychange", markLeft, { once: true });
    global.addEventListener("pagehide", markLeft, { once: true });
    global.addEventListener("blur", markLeft, { once: true });

    fallbackTimer = setTimeout(function () {
      if (!leftPage) {
        var modal = buildModal(url);
        modal.style.display = "flex";
      }
    }, FALLBACK_TIMEOUT_MS);
  }

  /**
   * Wires up every element matching the selector as a store-link CTA.
   * Normal browsers: left completely alone — the real href is already the
   * most reliable thing a web page can do (see project notes on why
   * JS-intercepted taps perform worse than a native anchor tap).
   * In-app browsers: preventDefault, fire the best-effort escape
   * synchronously, then arm the fallback modal.
   */
  function wireStoreLinks(selector) {
    if (!isInAppBrowser()) return; // do nothing outside in-app browsers

    var links = document.querySelectorAll(selector);
    links.forEach(function (link) {
      var url = link.getAttribute("href");
      link.addEventListener("click", function (e) {
        e.preventDefault();
        attemptEscape(url); // synchronous — do not wrap in setTimeout/await
        armFallback(url);
      });
    });
  }

  global.RhinoLabEscape = {
    isIOS: isIOS,
    isInstagramInApp: isInstagramInApp,
    isFacebookInApp: isFacebookInApp,
    isInAppBrowser: isInAppBrowser,
    attemptEscape: attemptEscape,
    wireStoreLinks: wireStoreLinks,
  };
})(window);
