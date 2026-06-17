(function () {
  "use strict";

  const slides = document.querySelectorAll(".hero-slide");
  const menuToggle = document.querySelector(".mobile-menu-toggle");
  const navList = document.querySelector(".nav-list");

  let currentSlide = 0;
  const slideInterval = 4500;

  function nextSlide() {
    if (!slides.length) return;
    slides[currentSlide].classList.remove("active");
    currentSlide = (currentSlide + 1) % slides.length;
    slides[currentSlide].classList.add("active");
  }

  if (slides.length > 1) {
    setInterval(nextSlide, slideInterval);
  }

  if (menuToggle && navList) {
    menuToggle.addEventListener("click", function () {
      const isOpen = navList.classList.toggle("is-open");
      menuToggle.setAttribute("aria-expanded", String(isOpen));
    });

    navList.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        navList.classList.remove("is-open");
        menuToggle.setAttribute("aria-expanded", "false");
      });
    });
  }
})();
