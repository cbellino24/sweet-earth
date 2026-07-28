const FORM_REASON_TEXT = {
  missing_fields: "Some required fields were left blank.",
  invalid_email: "The email address does not look valid.",
  invalid_website: "The website URL must start with https:// or be left blank.",
  invalid_method: "This form was submitted the wrong way.",
  mail_failed: "Our server could not send the email. Please call (402) 804-3315.",
  storage_error: "We could not save your signup on the server.",
  storage_busy: "The signup file was busy. Please try again.",
  network_error: "Your browser could not reach our server. Check your connection and try again.",
  server_error: "The server returned an unexpected response (not JSON).",
  mod_security:
    "The server blocked this POST. Upload js/form-gate.js and js/forms.js (with ?v=20260525), then hard-refresh. If it still fails, ask Bluehost about ModSecurity on contact.php.",
  host_challenge:
    "Bluehost needs a browser cookie before form POSTs work. Hard-refresh the page (or clear cache) so form-gate.js loads, then try again.",
  honeypot: "Submission blocked.",
};

const HUMANS_COOKIE_STORAGE_KEY = "452_humans_cookie";

/** Bluehost bot gate: POST returns 409 until cookie humans_XXXXX=1 is set (normally via JS on full page load). */
function readHumansCookieName() {
  try {
    const stored = localStorage.getItem(HUMANS_COOKIE_STORAGE_KEY);
    if (stored && /^humans_\d+$/.test(stored)) return stored;
  } catch {
    // ignore
  }
  const fromDoc = document.cookie.match(/(?:^|;\s*)(humans_\d+)=/);
  if (fromDoc) return fromDoc[1];
  return "humans_21909";
}

function setHumansCookie(name) {
  if (!/^humans_\d+$/.test(name)) return;
  document.cookie = `${name}=1; path=/; max-age=31536000; SameSite=Lax`;
  try {
    localStorage.setItem(HUMANS_COOKIE_STORAGE_KEY, name);
  } catch {
    // ignore
  }
}

