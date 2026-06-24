FROM python:3.11-slim

# Node.js 20 LTS + ffmpeg
RUN apt-get update && \
    apt-get install -y curl ffmpeg --no-install-recommends && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# yt-dlp + solver JS EJS (résout les challenges de signature YouTube)
RUN pip install --no-cache-dir yt-dlp && \
    npm install -g @yt-dlp/yt-dlp-js-solver

COPY server.py .

ENV PORT=8080

CMD ["python", "server.py"]
