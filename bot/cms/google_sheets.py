"""
Модуль для работы с CMS через Google Sheets
Парсит Google Sheets и формирует динамическое меню для бота
"""
import os
import logging
from typing import Dict, List, Optional
import gspread
from google.oauth2.service_account import Credentials
from shared.config import Config
from .base import MenuItem, CMS

logger = logging.getLogger(__name__)


class GoogleSheetsCMS(CMS):
    """Класс для управления контентом из Google Sheets"""
    
    def __init__(self, spreadsheet_id: str = None, credentials_path: str = None):
        """
        Инициализация CMS для Google Sheets
        
        Args:
            spreadsheet_id: ID Google таблицы (из URL)
            credentials_path: Путь к JSON файлу с credentials сервисного аккаунта
        """
        self.spreadsheet_id = spreadsheet_id or Config.GOOGLE_SHEETS_ID
        credentials_path = credentials_path or Config.GOOGLE_CREDENTIALS_PATH
        
        if not self.spreadsheet_id:
            raise ValueError("GOOGLE_SHEETS_ID не указан. Укажите в .env или передайте как параметр")
        
        if not os.path.exists(credentials_path):
            raise FileNotFoundError(
                f"Файл credentials не найден: {credentials_path}\n"
                "Создайте Service Account в Google Cloud и скачайте JSON ключ"
            )
        
        # Инициализируем клиент Google Sheets
        try:
            scope = [
                'https://spreadsheets.google.com/feeds',
                'https://www.googleapis.com/auth/drive'
            ]
            creds = Credentials.from_service_account_file(credentials_path, scopes=scope)
            self.client = gspread.authorize(creds)
            self.spreadsheet = self.client.open_by_key(self.spreadsheet_id)
            
        except Exception as e:
            logger.error(f"Ошибка при подключении к Google Sheets: {e}")
            raise
        
        self.menu_items: Dict[str, MenuItem] = {}
        self.welcome_message: str = ""
        self.admins: List[str] = []  # Список ID админов
        self.load_all_data()
    
    def load_settings(self) -> None:
        """Загружает настройки из листа Settings"""
        try:
            try:
                settings_sheet = self.spreadsheet.worksheet("Settings")
            except gspread.exceptions.WorksheetNotFound:
                logger.debug("Лист 'Settings' не найден, используем значения по умолчанию")
                return
            
            all_values = settings_sheet.get_all_values()
            if not all_values:
                return
            
            # Ищем настройки (welcome, admins)
            for row in all_values:
                if len(row) >= 2:
                    key = str(row[0]).strip().lower() if row[0] else ""
                    value = str(row[1]).strip() if len(row) > 1 and row[1] else ""
                    
                    if key in ['welcome', 'приветствие', 'welcome_message', 'приветственное сообщение']:
                        if value:
                            self.welcome_message = value
                            logger.info("Приветственное сообщение загружено из Settings")
                    
                    elif key in ['admins', 'админы', 'admin', 'админ']:
                        if value:
                            # Парсим ID админов через запятую
                            self.admins = [admin_id.strip() for admin_id in value.split(',') if admin_id.strip()]
                            logger.info(f"Загружено {len(self.admins)} админов из Settings")
            
        except Exception as e:
            logger.warning(f"Ошибка при загрузке настроек: {e}")
    
    def load_menu_from_sheet(self, worksheet) -> int:
        """
        Загружает меню из одного листа
        
        Args:
            worksheet: Лист Google Sheets
        
        Returns:
            Количество загруженных элементов
        """
        loaded_count = 0
        try:
            all_values = worksheet.get_all_values()
            
            if not all_values or len(all_values) < 2:
                return 0
            
            # Определяем индексы столбцов по заголовкам
            headers = [str(h).strip().lower() if h else "" for h in all_values[0]]
            
            # Ищем индексы столбцов
            col_id = headers.index("id") if "id" in headers else 0
            col_name = headers.index("название") if "название" in headers else (headers.index("name") if "name" in headers else 1)
            col_parent = headers.index("родитель id") if "родитель id" in headers else (headers.index("parent id") if "parent id" in headers else (headers.index("родитель") if "родитель" in headers else 2))
            col_type = headers.index("тип") if "тип" in headers else (headers.index("type") if "type" in headers else 3)
            col_text = headers.index("текст") if "текст" in headers else (headers.index("text") if "text" in headers else 4)
            col_callback = headers.index("callback data") if "callback data" in headers else (headers.index("callback") if "callback" in headers else 5)
            col_order = headers.index("порядок") if "порядок" in headers else (headers.index("order") if "order" in headers else 6)
            col_group = headers.index("группа") if "группа" in headers else (headers.index("group") if "group" in headers else -1)
            
            # Пропускаем заголовок (первая строка)
            for row in all_values[1:]:
                if not row or len(row) < 2 or not row[0] or not row[1]:
                    continue
                
                try:
                    # Используем определенные индексы столбцов
                    def get_cell(index, default=""):
                        return str(row[index]).strip() if len(row) > index and row[index] else default
                    
                    item_id = get_cell(col_id)
                    name = get_cell(col_name)
                    
                    if not item_id or not name:
                        continue
                    
                    # Родитель ID
                    parent_id_str = get_cell(col_parent)
                    parent_id = None
                    if parent_id_str and parent_id_str.lower() not in ['', 'none', 'null']:
                        # Проверяем, что это не тип меню
                        if parent_id_str.lower() not in ['mess_button', 'button', 'message', 'reply_button', 'reply_button_line']:
                            parent_id = parent_id_str
                    
                    # Тип
                    type_str = get_cell(col_type).lower()
                    menu_type = 'mess_button'  # По умолчанию
                    if type_str in ['mess_button', 'message', 'reply_button', 'reply_button_line', 'button']:
                        # Поддержка старого типа 'button' для обратной совместимости
                        if type_str == 'button':
                            menu_type = 'mess_button'
                        else:
                            menu_type = type_str
                    elif not type_str:
                        menu_type = 'mess_button'  # По умолчанию
                    
                    # Текст
                    text = get_cell(col_text)
                    
                    # Callback Data
                    callback_data = get_cell(col_callback)
                    if not callback_data:
                        callback_data = f"menu_{item_id}"
                    
                    # Порядок
                    order_str = get_cell(col_order)
                    order = 0
                    if order_str:
                        try:
                            order = int(order_str)
                        except ValueError:
                            order = 0
                    
                    # Группа (для reply_button_line)
                    group = None
                    if col_group >= 0:
                        group_str = get_cell(col_group)
                        if group_str:
                            group = group_str.strip()
                    
                    # Обработка parent_id - может быть пустым или содержать ID
                    if parent_id and parent_id.lower() in ['', 'none', 'null']:
                        parent_id = None
                    
                    item = MenuItem(
                        id=item_id,
                        name=name,
                        parent_id=parent_id,
                        menu_type=menu_type,
                        text=text,
                        callback_data=callback_data,
                        order=order,
                        group=group
                    )
                    
                    # Проверяем, не существует ли уже элемент с таким ID
                    if item.id in self.menu_items:
                        logger.warning(f"Дублирующийся ID '{item.id}' найден в листе '{worksheet.title}'. Используется последний.")
                    
                    self.menu_items[item.id] = item
                    loaded_count += 1
                    
                except Exception as e:
                    logger.error(f"Ошибка при обработке строки в листе '{worksheet.title}': {e}")
                    continue
            
        except Exception as e:
            logger.error(f"Ошибка при загрузке листа '{worksheet.title}': {e}")
        
        return loaded_count
    
    def load_all_data(self) -> None:
        """Загружает все данные из всех листов Google Sheets"""
        try:
            # Сначала загружаем настройки
            self.load_settings()
            
            # Получаем все листы
            all_worksheets = self.spreadsheet.worksheets()
            
            # Исключаем лист Settings из парсинга меню
            menu_sheets = [ws for ws in all_worksheets if ws.title.lower() not in ['settings', 'настройки']]
            
            if not menu_sheets:
                logger.warning("Не найдено листов с меню")
                return
            
            total_loaded = 0
            for worksheet in menu_sheets:
                logger.info(f"Загрузка листа: {worksheet.title}")
                loaded = self.load_menu_from_sheet(worksheet)
                total_loaded += loaded
                logger.info(f"Загружено {loaded} элементов из листа '{worksheet.title}'")
            
            logger.info(f"Всего загружено {total_loaded} пунктов меню из {len(menu_sheets)} листов")
            
            # Проверяем целостность данных (все parent_id должны существовать)
            self.validate_menu_structure()
            
        except Exception as e:
            logger.error(f"Ошибка при загрузке данных из Google Sheets: {e}")
            raise
    
    def validate_menu_structure(self) -> None:
        """Проверяет целостность структуры меню (все parent_id должны существовать)"""
        missing_parents = []
        for item_id, item in self.menu_items.items():
            if item.parent_id and item.parent_id not in self.menu_items:
                missing_parents.append((item_id, item.parent_id))
        
        if missing_parents:
            logger.warning(f"Найдено {len(missing_parents)} элементов с несуществующими parent_id:")
            for item_id, parent_id in missing_parents[:5]:  # Показываем первые 5
                logger.warning(f"  - ID '{item_id}' ссылается на несуществующий parent_id '{parent_id}'")
    
    def get_welcome_message(self) -> str:
        """Получает приветственное сообщение"""
        if self.welcome_message:
            return self.welcome_message
        # Значение по умолчанию
        return (
            "Добро пожаловать в Mosca\n\n"
            "📍 Москва, Пресненская набережная 12, Башня Федерация. Восток, этаж 11\n\n"
            "📅 Мы работаем для вас 24/7. Без обеда и выходных.\n\n"
            "💵 Мы работаем только за наличные рубли.\n\n"
            "💹 Самый низкий курс на покупку USDT и лучший курс покупки USDT в Москве.\n\n"
            "🤑 Отсутствие каких либо комиссии на покупку и продажу USDT\n\n"
            "Выберите раздел из меню:"
        )
    
    def is_admin(self, user_id: int) -> bool:
        """Проверяет, является ли пользователь админом"""
        return str(user_id) in self.admins
    
    def reload_menu(self) -> None:
        """Перезагружает меню из Google Sheets"""
        logger.info("Начинается перезагрузка меню из Google Sheets...")
        self.menu_items.clear()
        self.welcome_message = ""
        self.admins = []
        self.load_all_data()
        logger.info("Меню успешно перезагружено")
