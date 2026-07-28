/**
 * Bluehost blocks POST to contact.php until humans_XXXXX=1 is set.
 * Load this script WITHOUT defer, before forms.js, on every page that submits forms.
 */
(function () {
  if (location.protocol === "http:") {
    location.replace(
      "https://" + location.host + location.pathname + location.search + location.hash,
    );
    return;
  }

  var key = "452_humans_cookie";
  var name = "humans_21909";
  try {
    var stored = localStorage.getItem(key);
    if (stored && /^humans_\d+$/.test(stored)) name = stored;
  } catch (e) {
    /* ignore */
  }
  var match = document.cookie.match(/(?:^|;\s*)(humans_\d+)=/);
  if (match) name = match[1];
  document.cookie = name + "=1; path=/; max-age=31536000; SameSite=Lax";
  try {
    localStorage.setItem(key, name);
  } catch (e2) {
    /* ignore */
  }
})();
