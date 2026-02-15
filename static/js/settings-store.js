export const DEFAULT_SETTINGS = {
  cols_per_row: 3,
  column_width: 320,
  card_height: 100,
  dashboard_title: "Start Dashboard",
  dashboard_bg_image: "",
  column_bg_color: "#ffffff",
  column_bg_opacity: 0.5,
  card_bg_color: "#ffffff",
  card_bg_opacity: 0.5,
};

export function mergeSettings(current, incoming) {
  if (!incoming) {
    return { ...current };
  }
  const next = { ...current };
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    if (incoming[key] !== undefined && incoming[key] !== null) {
      next[key] = incoming[key];
    } else if (key === "dashboard_bg_image" && incoming[key] !== undefined) {
      next[key] = incoming[key];
    }
  }
  return next;
}

export function applySettingsToDom(settings) {
  const root = document.documentElement;
  root.style.setProperty("--cols-per-row", settings.cols_per_row);
  root.style.setProperty("--column-width", `${settings.column_width}px`);
  root.style.setProperty(
    "--card-height",
    settings.card_height > 0 ? `${settings.card_height}px` : "auto",
  );

  const bgEl = document.getElementById("bg");
  if (bgEl) {
    if (settings.dashboard_bg_image?.trim()) {
      // Apply custom background with fixed positioning
      bgEl.classList.add("has-custom-bg");
      bgEl.style.backgroundImage = `url(${settings.dashboard_bg_image})`;
      bgEl.style.backgroundSize = "cover";
      bgEl.style.backgroundPosition = "center center";
      bgEl.style.backgroundRepeat = "no-repeat";
      bgEl.style.backgroundAttachment = "fixed";
    } else {
      // Reset to default gradient
      bgEl.classList.remove("has-custom-bg");
      bgEl.style.backgroundImage = "";
      bgEl.style.backgroundSize = "";
      bgEl.style.backgroundPosition = "";
      bgEl.style.backgroundRepeat = "";
      bgEl.style.backgroundAttachment = "";
    }
  } else {
    document.body.style.background = settings.dashboard_bg_image?.trim()
      ? `url(${settings.dashboard_bg_image}) center/cover no-repeat fixed`
      : "";
  }

  try {
    if (settings.column_bg_color) {
      const c = hexToRgb(settings.column_bg_color);
      root.style.setProperty(
        "--column-bg",
        `rgba(${c.r}, ${c.g}, ${c.b}, ${parseFloat(settings.column_bg_opacity ?? 1)})`,
      );
    }
    if (settings.card_bg_color) {
      const c2 = hexToRgb(settings.card_bg_color);
      root.style.setProperty(
        "--card-bg",
        `rgba(${c2.r}, ${c2.g}, ${c2.b}, ${parseFloat(settings.card_bg_opacity ?? 1)})`,
      );

      // Автоматично визначити контрастний колір тексту
      const textMode = getContrastTextColor(settings.card_bg_color);
      if (textMode === "dark") {
        // Для світлих карток - темний текст
        root.style.setProperty("--card-text-color", "#0f172a");
        root.style.setProperty("--card-text-muted", "#475569");
        root.style.setProperty("--card-link-color", "#2563eb");
        root.style.setProperty("--card-menu-color", "#1f2937");
      } else {
        // Для темних карток - світлий текст
        root.style.setProperty("--card-text-color", "#f1f5f9");
        root.style.setProperty("--card-text-muted", "#cbd5e1");
        root.style.setProperty("--card-link-color", "#60a5fa");
        root.style.setProperty("--card-menu-color", "#e0e7ff");
      }
    }
  } catch (_err) {
    // ignore color parse errors
  }

  const titleEl = document.getElementById("dashboardTitle");
  if (titleEl) {
    titleEl.textContent = settings.dashboard_title;
  }
}

function hexToRgb(hex) {
  const normalized = hex.replace("#", "");
  const full =
    normalized.length === 3
      ? normalized
          .split("")
          .map((ch) => ch + ch)
          .join("")
      : normalized;
  const intValue = parseInt(full, 16);
  return {
    r: (intValue >> 16) & 255,
    g: (intValue >> 8) & 255,
    b: intValue & 255,
  };
}

/**
 * Визначити яскравість кольору (0-255)
 * Використовує стандартну формулу яскравості для людського ока
 */
export function getColorBrightness(hex) {
  const rgb = hexToRgb(hex);
  // Формула: (R*0.299 + G*0.587 + B*0.114)
  return rgb.r * 0.299 + rgb.g * 0.587 + rgb.b * 0.114;
}

/**
 * Визначити кольору контрастного тексту для фону
 * Повертає 'dark' для світлих фонів, 'light' для темних
 */
export function getContrastTextColor(backgroundColor) {
  const brightness = getColorBrightness(backgroundColor);
  // Якщо фон яскравий (> 128), потрібен темний текст
  return brightness > 128 ? "dark" : "light";
}
