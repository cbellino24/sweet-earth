function setYear() {
  const el = document.querySelector("[data-year]");
  if (el) el.textContent = String(new Date().getFullYear());
}

function setupThemeToggle() {
  /* LIGHT ONLY — dark mode removed */
  try {
    localStorage.setItem("theme", "light");
  } catch (_) {}
  document.documentElement.dataset.theme = "light";
  document.documentElement.style.colorScheme = "light";
  const btn = document.querySelector("[data-theme-toggle]");
  if (btn instanceof HTMLButtonElement) {
    btn.hidden = true;
    btn.style.display = "none";
  }
}

function setupRotators() {
  const rotators = Array.from(document.querySelectorAll("[data-rotator]"));
  for (const root of rotators) {
    if (!(root instanceof HTMLElement)) continue;

    const tabs = Array.from(root.querySelectorAll("[data-rotator-tab]")).filter(
      (el) => el instanceof HTMLButtonElement,
    );
    const panels = Array.from(root.querySelectorAll("[data-rotator-panel]")).filter((el) => el instanceof HTMLElement);
    if (!tabs.length || !panels.length) continue;

    let enhanced = root.hasAttribute("data-rotator-enhanced");

    const intervalMs = Math.max(2500, Number(root.getAttribute("data-interval")) || 5200);
    let idx = Math.max(0, tabs.findIndex((t) => t.classList.contains("is-active")));
    if (idx === -1) idx = 0;
    let timer = null;
    let idleResumeTimer = null;
    let pausedByHover = false;
    let pausedByVisibility = false;

    if (enhanced && tabs.length !== panels.length) {
      enhanced = false;
    }

    const announceEl =
      enhanced
        ? (() => {
            const el = document.createElement("div");
            el.className = "rotator-announce";
            el.setAttribute("aria-live", "polite");
            el.setAttribute("aria-relevant", "text");
            el.setAttribute("aria-atomic", "true");
            Object.assign(el.style, {
              position: "absolute",
              width: "1px",
              height: "1px",
              padding: "0",
              margin: "-1px",
              overflow: "hidden",
              clip: "rect(0, 0, 0, 0)",
              whiteSpace: "nowrap",
              border: "0",
            });
            root.style.position ||= "relative";
            root.appendChild(el);
            return el;
          })()
        : null;

    const getPanelTitle = (panelIndex) => {
      const title = panels[panelIndex]?.querySelector("h2, h3");
      return title?.textContent?.trim() || "";
    };

    const announce = (panelIndex) => {
      if (!(announceEl instanceof HTMLElement)) return;
      const label = getPanelTitle(panelIndex);
      if (!label) return;
      announceEl.textContent = "";
      window.requestAnimationFrame(() => {
        announceEl.textContent = `Now showing: ${label}`;
      });
    };

    const syncPanels = () => {
      for (let i = 0; i < panels.length; i++) {
        const active = i === idx;
        panels[i].classList.toggle("is-active", active);
        panels[i].toggleAttribute("hidden", !active);
        panels[i].setAttribute("aria-hidden", String(!active));
        if (enhanced) {
          panels[i].tabIndex = active ? 0 : -1;
        }
      }
    };

    const syncTabs = () => {
      for (let i = 0; i < tabs.length; i++) {
        const active = i === idx;
        tabs[i].classList.toggle("is-active", active);
        tabs[i].setAttribute("aria-selected", String(active));
        if (enhanced) tabs[i].tabIndex = active ? 0 : -1;
      }
    };

    const setActive = (next, options = {}) => {
      const { userInitiated = false } = options;
      idx = (next + tabs.length) % tabs.length;
      syncTabs();
      syncPanels();
      if (enhanced && userInitiated) announce(idx);
    };

    const stop = () => {
      if (timer) window.clearInterval(timer);
      timer = null;
    };

    const clearIdleResume = () => {
      if (idleResumeTimer) window.clearTimeout(idleResumeTimer);
      idleResumeTimer = null;
    };

    const shouldRun = () => !(pausedByHover || pausedByVisibility);

    const start = () => {
      stop();
      if (!shouldRun()) return;
      timer = window.setInterval(() => setActive(idx + 1), intervalMs);
    };

    const pauseInteractive = () => {
      pausedByHover = true;
      stop();
      clearIdleResume();
    };

    const resumeIfAllowed = () => {
      pausedByHover = false;
      clearIdleResume();
      if (shouldRun()) start();
    };

    const scheduleIdleResume = () => {
      clearIdleResume();
      idleResumeTimer = window.setTimeout(() => {
        resumeIfAllowed();
      }, 2600);
    };

    if (enhanced) {
      const rid = root.id || `site-rotator-${Math.random().toString(36).slice(2, 9)}`;
      if (!root.id) root.id = rid;

      tabs.forEach((tab, i) => {
        tab.id = `${rid}-tab-${i}`;
        panels[i].id = `${rid}-panel-${i}`;
        tab.setAttribute("role", "tab");
        tab.setAttribute("aria-controls", panels[i].id);
        panels[i].setAttribute("role", "tabpanel");
        panels[i].setAttribute("aria-labelledby", tab.id);
      });

      const focusTab = (i) => {
        tabs[i]?.focus();
      };

      tabs.forEach((tab, i) => {
        tab.addEventListener("click", () => {
          setActive(i, { userInitiated: true });
          stop();
          clearIdleResume();
          idleResumeTimer = window.setTimeout(() => {
            if (shouldRun()) start();
          }, intervalMs);
        });

        tab.addEventListener("keydown", (e) => {
          if (!(e instanceof KeyboardEvent)) return;
          let next = null;
          if (e.key === "ArrowRight" || e.key === "ArrowDown") next = idx + 1;
          else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = idx - 1;
          else if (e.key === "Home") next = 0;
          else if (e.key === "End") next = tabs.length - 1;
          else return;

          e.preventDefault();
          setActive(next, { userInitiated: true });
          focusTab(idx);
          stop();
          clearIdleResume();
          idleResumeTimer = window.setTimeout(() => {
            if (shouldRun()) start();
          }, intervalMs);
        });
      });

      document.addEventListener("visibilitychange", () => {
        pausedByVisibility = document.visibilityState !== "visible";
        if (pausedByVisibility) stop();
        else if (shouldRun()) start();
      });

      root.addEventListener("mouseenter", pauseInteractive);
      root.addEventListener("mouseleave", resumeIfAllowed);

      root.addEventListener(
        "focusin",
        (e) => {
          const t = e.target;
          if (t instanceof Node && root.contains(t)) pauseInteractive();
        },
        true,
      );

      root.addEventListener("focusout", () => {
        window.setTimeout(() => {
          const ae = document.activeElement;
          if (ae instanceof Node && root.contains(ae)) return;
          scheduleIdleResume();
        }, 0);
      });

      setActive(idx, { userInitiated: false });
      start();
      continue;
    }

    const setActiveLegacy = (next) => {
      idx = (next + tabs.length) % tabs.length;
      for (let i = 0; i < tabs.length; i++) {
        const isActive = i === idx;
        tabs[i].classList.toggle("is-active", isActive);
        tabs[i].setAttribute("aria-selected", String(isActive));
      }
      for (let i = 0; i < panels.length; i++) {
        const isActive = i === idx;
        panels[i].classList.toggle("is-active", isActive);
      }
    };

    const stopLegacy = () => {
      if (timer) window.clearInterval(timer);
      timer = null;
    };

    const startLegacy = () => {
      stopLegacy();
      timer = window.setInterval(() => setActiveLegacy(idx + 1), intervalMs);
    };

    for (let i = 0; i < tabs.length; i++) {
      tabs[i].addEventListener("click", () => {
        setActiveLegacy(i);
        startLegacy();
      });
    }

    root.addEventListener("mouseenter", stopLegacy);
    root.addEventListener("mouseleave", startLegacy);
    root.addEventListener("focusin", stopLegacy);
    root.addEventListener("focusout", startLegacy);

    setActiveLegacy(idx);
    startLegacy();
  }
}

