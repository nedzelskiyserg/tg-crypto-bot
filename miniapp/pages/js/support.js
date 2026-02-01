/**
 * Support Page Logic
 * Handles FAQ accordion and contact functionality
 */

/**
 * Initialize Support Page
 */
function initSupportPage() {
    initFaqAccordion();
    initContactButton();

    console.log('Support page initialized');
}

/**
 * Initialize FAQ Accordion
 */
function initFaqAccordion() {
    const faqItems = document.querySelectorAll('.faq-item');

    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');

        if (question) {
            question.addEventListener('click', () => {
                toggleFaqItem(item);
            });
        }
    });
}

/**
 * Toggle FAQ item open/close
 */
function toggleFaqItem(item) {
    const isOpen = item.classList.contains('open');

    // Close all other items (accordion behavior)
    const allItems = document.querySelectorAll('.faq-item');
    allItems.forEach(otherItem => {
        if (otherItem !== item) {
            otherItem.classList.remove('open');
        }
    });

    // Toggle current item
    if (isOpen) {
        item.classList.remove('open');
    } else {
        item.classList.add('open');

        // Haptic feedback
        if (window.hapticFeedback) {
            window.hapticFeedback('light');
        }
    }
}

/**
 * Initialize Contact Button
 */
function initContactButton() {
    const contactBtn = document.getElementById('contactSupport');

    if (contactBtn) {
        contactBtn.addEventListener('click', () => {
            openSupportChat();
        });
    }
}

/**
 * Open support chat in Telegram
 */
function openSupportChat() {
    const tg = window.Telegram?.WebApp;

    if (window.hapticFeedback) {
        window.hapticFeedback('medium');
    }

    if (tg) {
        // Option 1: Open support bot/channel
        tg.openTelegramLink('https://t.me/noname_ex_support');

        // Option 2: Show confirmation popup first
        // tg.showPopup({
        //     title: 'Поддержка',
        //     message: 'Вы будете перенаправлены в чат поддержки NONAME EX',
        //     buttons: [
        //         { id: 'open', type: 'default', text: 'Открыть' },
        //         { id: 'cancel', type: 'cancel' }
        //     ]
        // }, (buttonId) => {
        //     if (buttonId === 'open') {
        //         tg.openTelegramLink('https://t.me/noname_ex_support');
        //     }
        // });
    } else {
        // Fallback for browser testing
        window.open('https://t.me/noname_ex_support', '_blank');
    }
}

/**
 * Open specific FAQ item by index
 */
function openFaqItem(index) {
    const faqItems = document.querySelectorAll('.faq-item');

    if (faqItems[index]) {
        // Close all items first
        faqItems.forEach(item => item.classList.remove('open'));

        // Open the specified item
        faqItems[index].classList.add('open');

        // Scroll to the item
        faqItems[index].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

/**
 * Close all FAQ items
 */
function closeAllFaqItems() {
    const faqItems = document.querySelectorAll('.faq-item');
    faqItems.forEach(item => item.classList.remove('open'));
}

// Export functions for global use
window.initSupportPage = initSupportPage;
window.toggleFaqItem = toggleFaqItem;
window.openFaqItem = openFaqItem;
window.closeAllFaqItems = closeAllFaqItems;
window.openSupportChat = openSupportChat;
