"""
Обработчики для бота
"""
from .start import start_handler
from .menu import menu_handler
from .admin import admin_panel_handler
from .reply_buttons import reply_button_handler

__all__ = ['start_handler', 'menu_handler', 'admin_panel_handler', 'reply_button_handler']
