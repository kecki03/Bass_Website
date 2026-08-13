"""Datenbank-Anbindung (MySQL via SQLAlchemy).

Ersetzt die frueheren JSON-Lines-Dateien. Die Verbindungsdaten kommen aus der
Umgebungsvariable DATABASE_URL (siehe docker-compose.yml). Fuer die lokale
Entwicklung ohne Docker kann sie auf eine eigene MySQL-Instanz zeigen.
"""

import os
import time
from datetime import datetime, timedelta, timezone

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Integer,
    String,
    create_engine,
    distinct,
    func,
)
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import declarative_base, sessionmaker

# Standard passt zur docker-compose.yml. Lokal ggf. per Umgebungsvariable ueberschreiben.
DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "mysql+pymysql://bass:basspass@localhost:3306/bass?charset=utf8mb4",
)

# pool_pre_ping faengt abgelaufene Verbindungen ab (wichtig, wenn der DB-Container
# neu startet); pool_recycle erneuert Verbindungen regelmaessig.
engine = create_engine(
    DATABASE_URL, pool_pre_ping=True, pool_recycle=3600, future=True
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, future=True)
Base = declarative_base()


def _now():
    return datetime.now(timezone.utc)


class NewsletterSignup(Base):
    """Anmeldung fuer die Release-Benachrichtigung."""

    __tablename__ = "newsletter_signups"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(255), nullable=False)
    consent = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=_now)


class InterestSubmission(Base):
    """Interessensbekundung aus dem Konfigurator (inkl. Unterstuetzer-Anfragen)."""

    __tablename__ = "interest_submissions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    kind = Column(String(32), nullable=False, default="interest")
    email = Column(String(255))
    config = Column(JSON)
    # Nur bei kind == "supporter" gefuellt:
    name = Column(String(255))
    street = Column(String(255))
    zip = Column(String(32))
    city = Column(String(255))
    country = Column(String(128))
    contribution = Column(Integer)
    created_at = Column(DateTime, default=_now)


class PageView(Base):
    """Ein anonymer Seitenaufruf fuer die Eigen-Analytics (cookielos).

    Es werden KEINE personenbezogenen Daten gespeichert: `visitor` ist ein
    taeglich rotierender Hash (IP+UA+Salt+Datum) – keine Wiedererkennung ueber
    Tage hinweg, keine IP-Speicherung. `country` wird offline aus der IP
    abgeleitet (die IP selbst wird nicht gespeichert). `referrer` ist nur die
    Quell-Domain.
    """

    __tablename__ = "page_views"

    id = Column(Integer, primary_key=True, autoincrement=True)
    created_at = Column(DateTime, default=_now, index=True)
    path = Column(String(255))
    referrer = Column(String(255))      # nur Domain, z.B. "instagram.com"; None = direkt
    country = Column(String(2))         # ISO-Laendercode, z.B. "DE"
    device = Column(String(16))         # "mobile" | "tablet" | "desktop"
    visitor = Column(String(64), index=True)  # taeglich rotierender Anonym-Hash


def init_db(retries=15, delay=3):
    """Legt die Tabellen an. Wartet, bis MySQL erreichbar ist (Docker-Start)."""
    for attempt in range(1, retries + 1):
        try:
            Base.metadata.create_all(engine)
            return
        except OperationalError:
            if attempt == retries:
                raise
            print(f"[db] MySQL noch nicht bereit (Versuch {attempt}/{retries}) – warte {delay}s ...")
            time.sleep(delay)


def add_newsletter(email, consent):
    with SessionLocal() as session:
        session.add(NewsletterSignup(email=email, consent=bool(consent)))
        session.commit()


def add_interest(record):
    """record ist ein dict mit den Feldern aus der Route (kind, config, email, ...)."""
    with SessionLocal() as session:
        session.add(InterestSubmission(**record))
        session.commit()


def delete_newsletter(signup_id):
    """Loescht eine Newsletter-Anmeldung. Gibt True zurueck, wenn etwas geloescht wurde."""
    with SessionLocal() as session:
        obj = session.get(NewsletterSignup, signup_id)
        if obj is None:
            return False
        session.delete(obj)
        session.commit()
        return True


def delete_interest(submission_id):
    """Loescht eine Interessensbekundung. Gibt True zurueck, wenn etwas geloescht wurde."""
    with SessionLocal() as session:
        obj = session.get(InterestSubmission, submission_id)
        if obj is None:
            return False
        session.delete(obj)
        session.commit()
        return True


