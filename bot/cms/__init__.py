"""
Модули CMS для бота
"""
from .base import CMS, MenuItem
from .google_sheets import GoogleSheetsCMS

__all__ = ['CMS', 'MenuItem', 'GoogleSheetsCMS']
