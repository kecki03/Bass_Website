import os
import re
import secrets
from datetime import timedelta

from flask import Flask, render_template, jsonify, request, send_from_directory

import db
import mailer
from admin import admin_bp, format_config

app = Flask(__name__)

# ---------------------------------------------------------------------------
# Sicherheit / Sessions.
# SECRET_KEY signiert die Session-Cookies (Login). In Produktion MUSS
# FLASK_SECRET_KEY gesetzt sein – sonst bekommt jeder gunicorn-Worker einen
# eigenen Zufallsschluessel und Logins gehen zwischen den Workern verloren.
# ---------------------------------------------------------------------------
app.secret_key = os.environ.get("FLASK_SECRET_KEY") or secrets.token_hex(32)
_is_prod = os.environ.get("FLASK_ENV") == "production" or not app.debug

app.config.update(
    SESSION_COOKIE_HTTPONLY=True,          # kein JS-Zugriff aufs Cookie
    SESSION_COOKIE_SAMESITE="Lax",         # CSRF-Grundschutz beim Cookie-Versand
    SESSION_COOKIE_SECURE=_is_prod,        # in Prod nur ueber HTTPS senden
    PERMANENT_SESSION_LIFETIME=timedelta(hours=8),
    MAX_CONTENT_LENGTH=1 * 1024 * 1024,    # 1 MB Request-Limit
)

app.register_blueprint(admin_bp)

# Datenbank-Tabellen beim Start anlegen (wartet, bis MySQL erreichbar ist).
db.init_db()

# ---------------------------------------------------------------------------
# Entwicklungsphase-Schalter.
# Solange True, zeigen wir noch keine Preise und keinen Warenkorb, sondern nur
# Newsletter-Anmeldung und Interessensbekundung.
# ---------------------------------------------------------------------------
DEV_PHASE = True

# Freiwillige Spende ueber PayPal. WICHTIG (rechtlich): Es gibt bewusst KEINE
# Gegenleistung (kein Geschenk, keine Vorbestellung, kein Anspruch auf den Bass) –
# nur so bleibt es eine echte freiwillige Zuwendung und kein anmeldepflichtiger
# Verkauf/Crowdfunding-Beitrag. Der Betrag ist frei und wird direkt bei PayPal
# eingegeben; diese App bucht nichts ab.
#
# >>> HIER deinen PayPal.me-/Spendenlink eintragen: <<<
PAYPAL_DONATE_URL = "https://www.paypal.com/paypalme/DEINPAYPAL"

# Basispreis des Basses in Euro (waehrend der Entwicklungsphase nicht sichtbar)
BASE_PRICE = 1299

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

