"""Datenbank-Anbindung (MySQL via SQLAlchemy).

Ersetzt die frueheren JSON-Lines-Dateien. Die Verbindungsdaten kommen aus der
Umgebungsvariable DATABASE_URL (siehe docker-compose.yml). Fuer die lokale
Entwicklung ohne Docker kann sie auf eine eigene MySQL-Instanz zeigen.
"""

import os
import time
from datetime import datetime, timezone

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Integer,
    String,
    create_engine,
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
