"""
Serveur yt-helper — fonctionne en LOCAL (127.0.0.1) ou sur Railway (cloud).

Mode local  : pas de token, fichiers sauvegardés dans output_dir sur ton PC.
Mode Railway : token obligatoire (variable d'env YT_HELPER_TOKEN),
               fichiers dans /tmp puis servis via /file/<job_id> pour téléchargement.
"""

import json
import logging
import os
import shutil
import subprocess
import sys
import threading
import uuid
from pathlib import Path

from flask import Flask, jsonify, request, send_file
from flask_cors import CORS

# ---------------------------------------------------------------------------
# Détection du mode : local vs cloud
# ---------------------------------------------------------------------------
IS_CLOUD = os.environ.get("RAILWAY_ENVIRONMENT") is not None or os.environ.get("YT_HELPER_TOKEN") is not None

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        *([] if IS_CLOUD else [logging.FileHandler("server.log", encoding="utf-8")]),
        logging.StreamHandler(sys.stdout),
    ],
)
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Auth token (obligatoire en cloud, désactivé en local)
# ---------------------------------------------------------------------------
AUTH_TOKEN = os.environ.get("YT_HELPER_TOKEN", "")

# ---------------------------------------------------------------------------
# Enrichissement du PATH pour Windows local (winget, etc.)
# ---------------------------------------------------------------------------
if not IS_CLOUD:
    _extra = [
        str(Path.home() / "AppData" / "Local" / "Microsoft" / "WinGet" / "Links"),
        str(Path.home() / "scoop" / "shims"),
        r"C:\ProgramData\chocolatey\bin",
    ]
    os.environ["PATH"] = os.pathsep.join(
        [p for p in _extra if Path(p).exists()] + [os.environ.get("PATH", "")]
    )

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
CONFIG_PATH = Path(__file__).parent / "config.json"
VERSION = "2.0.0"


def load_config() -> dict:
    if IS_CLOUD:
        return {"output_dir": "/tmp/yt-helper"}
    if CONFIG_PATH.exists():
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            cfg = json.load(f)
        cfg.setdefault("output_dir", str(Path.home() / "Downloads"))
        return cfg
    cfg = {"output_dir": str(Path.home() / "Downloads")}
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(cfg, f, indent=2, ensure_ascii=False)
    return cfg


config     = load_config()
OUTPUT_DIR = Path(config["output_dir"])
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# Cookies YouTube (cloud uniquement) — écrits dans /tmp/yt_cookies.txt
# La variable d'env YT_COOKIES doit contenir le contenu d'un fichier cookies.txt
# exporté depuis Chrome (extension "Get cookies.txt LOCALLY" sur youtube.com).
# ---------------------------------------------------------------------------
COOKIES_FILE = None
if IS_CLOUD:
    cookies_content = os.environ.get("YT_COOKIES", "").strip()
    if cookies_content:
        COOKIES_FILE = "/tmp/yt_cookies.txt"
        with open(COOKIES_FILE, "w", encoding="utf-8") as f:
            f.write(cookies_content)
        log.info("✓ Cookies YouTube chargés depuis YT_COOKIES")

# ---------------------------------------------------------------------------
# Détection des outils
# ---------------------------------------------------------------------------

def _find_exe(name: str) -> str:
    cmd = ["where.exe", name] if sys.platform == "win32" else ["which", name]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode == 0:
            return r.stdout.strip().splitlines()[0]
    except FileNotFoundError:
        pass
    return shutil.which(name) or name


YTDLP_EXE  = _find_exe("yt-dlp")
FFMPEG_EXE = _find_exe("ffmpeg")


def check_tool(name: str) -> bool:
    exe = YTDLP_EXE if name == "yt-dlp" else FFMPEG_EXE
    p = Path(exe)
    return p.is_file() if p.is_absolute() else shutil.which(exe) is not None


def startup_checks():
    for tool in ("yt-dlp", "ffmpeg"):
        if check_tool(tool):
            log.info(f"✓ {tool} trouvé")
        else:
            log.error(f"⚠  {tool} introuvable")


# ---------------------------------------------------------------------------
# Flask
# ---------------------------------------------------------------------------
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

jobs: dict      = {}
jobs_lock       = threading.Lock()

# ---------------------------------------------------------------------------
# Middleware auth
# ---------------------------------------------------------------------------

@app.before_request
def require_auth():
    if not AUTH_TOKEN:
        return  # local, pas de vérification
    if request.method == "OPTIONS":
        return
    # Accepte le token en header OU en query param (pour les liens <a href>)
    provided = request.headers.get("X-Auth-Token") or request.args.get("_token", "")
    if provided != AUTH_TOKEN:
        return jsonify({"error": "Token invalide ou manquant"}), 403


# ---------------------------------------------------------------------------
# /health
# ---------------------------------------------------------------------------

@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "version": VERSION,
        "mode": "cloud" if IS_CLOUD else "local",
        "output_dir": str(OUTPUT_DIR),
        "ytdlp_ok":   check_tool("yt-dlp"),
        "ffmpeg_ok":  check_tool("ffmpeg"),
        "cookies_ok": COOKIES_FILE is not None and Path(COOKIES_FILE).exists(),
    })


# ---------------------------------------------------------------------------
# /download
# ---------------------------------------------------------------------------

