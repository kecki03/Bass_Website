"""E-Mail-Benachrichtigungen bei neuen Eintraegen (Newsletter / Interessenten).

Sobald sich jemand ueber die Website eintraegt, verschickt dieses Modul eine
kurze Info-Mail an den Betreiber. Der Versand ist bewusst "best effort":

* Ist kein SMTP konfiguriert, passiert einfach nichts (die App laeuft normal).
* Der Versand laeuft in einem Hintergrund-Thread, damit der Besucher nie auf
  den Mailserver warten muss.
* Jeder Fehler wird nur geloggt, niemals an den Besucher durchgereicht – eine
  fehlgeschlagene Mail darf die Anmeldung nie scheitern lassen.

Konfiguration ueber Umgebungsvariablen:
    SMTP_HOST         z.B. smtp.gmail.com
    SMTP_PORT         587 (STARTTLS, Standard) oder 465 (SSL)
    SMTP_USER         Login (bei Gmail die volle Adresse)
    SMTP_PASSWORD     App-Passwort (bei Gmail: Google-Konto -> Sicherheit ->
                      App-Passwoerter; NICHT das normale Google-Passwort)
    NOTIFY_EMAIL_TO   Empfaenger der Benachrichtigung
    NOTIFY_EMAIL_FROM (optional) Absender; Default = SMTP_USER
"""

import os
import smtplib
import ssl
import threading
from email.message import EmailMessage
from email.utils import formatdate

SMTP_HOST = os.environ.get("SMTP_HOST", "")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587") or "587")
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
NOTIFY_EMAIL_TO = os.environ.get("NOTIFY_EMAIL_TO", "")
NOTIFY_EMAIL_FROM = os.environ.get("NOTIFY_EMAIL_FROM") or SMTP_USER


def notifications_enabled():
    """True, wenn genug konfiguriert ist, um ueberhaupt senden zu koennen."""
    return bool(SMTP_HOST and SMTP_USER and SMTP_PASSWORD and NOTIFY_EMAIL_TO)


def _send_sync(subject, body):
    """Blockierender Versand einer einzelnen Mail. Nur intern (Thread) genutzt."""
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = NOTIFY_EMAIL_FROM
    msg["To"] = NOTIFY_EMAIL_TO
    msg["Date"] = formatdate(localtime=True)
    msg.set_content(body)

    if SMTP_PORT == 465:
        # Implizites SSL (Port 465).
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, context=context, timeout=15) as smtp:
            smtp.login(SMTP_USER, SMTP_PASSWORD)
            smtp.send_message(msg)
    else:
        # STARTTLS (Port 587, Standard).
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as smtp:
            smtp.starttls(context=ssl.create_default_context())
            smtp.login(SMTP_USER, SMTP_PASSWORD)
            smtp.send_message(msg)


def _send_worker(subject, body):
    try:
        _send_sync(subject, body)
    except Exception as exc:  # noqa: BLE001 – Benachrichtigung darf nie hart failen
        # Bewusst nur loggen: der Besucher hat sich bereits erfolgreich eingetragen.
        print(f"[mailer] Benachrichtigung fehlgeschlagen: {exc}")


def send_notification(subject, body):
    """Verschickt eine Benachrichtigung im Hintergrund (nicht blockierend).

    Ist nichts konfiguriert, kehrt die Funktion sofort zurueck.
    """
    if not notifications_enabled():
        return
    threading.Thread(
        target=_send_worker, args=(subject, body), daemon=True
    ).start()