function setupWorkCategoryFilter() {
  const root = document.querySelector("[data-work-filter]");
  if (!(root instanceof HTMLElement)) return;

  const tabs = Array.from(root.querySelectorAll("[data-work-tab]")).filter((el) => el instanceof HTMLButtonElement);
  const tiles = Array.from(document.querySelectorAll("[data-work-item]")).filter((el) => el instanceof HTMLElement);
  if (!tabs.length || !tiles.length) return;

  const grid = document.querySelector("[data-px-portfolio-grid]");
  const pager = document.querySelector("[data-work-pager]");
  const pageNums = pager instanceof HTMLElement ? pager.querySelector("[data-work-page-nums]") : null;
  const prevBtn = pager instanceof HTMLElement ? pager.querySelector("[data-work-page-prev]") : null;
  const nextBtn = pager instanceof HTMLElement ? pager.querySelector("[data-work-page-next]") : null;
  const pageSize = Math.max(
    1,
    Number(grid instanceof HTMLElement ? grid.getAttribute("data-page-size") : 9) || 9,
  );
  const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const leaveMs = 280;
  const enterMs = 520;

  let category = tabs.find((t) => t.classList.contains("is-active"))?.dataset.workTab || "all";
  let page = 1;
  let busy = false;

  const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

  const matching = () =>
    tiles.filter((el) => {
      const cat = el.getAttribute("data-work-category") || "";
      return category === "all" || cat.split(/\s+/).includes(category);
    });

  const syncChrome = (totalPages, focusTab = false) => {
    for (const tab of tabs) {
      const active = tab.dataset.workTab === category;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-pressed", String(active));
      tab.tabIndex = active ? 0 : -1;
      if (active && focusTab) tab.focus();
    }

    if (pager instanceof HTMLElement) {
      pager.hidden = totalPages <= 1;
    }

    if (pageNums instanceof HTMLElement) {
      pageNums.replaceChildren();
      for (let i = 1; i <= totalPages; i += 1) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "px-portfolio__pager-num" + (i === page ? " is-active" : "");
        btn.textContent = String(i);
        btn.setAttribute("aria-label", `Page ${i}`);
        btn.setAttribute("aria-current", i === page ? "page" : "false");
        btn.dataset.workPage = String(i);
        pageNums.appendChild(btn);
      }
    }

    if (prevBtn instanceof HTMLButtonElement) {
      prevBtn.disabled = page <= 1 || busy;
    }
    if (nextBtn instanceof HTMLButtonElement) {
      nextBtn.disabled = page >= totalPages || busy;
    }
  };

  const applyVisibility = () => {
    const matches = matching();
    const totalPages = Math.max(1, Math.ceil(matches.length / pageSize));
    if (page > totalPages) page = totalPages;
    if (page < 1) page = 1;

    const start = (page - 1) * pageSize;
    const visible = matches.slice(start, start + pageSize);
    const visibleSet = new Set(visible);

    for (const el of tiles) {
      const show = visibleSet.has(el);
      el.classList.remove("is-page-enter", "is-page-enter-active");
      el.style.removeProperty("--page-delay");
      el.classList.toggle("is-filtered-out", !show);
      el.toggleAttribute("hidden", !show);
    }

    return { matches, totalPages, visible };
  };

  const softScrollToGrid = () => {
    if (!(grid instanceof HTMLElement)) return;
    const top = grid.getBoundingClientRect().top + window.scrollY - 96;
    window.scrollTo({ top: Math.max(0, top), behavior: prefersReduced ? "auto" : "smooth" });
  };

  const render = async (options = {}) => {
    const { focusTab = false, animate = false, scroll = false } = options;
    if (busy) return;

    const runSwap = async () => {
      if (animate && !prefersReduced && grid instanceof HTMLElement) {
        busy = true;
        syncChrome(Math.max(1, Math.ceil(matching().length / pageSize)), focusTab);

        grid.classList.add("is-page-leaving");
        await wait(leaveMs);

        const { totalPages, visible } = applyVisibility();
        syncChrome(totalPages, focusTab);

        grid.classList.remove("is-page-leaving");
        grid.classList.add("is-page-entering");

        visible.forEach((el, i) => {
          el.style.setProperty("--page-delay", `${i * 70}ms`);
          el.classList.add("is-page-enter");
        });

        void grid.offsetWidth;

        requestAnimationFrame(() => {
          visible.forEach((el) => el.classList.add("is-page-enter-active"));
          grid.classList.remove("is-page-entering");
        });

        if (scroll) softScrollToGrid();

        await wait(enterMs + Math.max(0, visible.length - 1) * 70);

        visible.forEach((el) => {
          el.classList.remove("is-page-enter", "is-page-enter-active");
          el.style.removeProperty("--page-delay");
        });

        busy = false;
        syncChrome(totalPages, false);
        return;
      }

      const { totalPages } = applyVisibility();
      syncChrome(totalPages, focusTab);
      if (scroll && !prefersReduced) softScrollToGrid();
    };

    await runSwap();
  };

  root.addEventListener("click", (e) => {
    const t = e.target;
    const btn = t instanceof Element ? t.closest("[data-work-tab]") : null;
    if (!(btn instanceof HTMLButtonElement)) return;
    const nextCategory = btn.dataset.workTab || "all";
    if (nextCategory === category && page === 1) return;
    category = nextCategory;
    page = 1;
    render({ animate: true });
  });

  root.addEventListener("keydown", (e) => {
    if (!(e instanceof KeyboardEvent)) return;
    const activeIdx = Math.max(0, tabs.findIndex((t) => t.classList.contains("is-active")));
    let next = null;
    if (e.key === "ArrowRight") next = activeIdx + 1;
    else if (e.key === "ArrowLeft") next = activeIdx - 1;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    else return;

    e.preventDefault();
    const wrapped = (next + tabs.length) % tabs.length;
    category = tabs[wrapped]?.dataset.workTab || "all";
    page = 1;
    render({ focusTab: true, animate: true });
  });

  if (pager instanceof HTMLElement) {
    pager.addEventListener("click", (e) => {
      const t = e.target;
      if (!(t instanceof Element) || busy) return;

      if (t.closest("[data-work-page-prev]")) {
        if (page <= 1) return;
        page -= 1;
        render({ animate: true, scroll: true });
        return;
      }
      if (t.closest("[data-work-page-next]")) {
        page += 1;
        render({ animate: true, scroll: true });
        return;
      }
      const numBtn = t.closest("[data-work-page]");
      if (!(numBtn instanceof HTMLElement)) return;
      const nextPage = Number(numBtn.dataset.workPage);
      if (!Number.isFinite(nextPage) || nextPage === page) return;
      page = nextPage;
      render({ animate: true, scroll: true });
    });
  }

  render();
}

