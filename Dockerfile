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
# - Worker-Anzahl NICHT fest verdrahtet: gunicorn liest sie aus WEB_CONCURRENCY
#   (in docker-compose gesetzt). So laesst sich der RAM-Verbrauch pro Umgebung
#   steuern, ohne das Image neu zu bauen.
# - --max-requests: jeder Worker wird nach ~500 Requests neu gestartet. Faengt
#   langsam wachsenden Speicher (Fragmentierung/Leaks) ab, ohne Downtime.
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--timeout", "120", \
     "--max-requests", "500", "--max-requests-jitter", "50", "app:app"]
