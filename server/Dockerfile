FROM python:3.11-slim

# Installe ffmpeg (inclut ffprobe)
RUN apt-get update && \
    apt-get install -y ffmpeg --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Installe les dépendances Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Installe yt-dlp via pip (plus à jour que le paquet apt)
RUN pip install --no-cache-dir yt-dlp

COPY server.py .

# Railway injecte PORT automatiquement
ENV PORT=8080

CMD ["python", "server.py"]