function setupTestimonialFilters() {
  const page = document.querySelector(".page-testimonials");
  if (!(page instanceof HTMLElement)) return;

  const tabs = Array.from(page.querySelectorAll("[data-t-filter]")).filter(
    (el) => el instanceof HTMLButtonElement,
  );
  const items = Array.from(page.querySelectorAll("[data-testimonial-item]")).filter(
    (el) => el instanceof HTMLElement,
  );
  const countEl = page.querySelector("[data-t-count]");
  if (!tabs.length || !items.length) return;

  const updateCount = (visible) => {
    if (!(countEl instanceof HTMLElement)) return;
    const n = visible;
    countEl.textContent =
      n === 1 ? "Showing 1 testimonial" : `Showing ${n} testimonials`;
  };

  const applyFilter = (filter) => {
    let visible = 0;
    for (const item of items) {
      const cat = item.getAttribute("data-testimonial-cat") || "";
      const show = filter === "all" || cat === filter;
      item.classList.toggle("is-filtered-out", !show);
      if (show) {
        item.removeAttribute("hidden");
        visible += 1;
      } else {
        item.setAttribute("hidden", "");
      }
    }
    updateCount(visible);
  };

  for (const tab of tabs) {
    tab.addEventListener("click", () => {
      const filter = tab.getAttribute("data-t-filter") || "all";
      for (const t of tabs) {
        t.classList.toggle("is-active", t === tab);
      }
      applyFilter(filter);
    });
  }

  applyFilter("all");
}