function parseHumansCookieFromChallenge(text) {
  if (typeof text !== "string") return null;
  const m = text.match(/document\.cookie\s*=\s*["'](humans_\d+)=1["']/);
  return m ? m[1] : null;
}

function ensureHumansCookie() {
  setHumansCookie(readHumansCookieName());
}

function reasonDetail(reason) {
  if (!reason || typeof reason !== "string") return "";
  return FORM_REASON_TEXT[reason] || reason.replace(/_/g, " ");
}

function ensureFormModal() {
  let root = document.getElementById("form-feedback-modal");
  if (root instanceof HTMLElement) return root;

  root = document.createElement("div");
  root.id = "form-feedback-modal";
  root.className = "form-feedback-modal";
  root.hidden = true;
  root.innerHTML = `
    <div class="form-feedback-modal__backdrop" data-close-modal></div>
    <div
      class="form-feedback-modal__dialog"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="form-feedback-title"
      aria-describedby="form-feedback-message"
    >
      <button type="button" class="form-feedback-modal__close" data-close-modal aria-label="Close">×</button>
      <p class="form-feedback-modal__kicker" id="form-feedback-kicker"></p>
      <h2 class="form-feedback-modal__title" id="form-feedback-title"></h2>
      <p class="form-feedback-modal__message" id="form-feedback-message"></p>
      <p class="form-feedback-modal__reason" id="form-feedback-reason" hidden></p>
      <button type="button" class="btn btn--primary form-feedback-modal__ok" data-close-modal>OK</button>
    </div>
  `;
  document.body.appendChild(root);

  const close = () => hideFormModal(root);
  root.querySelectorAll("[data-close-modal]").forEach((el) => {
    el.addEventListener("click", close);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !root.hidden) close();
  });

  return root;
}

function hideFormModal(root) {
  root.hidden = true;
  document.body.classList.remove("form-feedback-modal-open");
}

/**
 * @param {{ kind: 'success' | 'error', title: string, message: string, reason?: string }} opts
 */
function showFormPopup(opts) {
  const root = ensureFormModal();
  const dialog = root.querySelector(".form-feedback-modal__dialog");
  const kicker = root.querySelector("#form-feedback-kicker");
  const title = root.querySelector("#form-feedback-title");
  const message = root.querySelector("#form-feedback-message");
  const reasonEl = root.querySelector("#form-feedback-reason");

  if (
    !(dialog instanceof HTMLElement) ||
    !(kicker instanceof HTMLElement) ||
    !(title instanceof HTMLElement) ||
    !(message instanceof HTMLElement) ||
    !(reasonEl instanceof HTMLElement)
  ) {
    return;
  }

  const isSuccess = opts.kind === "success";
  dialog.classList.toggle("is-success", isSuccess);
  dialog.classList.toggle("is-error", !isSuccess);
  kicker.textContent = isSuccess ? "Success" : "Could not send";
  title.textContent = opts.title;
  message.textContent = opts.message;

  const detail = reasonDetail(opts.reason);
  if (!isSuccess && detail) {
    reasonEl.hidden = false;
    reasonEl.textContent = detail;
  } else {
    reasonEl.hidden = true;
    reasonEl.textContent = "";
  }

  root.hidden = false;
  document.body.classList.add("form-feedback-modal-open");
  const okBtn = root.querySelector(".form-feedback-modal__ok");
  if (okBtn instanceof HTMLButtonElement) {
    try {
      okBtn.focus();
    } catch {
      // ignore
    }
  }
}

function updateInlineStatus(form, kind, message) {
  const wrap =
    form.closest(".contact-form-wrap, .newsletter-strip__panel, .container, section") || form.parentElement;
  const statusEl = wrap?.querySelector(".form-status");
  if (!(statusEl instanceof HTMLElement)) return;
  statusEl.hidden = false;
  statusEl.classList.toggle("is-success", kind === "success");
  statusEl.classList.toggle("is-error", kind === "error");
  statusEl.textContent = message;
}

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

function honeypotFilled(form) {
  const hp = form.querySelector('input[name="bot_check"], input[name="company"]');
  return hp instanceof HTMLInputElement && hp.value.trim() !== "";
}

/** URL-encoded body avoids multipart false positives on Bluehost ModSecurity. */
function bodyFromForm(form) {
  const params = new URLSearchParams();
  const fd = new FormData(form);
  for (const [key, value] of fd.entries()) {
    if (typeof value === "string") {
      params.append(key, value);
    }
  }
  return params.toString();
}

function validateRequiredFields(form) {
  const fields = Array.from(form.querySelectorAll("[required]")).filter(
    (el) =>
      el instanceof HTMLInputElement ||
      el instanceof HTMLTextAreaElement ||
      el instanceof HTMLSelectElement,
  );
  for (const el of fields) {
    if (!el.value.trim()) {
      return {
        ok: false,
        message: "Please fill out the required fields.",
        reason: "missing_fields",
      };
    }
  }
  return { ok: true };
}

async function postForm(form, action) {
  // Do not send Accept: application/json — Bluehost ModSecurity often returns 406 HTML.
  ensureHumansCookie();

  const fetchOnce = async () => {
    const res = await fetch(action, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: bodyFromForm(form),
      credentials: "same-origin",
      cache: "no-store",
    });
    const contentType = (res.headers.get("content-type") || "").toLowerCase();
    if (contentType.includes("application/json")) {
      const data = await res.json().catch(() => null);
      return { res, data, notJson: false, challengeText: "" };
    }
    const challengeText = await res.text().catch(() => "");
    return { res, data: null, notJson: true, challengeText };
  };

  let result = await fetchOnce();
  const humansName = parseHumansCookieFromChallenge(result.challengeText);
  if (
    result.notJson &&
    humansName &&
    (result.res.status === 409 || result.challengeText.includes("humans_"))
  ) {
    setHumansCookie(humansName);
    result = await fetchOnce();
  }

  return result;
}

function errorReasonFromResponse(res, data, notJson, challengeText = "") {
  if (notJson || data === null) {
    if (parseHumansCookieFromChallenge(challengeText)) {
      return "host_challenge";
    }
    if (res.status === 403 || res.status === 406 || res.status === 413) {
      return "mod_security";
    }
    if (res.status === 409) {
      return "host_challenge";
    }
    return "server_error";
  }
  if (data && typeof data.reason === "string") return data.reason;
  return "server_error";
}

