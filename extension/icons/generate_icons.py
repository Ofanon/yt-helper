"""
Script utilitaire pour générer les icônes PNG de l'extension.
Lance ce script UNE SEULE FOIS depuis le dossier icons/ :
    python generate_icons.py
Requiert Pillow : pip install Pillow
Si tu ne veux pas l'installer, tu peux remplacer les PNG par n'importe quelle
image de la bonne taille (16x16, 48x48, 128x128).
"""

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print("Installe Pillow d'abord : pip install Pillow")
    raise SystemExit(1)

import os

SIZES = [16, 48, 128]
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

for size in SIZES:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Cercle de fond rouge
    margin = max(1, size // 8)
    draw.ellipse([margin, margin, size - margin, size - margin], fill="#ff0000")

    # Triangle "play" blanc centré
    cx, cy = size // 2, size // 2
    r = (size - 2 * margin) // 3
    points = [
        (cx - r // 2, cy - r),
        (cx - r // 2, cy + r),
        (cx + r, cy),
    ]
    draw.polygon(points, fill="white")

    out_path = os.path.join(SCRIPT_DIR, f"icon{size}.png")
    img.save(out_path, "PNG")
    print(f"  Créé : {out_path}")

print("Icônes générées avec succès !")