function setupTestimonialModal() {
  const modal = document.querySelector("[data-px-testimonial-modal]");
  if (!(modal instanceof HTMLElement)) return;

  const dialog = modal.querySelector("[data-px-testimonial-dialog]");
  const img = modal.querySelector("[data-px-testimonial-image]");
  const titleEl = modal.querySelector("[data-px-testimonial-title]");
  const citeEl = modal.querySelector("[data-px-testimonial-cite]");
  const quoteEl = modal.querySelector("[data-px-testimonial-quote]");
  const visitEl = modal.querySelector("[data-px-testimonial-visit]");
  const triggers = Array.from(document.querySelectorAll("[data-px-testimonial]")).filter(
    (el) => el instanceof HTMLElement,
  );
  if (
    !(dialog instanceof HTMLElement) ||
    !(img instanceof HTMLImageElement) ||
    !(titleEl instanceof HTMLElement) ||
    !(citeEl instanceof HTMLElement) ||
    !(quoteEl instanceof HTMLElement) ||
    !(visitEl instanceof HTMLAnchorElement) ||
    !triggers.length
  ) {
    return;
  }

  let lastFocus = null;

  const close = () => {
    modal.classList.remove("is-open");
    modal.setAttribute("hidden", "");
    document.body.classList.remove("px-t-modal-open");
    if (lastFocus instanceof HTMLElement) lastFocus.focus();
    lastFocus = null;
  };

  const open = (trigger) => {
    const nameEl = trigger.querySelector(".px-t-card__name");
    const quoteSrc = trigger.querySelector(".px-t-card__quote");
    const citeSrc = trigger.querySelector(".px-t-card__cite");
    const media = trigger.querySelector(".px-t-card__media img");
    const url = trigger.getAttribute("data-testimonial-url") || "#";
    const title =
      nameEl instanceof HTMLElement ? nameEl.textContent.trim() : "";
    const quote =
      quoteSrc instanceof HTMLElement ? quoteSrc.textContent.trim() : "";
    const cite =
      citeSrc instanceof HTMLElement ? citeSrc.textContent.trim() : "";
    const src =
      media instanceof HTMLImageElement
        ? media.currentSrc || media.src
        : "";
    const alt = media instanceof HTMLImageElement ? media.alt || title : title;

    lastFocus = trigger;
    titleEl.textContent = title;
    citeEl.textContent = cite;
    quoteEl.textContent = quote;
    img.src = src;
    img.alt = alt;
    visitEl.href = url;
    visitEl.hidden = !url || url === "#";

    modal.removeAttribute("hidden");
    document.body.classList.add("px-t-modal-open");
    requestAnimationFrame(() => {
      modal.classList.add("is-open");
      dialog.focus();
    });
  };

  for (const trigger of triggers) {
    trigger.addEventListener("click", () => open(trigger));
  }

  modal.addEventListener("click", (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    if (t.closest("[data-px-testimonial-close]")) close();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (modal.hasAttribute("hidden")) return;
    close();
  });
}

function setupPxPortfolioModal() {
  const modal = document.querySelector("[data-px-project-modal]");
  if (!(modal instanceof HTMLElement)) return;

  const dialog = modal.querySelector("[data-px-project-dialog]");
  const img = modal.querySelector("[data-px-project-image]");
  const titleEl = modal.querySelector("[data-px-project-title]");
  const tagsEl = modal.querySelector("[data-px-project-tags]");
  const scopeEl = modal.querySelector("[data-px-project-scope]");
  const visitEl = modal.querySelector("[data-px-project-visit]");
  const triggers = Array.from(document.querySelectorAll("[data-px-project]")).filter(
    (el) => el instanceof HTMLElement,
  );
  if (
    !(dialog instanceof HTMLElement) ||
    !(img instanceof HTMLImageElement) ||
    !(titleEl instanceof HTMLElement) ||
    !(tagsEl instanceof HTMLElement) ||
    !(scopeEl instanceof HTMLElement) ||
    !(visitEl instanceof HTMLAnchorElement) ||
    !triggers.length
  ) {
    return;
  }

  let lastFocus = null;

  const close = () => {
    modal.classList.remove("is-open");
    modal.setAttribute("hidden", "");
    document.body.classList.remove("px-project-modal-open");
    if (lastFocus instanceof HTMLElement) lastFocus.focus();
    lastFocus = null;
  };

  const open = (trigger) => {
    const source =
      (trigger.closest(".px-portfolio__card") instanceof HTMLElement
        ? trigger.closest(".px-portfolio__card")
        : null) || trigger;
    const title = source.getAttribute("data-project-title") || "";
    const tags = source.getAttribute("data-project-tags") || "";
    const url = source.getAttribute("data-project-url") || "#";
    const scopeRaw = source.getAttribute("data-project-scope") || "";
    const media =
      source.querySelector(".px-portfolio__card-media img") ||
      source.querySelector(".px-portfolio__thumb-media img") ||
      trigger.querySelector(".px-portfolio__card-media img") ||
      trigger.querySelector(".px-portfolio__thumb-media img");
    const imageAttr = source.getAttribute("data-project-image") || "";
    const src =
      imageAttr ||
      (media instanceof HTMLImageElement ? media.currentSrc || media.src : "");
    const alt = title ? `${title} website` : "";

    lastFocus = trigger;
    titleEl.textContent = title;
    tagsEl.textContent = tags;
    img.src = src;
    img.alt = alt;
    visitEl.href = url;
    visitEl.hidden = !url || url === "#";

    scopeEl.replaceChildren();
    scopeRaw
      .split("|")
      .map((item) => item.trim())
      .filter(Boolean)
      .forEach((item) => {
        const li = document.createElement("li");
        li.textContent = item;
        scopeEl.appendChild(li);
      });

    modal.removeAttribute("hidden");
    document.body.classList.add("px-project-modal-open");
    requestAnimationFrame(() => {
      modal.classList.add("is-open");
      dialog.focus();
    });
  };

  for (const trigger of triggers) {
    trigger.addEventListener("click", () => open(trigger));
  }

  modal.addEventListener("click", (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    if (t.closest("[data-px-project-close]")) close();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (modal.hasAttribute("hidden")) return;
    close();
  });
}

function setupCountups() {
  const els = Array.from(document.querySelectorAll("[data-countup]")).filter((el) => el instanceof HTMLElement);
  if (!els.length) return;

  const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  const animate = (el) => {
    if (!(el instanceof HTMLElement)) return;
    if (el.dataset.countupDone === "true") return;
    el.dataset.countupDone = "true";

    const from = Number(el.dataset.from ?? el.getAttribute("data-from") ?? "0");
    const to = Number(el.dataset.to ?? el.getAttribute("data-to") ?? el.textContent ?? "0");
    const suffix = el.dataset.suffix ?? el.getAttribute("data-suffix") ?? "";

    if (!Number.isFinite(from) || !Number.isFinite(to) || prefersReduced) {
      el.textContent = `${to}${suffix}`;
      return;
    }

    const durationMs = Math.max(400, Number(el.dataset.duration) || 900);
    const start = performance.now();

    const tick = (now) => {
      const t = Math.min(1, (now - start) / durationMs);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      const value = Math.round(from + (to - from) * eased);
      el.textContent = `${value}${suffix}`;
      if (t < 1) requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  };

  if (!("IntersectionObserver" in window)) {
    els.forEach(animate);
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        animate(entry.target);
        io.unobserve(entry.target);
      }
    },
    { threshold: 0.35 },
  );

  els.forEach((el) => io.observe(el));
}

