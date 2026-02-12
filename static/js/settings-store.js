export const DEFAULT_SETTINGS = {
  cols_per_row: 3,
  column_width: 320,
  card_height: 0,
  dashboard_title: "Start Dashboard",
  dashboard_bg_image: "",
  column_bg_color: "#ffffff",
  column_bg_opacity: 1.0,
  card_bg_color: "#ffffff",
  card_bg_opacity: 1.0,
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
  root.style.setProperty("--card-height", settings.card_height > 0 ? `${settings.card_height}px` : "auto");

  const bgEl = document.getElementById("bg");
  if (bgEl) {
    bgEl.style.backgroundImage = settings.dashboard_bg_image?.trim()
      ? `url(${settings.dashboard_bg_image})`
      : "";
  } else {
    document.body.style.background = settings.dashboard_bg_image?.trim()
      ? `url(${settings.dashboard_bg_image}) center/cover no-repeat`
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
  const full = normalized.length === 3 ? normalized.split("").map((ch) => ch + ch).join("") : normalized;
  const intValue = parseInt(full, 16);
  return {
    r: (intValue >> 16) & 255,
    g: (intValue >> 8) & 255,
    b: intValue & 255,
  };
}