@app.route("/download", methods=["POST"])
def download():
    data = request.get_json(silent=True)
    if not data or "url" not in data:
        return jsonify({"error": "URL manquante"}), 400

    url: str          = data["url"].strip()
    fmt: str          = data.get("format", "mp4")
    use_cookies: bool = data.get("cookies", False) and not IS_CLOUD

    if not url.startswith("http"):
        return jsonify({"error": "URL invalide"}), 400
    if not check_tool("yt-dlp"):
        return jsonify({"error": "yt-dlp introuvable"}), 500
    if fmt == "mp4" and not check_tool("ffmpeg"):
        return jsonify({"error": "ffmpeg introuvable"}), 500

    job_id = str(uuid.uuid4())
    with jobs_lock:
        jobs[job_id] = {"state": "pending", "percent": 0, "filename": None, "filepath": None, "error": None}

    threading.Thread(target=_run_download, args=(job_id, url, fmt, use_cookies), daemon=True).start()
    return jsonify({"job_id": job_id}), 202


def _run_download(job_id: str, url: str, fmt: str, use_cookies: bool):
    def set_state(**kw):
        with jobs_lock:
            jobs[job_id].update(kw)

    set_state(state="downloading")

    # Dossier isolé par job
    job_dir = OUTPUT_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)

    cmd = [YTDLP_EXE]

    if fmt == "audio":
        cmd += ["-f", "bestaudio/best", "--extract-audio", "--audio-format", "m4a", "--audio-quality", "0"]
    else:
        cmd += ["-f", "bv*+ba/b", "--merge-output-format", "mp4",
                "--postprocessor-args", "ffmpeg:-c:v copy -c:a aac"]

    if use_cookies and not IS_CLOUD:
        cmd += ["--cookies-from-browser", "chrome"]
    elif IS_CLOUD and COOKIES_FILE:
        cmd += ["--cookies", COOKIES_FILE]

    # En mode cloud : EJS solver Node.js + client TV (supporte les cookies)
    if IS_CLOUD:
        cmd += ["--js-runtimes", "node", "--extractor-args", "youtube:player_client=tv,web"]

    if FFMPEG_EXE and Path(FFMPEG_EXE).is_absolute():
        cmd += ["--ffmpeg-location", str(Path(FFMPEG_EXE).parent)]

    cmd += [
        "-o", str(job_dir / "%(title)s.%(ext)s"),
        "--no-playlist", "--newline",
        "--progress-template",
        "download:[download] %(progress._percent_str)s of %(progress._total_bytes_str)s",
        url,
    ]

    try:
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                text=True, encoding="utf-8", errors="replace")
        all_output = []
        filepath   = None

        for line in proc.stdout:
            line = line.rstrip()
            all_output.append(line)
            log.info(f"[{job_id[:8]}] {line}")

            if "%" in line and "[download]" in line:
                try:
                    pct = float(line.split("%")[0].split()[-1].replace(",", "."))
                    set_state(percent=round(pct, 1))
                except (ValueError, IndexError):
                    pass

            if "Destination:" in line:
                filepath = line.split("Destination:", 1)[-1].strip()
                set_state(filename=Path(filepath).name, filepath=filepath)
            elif "[Merger]" in line and "into" in line:
                filepath = line.split("into", 1)[-1].strip().strip('"')
                set_state(filename=Path(filepath).name, filepath=filepath)
            elif "[ExtractAudio]" in line and "Destination:" in line:
                filepath = line.split("Destination:", 1)[-1].strip()
                set_state(filename=Path(filepath).name, filepath=filepath)

        proc.wait()

        if proc.returncode == 0:
            if not filepath:
                files = [f for f in job_dir.iterdir() if f.is_file()]
                if files:
                    filepath = str(files[0])
                    set_state(filename=files[0].name, filepath=filepath)
            set_state(state="finished", percent=100)
            log.info(f"[{job_id[:8]}] Terminé : {filepath}")
        else:
            last = " | ".join(all_output[-5:]) if all_output else "aucune sortie"
            set_state(state="error", error=last)

    except Exception as e:
        set_state(state="error", error=str(e))
        log.exception(f"[{job_id[:8]}] Exception")


# ---------------------------------------------------------------------------
# /progress/<job_id>
# ---------------------------------------------------------------------------

@app.route("/progress/<job_id>", methods=["GET"])
def progress(job_id: str):
    with jobs_lock:
        job = jobs.get(job_id)
    if not job:
        return jsonify({"error": "Job inconnu"}), 404
    return jsonify({k: v for k, v in job.items() if k != "filepath"})


# ---------------------------------------------------------------------------
# /file/<job_id> — sert le fichier (utile en mode cloud)
# ---------------------------------------------------------------------------

@app.route("/file/<job_id>", methods=["GET"])
def serve_file(job_id: str):
    with jobs_lock:
        job = jobs.get(job_id)
    if not job:
        return jsonify({"error": "Job inconnu"}), 404
    if job["state"] != "finished":
        return jsonify({"error": "Fichier pas encore prêt"}), 425
    filepath = job.get("filepath")
    if not filepath or not Path(filepath).exists():
        return jsonify({"error": "Fichier introuvable sur le serveur"}), 404
    return send_file(filepath, as_attachment=True, download_name=Path(filepath).name)


# ---------------------------------------------------------------------------
# Point d'entrée
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    host = "0.0.0.0" if IS_CLOUD else "127.0.0.1"

    log.info("=" * 60)
    log.info(f"  yt-helper v{VERSION} — mode {'CLOUD ☁' if IS_CLOUD else 'LOCAL 💻'}")
    if IS_CLOUD and not AUTH_TOKEN:
        log.warning("  ⚠ YT_HELPER_TOKEN non défini — le serveur est ouvert à tous !")
    log.info("=" * 60)

    startup_checks()
    app.run(host=host, port=port, debug=False, threaded=True)