function setupReviewCardReveal() {
  const grids = Array.from(document.querySelectorAll(".g-review-grid--portrait")).filter(
    (el) => el instanceof HTMLElement,
  );
  if (!grids.length) return;

  const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  const reveal = (grid) => {
    grid.classList.add("is-revealed");
  };

  if (prefersReduced) {
    grids.forEach(reveal);
    return;
  }

  for (const grid of grids) {
    grid.setAttribute("data-review-animate", "");
  }

  if (!("IntersectionObserver" in window)) {
    grids.forEach(reveal);
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        if (entry.target instanceof HTMLElement) reveal(entry.target);
        io.unobserve(entry.target);
      }
    },
    { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
  );

  grids.forEach((grid) => io.observe(grid));
}

function setupReviewCarousel() {
  const carousels = Array.from(document.querySelectorAll("[data-review-carousel]")).filter(
    (el) => el instanceof HTMLElement,
  );
  if (!carousels.length) return;

  const scrollEpsilon = 4;

  const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const scrollBehavior = prefersReduced ? "auto" : "smooth";

  for (const carousel of carousels) {
    const track = carousel.querySelector(".g-review-grid");
    const prevBtn = carousel.querySelector(".g-review-carousel__btn--prev");
    const nextBtn = carousel.querySelector(".g-review-carousel__btn--next");
    if (!(track instanceof HTMLElement)) continue;
    if (!(prevBtn instanceof HTMLButtonElement)) continue;
    if (!(nextBtn instanceof HTMLButtonElement)) continue;

    const getStep = () => {
      const card = track.querySelector(".g-review-card");
      if (!(card instanceof HTMLElement)) return track.clientWidth;
      const styles = getComputedStyle(track);
      const gap = Number.parseFloat(styles.columnGap || styles.gap || "0") || 0;
      return card.offsetWidth + gap;
    };

    const updateButtons = () => {
      const maxScroll = track.scrollWidth - track.clientWidth;
      prevBtn.disabled = track.scrollLeft <= scrollEpsilon;
      nextBtn.disabled = track.scrollLeft >= maxScroll - scrollEpsilon;
    };

    const scrollByStep = (direction) => {
      track.scrollBy({ left: direction * getStep(), behavior: scrollBehavior });
    };

    prevBtn.addEventListener("click", () => scrollByStep(-1));
    nextBtn.addEventListener("click", () => scrollByStep(1));
    track.addEventListener("scroll", updateButtons, { passive: true });
    window.addEventListener("resize", updateButtons, { passive: true });
    updateButtons();
  }
}

function setupBrandingIntroStatReveal() {
  const grids = Array.from(document.querySelectorAll(".hero__ads-stat-grid--branding")).filter(
    (el) => el instanceof HTMLElement,
  );
  if (!grids.length) return;

  const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  const reveal = (grid) => {
    grid.classList.add("is-revealed");
  };

  if (prefersReduced) {
    grids.forEach(reveal);
    return;
  }

  for (const grid of grids) {
    grid.setAttribute("data-branding-stats-animate", "");
  }

  if (!("IntersectionObserver" in window)) {
    grids.forEach(reveal);
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        if (entry.target instanceof HTMLElement) reveal(entry.target);
        io.unobserve(entry.target);
      }
    },
    { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
  );

  grids.forEach((grid) => io.observe(grid));
}

function setupProcessChainReveal() {
  const lists = Array.from(document.querySelectorAll(".process-hchain__list--cards")).filter(
    (el) => el instanceof HTMLElement,
  );
  if (!lists.length) return;

  const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  const reveal = (list) => {
    list.classList.add("is-revealed");
  };

  if (prefersReduced) {
    lists.forEach(reveal);
    return;
  }

  for (const list of lists) {
    list.setAttribute("data-process-animate", "");
  }

  if (!("IntersectionObserver" in window)) {
    lists.forEach(reveal);
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        if (entry.target instanceof HTMLElement) reveal(entry.target);
        io.unobserve(entry.target);
      }
    },
    { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
  );

  lists.forEach((list) => io.observe(list));
}

function setupCopyUrlButtons() {
  const buttons = Array.from(document.querySelectorAll("[data-copy-url]")).filter(
    (el) => el instanceof HTMLButtonElement,
  );
  if (!buttons.length) return;

  for (const btn of buttons) {
    btn.addEventListener("click", async () => {
      const url = window.location.href;
      const label = btn.getAttribute("aria-label") || "Copy link";
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(url);
        } else {
          const input = document.createElement("input");
          input.value = url;
          document.body.appendChild(input);
          input.select();
          document.execCommand("copy");
          input.remove();
        }
        btn.textContent = "Copied";
        btn.setAttribute("aria-label", "Link copied");
        window.setTimeout(() => {
          btn.textContent = "Link";
          btn.setAttribute("aria-label", label);
        }, 2000);
      } catch (_) {
        btn.textContent = "Error";
        window.setTimeout(() => {
          btn.textContent = "Link";
        }, 2000);
      }
    });
  }
}