function setupAjaxContactForms() {
  const forms = Array.from(
    document.querySelectorAll('form.contact-form[data-ajax="json"]'),
  ).filter((el) => el instanceof HTMLFormElement);
  if (!forms.length) return;

  for (const form of forms) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      if (honeypotFilled(form)) return;

      const requiredCheck = validateRequiredFields(form);
      if (!requiredCheck.ok) {
        showFormPopup({
          kind: "error",
          title: "Please check the form",
          message: requiredCheck.message,
          reason: requiredCheck.reason,
        });
        updateInlineStatus(form, "error", requiredCheck.message);
        return;
      }

      const emailEl = form.querySelector('input[name="email"]');
      if (emailEl instanceof HTMLInputElement && emailEl.value.trim() && !isValidEmail(emailEl.value.trim())) {
        const msg = "Please enter a valid email address.";
        showFormPopup({
          kind: "error",
          title: "Invalid email",
          message: msg,
          reason: "invalid_email",
        });
        updateInlineStatus(form, "error", msg);
        return;
      }

      const submitBtn = form.querySelector('button[type="submit"]');
      const originalText =
        submitBtn instanceof HTMLButtonElement ? submitBtn.textContent || "Send" : "";
      if (submitBtn instanceof HTMLButtonElement) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Sending…";
      }

      try {
        const action = form.getAttribute("action") || "/contact.php";
        const { res, data, notJson, challengeText } = await postForm(form, action);

        if (!res.ok || !data || data.ok !== true) {
          const message =
            (data && typeof data.message === "string" && data.message) ||
            "Something went wrong. Please try again.";
          const reason = errorReasonFromResponse(res, data, notJson, challengeText);
          showFormPopup({
            kind: "error",
            title: "Message not sent",
            message,
            reason,
          });
          updateInlineStatus(form, "error", message);
          return;
        }

        const successMsg =
          (typeof data.message === "string" && data.message) ||
          "Thanks — we got your message.";
        showFormPopup({
          kind: "success",
          title: "Message sent",
          message: successMsg,
        });
        updateInlineStatus(form, "success", successMsg);
        form.reset();
      } catch {
        const msg = "Network error. Please try again or call (402) 804-3315.";
        showFormPopup({
          kind: "error",
          title: "Connection problem",
          message: msg,
          reason: "network_error",
        });
        updateInlineStatus(form, "error", msg);
      } finally {
        if (submitBtn instanceof HTMLButtonElement) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        }
      }
    });
  }
}

function setupNewsletterForms() {
  const forms = Array.from(document.querySelectorAll("form[data-newsletter]")).filter(
    (el) => el instanceof HTMLFormElement,
  );
  if (!forms.length) return;

  for (const form of forms) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      if (honeypotFilled(form)) return;

      const requiredCheck = validateRequiredFields(form);
      if (!requiredCheck.ok) {
        showFormPopup({
          kind: "error",
          title: "Please check the form",
          message: requiredCheck.message,
          reason: requiredCheck.reason,
        });
        updateInlineStatus(form, "error", requiredCheck.message);
        return;
      }

      const emailEl = form.querySelector('input[name="email"]');
      if (emailEl instanceof HTMLInputElement && !isValidEmail(emailEl.value.trim())) {
        const msg = "Please enter a valid email address.";
        showFormPopup({
          kind: "error",
          title: "Invalid email",
          message: msg,
          reason: "invalid_email",
        });
        updateInlineStatus(form, "error", msg);
        return;
      }

      const submitBtn = form.querySelector('button[type="submit"]');
      const originalText =
        submitBtn instanceof HTMLButtonElement ? submitBtn.textContent || "Subscribe" : "";
      if (submitBtn instanceof HTMLButtonElement) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Sending…";
      }

      try {
        const action = form.getAttribute("action") || "/newsletter-handler.php";
        const { res, data, notJson, challengeText } = await postForm(form, action);

        if (!res.ok || !data || data.ok !== true) {
          const message =
            (data && typeof data.message === "string" && data.message) ||
            "Something went wrong. Please try again.";
          const reason = errorReasonFromResponse(res, data, notJson, challengeText);
          showFormPopup({
            kind: "error",
            title: "Signup not saved",
            message,
            reason,
          });
          updateInlineStatus(form, "error", message);
          return;
        }

        const successMsg =
          (typeof data.message === "string" && data.message) ||
          "Thanks — you are on the list.";
        showFormPopup({
          kind: "success",
          title: "You are subscribed",
          message: successMsg,
        });
        updateInlineStatus(form, "success", successMsg);
        form.reset();
      } catch {
        const msg = "Network error. Please try again in a moment.";
        showFormPopup({
          kind: "error",
          title: "Connection problem",
          message: msg,
          reason: "network_error",
        });
        updateInlineStatus(form, "error", msg);
      } finally {
        if (submitBtn instanceof HTMLButtonElement) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        }
      }
    });
  }
}

function setupQueryFlashPopups() {
  const params = new URLSearchParams(window.location.search);

  if (document.body.classList.contains("page-contact")) {
    const sent = params.get("sent");
    const err = params.get("error");
    if (sent === "1") {
      showFormPopup({
        kind: "success",
        title: "Message sent",
        message:
          "Thanks — we received your message. We will reply within one business day, usually much sooner.",
      });
    } else if (err === "1") {
      showFormPopup({
        kind: "error",
        title: "Message not sent",
        message:
          "Something did not go through. Please call or text (402) 804-3315, or try the form again in a moment.",
        reason: "mail_failed",
      });
    }
  }

  if (params.get("newsletter") === "error") {
    showFormPopup({
      kind: "error",
      title: "Signup not saved",
      message: "We could not save your newsletter signup. Please try again.",
      reason: "storage_error",
    });
  }
}

ensureHumansCookie();
setupAjaxContactForms();
setupNewsletterForms();
setupQueryFlashPopups();
