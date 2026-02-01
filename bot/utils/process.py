"""
Утилиты для работы с процессами
"""
import os
import subprocess
import logging

logger = logging.getLogger(__name__)


def check_running_processes(process_name: str = 'main.py') -> bool:
    """
    Проверяет, не запущен ли уже экземпляр процесса
    
    Args:
        process_name: Имя процесса для проверки
        
    Returns:
        True, если найдены другие запущенные экземпляры
    """
    try:
        # Проверяем процессы Python, запущенные с указанным файлом
        result = subprocess.run(
            ['pgrep', '-f', f'python.*{process_name}'],
            capture_output=True,
            text=True
        )
        if result.returncode == 0:
            pids = result.stdout.strip().split('\n')
            # Исключаем текущий процесс
            current_pid = str(os.getpid())
            other_pids = [pid for pid in pids if pid and pid != current_pid]
            if other_pids:
                logger.warning(f"Обнаружены другие запущенные экземпляры (PID: {', '.join(other_pids)})")
                logger.warning("Остановите их перед запуском нового экземпляра")
                return True
    except Exception as e:
        logger.debug(f"Не удалось проверить процессы: {e}")
    return False