# Konfigurator-Optionen. Jede Option hat einen Aufpreis (delta) zum Basispreis.
# Die Farb-Optionen tragen zusaetzlich CSS-Filterwerte, mit denen das Produktfoto
# live umgefaerbt wird (hue = Farbrotation in Grad, sat = Saettigung).
OPTIONS = {
    "neck": {
        "label": "Hals",
        # Aktuell nur eine Ausfuehrung (Dr. Parts); weitere Hals-Optionen folgen.
        # color = Holz-Tönung, die im 3D-Modell auf die Holztextur gelegt wird.
        "note": "Weitere Hals-Optionen folgen in Kürze.",
        "choices": [
            {"id": "drparts", "name": "Dr. Parts: Palisander", "delta": 0, "color": "#e8c79a"},
        ],
    },
    "metal_brand": {
        "label": "Metallteile",
        # Marke der Metallteile (Bridge, Tuners, Knobs, Output-Jack). Bestimmt zusammen
        # mit der Farbe den Preis (siehe PRICING["metal"]). Harley Benton: nur
        # Chrom/Schwarz. Gotoh: Chrom/Schwarz/Gold (Gold wird im JS nur bei Gotoh gezeigt).
        "choices": [
            {"id": "harley_benton", "name": "Harley Benton", "delta": 0},
            {"id": "gotoh", "name": "Gotoh", "delta": 0},
        ],
    },
    "pickups": {
        "label": "Pick-Ups",
        "choices": [
            {"id": "seymour", "name": "Seymour Duncan SPB-3", "delta": 0, "price": 110},
            {"id": "emg", "name": "EMG Geezer Butler PHZ", "delta": 0, "price": 91},
        ],
    },
    "potis": {
        "label": "Potentiometer",
        "choices": [
            {"id": "allparts", "name": "Allparts 500kΩ", "delta": 0, "price": 26},
            {"id": "bareknuckle", "name": "Bare Knuckle 550kΩ", "delta": 0, "price": 34},
        ],
    },
    "body": {
        "label": "Korpus · Dual-Color-Filament",
        # Echte Dual-Color-Silk-Filamente von 3DJake. color = Farbe frontal,
        # color2 = Farbe im flachen Winkel; der Verlauf entsteht im 3D-Viewer.
        # url = Produktseite zum Ansehen/Kaufen.
        "choices": [
            {"id": "silk_blue_magenta", "name": "Silk Blue Magenta", "delta": 0, "swatch": "linear-gradient(135deg,#e21d93,#1c4fd6)", "color": "#e21d93", "color2": "#1c4fd6", "url": "https://www.3djake.de/elegoo/pla-silk-blue-magenta"},
            {"id": "blue_hawaii", "name": "Blue Hawaii", "delta": 0, "swatch": "linear-gradient(135deg,#1e5fd6,#16b98a)", "color": "#1e5fd6", "color2": "#16b98a", "url": "https://www.3djake.de/bambu-lab/pla-silk-dual-color-blue-hawaii"},
            {"id": "velvet_eclipse", "name": "Velvet Eclipse", "delta": 60, "swatch": "linear-gradient(135deg,#cc2030,#17131b)", "color": "#cc2030", "color2": "#17131b", "url": "https://www.3djake.de/bambu-lab/pla-silk-dual-color-velvet-eclipse"},
            {"id": "red_gold", "name": "Red Gold", "delta": 30, "swatch": "linear-gradient(135deg,#cf1f28,#e6b23a)", "color": "#cf1f28", "color2": "#e6b23a", "url": "https://www.3djake.de/sunlu/silk-pla-dual-color-red-gold"},
            {"id": "midnight_blaze", "name": "Midnight Blaze", "delta": 60, "swatch": "linear-gradient(135deg,#1e326e,#ff5030)", "color": "#1e326e", "color2": "#ff5030", "url": "https://www.3djake.de/bambu-lab/pla-silk-dual-color-midnight-blaze"},
            {"id": "black_gold", "name": "Black Gold", "delta": 30, "swatch": "linear-gradient(135deg,#17171a,#e0b23a)", "color": "#17171a", "color2": "#e0b23a", "url": "https://www.3djake.de/sunlu/silk-pla-dual-color-black-gold"},
            {"id": "pink_gold", "name": "Pink Gold", "delta": 30, "swatch": "linear-gradient(135deg,#e84f9a,#e6b23a)", "color": "#e84f9a", "color2": "#e6b23a", "url": "https://www.3djake.de/sunlu/silk-pla-dual-color-pink-gold"},
            {"id": "south_beach", "name": "South Beach", "delta": 60, "swatch": "linear-gradient(135deg,#ff4d94,#23c0d0)", "color": "#ff4d94", "color2": "#23c0d0", "url": "https://www.3djake.de/bambu-lab/pla-silk-south-beach"},
            {"id": "black_blue", "name": "Black Blue", "delta": 30, "swatch": "linear-gradient(135deg,#16161c,#1f5fd6)", "color": "#16161c", "color2": "#1f5fd6", "url": "https://www.3djake.de/sunlu/silk-pla-dual-color-black-blue"},
            {"id": "black_green", "name": "Black Green", "delta": 30, "swatch": "linear-gradient(135deg,#14161a,#1fb85f)", "color": "#14161a", "color2": "#1fb85f", "url": "https://www.3djake.de/sunlu/silk-pla-dual-color-black-green"},
            {"id": "black_purple", "name": "Black Purple", "delta": 30, "swatch": "linear-gradient(135deg,#16121c,#7a2fd6)", "color": "#16121c", "color2": "#7a2fd6", "url": "https://www.3djake.de/sunlu/silk-pla-dual-color-black-purple"},
            {"id": "blue_green", "name": "Blue Green", "delta": 30, "swatch": "linear-gradient(135deg,#1f6fd6,#17b98a)", "color": "#1f6fd6", "color2": "#17b98a", "url": "https://www.3djake.de/sunlu/silk-pla-dual-color-blue-green"},
            {"id": "green_purple", "name": "Green Purple", "delta": 30, "swatch": "linear-gradient(135deg,#1fb85f,#7a2fd6)", "color": "#1fb85f", "color2": "#7a2fd6", "url": "https://www.3djake.de/sunlu/silk-pla-dual-color-green-purple"},
            {"id": "black_white", "name": "Black White", "delta": 30, "swatch": "linear-gradient(135deg,#17171a,#e8e8ee)", "color": "#17171a", "color2": "#e8e8ee", "url": "https://www.3djake.de/sunlu/silk-pla-dual-color-black-white"},
            {"id": "crimson_steel", "name": "Crimson Steel", "delta": 40, "swatch": "linear-gradient(135deg,#b21f2a,#8a9099)", "color": "#b21f2a", "color2": "#8a9099", "url": "https://www.3djake.de/azurefilm/pla-silk-dual-color-crimson-steel"},
            {"id": "golden_shadow", "name": "Golden Shadow", "delta": 40, "swatch": "linear-gradient(135deg,#e0a63a,#2a2620)", "color": "#e0a63a", "color2": "#2a2620", "url": "https://www.3djake.de/azurefilm/pla-silk-dual-color-golden-shadow"},
            {"id": "black_red", "name": "Black Red", "delta": 30, "swatch": "linear-gradient(135deg,#17141a,#d81f2a)", "color": "#17141a", "color2": "#d81f2a", "url": "https://www.3djake.de/anycubic/pla-silk-dual-color-black-red"},
        ],
    },
    "hardware": {
        "label": "Farbe der Metallteile",
        # color/metallic/rough = Metall-Look der Hardware im 3D-Modell.
        "choices": [
            {"id": "chrome", "name": "Chrom", "delta": 0, "swatch": "linear-gradient(135deg,#e9edf2,#9aa3ad)", "color": "#c9ccd2", "metallic": 1, "rough": 0.12},
            {"id": "black", "name": "Schwarz", "delta": 40, "swatch": "linear-gradient(135deg,#3a3a3f,#0d0d10)", "color": "#0e0e12", "metallic": 1, "rough": 0.5},
            {"id": "gold", "name": "Gold", "delta": 90, "swatch": "linear-gradient(135deg,#ffd97a,#c79320)", "color": "#ffcf5a", "metallic": 1, "rough": 0.22},
        ],
    },
}

