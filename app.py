import json
import os
import re
from datetime import datetime, timezone

from flask import Flask, render_template, jsonify, request

app = Flask(__name__)

# ---------------------------------------------------------------------------
# Entwicklungsphase-Schalter.
# Solange True, zeigen wir noch keine Preise und keinen Warenkorb, sondern nur
# Newsletter-Anmeldung und Interessensbekundung.
# ---------------------------------------------------------------------------
DEV_PHASE = True

# Beitrag fuer die "ernsthaftes Interesse"-Bekundung: Unterstuetzung der
# Entwicklung, damit das Produkt auf den Markt kommt. Als Dankeschoen gibt es
# ein kleines Geschenk.
# Rechtlicher Hinweis: Wegen dieser Gegenleistung ist es streng genommen keine
# steuerlich absetzbare "Spende", sondern ein Crowdfunding-/Unterstuetzerbeitrag.
SUPPORTER_CONTRIBUTION = 50

# Basispreis des Basses in Euro (waehrend der Entwicklungsphase nicht sichtbar)
BASE_PRICE = 1299

# Ablage fuer Anmeldungen (einfache JSON-Lines-Dateien, spaeter durch DB ersetzbar)
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
NEWSLETTER_FILE = os.path.join(DATA_DIR, "newsletter.jsonl")
INTEREST_FILE = os.path.join(DATA_DIR, "interest.jsonl")

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

# Konfigurator-Optionen. Jede Option hat einen Aufpreis (delta) zum Basispreis.
# Die Farb-Optionen tragen zusaetzlich CSS-Filterwerte, mit denen das Produktfoto
# live umgefaerbt wird (hue = Farbrotation in Grad, sat = Saettigung).
OPTIONS = {
    "neck": {
        "label": "Hals",
        "choices": [
            {"id": "maple", "name": "Ahorn", "delta": 0},
            {"id": "rosewood", "name": "Palisander", "delta": 80},
            {"id": "ebony", "name": "Ebenholz", "delta": 150},
        ],
    },
    "pickups": {
        "label": "Pick-Ups",
        "choices": [
            {"id": "pj", "name": "PJ Standard", "delta": 0},
            {"id": "single", "name": "Vintage Single-Coil", "delta": 120},
            {"id": "humbucker", "name": "Aktive Humbucker", "delta": 220},
        ],
    },
    "tuners": {
        "label": "Stimmer",
        "choices": [
            {"id": "standard", "name": "Standard", "delta": 0},
            {"id": "locking", "name": "Locking Tuners", "delta": 90},
            {"id": "vintage", "name": "Vintage Open-Gear", "delta": 60},
        ],
    },
    "body": {
        "label": "Korpus-Farbe",
        "choices": [
            {"id": "nebula", "name": "Nebula", "delta": 0, "swatch": "linear-gradient(135deg,#6d5cff,#c74bd6)", "hue": 0, "sat": 1},
            {"id": "amber", "name": "Amber Sunset", "delta": 50, "swatch": "linear-gradient(135deg,#ff9d3c,#ff4d4d)", "hue": 120, "sat": 1.15},
            {"id": "crimson", "name": "Crimson", "delta": 50, "swatch": "linear-gradient(135deg,#ff4d6d,#a01030)", "hue": 80, "sat": 1.2},
            {"id": "emerald", "name": "Emerald", "delta": 50, "swatch": "linear-gradient(135deg,#2ee6a0,#0f8f5f)", "hue": 210, "sat": 1.1},
            {"id": "ice", "name": "Ice Cyan", "delta": 50, "swatch": "linear-gradient(135deg,#57e0ff,#2a7fd6)", "hue": 270, "sat": 1.1},
            {"id": "graphite", "name": "Graphite", "delta": 0, "swatch": "linear-gradient(135deg,#6a6a72,#2b2b30)", "hue": 0, "sat": 0},
        ],
    },
    "hardware": {
        "label": "Metallteile",
        "choices": [
            {"id": "chrome", "name": "Chrom", "delta": 0, "swatch": "linear-gradient(135deg,#e9edf2,#9aa3ad)"},
            {"id": "black", "name": "Schwarz matt", "delta": 40, "swatch": "linear-gradient(135deg,#3a3a3f,#0d0d10)"},
            {"id": "gold", "name": "Gold", "delta": 90, "swatch": "linear-gradient(135deg,#ffd97a,#c79320)"},
        ],
    },
}