/** Homepage / local heroes: fade video in after frames are ready (no poster flash). */
function setupPxVheroVideo() {
  const videos = Array.from(document.querySelectorAll(".px-vhero__video")).filter(
    (el) => el instanceof HTMLVideoElement,
  );
  if (!videos.length) return;

  const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  if (prefersReduced) return;

  for (const video of videos) {
    const markReady = () => {
      video.classList.remove("is-pending");
      video.classList.add("is-ready");
    };

    video.classList.add("is-pending");
    // Drop HTML poster — browser poster doesn't respect object-fit and flashes when video starts
    video.removeAttribute("poster");

    video.addEventListener("playing", markReady, { once: true });
    video.addEventListener("loadeddata", () => {
      if (video.readyState >= 2) markReady();
    });

    if (video.readyState >= 2) markReady();

    // Safety net if play events are delayed
    window.setTimeout(markReady, 2800);

    const tryPlay = () => {
      video.play().catch(() => {});
    };

    const root = video.closest(".px-vhero") || video;

    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            tryPlay();
          } else {
            video.pause();
          }
        },
        { threshold: 0.05, rootMargin: "40px 0px" },
      );
      io.observe(root);
    } else {
      tryPlay();
      video.addEventListener("canplay", tryPlay, { once: true });
    }
  }
}

/** Drone hero: loop a ~30s slice of the Cattlemen’s Ball reel (full file is much longer). */
function setupDroneHeroVideo() {
  const video =
    document.querySelector("#drone-hero .hero__video--drone") ||
    document.querySelector("#drone-hero .px-t-hero__video");
  if (!(video instanceof HTMLVideoElement)) return;

  const desktopMq = window.matchMedia?.("(min-width: 981px)");
  const reducedMq = window.matchMedia?.("(prefers-reduced-motion: reduce)");

  const CLIP_START = 12;
  const CLIP_DURATION = 30;

  const clipBounds = () => {
    const duration = video.duration;
    if (!duration || Number.isNaN(duration)) {
      return { start: CLIP_START, end: CLIP_START + CLIP_DURATION };
    }
    const end = Math.min(CLIP_START + CLIP_DURATION, duration - 0.25);
    const start = Math.min(CLIP_START, Math.max(0, end - CLIP_DURATION));
    return { start, end };
  };

  const shouldPlayVideo = () =>
    Boolean(desktopMq?.matches) && !reducedMq?.matches;

  const pauseVideo = () => {
    video.pause();
  };

  const playVideo = () => {
    if (!shouldPlayVideo()) {
      pauseVideo();
      return;
    }
    const { start } = clipBounds();
    if (video.readyState >= 1 && video.currentTime < start) {
      video.currentTime = start;
    }
    video.play().catch(() => {});
  };

  video.addEventListener("loadedmetadata", () => {
    const { start } = clipBounds();
    video.currentTime = start;
    playVideo();
  });

  video.addEventListener("timeupdate", () => {
    const { start, end } = clipBounds();
    if (video.currentTime >= end) {
      video.currentTime = start;
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pauseVideo();
    else playVideo();
  });

  desktopMq?.addEventListener?.("change", playVideo);
  reducedMq?.addEventListener?.("change", playVideo);

  if (video.readyState >= 1) {
    video.currentTime = clipBounds().start;
  }
  playVideo();
}

function setupRsHeroTitleType() {
  const title =
    document.querySelector("#px-vhero-title") || document.querySelector("#rs-hero-title");
  if (!(title instanceof HTMLElement)) return;

  const full = title.textContent?.replace(/\s+/g, " ").trim() || "";
  if (!full) return;

  const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  if (prefersReduced) return;

  // Spanish toggle uses Google Translate on the static h1. The typewriter
  // clears that node into an aria-hidden span, which Translate skips.
  const googtrans = document.cookie.match(/(?:^|; )googtrans=([^;]*)/);
  const isSpanish =
    Boolean(googtrans) &&
    /\/es(?:$|\/)/.test(decodeURIComponent(googtrans[1]));
  if (isSpanish) return;

  title.setAttribute("aria-label", full);
  title.textContent = "";

  const textEl = document.createElement("span");
  textEl.className = "rs-hero__title-text";
  textEl.setAttribute("aria-hidden", "true");

  const caret = document.createElement("span");
  caret.className = "rs-hero__caret";
  caret.setAttribute("aria-hidden", "true");

  title.append(textEl, caret);

  let i = 0;
  const speedMs = 72;
  const startDelayMs = 320;
  const flashHalfMs = 380;

  const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

  const finish = async () => {
    caret.classList.add("is-paused");
    caret.style.opacity = "1";

    for (let n = 0; n < 3; n++) {
      caret.style.opacity = "1";
      await wait(flashHalfMs);
      caret.style.opacity = "0";
      await wait(flashHalfMs);
    }

    caret.className = "rs-hero__end";
    caret.style.opacity = "";
    caret.textContent = ".";
  };

  const tick = () => {
    i += 1;
    textEl.textContent = full.slice(0, i);
    if (i < full.length) {
      window.setTimeout(tick, speedMs);
    } else {
      finish();
    }
  };

  window.setTimeout(tick, startDelayMs);
}

function setupPxHero() {
  const root = document.querySelector("[data-px-hero]");
  if (!(root instanceof HTMLElement)) return;

  const slides = Array.from(root.querySelectorAll("[data-px-slide]")).filter(
    (el) => el instanceof HTMLElement,
  );
  const dotsWrap = root.querySelector("[data-px-dots]");
  if (slides.length < 2 || !(dotsWrap instanceof HTMLElement)) return;

  let idx = Math.max(0, slides.findIndex((s) => s.classList.contains("is-active")));
  if (idx < 0) idx = 0;
  let timer = null;
  const intervalMs = 5500;

  const syncDark = () => {
    root.classList.toggle("is-dark-slide", slides[idx]?.hasAttribute("data-dark-dots") || false);
  };

  const go = (next) => {
    idx = ((next % slides.length) + slides.length) % slides.length;
    slides.forEach((s, i) => s.classList.toggle("is-active", i === idx));
    Array.from(dotsWrap.children).forEach((d, i) => {
      d.classList.toggle("is-active", i === idx);
      d.setAttribute("aria-selected", String(i === idx));
    });
    syncDark();
  };

  dotsWrap.innerHTML = "";
  slides.forEach((_, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "px-hero__dot" + (i === idx ? " is-active" : "");
    btn.setAttribute("aria-label", `Show slide ${i + 1}`);
    btn.setAttribute("aria-selected", String(i === idx));
    btn.addEventListener("click", () => {
      go(i);
      restart();
    });
    dotsWrap.appendChild(btn);
  });

  const stop = () => {
    if (timer) clearInterval(timer);
    timer = null;
  };

  const start = () => {
    stop();
    timer = setInterval(() => go(idx + 1), intervalMs);
  };

  const restart = () => start();

  root.addEventListener("mouseenter", stop);
  root.addEventListener("mouseleave", start);
  root.addEventListener("focusin", stop);
  root.addEventListener("focusout", start);

  syncDark();
  start();
}

function setupPxFeatureVideo() {
  const roots = Array.from(document.querySelectorAll("[data-px-feature-video]")).filter(
    (el) => el instanceof HTMLElement,
  );

  for (const root of roots) {
    const video = root.querySelector("[data-px-feature-video-el]");
    const playBtn = root.querySelector("[data-px-feature-play]");
    const muteBtn = root.querySelector("[data-px-feature-mute]");
    if (!(video instanceof HTMLVideoElement)) continue;
    if (!(playBtn instanceof HTMLButtonElement) || !(muteBtn instanceof HTMLButtonElement)) continue;

    const playIcon = playBtn.querySelector(".px-feature__ctrl-icon");
    const muteIcon = muteBtn.querySelector(".px-feature__ctrl-icon");
    let allowAutoplay = true;

    const syncPlay = () => {
      const paused = video.paused;
      playBtn.setAttribute("aria-label", paused ? "Play video" : "Pause video");
      if (playIcon) {
        playIcon.classList.toggle("px-feature__ctrl-icon--play", paused);
        playIcon.classList.toggle("px-feature__ctrl-icon--pause", !paused);
      }
    };

    const syncMute = () => {
      const muted = video.muted || video.volume === 0;
      muteBtn.setAttribute("aria-label", muted ? "Unmute video" : "Mute video");
      if (muteIcon) {
        muteIcon.classList.toggle("px-feature__ctrl-icon--muted", muted);
        muteIcon.classList.toggle("px-feature__ctrl-icon--unmuted", !muted);
      }
    };

    playBtn.addEventListener("click", () => {
      if (video.paused) {
        allowAutoplay = true;
        video.play().catch(() => {});
      } else {
        allowAutoplay = false;
        video.pause();
      }
      syncPlay();
    });

    muteBtn.addEventListener("click", () => {
      video.muted = !video.muted;
      if (!video.muted && video.volume === 0) video.volume = 1;
      syncMute();
    });

    video.addEventListener("play", syncPlay);
    video.addEventListener("pause", syncPlay);
    video.addEventListener("volumechange", syncMute);

    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            if (allowAutoplay) video.play().catch(() => {});
          } else {
            video.pause();
          }
          syncPlay();
        },
        { threshold: 0.2, rootMargin: "80px 0px" },
      );
      io.observe(root);
    }

    syncPlay();
    syncMute();
  }
}

