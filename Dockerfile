FROM python:3.11-slim

WORKDIR /app
COPY . .

# Install system dependencies for audio and image processing
RUN apt-get update && apt-get install -y \
    libjpeg-dev \
    zlib1g-dev \
    ffmpeg \
    portaudio19-dev \
    espeak \
    libespeak1 \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt

EXPOSE 7860

CMD ["streamlit", "run", "app.py", "--server.port=7860", "--server.address=0.0.0.0"]