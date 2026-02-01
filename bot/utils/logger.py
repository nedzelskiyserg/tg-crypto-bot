"""
Настройка логирования
"""
import logging
import sys
from shared.config import Config


def setup_logger(name: str = __name__) -> logging.Logger:
    """
    Настраивает и возвращает логгер
    
    Args:
        name: Имя логгера
        
    Returns:
        Настроенный логгер
    """
    logger = logging.getLogger(name)
    
    # Устанавливаем уровень логирования
    log_level = getattr(logging, Config.LOG_LEVEL.upper(), logging.INFO)
    logger.setLevel(log_level)
    
    # Если у логгера уже есть обработчики, не добавляем новые
    if logger.handlers:
        return logger
    
    # Создаем обработчик для консоли
    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(log_level)
    
    # Создаем форматтер
    formatter = logging.Formatter(Config.LOG_FORMAT)
    handler.setFormatter(formatter)
    
    # Добавляем обработчик к логгеру
    logger.addHandler(handler)
    
    return logger