function setupPxProcessReveal() {
  const lists = Array.from(document.querySelectorAll("[data-px-process]")).filter(
    (el) => el instanceof HTMLElement,
  );
  if (!lists.length) return;

  const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  const reveal = (list) => {
    list.classList.add("is-revealed");
  };

  if (prefersReduced) {
    lists.forEach(reveal);
    return;
  }

  for (const list of lists) {
    list.setAttribute("data-px-process-animate", "");
  }

  if (!("IntersectionObserver" in window)) {
    lists.forEach(reveal);
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        if (entry.target instanceof HTMLElement) reveal(entry.target);
        io.unobserve(entry.target);
      }
    },
    { threshold: 0.2, rootMargin: "0px 0px -8% 0px" },
  );

  lists.forEach((list) => io.observe(list));
}

function setupPxFeatureReveal() {
  const sections = Array.from(document.querySelectorAll("[data-px-feature]")).filter(
    (el) => el instanceof HTMLElement,
  );
  if (!sections.length) return;

  const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  const reveal = (section) => {
    section.classList.add("is-revealed");
  };

  if (prefersReduced) {
    sections.forEach(reveal);
    return;
  }

  for (const section of sections) {
    section.setAttribute("data-px-feature-animate", "");
  }

  if (!("IntersectionObserver" in window)) {
    sections.forEach(reveal);
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        if (entry.target instanceof HTMLElement) reveal(entry.target);
        io.unobserve(entry.target);
      }
    },
    { threshold: 0.18, rootMargin: "0px 0px -8% 0px" },
  );

  sections.forEach((section) => io.observe(section));
}

function setupPxWorkGridReveal() {
  const lists = Array.from(document.querySelectorAll("[data-px-work-grid]")).filter(
    (el) => el instanceof HTMLElement,
  );
  if (!lists.length) return;

  const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  const reveal = (list) => {
    list.classList.add("is-revealed");
  };

  if (prefersReduced) {
    lists.forEach(reveal);
    return;
  }

  for (const list of lists) {
    list.setAttribute("data-px-work-grid-animate", "");
  }

  if (!("IntersectionObserver" in window)) {
    lists.forEach(reveal);
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        if (entry.target instanceof HTMLElement) reveal(entry.target);
        io.unobserve(entry.target);
      }
    },
    { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
  );

  lists.forEach((list) => io.observe(list));
}

