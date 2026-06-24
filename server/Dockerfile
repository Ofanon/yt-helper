FROM python:3.11-slim

# Installe curl + Node.js 20 LTS (requis par yt-dlp pour résoudre les signatures YouTube)
RUN apt-get update && \
    apt-get install -y curl ffmpeg --no-install-recommends && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

RUN pip install --no-cache-dir yt-dlp

COPY server.py .

ENV PORT=8080

CMD ["python", "server.py"]
