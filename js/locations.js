(function () {
  "use strict";

  var mapEl = document.getElementById("location-map");
  if (!mapEl || typeof L === "undefined") return;

  var CATEGORY_LABELS = {
    all: "All locations",
    market: "Farmers markets",
    popup: "Pop-ups & events",
    retail: "Local retail",
    pickup: "Kitchen pickup",
  };

  var finderRoot = document.getElementById("location-finder");
  var pageFilter = finderRoot ? finderRoot.dataset.locationFilter : "";
  var LOCATIONS =
    (window.SWEET_EARTH_LOCATIONS && window.SWEET_EARTH_LOCATIONS.locations) || [];

  var searchInput = document.getElementById("location-search");
  var radiusSelect = document.getElementById("location-radius");
  var categorySelect = document.getElementById("location-category");
  var resultsList = document.getElementById("location-results");
  var resultsCount = document.getElementById("location-results-count");
  var resultsStatus = document.getElementById("location-results-status");
  var searchForm = document.getElementById("location-search-form");
  var featuredGrid = document.getElementById("location-featured");

  var map = L.map(mapEl, {
    scrollWheelZoom: false,
    zoomControl: true,
  }).setView([41.24, -95.95], 10);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 18,
  }).addTo(map);

  map.on("focus", function () {
    map.scrollWheelZoom.enable();
  });
  map.on("blur", function () {
    map.scrollWheelZoom.disable();
  });

  var markerLayer = L.layerGroup().addTo(map);
  var markersById = {};
  var activeId = null;
  var searchOrigin = null;
  var geocodeTimer = null;

  function categoryLabel(category) {
    return CATEGORY_LABELS[category] || category;
  }

  function directionsUrl(location) {
    return (
      "https://www.google.com/maps/dir/?api=1&destination=" +
      encodeURIComponent(location.lat + "," + location.lng)
    );
  }

  function haversineMiles(lat1, lng1, lat2, lng2) {
    var toRad = function (deg) {
      return (deg * Math.PI) / 180;
    };
    var earthRadius = 3958.8;
    var dLat = toRad(lat2 - lat1);
    var dLng = toRad(lng2 - lng1);
    var a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function matchesCategory(location, category) {
    return category === "all" || location.category === category;
  }

  function filterLocations() {
    var category = pageFilter || (categorySelect ? categorySelect.value : "all");
    var radius = radiusSelect ? parseFloat(radiusSelect.value) : 25;
    var filtered = LOCATIONS.filter(function (location) {
      return matchesCategory(location, category);
    });

    if (searchOrigin) {
      filtered = filtered
        .map(function (location) {
          return {
            location: location,
            distance: haversineMiles(
              searchOrigin.lat,
              searchOrigin.lng,
              location.lat,
              location.lng
            ),
          };
        })
        .filter(function (entry) {
          return entry.distance <= radius;
        })
        .sort(function (a, b) {
          return a.distance - b.distance;
        });
    } else {
      filtered = filtered
        .map(function (location) {
          return { location: location, distance: null };
        })
        .sort(function (a, b) {
          return a.location.name.localeCompare(b.location.name);
        });
    }

    return filtered;
  }

  function createMarkerIcon(isActive) {
    return L.divIcon({
      className: "location-marker" + (isActive ? " location-marker--active" : ""),
      html: '<span class="location-marker__pin" aria-hidden="true"></span>',
      iconSize: [28, 36],
      iconAnchor: [14, 36],
      popupAnchor: [0, -32],
    });
  }

  function buildPopup(location, distance) {
    var distanceHtml = distance !== null
      ? '<p class="location-popup__distance">' + distance.toFixed(1) + " mi away</p>"
      : "";
    return (
      '<div class="location-popup">' +
      '<p class="location-popup__category">' + categoryLabel(location.category) + "</p>" +
      "<strong>" + location.name + "</strong>" +
      "<p>" + location.address + "</p>" +
      "<p>" + location.hours + "</p>" +
      distanceHtml +
      '<a class="location-popup__link" href="' + directionsUrl(location) + '" target="_blank" rel="noopener noreferrer">Get directions</a>' +
      "</div>"
    );
  }

  function setActiveLocation(id) {
    activeId = id;
    Object.keys(markersById).forEach(function (markerId) {
      var marker = markersById[markerId];
      marker.setIcon(createMarkerIcon(markerId === id));
    });

    if (!resultsList) return;
    resultsList.querySelectorAll(".location-card").forEach(function (card) {
      var isActive = card.dataset.locationId === id;
      card.classList.toggle("is-active", isActive);
      if (isActive) {
        card.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    });
  }

  function updateMap(entries) {
    markerLayer.clearLayers();
    markersById = {};

    if (!entries.length) {
      if (searchOrigin) {
        map.setView([searchOrigin.lat, searchOrigin.lng], 10);
      }
      return;
    }

    var bounds = [];

    entries.forEach(function (entry) {
      var location = entry.location;
      var marker = L.marker([location.lat, location.lng], {
        icon: createMarkerIcon(location.id === activeId),
        title: location.name,
      });

      marker.bindPopup(buildPopup(location, entry.distance));
      marker.on("click", function () {
        setActiveLocation(location.id);
      });

      marker.addTo(markerLayer);
      markersById[location.id] = marker;
      bounds.push([location.lat, location.lng]);
    });

    if (searchOrigin) {
      bounds.push([searchOrigin.lat, searchOrigin.lng]);
    }

    if (bounds.length === 1) {
      map.setView(bounds[0], 13);
    } else {
      map.fitBounds(bounds, { padding: [48, 48], maxZoom: 13 });
    }
  }

  function renderResults(entries) {
    if (!resultsList) return;

    if (!entries.length) {
      resultsList.innerHTML =
        '<div class="location-empty">' +
        "<p><strong>No locations found</strong></p>" +
        "<p>Try a different city or zip code, expand your search radius, or change the category filter.</p>" +
        "</div>";
      if (resultsCount) resultsCount.textContent = "0 results";
      return;
    }

    resultsList.innerHTML = entries
      .map(function (entry) {
        var location = entry.location;
        var distanceBadge =
          entry.distance !== null
            ? '<span class="location-card__distance">' + entry.distance.toFixed(1) + " mi</span>"
            : "";
        return (
          '<article class="location-card' +
          (location.id === activeId ? " is-active" : "") +
          '" data-location-id="' +
          location.id +
          '" tabindex="0" role="button" aria-label="Show ' +
          location.name +
          ' on map">' +
          '<div class="location-card__head">' +
          '<p class="location-card__category">' +
          categoryLabel(location.category) +
          "</p>" +
          distanceBadge +
          "</div>" +
          "<h3 class=\"location-card__title\">" +
          location.name +
          "</h3>" +
          '<p class="location-card__address">' +
          location.address +
          "</p>" +
          '<p class="location-card__hours">' +
          location.hours +
          "</p>" +
          '<p class="location-card__schedule">' +
          location.schedule +
          "</p>" +
          '<div class="location-card__actions">' +
          '<a class="location-card__directions" href="' +
          directionsUrl(location) +
          '" target="_blank" rel="noopener noreferrer">Get directions</a>' +
          (location.category === "pickup"
            ? '<a class="location-card__order" href="contact.html#order-form">Order pickup</a>'
            : location.category === "market" || location.category === "popup"
              ? '<a class="location-card__order" href="schedule.html">View schedule</a>'
              : "") +
          "</div>" +
          "</article>"
        );
      })
      .join("");

    if (resultsCount) {
      resultsCount.textContent =
        entries.length + (entries.length === 1 ? " result" : " results");
    }

    resultsList.querySelectorAll(".location-card").forEach(function (card) {
      function activateCard() {
        var id = card.dataset.locationId;
        setActiveLocation(id);
        var marker = markersById[id];
        if (marker) {
          marker.openPopup();
          map.panTo(marker.getLatLng(), { animate: true });
        }
      }

      card.addEventListener("click", function (event) {
        if (event.target.closest("a")) return;
        activateCard();
      });

      card.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activateCard();
        }
      });
    });
  }

  function renderFeatured() {
    if (!featuredGrid) return;

    var featured = LOCATIONS.filter(function (location) {
      return location.featured;
    });

    featuredGrid.innerHTML = featured
      .map(function (location) {
        return (
          '<article class="location-feature-card">' +
          '<p class="location-feature-card__category">' +
          categoryLabel(location.category) +
          "</p>" +
          "<h3>" +
          location.name +
          "</h3>" +
          "<p>" +
          location.address +
          "</p>" +
          "<p><strong>" +
          location.hours +
          "</strong></p>" +
          '<a href="#location-finder" class="location-feature-card__link" data-feature-id="' +
          location.id +
          '">View on map</a>' +
          "</article>"
        );
      })
      .join("");

    featuredGrid.querySelectorAll("[data-feature-id]").forEach(function (link) {
      link.addEventListener("click", function (event) {
        event.preventDefault();
        var id = link.dataset.featureId;
        setActiveLocation(id);
        var marker = markersById[id];
        if (marker) {
          marker.openPopup();
          map.panTo(marker.getLatLng(), { animate: true });
        }
        document.getElementById("location-finder").scrollIntoView({
          behavior: "smooth",
        });
      });
    });
  }

  function setStatus(message, isError) {
    if (!resultsStatus) return;
    resultsStatus.textContent = message || "";
    resultsStatus.classList.toggle("is-error", Boolean(isError));
  }

  function geocodeQuery(query) {
    var trimmed = query.trim();
    if (!trimmed) {
      searchOrigin = null;
      setStatus("");
      refresh();
      return Promise.resolve();
    }

    setStatus("Searching near " + trimmed + "…");

    var isZip = /^\d{5}(-\d{4})?$/.test(trimmed);
    var url = isZip
      ? "https://nominatim.openstreetmap.org/search?postalcode=" +
        encodeURIComponent(trimmed.slice(0, 5)) +
        "&country=US&format=json&limit=1"
      : "https://nominatim.openstreetmap.org/search?q=" +
        encodeURIComponent(trimmed + ", Nebraska, USA") +
        "&format=json&limit=1";

    return fetch(url, {
      headers: { Accept: "application/json" },
    })
      .then(function (response) {
        if (!response.ok) throw new Error("Geocoding failed");
        return response.json();
      })
      .then(function (results) {
        if (!results.length) {
          searchOrigin = null;
          setStatus("We couldn't find that location. Try a nearby city or zip code.", true);
          refresh();
          return;
        }

        searchOrigin = {
          lat: parseFloat(results[0].lat),
          lng: parseFloat(results[0].lon),
          label: results[0].display_name,
        };
        setStatus("Showing locations near your search.");
        refresh();
      })
      .catch(function () {
        searchOrigin = null;
        setStatus("Location search is temporarily unavailable. Browse all locations below.", true);
        refresh();
      });
  }

  function refresh() {
    var entries = filterLocations();
    if (!activeId || !entries.some(function (entry) { return entry.location.id === activeId; })) {
      activeId = entries.length ? entries[0].location.id : null;
    }
    updateMap(entries);
    renderResults(entries);
  }

  if (searchForm) {
    searchForm.addEventListener("submit", function (event) {
      event.preventDefault();
      geocodeQuery(searchInput ? searchInput.value : "");
    });
  }

  if (searchInput) {
    searchInput.addEventListener("input", function () {
      clearTimeout(geocodeTimer);
      if (!searchInput.value.trim()) {
        searchOrigin = null;
        setStatus("");
        refresh();
        return;
      }
      geocodeTimer = setTimeout(function () {
        geocodeQuery(searchInput.value);
      }, 650);
    });
  }

  [radiusSelect, categorySelect].forEach(function (control) {
    if (!control) return;
    control.addEventListener("change", refresh);
  });

  var hashCategory = window.location.hash.replace("#", "");
  if (!pageFilter && hashCategory && CATEGORY_LABELS[hashCategory] && categorySelect) {
    categorySelect.value = hashCategory;
  }

  if (featuredGrid) {
    renderFeatured();
  }
  refresh();

  window.addEventListener("resize", function () {
    map.invalidateSize();
  });
})();
