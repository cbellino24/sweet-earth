/**
 * Client-side Español/English toggle via Google Translate.
 * English HTML in the document remains the source of truth for SEO —
 * no alternate Spanish URLs, no hreflang, script loads only after opt-in
 * (or when a prior googtrans cookie is present).
 */
(function () {
  const HOST_ID = "google_translate_element";

  function readGoogTrans() {
    const match = document.cookie.match(/(?:^|; )googtrans=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : "";
  }

  function isSpanish() {
    return /\/es(?:$|\/)/.test(readGoogTrans());
  }

  function cookieDomains() {
    const host = location.hostname;
    const out = new Set(["", host]);
    const parts = host.split(".").filter(Boolean);
    if (parts.length >= 2) {
      out.add(`.${parts.slice(-2).join(".")}`);
    }
    if (host.startsWith("www.") && parts.length >= 3) {
      out.add(`.${parts.slice(1).join(".")}`);
    }
    return [...out];
  }

  function writeCookie(value) {
    for (const domain of cookieDomains()) {
      const domainPart = domain ? `;domain=${domain}` : "";
      document.cookie = `googtrans=${value};path=/${domainPart}`;
    }
  }

  function clearTransCookies() {
    const expired = "expires=Thu, 01 Jan 1970 00:00:00 GMT";
    for (const domain of cookieDomains()) {
      const domainPart = domain ? `;domain=${domain}` : "";
      document.cookie = `googtrans=;path=/${domainPart};${expired}`;
      document.cookie = `googtrans=/en/en;path=/${domainPart};${expired}`;
    }
  }

  function ensureHost() {
    if (document.getElementById(HOST_ID)) return;
    const el = document.createElement("div");
    el.id = HOST_ID;
    el.className = "nav__translate-host";
    el.setAttribute("aria-hidden", "true");
    document.body.appendChild(el);
  }

  function syncLabels() {
    const es = isSpanish();
    document.documentElement.classList.toggle("is-translated-es", es);
    for (const btn of document.querySelectorAll("[data-lang-toggle]")) {
      btn.textContent = es ? "English" : "Español";
      btn.setAttribute("aria-pressed", String(es));
      btn.setAttribute(
        "aria-label",
        es ? "View this page in English" : "Ver esta página en español",
      );
    }
    // Manual CTAs — Google Translate mangles "GET STARTED"
    for (const el of document.querySelectorAll("[data-lang-cta]")) {
      const en = el.getAttribute("data-label-en");
      const esLabel = el.getAttribute("data-label-es");
      if (!en || !esLabel) continue;
      el.textContent = es ? esLabel : en;
    }
  }

  function triggerCombo(lang) {
    const combo = document.querySelector(".goog-te-combo");
    if (!(combo instanceof HTMLSelectElement)) return false;
    combo.value = lang;
    combo.dispatchEvent(new Event("change"));
    return true;
  }

  function loadTranslateScript() {
    return new Promise((resolve, reject) => {
      if (window.google?.translate?.TranslateElement) {
        resolve();
        return;
      }

      window.googleTranslateElementInit = function googleTranslateElementInit() {
        try {
          new window.google.translate.TranslateElement(
            {
              pageLanguage: "en",
              includedLanguages: "en,es",
              autoDisplay: false,
            },
            HOST_ID,
          );
          resolve();
        } catch (err) {
          reject(err);
        }
      };

      if (document.querySelector("script[data-452-translate]")) {
        // Script already requested; init callback will resolve via polling
        const wait = window.setInterval(() => {
          if (window.google?.translate?.TranslateElement) {
            window.clearInterval(wait);
            resolve();
          }
        }, 50);
        window.setTimeout(() => {
          window.clearInterval(wait);
          reject(new Error("Translate script timed out"));
        }, 8000);
        return;
      }

      const script = document.createElement("script");
      script.src =
        "https://translate.googleapis.com/translate_a/element.js?cb=googleTranslateElementInit";
      script.async = true;
      script.setAttribute("data-452-translate", "1");
      script.onerror = () => reject(new Error("Translate script failed to load"));
      document.body.appendChild(script);
    });
  }

  function toSpanish() {
    ensureHost();
    writeCookie("/en/es");
    // Reload so Google Translate applies from the cookie without altering source HTML/URLs
    location.reload();
  }

  function toEnglish() {
    clearTransCookies();
    location.reload();
  }

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const btn = target.closest("[data-lang-toggle]");
    if (!btn) return;
    event.preventDefault();
    if (isSpanish()) toEnglish();
    else toSpanish();
  });

  if (isSpanish()) {
    ensureHost();
    loadTranslateScript().finally(syncLabels);
  } else {
    syncLabels();
  }
})();
