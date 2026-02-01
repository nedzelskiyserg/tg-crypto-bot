"""
Обработчик reply кнопок
"""
from aiogram import types

# Эти переменные будут установлены из bot/main.py
CMS_INSTANCE = None
MENU_KEYBOARD = None
USE_GOOGLE_SHEETS = False

async def reply_button_handler(message: types.Message) -> None:
    """Обработчик reply кнопок (кнопок внизу экрана)"""
    # Импортируем здесь, чтобы избежать циклических импортов
    from .admin import admin_panel_handler
    from .start import start_handler
    
    # Ищем элемент меню по названию кнопки
    button_text = message.text
    
    # Сначала проверяем админ-панель
    if button_text in ["Настройки ⚙️", "🔁 Обновить бот"]:
        await admin_panel_handler(message)
        return
    elif button_text == "◀️ Назад":
        # Проверяем, не из админ-панели ли это
        # Если пользователь админ и нажал "Назад", возвращаемся к главному меню
        user_id = message.from_user.id
        if USE_GOOGLE_SHEETS and hasattr(CMS_INSTANCE, 'is_admin') and CMS_INSTANCE.is_admin(user_id):
            await start_handler(message)
            return
    
    # Используем метод поиска по названию и типу (ищем reply_button и reply_button_line)
    found_item = None
    if hasattr(CMS_INSTANCE, 'find_item_by_name_and_type'):
        # Сначала ищем reply_button
        found_item = CMS_INSTANCE.find_item_by_name_and_type(button_text, "reply_button")
        # Если не найдено, ищем reply_button_line
        if not found_item:
            found_item = CMS_INSTANCE.find_item_by_name_and_type(button_text, "reply_button_line")
    else:
        # Fallback: ищем вручную
        if hasattr(CMS_INSTANCE, 'get_all_items'):
            all_items = CMS_INSTANCE.get_all_items()
        elif hasattr(CMS_INSTANCE, 'menu_items'):
            all_items = list(CMS_INSTANCE.menu_items.values())
        else:
            all_items = []
        
        for item in all_items:
            if item.name == button_text and item.menu_type in ["reply_button", "reply_button_line"]:
                found_item = item
                break
    
    if not found_item:
        # Если не найдено, просто отвечаем
        return
    
    # Обрабатываем reply_button и reply_button_line
    if found_item.menu_type in ["reply_button", "reply_button_line"]:
        # ПРИОРИТЕТ 1: Проверяем наличие дочернего message (как в mess_button)
        children = CMS_INSTANCE.get_children(found_item.id)
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
            # Если родитель reply-кнопки - корневой элемент, возвращаем к корневому меню
            if found_item.parent_id is None:
                builder.add(InlineKeyboardButton(
                    text="◀️ Назад",
                    callback_data="menu_root"
                ))
            else:
                builder.add(InlineKeyboardButton(
                    text="◀️ Назад",
                    callback_data=f"menu_back_{found_item.parent_id}"
                ))
            
            builder.adjust(1)
            keyboard = builder.as_markup()
            
            # Проверяем наличие reply кнопок, привязанных к этому сообщению
            reply_keyboard = MENU_KEYBOARD.build_reply_keyboard(parent_id=child_message.id, user_id=None)
            
            # Отправляем новое сообщение с reply-кнопками (если есть)
            await message.answer(
                text,
                reply_markup=reply_keyboard if reply_keyboard else (keyboard if keyboard.inline_keyboard else None)
            )
            return
        
        # ПРИОРИТЕТ 2: Проверяем, ведет ли reply_button к message через parent_id
        if found_item.parent_id:
            parent_item = CMS_INSTANCE.get_menu_item(found_item.parent_id)
            if parent_item and parent_item.menu_type == "message":
                # Если родитель - message, отправляем это сообщение
                # Выводим только текст из таблицы, без breadcrumbs
                text = parent_item.text
                
                # Получаем кнопки, привязанные к этому message
                keyboard = MENU_KEYBOARD.build_menu_keyboard(
                    parent_id=parent_item.id,
                    back_button=False
                )
                
                reply_keyboard = MENU_KEYBOARD.build_reply_keyboard(parent_id=parent_item.id, user_id=None)
                
                # Приоритет: reply-кнопки (если есть), иначе inline-кнопки
                if reply_keyboard:
                    await message.answer(
                        text,
                        reply_markup=reply_keyboard
                    )
                else:
                    await message.answer(
                        text,
                        reply_markup=keyboard if keyboard.inline_keyboard else None
                    )
                return
        
        # ПРИОРИТЕТ 3: Если нет дочернего message и нет родителя message, показываем обычное меню
        keyboard = MENU_KEYBOARD.build_menu_keyboard(
            parent_id=found_item.id,
            back_button=True
        )
        
        reply_keyboard = MENU_KEYBOARD.build_reply_keyboard(parent_id=found_item.id, user_id=None)
        
        # Выводим только название раздела, без breadcrumbs
        text = f"{found_item.name}\n\nВыберите раздел:"
        
        # Приоритет: reply-кнопки (если есть), иначе inline-кнопки
        if reply_keyboard:
            await message.answer(text, reply_markup=reply_keyboard)
        else:
            await message.answer(text, reply_markup=keyboard)
