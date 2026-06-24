@echo off
REM Lance le serveur yt-helper en arrière-plan (sans fenêtre noire).
REM Placez ce fichier dans le dossier shell:startup pour un démarrage automatique.

REM --- Chemin vers le dossier du serveur (modifiez si vous avez déplacé le projet) ---
set SERVER_DIR=%~dp0

REM pythonw.exe = comme python.exe mais sans fenêtre console
start "" pythonw "%SERVER_DIR%server.py"

echo Serveur yt-helper démarré en arrière-plan.
echo Pour l'arrêter : ouvrez le Gestionnaire des tâches ^> onglet Détails ^> pythonw.exe ^> Fin de tâche.