# Anzeige-Reihenfolge im Konfigurator: zuerst die Farbe (Korpus), dann die
# Metallteil-Marke + Farbe, Pickups, Potis, Hals. dict behaelt ab Python 3.7 die
# Einfuegereihenfolge.
OPTIONS = {k: OPTIONS[k] for k in ("body", "metal_brand", "hardware", "pickups", "potis", "neck")}

# ---------------------------------------------------------------------------
# Preis-Kalkulation (Quelle: Kalkulations-Tabelle).
# Metallteile-Preis haengt von Marke UND Farbe ab (Bridge + Tuners + 2x Knobs +
# Output-Jack; Chrom = Nickel-Jack). Alles in Euro.
#
# Gesamtpreis = (Summe aller Teile + Arbeitszeit + Shipping) * (1 + Gewinn)
#   Teile = Metall + Pickups + Potis + Hals + Fix-Teile (3D-Druck, Schrauben, Saiten)
# ---------------------------------------------------------------------------
PRICING = {
    "metal": {                                   # [Marke][Farbe] -> Summe Metallteile
        "harley_benton": {"chrome": 48, "black": 61},
        "gotoh": {"chrome": 164, "black": 201, "gold": 216},
    },
    "pickups": {"seymour": 110, "emg": 91},
    "potis": {"allparts": 26, "bareknuckle": 34},
    "neck": {"drparts": 69},
    "fixed_parts": 100,   # 3D-Druck 60 + Schrauben/Kabel/Kondensator 20 + Saiten 20
    "labor": 100,         # Arbeitszeit
    "shipping": 30,       # Shipping & Packaging
    "profit": 1.20,       # +20 % Gewinn
}


def compute_price(config):
    """Gesamtpreis (gerundet, Euro) fuer eine Konfiguration.

    config: dict der Auswahl-IDs je Gruppe, z.B.
        {"metal_brand": "gotoh", "hardware": "gold", "pickups": "seymour",
         "potis": "allparts", "neck": "drparts"}
    Fehlt/ungueltig etwas, wird der jeweils erste (guenstigste sinnvolle) Wert genommen.
    """
    brand = config.get("metal_brand") or "harley_benton"
    color = config.get("hardware") or "chrome"
    metal_by_brand = PRICING["metal"].get(brand, PRICING["metal"]["harley_benton"])
    metal = metal_by_brand.get(color, next(iter(metal_by_brand.values())))

    pickups = PRICING["pickups"].get(config.get("pickups"), PRICING["pickups"]["seymour"])
    potis = PRICING["potis"].get(config.get("potis"), PRICING["potis"]["allparts"])
    neck = PRICING["neck"].get(config.get("neck"), PRICING["neck"]["drparts"])

    parts = metal + pickups + potis + neck + PRICING["fixed_parts"]
    total = (parts + PRICING["labor"] + PRICING["shipping"]) * PRICING["profit"]
    return round(total)