def _append_record(path, record):
    """Haengt einen Datensatz als JSON-Zeile an die angegebene Datei an."""
    os.makedirs(DATA_DIR, exist_ok=True)
    record = dict(record)
    record["ts"] = datetime.now(timezone.utc).isoformat()
    with open(path, "a", encoding="utf-8") as fh:
        fh.write(json.dumps(record, ensure_ascii=False) + "\n")


@app.route("/")
def home():
    return render_template("index.html", dev_phase=DEV_PHASE)


@app.route("/konfigurator")
def configurator():
    return render_template(
        "configurator.html",
        options=OPTIONS,
        base_price=BASE_PRICE,
        dev_phase=DEV_PHASE,
        supporter_contribution=SUPPORTER_CONTRIBUTION,
    )


@app.route("/api/options")
def api_options():
    return jsonify({"base_price": BASE_PRICE, "options": OPTIONS})


@app.route("/api/newsletter", methods=["POST"])
def api_newsletter():
    """Newsletter-Anmeldung fuer die Release-Benachrichtigung.

    Hinweis Datenschutz: Fuer den echten Betrieb ist ein Double-Opt-in noetig
    (Bestaetigungsmail), damit die Einwilligung DSGVO-konform nachweisbar ist.
    Hier speichern wir die Anmeldung erst einmal lokal.
    """
    data = request.get_json(silent=True) or request.form
    email = (data.get("email") or "").strip()
    consent = bool(data.get("consent"))

    if not EMAIL_RE.match(email):
        return jsonify({"ok": False, "error": "Bitte gib eine gültige E-Mail-Adresse ein."}), 400
    if not consent:
        return jsonify({"ok": False, "error": "Bitte bestätige die Einwilligung."}), 400

    _append_record(NEWSLETTER_FILE, {"email": email, "consent": consent})
    return jsonify({"ok": True, "message": "Danke! Wir melden uns, sobald es losgeht."})


@app.route("/api/interest", methods=["POST"])
def api_interest():
    """Interessensbekundung aus dem Konfigurator.

    kind = "interest"  -> unverbindliches Interesse (nur Konfiguration + optional E-Mail)
    kind = "supporter" -> ernsthaftes Interesse mit Unterstuetzer-Beitrag (Adresse noetig)

    WICHTIG (Zahlung): Der 50-€-Beitrag wird hier NICHT abgebucht. Fuer echte
    Zahlungen einen Anbieter (Stripe/PayPal/Mollie) einbinden und den Nutzer nach
    dem Speichern zur Checkout-URL weiterleiten. Diese Route legt nur die Anfrage ab.
    """
    data = request.get_json(silent=True) or request.form
    kind = (data.get("kind") or "interest").strip()
    config = data.get("config") or {}
    email = (data.get("email") or "").strip()

    if email and not EMAIL_RE.match(email):
        return jsonify({"ok": False, "error": "Bitte gib eine gültige E-Mail-Adresse ein."}), 400

    record = {"kind": kind, "config": config, "email": email}

    if kind == "supporter":
        # Fuer die Reservierung brauchen wir Name + Lieferadresse fuers Dankeschoen.
        required = {
            "name": (data.get("name") or "").strip(),
            "street": (data.get("street") or "").strip(),
            "zip": (data.get("zip") or "").strip(),
            "city": (data.get("city") or "").strip(),
            "country": (data.get("country") or "").strip(),
        }
        missing = [k for k, v in required.items() if not v]
        if not email:
            missing.append("email")
        if missing:
            return jsonify({"ok": False, "error": "Bitte fülle alle Pflichtfelder aus."}), 400
        record.update(required)
        record["contribution"] = SUPPORTER_CONTRIBUTION

    _append_record(INTEREST_FILE, record)

    if kind == "supporter":
        message = (
            "Danke, dass du die Entwicklung unterstützt! Wir haben deinen Beitrag "
            "notiert und melden uns mit den nächsten Schritten dazu."
        )
    else:
        message = "Danke für dein Interesse! Wir halten dich auf dem Laufenden."
    return jsonify({"ok": True, "message": message})


if __name__ == "__main__":
    app.run(debug=True)
