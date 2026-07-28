const clamp = (num, min, max) => Math.min(Math.max(num, min), max);

function setupStickyHeader() {
  const header = document.querySelector("[data-header]");
  if (!header) return;

  let ticking = false;

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(() => {
      const y = window.scrollY || 0;
      header.classList.toggle("is-scrolled", y > 8);
      ticking = false;
    });
  };

  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
}

function setupScrollPerf() {
  let scrollEndTimer = null;

  const markScrolling = () => {
    document.body.classList.add("is-scrolling");
    if (scrollEndTimer) window.clearTimeout(scrollEndTimer);
    scrollEndTimer = window.setTimeout(() => {
      document.body.classList.remove("is-scrolling");
    }, 120);
  };

  window.addEventListener("scroll", markScrolling, { passive: true });
}

function setupHeroVisibility() {
  const heroes = Array.from(
    document.querySelectorAll(".hero, .px-vhero"),
  ).filter((el) => el instanceof HTMLElement);
  if (!heroes.length || !("IntersectionObserver" in window)) return;

  for (const hero of heroes) {
    const io = new IntersectionObserver(
      ([entry]) => {
        hero.classList.toggle("is-offscreen", !entry.isIntersecting);
      },
      { threshold: 0, rootMargin: "0px" },
    );
    io.observe(hero);
  }
}

function setupMobileNav() {
  const toggle = document.querySelector("[data-nav-toggle]");
  const links = document.querySelector("[data-nav-links]");
  if (!toggle || !links) return;

  let overlay = document.querySelector("[data-nav-overlay]");
  if (!(overlay instanceof HTMLElement)) {
    overlay = document.createElement("div");
    overlay.className = "nav__overlay";
    overlay.setAttribute("data-nav-overlay", "");
    overlay.setAttribute("aria-hidden", "true");
    document.body.appendChild(overlay);
  }

  const setOpen = (open) => {
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    links.classList.toggle("is-open", open);
    overlay.classList.toggle("is-open", open);
    overlay.setAttribute("aria-hidden", String(!open));
    document.body.style.overflow = open ? "hidden" : "";
  };

  toggle.addEventListener("click", () => {
    const open = toggle.getAttribute("aria-expanded") !== "true";
    setOpen(open);
  });

  overlay.addEventListener("click", () => setOpen(false));

  links.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    if (target.closest("[data-nav-dropdown]")) return;
    if (target.closest("a")) setOpen(false);
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setOpen(false);
  });

  window.addEventListener("resize", () => {
    const vw = clamp(window.innerWidth || 0, 0, 10_000);
    if (vw > 760) setOpen(false);
  });
}

function setupNavDropdowns() {
  const items = Array.from(document.querySelectorAll("[data-nav-item]"));
  if (!items.length) return;

  const desktopMq = window.matchMedia("(min-width: 761px)");
  let closeTimer = null;

  const cancelClose = () => {
    if (closeTimer) {
      window.clearTimeout(closeTimer);
      closeTimer = null;
    }
  };

  const closeAll = () => {
    cancelClose();
    for (const item of items) {
      item.classList.remove("is-open");
      const btn = item.querySelector("[data-nav-dropdown]");
      if (btn instanceof HTMLButtonElement) btn.setAttribute("aria-expanded", "false");
    }
  };

  const openItem = (item) => {
    cancelClose();
    for (const other of items) {
      const isActive = other === item;
      other.classList.toggle("is-open", isActive);
      const btn = other.querySelector("[data-nav-dropdown]");
      if (btn instanceof HTMLButtonElement) {
        btn.setAttribute("aria-expanded", String(isActive));
      }
    }
  };

  const scheduleClose = () => {
    cancelClose();
    closeTimer = window.setTimeout(() => {
      if (desktopMq.matches) closeAll();
    }, 320);
  };

  for (const item of items) {
    const btn = item.querySelector("[data-nav-dropdown]");
    const menu = item.querySelector("[data-nav-dropdown-menu]");

    item.addEventListener("mouseenter", () => {
      if (!desktopMq.matches) return;
      openItem(item);
    });

    item.addEventListener("mouseleave", () => {
      if (!desktopMq.matches) return;
      scheduleClose();
    });

    if (menu instanceof HTMLElement) {
      menu.addEventListener("mouseenter", () => {
        if (!desktopMq.matches) return;
        openItem(item);
      });
      menu.addEventListener("mouseleave", () => {
        if (!desktopMq.matches) return;
        scheduleClose();
      });
    }

    if (btn instanceof HTMLButtonElement) {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const open = btn.getAttribute("aria-expanded") !== "true";
        if (open) openItem(item);
        else closeAll();
      });
    }
  }

  document.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    const inside = target.closest("[data-nav-item]");
    if (!inside) closeAll();
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAll();
  });

  window.addEventListener("resize", () => {
    const vw = clamp(window.innerWidth || 0, 0, 10_000);
    if (vw > 760) closeAll();
  });
}

setupStickyHeader();
setupScrollPerf();
setupHeroVisibility();
setupNavDropdowns();
setupMobileNav();
setupInPageAnchors();

/** Smooth-scroll in-page hashes (works even when <base href> is set on production). */
function setupInPageAnchors() {
  document.addEventListener("click", (e) => {
    const link = e.target instanceof Element ? e.target.closest('a[href^="#"]') : null;
    if (!(link instanceof HTMLAnchorElement)) return;

    const href = link.getAttribute("href");
    if (!href || href === "#" || href.length < 2) return;

    const id = decodeURIComponent(href.slice(1));
    const target = document.getElementById(id);
    if (!target) return;

    e.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    try {
      history.pushState(null, "", href);
    } catch (_) {}

    if (target instanceof HTMLFormElement) {
      const field = target.querySelector("input, select, textarea, button");
      if (field instanceof HTMLElement) field.focus({ preventScroll: true });
    }
  });
}
