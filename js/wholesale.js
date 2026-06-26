(function () {
  "use strict";

  var track = document.getElementById("partner-marquee-track");
  if (!track || !window.SWEET_EARTH_LOCATIONS) return;

  var partners = window.SWEET_EARTH_LOCATIONS.retailPartners || [];
  if (!partners.length) return;

  function buildItems() {
    return partners
      .map(function (partner) {
        var inner = partner.logo
          ? '<img class="partner-marquee__logo" src="' +
            partner.logo +
            '" alt="' +
            partner.name +
            '" width="200" height="56" loading="lazy" decoding="async">'
          : '<span class="partner-marquee__name">' +
            partner.name +
            ' <span class="partner-marquee__sep" aria-hidden="true">◆</span></span>';
        if (partner.locationId) {
          return (
            '<a class="partner-marquee__item" href="#retail-locations" data-partner-id="' +
            partner.locationId +
            '">' +
            inner +
            "</a>"
          );
        }
        return '<div class="partner-marquee__item">' + inner + "</div>";
      })
      .join("");
  }

  var items = buildItems();
  track.innerHTML = items + items;

  track.querySelectorAll("[data-partner-id]").forEach(function (link) {
    link.addEventListener("click", function (event) {
      event.preventDefault();
      var partnerId = link.dataset.partnerId;
      var target = document.getElementById("retail-locations");
      if (target) {
        target.scrollIntoView({ behavior: "smooth" });
      }
      window.setTimeout(function () {
        var card = document.querySelector(
          '.location-card[data-location-id="' + partnerId + '"]'
        );
        if (card) {
          card.click();
        }
      }, 450);
    });
  });
})();
