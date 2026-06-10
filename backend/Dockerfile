FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y \
    build-essential \
    libgl1 \
    libglib2.0-0 \
    curl \
    unzip \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# preload model
ARG INSIGHTFACE_MODEL_URL=https://github.com/deepinsight/insightface/releases/download/v0.7/buffalo_l.zip

RUN mkdir -p /root/.insightface \
    && curl -L --fail $INSIGHTFACE_MODEL_URL -o /tmp/model.zip \
    && unzip -q /tmp/model.zip -d /root/.insightface \
    && rm -f /tmp/model.zip

ENV INSIGHTFACE_HOME=/root/.insightface

COPY src ./src
COPY yunet.onnx .
COPY files ./files

EXPOSE 8000

CMD ["uvicorn", "src.api.main:api", "--host", "0.0.0.0", "--port", "8000"]