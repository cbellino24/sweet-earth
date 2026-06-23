(function () {
  "use strict";

  const slides = document.querySelectorAll(".hero-slide");
  const menuToggle = document.querySelector(".mobile-menu-toggle");
  const navList = document.querySelector(".nav-list");

  let currentSlide = 0;
  const slideInterval = 4500;

  function loadSlideImage(slide) {
    const img = slide.querySelector("img[data-src]");
    if (!img) return;
    img.src = img.dataset.src;
    img.removeAttribute("data-src");
  }

  function preloadAdjacentSlides(index) {
    if (!slides.length) return;
    loadSlideImage(slides[index]);
    loadSlideImage(slides[(index + 1) % slides.length]);
  }

  function nextSlide() {
    if (!slides.length) return;
    slides[currentSlide].classList.remove("active");
    currentSlide = (currentSlide + 1) % slides.length;
    slides[currentSlide].classList.add("active");
    preloadAdjacentSlides(currentSlide);
  }

  if (slides.length) {
    preloadAdjacentSlides(0);

    if (slides.length > 1) {
      if ("requestIdleCallback" in window) {
        requestIdleCallback(function () {
          slides.forEach(function (slide, index) {
            if (index > 1) loadSlideImage(slide);
          });
        });
      }

      setInterval(nextSlide, slideInterval);
    }
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

  const shopFilterBtns = document.querySelectorAll("[data-shop-filter]");
  const shopProducts = document.querySelectorAll(".shop-product");
  const shopCount = document.getElementById("shop-count");

  if (shopFilterBtns.length && shopProducts.length) {
    function updateShopFilter(filter) {
      let visible = 0;

      shopProducts.forEach(function (product) {
        const show = filter === "all" || product.dataset.category === filter;
        product.classList.toggle("is-hidden", !show);
        if (show) visible += 1;
      });

      if (shopCount) {
        shopCount.textContent = visible + (visible === 1 ? " product" : " products");
      }
    }

    shopFilterBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        shopFilterBtns.forEach(function (b) {
          b.classList.remove("is-active");
        });
        btn.classList.add("is-active");
        updateShopFilter(btn.dataset.shopFilter);
      });
    });
  }

  const orderMessage = document.getElementById("contact-message");
  if (orderMessage) {
    const item = new URLSearchParams(window.location.search).get("item");
    if (item && !orderMessage.value.trim()) {
      orderMessage.value =
        "I'd like to order: " +
        item +
        "\n\nQuantity: \nPreferred pickup date: ";
    }
  }
})();