def get_newsletter_signups():
    """Alle Newsletter-Anmeldungen als Liste von dicts (neueste zuerst)."""
    with SessionLocal() as session:
        rows = (
            session.query(NewsletterSignup)
            .order_by(NewsletterSignup.created_at.desc(), NewsletterSignup.id.desc())
            .all()
        )
        return [
            {
                "id": r.id,
                "email": r.email,
                "consent": r.consent,
                "created_at": r.created_at,
            }
            for r in rows
        ]


def get_interest_submissions():
    """Alle Interessensbekundungen als Liste von dicts (neueste zuerst)."""
    with SessionLocal() as session:
        rows = (
            session.query(InterestSubmission)
            .order_by(InterestSubmission.created_at.desc(), InterestSubmission.id.desc())
            .all()
        )
        return [
            {
                "id": r.id,
                "kind": r.kind,
                "email": r.email,
                "config": r.config,
                "name": r.name,
                "street": r.street,
                "zip": r.zip,
                "city": r.city,
                "country": r.country,
                "contribution": r.contribution,
                "created_at": r.created_at,
            }
            for r in rows
        ]


# ---------------------------------------------------------------------------
# Analytics (cookielose Eigen-Statistik)
# ---------------------------------------------------------------------------
def add_page_view(path=None, referrer=None, country=None, device=None, visitor=None):
    with SessionLocal() as session:
        session.add(PageView(
            path=(path[:255] if path else None),
            referrer=(referrer[:255] if referrer else None),
            country=(country[:2] if country else None),
            device=(device[:16] if device else None),
            visitor=(visitor[:64] if visitor else None),
        ))
        session.commit()


def _naive(dt):
    """Zeitzonenlose UTC-Zeit (passend zu den in MySQL naiv gespeicherten Werten)."""
    return dt.replace(tzinfo=None) if dt.tzinfo else dt


def _period_stats(session, days):
    cutoff = _naive(_now()) - timedelta(days=days)
    views = session.query(func.count(PageView.id)).filter(PageView.created_at >= cutoff).scalar() or 0
    visitors = session.query(func.count(distinct(PageView.visitor))).filter(
        PageView.created_at >= cutoff).scalar() or 0
    return {"views": views, "visitors": visitors}


def get_analytics(detail_days=30, series_days=14):
    """Alle Kennzahlen fuer das Admin-Analytics-Panel in einem dict."""
    with SessionLocal() as session:
        cutoff = _naive(_now()) - timedelta(days=detail_days)
        recent = PageView.created_at >= cutoff

        def top(col, limit, extra=None):
            q = session.query(col, func.count(PageView.id)).filter(recent)
            if extra is not None:
                q = q.filter(extra)
            return [(v, n) for v, n in
                    q.group_by(col).order_by(func.count(PageView.id).desc()).limit(limit).all()]

        top_paths = top(PageView.path, 10)
        top_referrers = top(PageView.referrer, 10,
                            (PageView.referrer.isnot(None)) & (PageView.referrer != ""))
        top_countries = top(PageView.country, 15, PageView.country.isnot(None))
        devices = top(PageView.device, 5)

        # Taeglicher Verlauf (letzte series_days Tage), fehlende Tage mit 0 auffuellen
        today = _naive(_now()).date()
        start = today - timedelta(days=series_days - 1)
        rows = (session.query(func.date(PageView.created_at), func.count(PageView.id))
                .filter(PageView.created_at >= datetime(start.year, start.month, start.day))
                .group_by(func.date(PageView.created_at)).all())
        by_day = {str(d): n for d, n in rows}
        series = []
        for i in range(series_days - 1, -1, -1):
            day = today - timedelta(days=i)
            series.append((day.strftime("%d.%m."), by_day.get(str(day), 0)))

        # Konfigurator-Nutzung (eindeutige Besucher, die den Konfigurator geoeffnet haben)
        konf_visitors = session.query(func.count(distinct(PageView.visitor))).filter(
            recent, PageView.path.like("%konfigurator%")).scalar() or 0
        interest_recent = session.query(func.count(InterestSubmission.id)).filter(
            InterestSubmission.created_at >= cutoff).scalar() or 0

        return {
            "today": _period_stats(session, 1),
            "d7": _period_stats(session, 7),
            "d30": _period_stats(session, 30),
            "top_paths": top_paths,
            "top_referrers": top_referrers,
            "top_countries": top_countries,
            "devices": devices,
            "series": series,
            "series_max": max([n for _, n in series] + [1]),
            "detail_days": detail_days,
            "konf_visitors": konf_visitors,
            "interest_recent": interest_recent,
        }