function setupPxHelpSlider() {
  const root = document.querySelector("[data-px-help]");
  if (!(root instanceof HTMLElement)) return;

  const images = Array.from(root.querySelectorAll("[data-px-help-image]")).filter(
    (el) => el instanceof HTMLElement,
  );
  const panels = Array.from(root.querySelectorAll("[data-px-help-panel]")).filter(
    (el) => el instanceof HTMLElement,
  );
  const prevBtn = root.querySelector("[data-px-help-prev]");
  const nextBtn = root.querySelector("[data-px-help-next]");
  const bar = root.querySelector("[data-px-help-bar]");
  const count = root.querySelector("[data-px-help-count]");
  const total = Math.min(images.length, panels.length);

  if (total < 2 || !(prevBtn instanceof HTMLElement) || !(nextBtn instanceof HTMLElement)) return;

  let idx = Math.max(0, panels.findIndex((p) => p.classList.contains("is-active")));
  if (idx < 0) idx = 0;

  const go = (next) => {
    idx = ((next % total) + total) % total;

    images.forEach((img, i) => {
      img.classList.toggle("is-active", i === idx);
    });

    panels.forEach((panel, i) => {
      const active = i === idx;
      panel.classList.toggle("is-active", active);
      if (active) panel.removeAttribute("hidden");
      else panel.setAttribute("hidden", "");
    });

    if (bar instanceof HTMLElement) {
      bar.style.width = `${((idx + 1) / total) * 100}%`;
    }
    if (count instanceof HTMLElement) {
      count.textContent = `${idx + 1} / ${total}`;
    }
  };

  prevBtn.addEventListener("click", () => go(idx - 1));
  nextBtn.addEventListener("click", () => go(idx + 1));

  root.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(idx - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      go(idx + 1);
    }
  });

  go(idx);
}

function setupPxFeaturedSlider() {
  const root = document.querySelector("[data-px-featured-slider]");
  if (!(root instanceof HTMLElement)) return;

  const images = Array.from(root.querySelectorAll("[data-px-featured-image]")).filter(
    (el) => el instanceof HTMLElement,
  );
  const prevBtn = root.querySelector("[data-px-featured-prev]");
  const nextBtn = root.querySelector("[data-px-featured-next]");
  const bar = root.querySelector("[data-px-featured-bar]");
  const count = root.querySelector("[data-px-featured-count]");
  const total = images.length;

  if (total < 2 || !(prevBtn instanceof HTMLElement) || !(nextBtn instanceof HTMLElement)) return;

  let idx = Math.max(0, images.findIndex((img) => img.classList.contains("is-active")));
  if (idx < 0) idx = 0;

  const go = (next) => {
    idx = ((next % total) + total) % total;

    images.forEach((img, i) => {
      img.classList.toggle("is-active", i === idx);
    });

    if (bar instanceof HTMLElement) {
      bar.style.width = `${((idx + 1) / total) * 100}%`;
    }
    if (count instanceof HTMLElement) {
      count.textContent = `${idx + 1} / ${total}`;
    }
  };

  prevBtn.addEventListener("click", () => go(idx - 1));
  nextBtn.addEventListener("click", () => go(idx + 1));

  root.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(idx - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      go(idx + 1);
    }
  });

  if (!root.hasAttribute("tabindex")) root.setAttribute("tabindex", "0");

  go(idx);
}

function setupPxPortfolioReveal() {
  const intro = document.querySelector("[data-px-portfolio-intro]");
  const section = document.querySelector("[data-px-portfolio]");
  const best = document.querySelector("[data-px-best]");
  if (
    !(intro instanceof HTMLElement) &&
    !(section instanceof HTMLElement) &&
    !(best instanceof HTMLElement)
  ) {
    return;
  }

  const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  const reveal = (el) => {
    el.classList.add("is-revealed");
  };

  const targets = [];
  if (intro instanceof HTMLElement) targets.push(intro);
  if (best instanceof HTMLElement) {
    targets.push(best);
    const bestThumbs = best.querySelector("[data-px-portfolio-thumbs]");
    if (bestThumbs instanceof HTMLElement) targets.push(bestThumbs);
  }
  if (section instanceof HTMLElement) {
    targets.push(section);
    const thumbs = section.querySelector("[data-px-portfolio-thumbs]");
    const items = Array.from(section.querySelectorAll("[data-px-portfolio-item]"));
    const grid = section.querySelector("[data-px-portfolio-grid]");
    if (thumbs instanceof HTMLElement) targets.push(thumbs);
    items.forEach((item) => {
      if (item instanceof HTMLElement) targets.push(item);
    });
    if (grid instanceof HTMLElement) targets.push(grid);
  }

  if (prefersReduced) {
    targets.forEach(reveal);
    return;
  }

  for (const el of targets) {
    el.setAttribute("data-px-portfolio-animate", "");
  }

  if (!("IntersectionObserver" in window)) {
    targets.forEach(reveal);
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        if (entry.target instanceof HTMLElement) reveal(entry.target);
        io.unobserve(entry.target);
      }
    },
    { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
  );

  targets.forEach((el) => io.observe(el));
}

setYear();
setupThemeToggle();
setupRsHeroTitleType();
setupPxHero();
setupPxHelpSlider();
setupPxFeaturedSlider();
setupPxFeatureVideo();
setupPxFeatureReveal();
setupPxWorkGridReveal();
setupPxPortfolioReveal();
setupPxProcessReveal();
setupRotators();
setupWorkCategoryFilter();
setupPxPortfolioModal();
setupTestimonialFilters();
setupTestimonialModal();
setupCountups();
setupReviewCardReveal();
setupReviewCarousel();
setupProcessChainReveal();
setupBrandingIntroStatReveal();
setupCopyUrlButtons();
setupDroneHeroVideo();
setupPxVheroVideo();

