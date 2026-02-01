"""
Обработчик навигации по меню
"""
from aiogram.types import CallbackQuery

# Эти переменные будут установлены из bot/main.py
CMS_INSTANCE = None
MENU_KEYBOARD = None
USE_GOOGLE_SHEETS = False

async def menu_handler(callback: CallbackQuery) -> None:
    """Обработчик навигации по меню"""
    await callback.answer()
    
    # Извлекаем ID элемента меню из callback_data
    # Формат: menu_<id> или menu_back_<id>
    data = callback.data
    
    if data.startswith("menu_back_"):
        # Навигация назад
        parent_id = data.replace("menu_back_", "")
        if parent_id == "root" or not parent_id:
            parent_id = None
    elif data == "menu_root":
        # Возврат в корневое меню
        parent_id = None
    elif data.startswith("menu_"):
        # Переход к элементу меню
        item_id = data.replace("menu_", "")
        menu_item = CMS_INSTANCE.get_menu_item(item_id)
        
        if not menu_item:
            await callback.message.edit_text("❌ Элемент меню не найден")
            return
        
        # Если это сообщение, отправляем новое текстовое сообщение
        if menu_item.menu_type == "message":
            # Выводим только текст из таблицы, без breadcrumbs
            text = menu_item.text
            
            # Получаем кнопки, привязанные к этому сообщению (дочерние элементы)
            # Создаем клавиатуру вручную для правильной кнопки "Назад"
            from aiogram.utils.keyboard import InlineKeyboardBuilder
            from aiogram.types import InlineKeyboardButton
            
            builder = InlineKeyboardBuilder()
            
            # Получаем дочерние элементы message
            message_children = CMS_INSTANCE.get_children(item_id)
            for child in message_children:
                if child.menu_type != "reply_button":
                    icon = "📄" if child.menu_type == "message" else "📁"
                    builder.add(InlineKeyboardButton(
                        text=f"{icon} {child.name}",
                        callback_data=f"menu_{child.id}"
                    ))
            
            # Добавляем кнопку "Назад"
            # Если родитель message - корневой элемент, возвращаем к корневому меню
            if menu_item.parent_id is None:
                builder.add(InlineKeyboardButton(
                    text="◀️ Назад",
                    callback_data="menu_root"
                ))
            else:
                # Проверяем, является ли родитель корневым
                parent_item = CMS_INSTANCE.get_menu_item(menu_item.parent_id)
                if parent_item and parent_item.parent_id is None:
                    # Родитель - корневой элемент, возвращаем к корневому меню
                    builder.add(InlineKeyboardButton(
                        text="◀️ Назад",
                        callback_data="menu_root"
                    ))
                else:
                    # Возвращаем к родителю
                    builder.add(InlineKeyboardButton(
                        text="◀️ Назад",
                        callback_data=f"menu_back_{menu_item.parent_id}"
                    ))
            
            builder.adjust(1)
            keyboard = builder.as_markup()
            
            # Проверяем наличие reply кнопок, привязанных к этому сообщению
            reply_keyboard = MENU_KEYBOARD.build_reply_keyboard(parent_id=item_id, user_id=None)
            
            # Отправляем новое сообщение с reply-кнопками (если есть)
            await callback.message.answer(
                text,
                reply_markup=reply_keyboard if reply_keyboard else (keyboard if keyboard.inline_keyboard else None)
            )
            return
        elif menu_item.menu_type == "mess_button":
            # Если это категория (mess_button), проверяем наличие дочернего message
            children = CMS_INSTANCE.get_children(item_id)
            
            # Ищем дочерний элемент типа message
            # Приоритет: ищем первый message среди дочерних элементов
            child_message = None
            for child in children:
                if child.menu_type == "message":
                    child_message = child
                    break  # Берем первый найденный message
            
            # Если есть дочерний message, сразу отправляем его
            if child_message:
                # Выводим только текст из таблицы, без breadcrumbs
                text = child_message.text
                
                # Получаем кнопки, привязанные к этому message (дочерние элементы message)
                # Создаем клавиатуру вручную, чтобы кнопка "Назад" возвращала к mess_button
                from aiogram.utils.keyboard import InlineKeyboardBuilder
                from aiogram.types import InlineKeyboardButton
                
                builder = InlineKeyboardBuilder()
                
                # Получаем дочерние элементы message (кнопки "Купить", "Продать" и т.д.)
                message_children = CMS_INSTANCE.get_children(child_message.id)
                for child in message_children:
                    # Пропускаем reply кнопки - они обрабатываются отдельно
                    if child.menu_type not in ["reply_button", "reply_button_line"]:
                        icon = "📄" if child.menu_type == "message" else "📁"
                        builder.add(InlineKeyboardButton(
                            text=f"{icon} {child.name}",
                            callback_data=f"menu_{child.id}"
                        ))
                
                # Добавляем кнопку "Назад"
                # Если родитель mess_button - корневой элемент, возвращаем к корневому меню
                # Иначе возвращаем к родителю mess_button
                if menu_item.parent_id is None:
                    # Родитель - корневой элемент, возвращаем к корневому меню
                    builder.add(InlineKeyboardButton(
                        text="◀️ Назад",
                        callback_data="menu_root"
                    ))
                else:
                    # Родитель не корневой, возвращаем к родителю
                    builder.add(InlineKeyboardButton(
                        text="◀️ Назад",
                        callback_data=f"menu_back_{menu_item.parent_id}"
                    ))
                
                builder.adjust(1)
                keyboard = builder.as_markup()
                
                # Проверяем наличие reply кнопок, привязанных к этому сообщению
                reply_keyboard = MENU_KEYBOARD.build_reply_keyboard(parent_id=child_message.id, user_id=None)
                
                # Отправляем новое сообщение с reply-кнопками (если есть)
                await callback.message.answer(
                    text,
                    reply_markup=reply_keyboard if reply_keyboard else (keyboard if keyboard.inline_keyboard else None)
                )
                return
            else:
                # Если нет дочернего message, показываем обычное меню
                parent_id = item_id
        else:
            # Для reply_button обрабатываем через текстовый обработчик
            parent_id = item_id
    
    # Строим клавиатуру для текущего уровня (если не было дочернего message)
    keyboard = MENU_KEYBOARD.build_menu_keyboard(parent_id=parent_id, back_button=True)
    
    # Проверяем наличие reply кнопок
    # Передаем user_id для проверки прав админа (только для корневого меню)
    user_id = callback.from_user.id if hasattr(callback, 'from_user') else None
    reply_keyboard = MENU_KEYBOARD.build_reply_keyboard(
        parent_id=parent_id, 
        user_id=user_id if parent_id is None else None
    )
    
    # Формируем текст сообщения
    if parent_id:
        menu_item = CMS_INSTANCE.get_menu_item(parent_id)
        if menu_item:
            # Выводим только название раздела, без breadcrumbs
            text = f"{menu_item.name}\n\nВыберите раздел:"
        else:
            text = "Выберите раздел:"
    else:
        # Корневое меню - используем приветственное сообщение из Settings
        if USE_GOOGLE_SHEETS and hasattr(CMS_INSTANCE, 'get_welcome_message'):
            text = CMS_INSTANCE.get_welcome_message()
        else:
            # Значение по умолчанию для локального файла
            text = (
                "Добро пожаловать в Mosca\n\n"
                "📍 Москва, Пресненская набережная 12, Башня Федерация. Восток, этаж 11\n\n"
                "📅 Мы работаем для вас 24/7. Без обеда и выходных.\n\n"
                "💵 Мы работаем только за наличные рубли.\n\n"
                "💹 Самый низкий курс на покупку USDT и лучший курс покупки USDT в Москве.\n\n"
                "🤑 Отсутствие каких либо комиссии на покупку и продажу USDT\n\n"
                "Выберите раздел из меню:"
            )
    
    # Приоритет: reply-кнопки (если есть), иначе inline-кнопки
    # В Telegram нельзя использовать оба типа одновременно
    if reply_keyboard:
        # Для reply-кнопок нужно отправить новое сообщение (edit_text не поддерживает ReplyKeyboardMarkup)
        # Удаляем старое сообщение, чтобы избежать дубликатов
        try:
            await callback.message.delete()
        except Exception:
            pass  # Игнорируем ошибки удаления (если сообщение уже удалено или недоступно)
        # Отправляем новое сообщение с reply-кнопками
        await callback.message.answer(
            text,
            reply_markup=reply_keyboard
        )
    else:
        await callback.message.edit_text(text, reply_markup=keyboard)
