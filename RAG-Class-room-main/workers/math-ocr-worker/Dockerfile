FROM python:3.11-slim
ENV PORT=8080
RUN apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY main.py .
CMD exec uvicorn main:app --host 0.0.0.0 --port ${PORT}
