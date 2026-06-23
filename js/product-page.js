(function () {
  "use strict";

  var params = new URLSearchParams(window.location.search);
  var slug = params.get("p");
  var products = window.SWEET_EARTH_PRODUCTS || {};
  var product = slug ? products[slug] : null;

  var page = document.querySelector(".product-page");
  if (!product || !page) {
    if (page) {
      page.innerHTML =
        '<div class="product-page__container product-page__empty">' +
        "<h1>Product not found</h1>" +
        '<p>We could not find that item. <a href=\"shop.html\">Browse the shop</a>.</p>" +
        "</div>";
    }
    return;
  }

  document.title = product.name + " | Sweet Earth Delights";

  var metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) {
    metaDesc.setAttribute("content", product.shortDesc);
  }

  var categoryLink = document.getElementById("product-category-link");
  var categoryCurrent = document.getElementById("product-category-current");
  var image = document.getElementById("product-image");
  var title = document.getElementById("product-title");
  var price = document.getElementById("product-price");
  var size = document.getElementById("product-size");
  var description = document.getElementById("product-description");
  var ingredientsList = document.getElementById("product-ingredients");
  var allergens = document.getElementById("product-allergens");
  var orderBtn = document.getElementById("product-order-btn");

  if (categoryLink) {
    categoryLink.textContent = product.categoryLabel;
    categoryLink.href = "shop.html";
  }

  if (categoryCurrent) {
    categoryCurrent.textContent = product.name;
  }

  var categoryLabel = document.getElementById("product-category-label");
  if (categoryLabel) {
    categoryLabel.textContent = product.categoryLabel;
  }

  if (image) {
    image.src = product.image;
    image.alt = product.imageAlt;
  }

  if (title) title.textContent = product.name;
  if (price) price.textContent = product.price;
  if (size) size.textContent = product.size;
  if (description) description.textContent = product.description;

  if (ingredientsList) {
    ingredientsList.innerHTML = product.ingredients
      .map(function (item) {
        return "<li>" + item + "</li>";
      })
      .join("");
  }

  if (allergens) {
    allergens.textContent = product.allergens;
  }

  if (orderBtn) {
    orderBtn.href =
      "contact.html?item=" +
      encodeURIComponent(product.name) +
      "#order-form";
  }
})();
