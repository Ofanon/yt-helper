/**
 * content.js — Injecte des boutons natifs YouTube pour télécharger vidéos et Shorts.
 */

const DEFAULT_SERVER = "http://127.0.0.1:5000";
const BTN_ID = "yt-helper-btn-download";
const THUMB_BTN_ID = "yt-helper-btn-thumb";

let pollInterval = null;
let lastUrl = location.href;

// ---------------------------------------------------------------------------
// Détection de la page et de l'ID vidéo
// ---------------------------------------------------------------------------

function getPageType() {
  if (location.pathname.startsWith("/shorts/")) return "shorts";
  if (location.pathname === "/watch") return "watch";
  if (location.hostname === "studio.youtube.com") return "studio";
  return null;
}

function getVideoId() {
  if (location.pathname.startsWith("/shorts/")) {
    return location.pathname.split("/shorts/")[1].split("?")[0];
  }
  const params = new URL(location.href).searchParams;
  if (params.has("v")) return params.get("v");
  const m = location.pathname.match(/\/video\/([^/]+)/);
  return m ? m[1] : null;
}

async function getSettings() {
  return new Promise((r) =>
    chrome.storage.local.get(
      { serverUrl: DEFAULT_SERVER, token: "", format: "mp4", useCookies: false },
      r
    )
  );
}

// ---------------------------------------------------------------------------
// Création d'un bouton au style YouTube natif
// ---------------------------------------------------------------------------

function makeYtButton({ id, icon, label, onClick }) {
  // Conteneur au style pill YouTube (comme "Partager", "Enregistrer")
  const btn = document.createElement("button");
  btn.id = id;
  btn.className = "yth-native-btn";
  btn.setAttribute("aria-label", label);

  const iconEl = document.createElement("span");
  iconEl.className = "yth-native-icon";
  iconEl.textContent = icon;

  const labelEl = document.createElement("span");
  labelEl.className = "yth-native-label";
  labelEl.textContent = label;

  btn.appendChild(iconEl);
  btn.appendChild(labelEl);
  btn.addEventListener("click", onClick);
  return btn;
}

// Zone de progression compacte (s'affiche sous les boutons)
function makeProgressBar() {
  const wrap = document.createElement("div");
  wrap.id = "yth-progress-wrap";
  wrap.className = "yth-progress-wrap yth-hidden";

  const bar = document.createElement("div");
  bar.className = "yth-bar";
  const fill = document.createElement("div");
  fill.className = "yth-fill";
  bar.appendChild(fill);

  const lbl = document.createElement("span");
  lbl.className = "yth-lbl";

  wrap.appendChild(bar);
  wrap.appendChild(lbl);
  return wrap;
}

// ---------------------------------------------------------------------------
// Injection dans la barre de boutons YouTube
// ---------------------------------------------------------------------------

function removeButtons() {
  document.getElementById(BTN_ID)?.remove();
  document.getElementById(THUMB_BTN_ID)?.remove();
  document.getElementById("yth-progress-wrap")?.remove();
  stopPolling();
}

function injectButtons(videoId) {
  removeButtons();

  const type = getPageType();
  const progressBar = makeProgressBar();

  const btnDownload = makeYtButton({
    id: BTN_ID,
    icon: "⬇",
    label: "MP4 propre",
    onClick: () => startDownload(videoId, progressBar),
  });

  const btnThumb = makeYtButton({
    id: THUMB_BTN_ID,
    icon: "🖼",
    label: "Miniature",
    onClick: () => downloadThumbnail(videoId),
  });

  if (type === "shorts") {
    injectShorts(btnDownload, btnThumb, progressBar);
  } else {
    injectWatch(btnDownload, btnThumb, progressBar);
  }

  console.log("[yt-helper] Boutons injectés pour", videoId);
}

/** Injection sur /watch — dans la barre de boutons sous le titre */
function injectWatch(btnDownload, btnThumb, progressBar) {
  // Cible : le renderer des actions (#actions contient les boutons like/share/etc.)
  const selectors = [
    "ytd-watch-metadata #actions",
    "#actions-inner",
    "ytd-menu-renderer.ytd-watch-metadata",
    "#above-the-fold #actions",
    "ytd-watch-flexy #actions",
  ];

  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) {
      el.appendChild(btnDownload);
      el.appendChild(btnThumb);
      // La barre de progression va juste après la zone d'actions
      el.closest("#above-the-fold, ytd-watch-metadata")
        ?.appendChild(progressBar);
      return;
    }
  }

  // Fallback flottant si rien ne matche
  fallbackFloat(btnDownload, btnThumb, progressBar);
}

/** Injection sur /shorts — barre verticale à droite */
function injectShorts(btnDownload, btnThumb, progressBar) {
  // Sur Shorts, les boutons (like, commentaire, partage) sont dans un container vertical
  const selectors = [
    "ytd-reel-video-renderer[is-active] #actions",
    "ytReelVideoRendererElement #actions",
    "#shorts-inner-container #actions",
    "ytd-shorts #actions",
  ];

  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) {
      el.appendChild(btnDownload);
      el.appendChild(btnThumb);
      el.appendChild(progressBar);
      return;
    }
  }

  fallbackFloat(btnDownload, btnThumb, progressBar);
}

