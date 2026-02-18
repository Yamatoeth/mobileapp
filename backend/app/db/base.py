"""Declarative base for SQLAlchemy models.
This module exists so Alembic can import `Base` without creating engines.
"""
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models."""
    pass
