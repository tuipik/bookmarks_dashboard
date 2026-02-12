let toastRoot = null;
let confirmRoot = null;

function ensureToastRoot() {
  if (toastRoot) {
    return toastRoot;
  }
  toastRoot = document.createElement("div");
  toastRoot.className = "toast-root";
  document.body.appendChild(toastRoot);
  return toastRoot;
}

export function notify(message, variant = "info", timeout = 2800) {
  const root = ensureToastRoot();
  const toast = document.createElement("div");
  toast.className = `toast toast-${variant}`;
  toast.textContent = message;
  root.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add("is-visible");
  });

  window.setTimeout(() => {
    toast.classList.remove("is-visible");
    window.setTimeout(() => {
      toast.remove();
    }, 220);
  }, timeout);
}

export function notifySuccess(message) {
  notify(message, "success");
}

export function notifyError(message) {
  notify(message, "error", 3600);
}

function ensureConfirmRoot() {
  if (confirmRoot) {
    return confirmRoot;
  }
  confirmRoot = document.createElement("div");
  confirmRoot.className = "confirm-root";
  document.body.appendChild(confirmRoot);
  return confirmRoot;
}

export function askConfirm(message, options = {}) {
  const root = ensureConfirmRoot();
  const title = options.title || "Confirmation";
  const confirmLabel = options.confirmLabel || "Confirm";
  const cancelLabel = options.cancelLabel || "Cancel";

  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "confirm-overlay";
    overlay.innerHTML = `
      <div class="confirm-window" role="dialog" aria-modal="true" aria-label="${title}">
        <h4 class="confirm-title">${title}</h4>
        <p class="confirm-message">${message}</p>
        <div class="confirm-actions">
          <button type="button" class="confirm-btn confirm-btn-cancel">${cancelLabel}</button>
          <button type="button" class="confirm-btn confirm-btn-submit">${confirmLabel}</button>
        </div>
      </div>
    `;
    root.appendChild(overlay);

    const confirmBtn = overlay.querySelector(".confirm-btn-submit");
    const cancelBtn = overlay.querySelector(".confirm-btn-cancel");

    const close = (result) => {
      overlay.classList.remove("is-visible");
      window.setTimeout(() => {
        overlay.remove();
        resolve(result);
      }, 140);
    };

    confirmBtn.addEventListener("click", () => close(true));
    cancelBtn.addEventListener("click", () => close(false));
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        close(false);
      }
    });

    requestAnimationFrame(() => overlay.classList.add("is-visible"));
  });
}
