FROM python:3.12-slim

# Keine .pyc-Dateien, Ausgabe direkt in den Log (ungepuffert)
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Zuerst nur die Abhaengigkeiten -> besseres Docker-Layer-Caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Anwendungscode
COPY . .

EXPOSE 5000

# Produktionsserver (gunicorn). "app:app" = Flask-Instanz "app" aus app.py
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "--timeout", "120", "app:app"]