function fallbackFloat(btnDownload, btnThumb, progressBar) {
  const wrap = document.createElement("div");
  wrap.id = "yth-float-wrap";
  Object.assign(wrap.style, {
    position: "fixed", bottom: "80px", right: "20px",
    zIndex: "999999", display: "flex", flexDirection: "column",
    gap: "8px", background: "rgba(15,15,15,0.92)",
    padding: "10px 12px", borderRadius: "12px",
    border: "1px solid #333",
  });
  wrap.appendChild(btnDownload);
  wrap.appendChild(btnThumb);
  wrap.appendChild(progressBar);
  document.body.appendChild(wrap);
}

// ---------------------------------------------------------------------------
// Téléchargement
// ---------------------------------------------------------------------------

async function startDownload(videoId, progressBar) {
  const settings = await getSettings();
  const server = (settings.serverUrl || DEFAULT_SERVER).replace(/\/$/, "");
  const token  = settings.token || "";
  const headers = { "Content-Type": "application/json", ...(token ? { "X-Auth-Token": token } : {}) };

  const ytUrl = location.pathname.startsWith("/shorts/")
    ? `https://www.youtube.com/shorts/${videoId}`
    : `https://www.youtube.com/watch?v=${videoId}`;

  showProgress(progressBar, 0, "Connexion au serveur…");

  try {
    const h = await fetch(`${server}/health`, { headers });
    if (!h.ok) throw new Error();
  } catch {
    const isLocal = server.includes("127.0.0.1") || server.includes("localhost");
    showProgress(progressBar, 0,
      isLocal ? "⚠ Serveur introuvable — lance python server.py"
              : "⚠ Serveur Railway introuvable — vérifie le déploiement",
      true);
    return;
  }

  let resp;
  try {
    resp = await fetch(`${server}/download`, {
      method: "POST",
      headers,
      body: JSON.stringify({ url: ytUrl, format: settings.format || "mp4", cookies: settings.useCookies }),
    });
  } catch {
    showProgress(progressBar, 0, "⚠ Impossible de contacter le serveur", true);
    return;
  }

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    showProgress(progressBar, 0, `⚠ ${err.error || "Erreur serveur"}`, true);
    return;
  }

  const { job_id } = await resp.json();
  chrome.runtime.sendMessage({ type: "JOB_STARTED", jobId: job_id }).catch(() => {});
  startPolling(job_id, server, token, progressBar);
}

// ---------------------------------------------------------------------------
// Progression
// ---------------------------------------------------------------------------

function startPolling(jobId, server, token, progressBar) {
  stopPolling();
  const headers = token ? { "X-Auth-Token": token } : {};
  pollInterval = setInterval(async () => {
    try {
      const r = await fetch(`${server}/progress/${jobId}`, { headers });
      if (!r.ok) return;
      const d = await r.json();

      if (d.state === "downloading") {
        showProgress(progressBar, d.percent, `${d.percent}%`);
      } else if (d.state === "finished") {
        showProgress(progressBar, 100, "✓ Terminé !");
        stopPolling();
        setTimeout(() => hideProgress(progressBar), 5000);
      } else if (d.state === "error") {
        showProgress(progressBar, 0, `⚠ ${d.error}`, true);
        stopPolling();
      }
    } catch { stopPolling(); }
  }, 1000);
}

function stopPolling() {
  if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
}

function showProgress(progressBar, pct, label, isError = false) {
  progressBar.classList.remove("yth-hidden");
  const fill = progressBar.querySelector(".yth-fill");
  const lbl  = progressBar.querySelector(".yth-lbl");
  if (fill) {
    fill.style.width = `${Math.min(pct, 100)}%`;
    fill.style.background = isError ? "#e53935" : "#ff0000";
  }
  if (lbl) lbl.textContent = label;
}

function hideProgress(progressBar) {
  progressBar.classList.add("yth-hidden");
}

// ---------------------------------------------------------------------------
// Miniature
// ---------------------------------------------------------------------------

async function downloadThumbnail(videoId) {
  const maxRes = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
  const hqDef  = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  let url = maxRes;
  try {
    const p = await fetch(maxRes, { method: "HEAD" });
    if (!p.ok) url = hqDef;
  } catch { url = hqDef; }
  const a = document.createElement("a");
  a.href = url; a.download = `thumbnail_${videoId}.jpg`; a.target = "_blank";
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

// ---------------------------------------------------------------------------
// Attente du DOM + navigation SPA
// ---------------------------------------------------------------------------

function tryInject() {
  const vid = getVideoId();
  if (!vid) return;
  waitForActions(() => injectButtons(vid));
}

function waitForActions(cb, tries = 0) {
  // Sélecteurs qui signalent que la page est suffisamment chargée
  const ready = [
    "ytd-watch-metadata #actions",
    "#actions-inner",
    "ytd-reel-video-renderer[is-active] #actions",
    "ytd-shorts #actions",
    "#above-the-fold",
    "#primary-inner",
  ].some((s) => document.querySelector(s));

  if (ready) { cb(); return; }
  if (tries < 40) setTimeout(() => waitForActions(cb, tries + 1), 250);
  else { console.log("[yt-helper] fallback float (DOM non trouvé)"); cb(); }
}

// Écoute la navigation SPA YouTube
window.addEventListener("yt-navigate-finish", () => {
  setTimeout(tryInject, 300); // petit délai pour laisser le DOM se mettre à jour
});

// MutationObserver fallback
new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    removeButtons();
    setTimeout(tryInject, 500);
  }
}).observe(document.documentElement, { childList: true, subtree: true });

// Premier chargement
tryInject();
