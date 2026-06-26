(function () {
  "use strict";

  var timeline = document.querySelector(".about-timeline");
  if (!timeline) return;

  var track = timeline.querySelector(".about-timeline__track");
  var fill = timeline.querySelector(".about-timeline__fill");
  if (!track || !fill) return;

  var icons = track.querySelectorAll(".about-timeline__icon");
  var years = track.querySelectorAll(".about-timeline__year");
  var animateEls = track.querySelectorAll("[data-timeline-animate]");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var ticking = false;

  function getTimelineMetrics() {
    var styles = getComputedStyle(timeline);
    return {
      lineInset: parseFloat(styles.getPropertyValue("--timeline-line-inset")) || 20,
      axis: parseFloat(styles.getPropertyValue("--timeline-axis")) || 50,
    };
  }

  function centerOffsetInTrack(element) {
    var trackRect = track.getBoundingClientRect();
    var elRect = element.getBoundingClientRect();
    return elRect.top - trackRect.top + elRect.height / 2;
  }

  function updateFill() {
    var metrics = getTimelineMetrics();
    var trackRect = track.getBoundingClientRect();
    var maxFill = Math.max(0, track.offsetHeight - metrics.lineInset * 2);
    var viewportAnchor = window.innerHeight * (window.innerWidth <= 980 ? 0.62 : 0.55);
    var fillLength = viewportAnchor - (trackRect.top + metrics.lineInset);

    fillLength = Math.max(0, Math.min(maxFill, fillLength));
    fill.style.height = fillLength + "px";

    icons.forEach(function (icon) {
      icon.classList.toggle("is-active", fillLength >= centerOffsetInTrack(icon) - 8);
    });

    years.forEach(function (year) {
      year.classList.toggle("is-active", fillLength >= centerOffsetInTrack(year) - 8);
    });
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () {
      updateFill();
      ticking = false;
    });
  }

  if (!reduceMotion) {
    timeline.classList.add("is-enhanced");

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      {
        root: null,
        rootMargin: window.innerWidth <= 980 ? "0px 0px -80px 0px" : "0px 0px -150px 0px",
        threshold: 0.08,
      }
    );

    animateEls.forEach(function (el) {
      observer.observe(el);
    });

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", function () {
      updateFill();
    });
  } else {
    var metrics = getTimelineMetrics();
    fill.style.height = Math.max(0, track.offsetHeight - metrics.lineInset * 2) + "px";
    icons.forEach(function (icon) {
      icon.classList.add("is-active");
    });
    years.forEach(function (year) {
      year.classList.add("is-active");
    });
    animateEls.forEach(function (el) {
      el.classList.add("is-visible");
    });
  }

  updateFill();
})();
