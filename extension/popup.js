/**
 * popup.js — Gère local (127.0.0.1) et cloud (Railway).
 */

const DEFAULT_SERVER = "http://127.0.0.1:5000";

const serverUrlInput  = document.getElementById("server-url");
const tokenInput      = document.getElementById("token-input");
const tokenShowBtn    = document.getElementById("token-show");
const fmtSelect       = document.getElementById("fmt-select");
const cookiesCheck    = document.getElementById("cookies-check");
const cookiesRow      = document.getElementById("cookies-row");
const outputDirEl     = document.getElementById("output-dir");
const serverStatusDot = document.getElementById("server-status");
const serverMsgEl     = document.getElementById("server-msg");
const saveBtn         = document.getElementById("save-btn");
const saveMsgEl       = document.getElementById("save-msg");
const progressSection = document.getElementById("progress-section");
const progressFill    = document.getElementById("popup-progress-fill");
const progressLabel   = document.getElementById("popup-progress-label");
const downloadLink    = document.getElementById("download-link");

let pollInterval = null;

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

async function init() {
  const s = await loadSettings();
  serverUrlInput.value = s.serverUrl  || DEFAULT_SERVER;
  tokenInput.value     = s.token      || "";
  fmtSelect.value      = s.format     || "mp4";
  cookiesCheck.checked = s.useCookies || false;

  updateCookiesVisibility(s.serverUrl || DEFAULT_SERVER);
  await checkServer(s.serverUrl || DEFAULT_SERVER, s.token || "");

  if (s.currentJobId) {
    progressSection.style.display = "block";
    startPolling(s.currentJobId, s.serverUrl || DEFAULT_SERVER, s.token || "");
  }
}

function loadSettings() {
  return new Promise((r) =>
    chrome.storage.local.get(
      { serverUrl: DEFAULT_SERVER, token: "", format: "mp4", useCookies: false, currentJobId: null },
      r
    )
  );
}

function isCloud(url) {
  return url && !url.includes("127.0.0.1") && !url.includes("localhost");
}

function updateCookiesVisibility(url) {
  cookiesRow.style.display = isCloud(url) ? "none" : "";
}

// ---------------------------------------------------------------------------
// Vérification serveur
// ---------------------------------------------------------------------------

async function checkServer(url, token) {
  url = url.replace(/\/$/, "");
  setServerStatus("unknown", "Vérification…");
  try {
    const headers = token ? { "X-Auth-Token": token } : {};
    const resp = await fetch(`${url}/health`, { headers });

    if (resp.status === 403) {
      setServerStatus("error", "Token incorrect — vérifie le token Railway.");
      return;
    }
    if (!resp.ok) {
      setServerStatus("error", `Erreur serveur (code ${resp.status}).`);
      return;
    }

    const data = await resp.json();
    const warns = [];
    if (!data.ytdlp_ok)  warns.push("yt-dlp introuvable");
    if (!data.ffmpeg_ok) warns.push("ffmpeg introuvable");

    const mode = data.mode === "cloud" ? "☁ Cloud" : "💻 Local";
    if (warns.length) {
      setServerStatus("error", `${mode} actif mais : ${warns.join(", ")}`);
    } else {
      setServerStatus("ok", `${mode} actif ✓`);
      if (data.output_dir) outputDirEl.textContent = data.output_dir;
    }
  } catch {
    setServerStatus("error",
      isCloud(url)
        ? "Serveur Railway introuvable. Vérifie que le déploiement est actif."
        : "Serveur introuvable. Lance start-server.bat ou « python server.py »."
    );
  }
}

function setServerStatus(type, msg) {
  serverStatusDot.className = `status-dot status-${type}`;
  serverMsgEl.className     = `server-msg server-${type}`;
  serverMsgEl.textContent   = msg;
}

// ---------------------------------------------------------------------------
// Sauvegarde
// ---------------------------------------------------------------------------

saveBtn.addEventListener("click", async () => {
  const url = serverUrlInput.value.trim() || DEFAULT_SERVER;
  const settings = {
    serverUrl:  url,
    token:      tokenInput.value.trim(),
    format:     fmtSelect.value,
    useCookies: cookiesCheck.checked,
  };
  chrome.storage.local.set(settings, () => {
    saveMsgEl.textContent = "✓ Sauvegardé !";
    setTimeout(() => { saveMsgEl.textContent = ""; }, 2500);
  });
  updateCookiesVisibility(url);
  await checkServer(url, settings.token);
});

tokenShowBtn.addEventListener("click", () => {
  tokenInput.type = tokenInput.type === "password" ? "text" : "password";
});

serverUrlInput.addEventListener("input", () => {
  updateCookiesVisibility(serverUrlInput.value);
});

// ---------------------------------------------------------------------------
// Progression
// ---------------------------------------------------------------------------

function startPolling(jobId, serverUrl, token) {
  stopPolling();
  serverUrl = serverUrl.replace(/\/$/, "");
  const headers = token ? { "X-Auth-Token": token } : {};
  progressSection.style.display = "block";
  downloadLink.style.display    = "none";

  pollInterval = setInterval(async () => {
    try {
      const resp = await fetch(`${serverUrl}/progress/${jobId}`, { headers });
      if (!resp.ok) return;
      const data = await resp.json();

      if (data.state === "downloading") {
        updateProgress(data.percent, `${data.percent}%`);
      } else if (data.state === "finished") {
        updateProgress(100, "✓ Terminé !");
        stopPolling();
        chrome.storage.local.remove("currentJobId");

        if (isCloud(serverUrl)) {
          // Mode cloud : bouton pour télécharger le fichier depuis Railway
          downloadLink.href        = `${serverUrl}/file/${jobId}`;
          downloadLink.textContent = `⬇ Télécharger ${data.filename || "le fichier"}`;
          downloadLink.style.display = "block";
          // Ajoute le token dans les headers via fetch (pas possible avec <a href>)
          // On ouvre dans un nouvel onglet, le token est passé en query param
          if (token) downloadLink.href += `?_token=${encodeURIComponent(token)}`;
        } else {
          setTimeout(() => { progressSection.style.display = "none"; }, 5000);
        }
      } else if (data.state === "error") {
        updateProgress(0, `⚠ ${data.error || "Erreur inconnue"}`);
        progressFill.style.background = "#e53935";
        stopPolling();
        chrome.storage.local.remove("currentJobId");
      }
    } catch { stopPolling(); }
  }, 1000);
}

function stopPolling() {
  if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
}

function updateProgress(pct, label) {
  progressFill.style.width      = `${Math.min(pct, 100)}%`;
  progressFill.style.background = "#ff4444";
  progressLabel.textContent     = label;
}

// ---------------------------------------------------------------------------
// Message du content script (nouveau job lancé)
// ---------------------------------------------------------------------------
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "JOB_STARTED" && msg.jobId) {
    chrome.storage.local.get({ serverUrl: DEFAULT_SERVER, token: "" }, (s) => {
      chrome.storage.local.set({ currentJobId: msg.jobId });
      startPolling(msg.jobId, s.serverUrl, s.token);
    });
  }
});

init();