@app.route("/")
def home():
    return render_template("index.html", dev_phase=DEV_PHASE)


@app.route("/konfigurator")
def configurator():
    return render_template(
        "configurator.html",
        options=OPTIONS,
        base_price=BASE_PRICE,
        pricing=PRICING,
        dev_phase=DEV_PHASE,
        paypal_donate_url=PAYPAL_DONATE_URL,
    )


@app.route("/robots.txt")
def robots():
    # Aus static/ ausliefern, aber unter der Wurzel-URL /robots.txt erreichbar.
    return send_from_directory(app.static_folder, "robots.txt", mimetype="text/plain")


@app.route("/sitemap.xml")
def sitemap():
    # Aus static/ ausliefern, aber unter der Wurzel-URL /sitemap.xml erreichbar.
    return send_from_directory(app.static_folder, "sitemap.xml", mimetype="application/xml")


@app.route("/impressum")
def impressum():
    return render_template("impressum.html")


@app.route("/datenschutz")
def datenschutz():
    return render_template("datenschutz.html")


@app.route("/api/options")
def api_options():
    return jsonify({"base_price": BASE_PRICE, "options": OPTIONS, "pricing": PRICING})


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

    db.add_newsletter(email=email, consent=consent)

    mailer.send_notification(
        subject="Neue Newsletter-Anmeldung – Layer Instruments",
        body=(
            "Es hat sich jemand fuer den Newsletter angemeldet.\n\n"
            f"E-Mail: {email}\n"
            f"Einwilligung: {'ja' if consent else 'nein'}\n\n"
            "Alle Eintraege siehst du unter https://layerinstruments.com/admin"
        ),
    )
    return jsonify({"ok": True, "message": "Danke! Wir melden uns, sobald es losgeht."})


def _notify_interest(record):
    """Baut die Benachrichtigungs-Mail fuer eine Interessensbekundung und sendet sie."""
    kind = record.get("kind")
    is_supporter = kind == "supporter"
    art = "Unterstuetzer-Anfrage (mit Anschrift)" if is_supporter else "Interessensbekundung"

    lines = [
        f"Neue {art} ueber die Website.",
        "",
        f"E-Mail: {record.get('email') or '– keine angegeben –'}",
    ]

    if is_supporter:
        lines += [
            f"Name: {record.get('name') or ''}",
            f"Adresse: {record.get('street') or ''}, "
            f"{record.get('zip') or ''} {record.get('city') or ''}, "
            f"{record.get('country') or ''}",
        ]

    config_pairs = format_config(record.get("config"))
    if config_pairs:
        lines.append("")
        lines.append("Konfiguration:")
        lines += [f"  - {label}: {value}" for label, value in config_pairs]

    lines += [
        "",
        "Alle Eintraege siehst du unter https://layerinstruments.com/admin",
    ]

    subject = (
        "Neue Unterstuetzer-Anfrage – Layer Instruments"
        if is_supporter
        else "Neue Interessensbekundung – Layer Instruments"
    )
    mailer.send_notification(subject=subject, body="\n".join(lines))


@app.route("/api/interest", methods=["POST"])
def api_interest():
    """Interessensbekundung aus dem Konfigurator.

    kind = "interest"  -> unverbindliches Interesse (nur Konfiguration + optional E-Mail)
    kind = "supporter" -> freiwilliger Kontakt fuer Werbezwecke (Adresse/E-Mail, alles
                          optional). Die Spende selbst laeuft ueber PayPal und wird
                          hier NICHT verarbeitet – diese Route legt nur die (freiwillig)
                          hinterlassenen Kontaktdaten ab.
    """
    data = request.get_json(silent=True) or request.form
    kind = (data.get("kind") or "interest").strip()
    config = data.get("config") or {}
    email = (data.get("email") or "").strip()

    if email and not EMAIL_RE.match(email):
        return jsonify({"ok": False, "error": "Bitte gib eine gültige E-Mail-Adresse ein."}), 400

    record = {"kind": kind, "config": config, "email": email or None}

    if kind == "supporter":
        # Wer die Adresse hinterlegen will, muss Name + komplette Anschrift angeben.
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
            return jsonify({
                "ok": False,
                "error": "Bitte fülle alle Felder aus, dann klappt's mit der Post.",
            }), 400
        record.update(required)

    db.add_interest(record)

    _notify_interest(record)

    if kind == "supporter":
        message = (
            "Danke! Wir melden uns, "
            "wenn es was zu erzählen gibt."
        )
    else:
        message = "Danke für dein Interesse! Wir halten dich auf dem Laufenden."
    return jsonify({"ok": True, "message": message})


if __name__ == "__main__":
    app.run(debug=True)
