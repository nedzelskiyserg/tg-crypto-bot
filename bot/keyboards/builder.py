"""
Модуль для создания клавиатур на основе данных CMS
"""
import logging
from typing import Optional
from aiogram.types import (
    InlineKeyboardButton, 
    InlineKeyboardMarkup,
    ReplyKeyboardMarkup,
    KeyboardButton
)
from aiogram.utils.keyboard import InlineKeyboardBuilder, ReplyKeyboardBuilder

logger = logging.getLogger(__name__)


class MenuKeyboard:
    """Класс для создания клавиатур меню"""
    
    def __init__(self, cms):
        """
        Инициализация
        
        Args:
            cms: Экземпляр CMS (локальный или Google Sheets) для получения данных меню
        """
        self.cms = cms
    
    def build_menu_keyboard(self, parent_id: Optional[str] = None, 
                           back_button: bool = True) -> InlineKeyboardMarkup:
        """
        Создает клавиатуру меню
        
        Args:
            parent_id: ID родительского элемента (None для корневого меню)
            back_button: Показывать ли кнопку "Назад"
        
        Returns:
            InlineKeyboardMarkup с кнопками меню
        """
        builder = InlineKeyboardBuilder()
        
        # Получаем дочерние элементы
        children = self.cms.get_children(parent_id)
        
        if not children:
            # Если нет дочерних элементов, добавляем кнопку "Назад" если нужно
            if back_button and parent_id:
                parent_item = self.cms.get_menu_item(parent_id)
                if parent_item and parent_item.parent_id:
                    builder.add(InlineKeyboardButton(
                        text="◀️ Назад",
                        callback_data=f"menu_back_{parent_item.parent_id}"
                    ))
                elif parent_item:
                    builder.add(InlineKeyboardButton(
                        text="◀️ Назад",
                        callback_data="menu_root"
                    ))
            builder.adjust(1)
            return builder.as_markup()
        
        # Добавляем кнопки меню
        for item in children:
            # Пропускаем reply_button и reply_button_line - они обрабатываются отдельно
            if item.menu_type in ["reply_button", "reply_button_line"]:
                continue
                
            # Определяем иконку в зависимости от типа
            # message теперь тоже отображается как кнопка, но при нажатии отправляет новое сообщение
            icon = "📄" if item.menu_type == "message" else "📁"
            builder.add(InlineKeyboardButton(
                text=f"{icon} {item.name}",
                callback_data=f"menu_{item.id}"
            ))
        
        # Настраиваем количество кнопок в ряду (по умолчанию 1)
        builder.adjust(1)
        
        # Добавляем кнопку "Назад" если нужно
        if back_button and parent_id:
            parent_item = self.cms.get_menu_item(parent_id)
            if parent_item and parent_item.parent_id:
                builder.add(InlineKeyboardButton(
                    text="◀️ Назад",
                    callback_data=f"menu_back_{parent_item.parent_id}"
                ))
            elif parent_item:
                builder.add(InlineKeyboardButton(
                    text="◀️ Назад",
                    callback_data="menu_root"
                ))
        
        return builder.as_markup()
    
    def build_breadcrumbs(self, item_id: str) -> str:
        """
        Создает хлебные крошки (путь навигации)
        
        Args:
            item_id: ID текущего элемента
        
        Returns:
            Строка с хлебными крошками
        """
        path = self.cms.get_menu_path(item_id)
        if not path:
            return ""
        
        breadcrumbs = " / ".join([item.name for item in path])
        return f"📍 {breadcrumbs}"
    
    def build_reply_keyboard(self, parent_id: Optional[str] = None, user_id: Optional[int] = None) -> Optional[ReplyKeyboardMarkup]:
        """
        Создает Reply клавиатуру (кнопки внизу экрана)
        
        Логика группировки:
        - reply_button: каждая кнопка в отдельный ряд
        - reply_button_line: группируются по последовательным порядкам в ряды
          (кнопки с порядком 1-2 → первый ряд, 3-4 → второй ряд, и т.д.)
        
        Args:
            parent_id: ID родительского элемента (None для корневого меню)
            user_id: ID пользователя для проверки прав админа
        
        Returns:
            ReplyKeyboardMarkup с кнопками или None, если нет reply кнопок
        """
        builder = ReplyKeyboardBuilder()
        
        # Получаем дочерние элементы типа reply_button и reply_button_line
        children = self.cms.get_children(parent_id)
        reply_buttons = [item for item in children if item.menu_type in ["reply_button", "reply_button_line"]]
        
        if not reply_buttons:
            return None
        
        # Сортируем по порядку
        reply_buttons = sorted(reply_buttons, key=lambda x: x.order)
        
        # Разделяем на типы
        line_buttons = [item for item in reply_buttons if item.menu_type == "reply_button_line"]
        single_buttons = [item for item in reply_buttons if item.menu_type == "reply_button"]
        
        # Группируем reply_button_line
        # Приоритет: 1) по столбцу "Группа" (если указан), 2) по последовательным порядкам
        line_groups = []
        if line_buttons:
            # Проверяем, есть ли кнопки с указанной группой
            buttons_with_group = [item for item in line_buttons if item.group]
            buttons_without_group = [item for item in line_buttons if not item.group]
            
            # Группируем по явно указанной группе
            if buttons_with_group:
                from collections import defaultdict
                group_dict = defaultdict(list)
                for item in buttons_with_group:
                    group_dict[item.group].append(item)
                
                # Сортируем группы по минимальному порядку в группе
                for group_name in sorted(group_dict.keys(), key=lambda g: min(item.order for item in group_dict[g])):
                    # Сортируем кнопки в группе по порядку
                    sorted_group = sorted(group_dict[group_name], key=lambda x: x.order)
                    line_groups.append(sorted_group)
            
            # Группируем кнопки без группы по последовательным порядкам
            if buttons_without_group:
                buttons_without_group = sorted(buttons_without_group, key=lambda x: x.order)
                if buttons_without_group:
                    current_group = [buttons_without_group[0]]
                    for i in range(1, len(buttons_without_group)):
                        # Если порядок последовательный (разница <= 1), добавляем в текущую группу
                        if buttons_without_group[i].order - buttons_without_group[i-1].order <= 1:
                            current_group.append(buttons_without_group[i])
                        else:
                            # Разрыв в порядке - начинаем новую группу
                            line_groups.append(current_group)
                            current_group = [buttons_without_group[i]]
                    # Добавляем последнюю группу
                    if current_group:
                        line_groups.append(current_group)
        
        # Сортируем все группы по минимальному порядку для правильной последовательности
        line_groups = sorted(line_groups, key=lambda g: min(item.order for item in g))
        
        # Добавляем группы reply_button_line (каждая группа - один ряд)
        for group in line_groups:
            # Создаем кнопки для группы
            buttons = [KeyboardButton(text=item.name) for item in group]
            # Добавляем все кнопки группы в один ряд
            builder.row(*buttons)
        
        # Добавляем одиночные кнопки (каждая в свой ряд)
        for item in single_buttons:
            builder.row(KeyboardButton(text=item.name))
        
        # Добавляем кнопку "Настройки ⚙️" для админов (только в корневое меню)
        if parent_id is None and user_id is not None:
            # Проверяем, является ли пользователь админом
            if hasattr(self.cms, 'is_admin') and self.cms.is_admin(user_id):
                builder.row(KeyboardButton(text="Настройки ⚙️"))
        
        return builder.as_markup(resize_keyboard=True)
