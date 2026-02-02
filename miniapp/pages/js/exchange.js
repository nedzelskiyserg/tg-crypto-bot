/**
 * Exchange Page Logic
 * Handles buy/sell exchange functionality
 */

// Exchange state (prefilled for testing)
window.exchangeState = {
    mode: 'buy',
    amount: 10000,
    receiveAmount: 0,
    currency: 'RUB',
    receiveCurrency: 'USDT',
    surname: 'Иванов',
    name: 'Иван',
    patronymic: 'Иванович',
    phone: '+79001234567',
    email: 'test@example.com',
    wallet: 'TJYeasTPa6gpEEfYBzaFNj7aGCGvdMcsVc',
    bankCard: '',  // Bank card for sell mode
    termsAccepted: true
};

// Get API base URL: same origin when miniapp served from backend (production), else config or localhost
function getApiBaseUrl() {
    const config = window.BACKEND_API_CONFIG;
    if (config && config.baseUrl) return config.baseUrl;
    const origin = typeof window !== 'undefined' && window.location && window.location.origin ? window.location.origin : '';
    if (origin && !/localhost|127\.0\.0\.1/.test(origin)) return origin + '/api';
    return 'http://localhost:8000/api';
}

// Track initialization
let exchangeHandlerInstalled = false;

/**
 * Format number with thousand separators (space) and decimal comma
 * @param {number} num - Number to format
 * @param {number} maxDecimals - Maximum decimal places (default 2)
 * @returns {string} Formatted string like "10 000,50"
 */
function formatNumber(num, maxDecimals = 2) {
    if (num === null || num === undefined || isNaN(num)) return '';
    if (num === 0) return '';

    // Round to specified decimals
    const multiplier = Math.pow(10, maxDecimals);
    const rounded = Math.round(num * multiplier) / multiplier;

    // Split into integer and decimal parts
    const parts = rounded.toString().split('.');

    // Format integer part with space as thousands separator
    const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

    // Format decimal part (if exists)
    let decimalPart = '';
    if (parts[1]) {
        decimalPart = ',' + parts[1].substring(0, maxDecimals);
    }

    return integerPart + decimalPart;
}

/**
 * Parse formatted string to number
 * "10 000,5" -> 10000.5; "127,82" -> 127.82
 */
function parseFormattedNumber(str) {
    if (!str || typeof str !== 'string') return 0;
    // Remove all spaces, replace comma with dot
    const cleaned = str.replace(/\s/g, '').replace(',', '.');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
}

/**
 * Sanitize input value - only digits, one comma, and spaces
 * @param {string} value - Raw input value
 * @returns {string} Sanitized value
 */
function sanitizeNumericInput(value) {
    // Remove all non-digit, non-comma, non-space characters
    let sanitized = value.replace(/[^\d\s,]/g, '');

    // Keep only first comma
    const firstComma = sanitized.indexOf(',');
    if (firstComma >= 0) {
        sanitized = sanitized.slice(0, firstComma + 1) +
                    sanitized.slice(firstComma + 1).replace(/,/g, '');
    }

    // Limit decimal places to 2
    const commaPos = sanitized.indexOf(',');
    if (commaPos >= 0) {
        const afterComma = sanitized.slice(commaPos + 1).replace(/\s/g, '');
        if (afterComma.length > 2) {
            sanitized = sanitized.slice(0, commaPos + 1) + afterComma.slice(0, 2);
        }
    }

    return sanitized;
}

/**
 * Format input value while preserving cursor position
 * Uses "significant characters after cursor" method for reliable cursor placement
 * @param {HTMLInputElement} input - Input element
 * @param {string} rawValue - Raw input value (after sanitization)
 * @returns {number} Parsed numeric value
 */
function formatInputWithCursor(input, rawValue) {
    const cursorPos = input.selectionStart;

    // Count significant chars (digits and comma) AFTER cursor
    const afterCursor = rawValue.substring(cursorPos);
    const significantAfter = (afterCursor.match(/[\d,]/g) || []).length;

    // Check if user is typing comma (comma at end with no digits after)
    const isTypingComma = rawValue.endsWith(',') &&
                          rawValue.indexOf(',') === rawValue.length - 1;

    // Parse the number
    const num = parseFormattedNumber(rawValue);

    // Handle empty or zero case
    if (num === 0 && !rawValue.match(/\d/)) {
        input.value = '';
        return 0;
    }

    // Format the number
    let formatted = formatNumber(num);

    // If user just typed comma, preserve it
    if (isTypingComma && formatted && !formatted.includes(',')) {
        formatted += ',';
    }

    // Handle case when input becomes empty
    if (!formatted) {
        input.value = '';
        return 0;
    }

    // Calculate new cursor position
    // Count backwards from end to find position with same significant chars after
    let newCursorPos = formatted.length;
    let significantCount = 0;

    for (let i = formatted.length - 1; i >= 0; i--) {
        if (/[\d,]/.test(formatted[i])) {
            significantCount++;
        }
        if (significantCount === significantAfter) {
            newCursorPos = i;
            break;
        }
    }

    // If we need more significant chars than exist, cursor goes to start
    if (significantCount < significantAfter) {
        newCursorPos = 0;
    }

    // Update input
    input.value = formatted;

    // Set cursor position synchronously (not in RAF - causes flicker)
    input.setSelectionRange(newCursorPos, newCursorPos);

    return num;
}

/**
 * Initialize Exchange Page
 */
window.initExchangePage = function() {
    console.log('[Exchange] initExchangePage called');

    // Install global click handler once (capture phase)
    if (!exchangeHandlerInstalled) {
        document.addEventListener('click', exchangeClickHandler, true);
        exchangeHandlerInstalled = true;
        console.log('[Exchange] Global click handler installed');
    }

    // Wait for elements
    const waitForElements = () => {
        const pageExchange = document.getElementById('pageExchange');
        const segments = document.querySelector('.segmented-control');

        if (!pageExchange || !segments) {
            console.log('[Exchange] Elements not ready, waiting...');
            setTimeout(waitForElements, 100);
            return;
        }

        // Setup input handlers for buy mode
        setupAmountInput();
        setupReceiveInput();
        // Setup input handlers for sell mode
        setupSellAmountInput();
        setupSellReceiveInput();
        setupBankCardInput();
        // Setup common handlers
        setupDataInputs();
        setupTermsCheckbox();
        setupModalDrag();

        // Initial values and mode setup
        setExchangeMode(window.exchangeState.mode);
        
        // Calculate initial receive amount
        const rate = window.getBuyRate ? window.getBuyRate() : (window.getCurrentRate ? window.getCurrentRate() : 97.50);
        if (window.exchangeState.mode === 'buy' && window.exchangeState.amount > 0) {
            window.exchangeState.receiveAmount = window.exchangeState.amount / rate;
        }
        
        // Set initial formatted values
        const amountInput = document.getElementById('amountInput');
        const receiveInput = document.getElementById('receiveValue');
        if (amountInput && window.exchangeState.amount > 0) {
            amountInput.value = formatNumber(window.exchangeState.amount);
        }
        if (receiveInput && window.exchangeState.receiveAmount > 0) {
            receiveInput.value = formatNumber(window.exchangeState.receiveAmount);
        }
        
        updateExchangeValues();
        validateForm();

        console.log('[Exchange] Page initialized');
    };

    setTimeout(waitForElements, 50);
};

/**
 * Global click handler for exchange page
 */
function exchangeClickHandler(e) {
    const pageExchange = document.getElementById('pageExchange');
    const currencyModal = document.getElementById('currencyModal');

    const isInsideExchange = pageExchange && pageExchange.contains(e.target);
    const isInsideModal = currencyModal && currencyModal.contains(e.target);

    if (!isInsideExchange && !isInsideModal) {
        return; // Not our page
    }

    // Handle segment controls (buy/sell)
    const segment = e.target.closest('.segment');
    if (segment && isInsideExchange) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        const mode = segment.dataset.segment;
        console.log('[Exchange] Segment clicked:', mode);
        setExchangeMode(mode);
        if (window.hapticFeedback) window.hapticFeedback('light');
        return;
    }


    // Handle terms checkbox (both buy and sell)
    const termsCheckboxBuy = e.target.closest('#termsCheckboxBuy');
    const termsRowBuy = e.target.closest('#termsRowBuy');
    const termsCheckboxSell = e.target.closest('#termsCheckboxSell');
    const termsRowSell = e.target.closest('#termsRowSell');
    
    if ((termsCheckboxBuy || termsRowBuy || termsCheckboxSell || termsRowSell) && isInsideExchange) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        console.log('[Exchange] Terms clicked');
        toggleTerms();
        return;
    }

    // Handle submit button
    const submitBtn = e.target.closest('#submitExchange');
    if (submitBtn && isInsideExchange) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        console.log('[Exchange] Submit clicked');
        submitExchange();
        return;
    }

    // Modal handlers
    if (isInsideModal) {
        // Currency option
        const currencyOption = e.target.closest('.currency-option');
        if (currencyOption) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();

            const currency = currencyOption.dataset.currency;
            console.log('[Exchange] Currency selected:', currency);
            selectCurrency(currency);
            return;
        }

        // Modal overlay
        if (e.target.classList.contains('modal-overlay')) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();

            console.log('[Exchange] Modal overlay clicked');
            closeCurrencyModal();
            return;
        }

        // Modal close button
        const closeBtn = e.target.closest('.modal-close');
        if (closeBtn) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();

            console.log('[Exchange] Modal close clicked');
            closeCurrencyModal();
            return;
        }
    }
}

/**
 * Setup amount input (RUB)
 */
function setupAmountInput() {
    const amountInput = document.getElementById('amountInput');
    if (!amountInput) return;

    amountInput.addEventListener('input', (e) => {
        // Sanitize input
        const sanitized = sanitizeNumericInput(e.target.value);

        // Format with cursor preservation
        const numValue = formatInputWithCursor(amountInput, sanitized);
        window.exchangeState.amount = numValue;

        // Update the other input based on mode
        if (window.exchangeState.mode === 'buy') {
            updateReceiveValueFromAmount();
        } else {
            const rate = window.getSellRate ? window.getSellRate() : (window.getCurrentRate ? window.getCurrentRate() : 96.80);
            if (rate > 0) {
                window.exchangeState.receiveAmount = numValue * rate;
                const receiveInput = document.getElementById('receiveValue');
                if (receiveInput && document.activeElement !== receiveInput) {
                    receiveInput.value = formatNumber(window.exchangeState.receiveAmount);
                }
            }
        }
        validateForm();
    });

    amountInput.addEventListener('focus', () => {
        hideSubmitButton();
    });

    amountInput.addEventListener('blur', () => {
        const val = window.exchangeState.amount || 0;
        // Round to 2 decimals for display and sync state
        const rounded = Math.round(val * 100) / 100;
        window.exchangeState.amount = rounded;
        amountInput.value = rounded > 0 ? formatNumber(rounded) : '';
        showSubmitButton();
    });
}

/**
 * Setup receive input (USDT)
 */
function setupReceiveInput() {
    const receiveInput = document.getElementById('receiveValue');
    if (!receiveInput) return;

    receiveInput.addEventListener('input', (e) => {
        // Sanitize input
        const sanitized = sanitizeNumericInput(e.target.value);

        // Format with cursor preservation
        const numValue = formatInputWithCursor(receiveInput, sanitized);

        if (window.exchangeState.mode === 'buy') {
            window.exchangeState.receiveAmount = numValue;
            updateAmountFromReceiveValue(numValue);
        } else {
            window.exchangeState.receiveAmount = numValue;
            const rate = window.getSellRate ? window.getSellRate() : (window.getCurrentRate ? window.getCurrentRate() : 96.80);
            if (rate > 0) {
                window.exchangeState.amount = numValue / rate;
                const amountInput = document.getElementById('amountInput');
                if (amountInput && document.activeElement !== amountInput) {
                    amountInput.value = formatNumber(window.exchangeState.amount);
                }
            }
        }
        validateForm();
    });

    receiveInput.addEventListener('focus', () => {
        hideSubmitButton();
    });

    receiveInput.addEventListener('blur', () => {
        const val = window.exchangeState.receiveAmount || 0;
        // Round to 2 decimals for display and sync state
        const rounded = Math.round(val * 100) / 100;
        window.exchangeState.receiveAmount = rounded;
        receiveInput.value = rounded > 0 ? formatNumber(rounded) : '';
        showSubmitButton();
    });
}

/**
 * Update receive value (USDT) from amount (RUB)
 */
function updateReceiveValueFromAmount() {
    const amount = window.exchangeState.amount || 0;
    const rate = window.getBuyRate ? window.getBuyRate() : (window.getCurrentRate ? window.getCurrentRate() : 97.50);
    
    if (rate <= 0) return;
    
    const receiveValue = amount / rate;
    window.exchangeState.receiveAmount = receiveValue;
    
    const receiveInput = document.getElementById('receiveValue');
    if (receiveInput && document.activeElement !== receiveInput) {
        receiveInput.value = formatNumber(receiveValue);
    }
}

/**
 * Update amount (RUB) from receive value (USDT)
 */
function updateAmountFromReceiveValue(receiveValue) {
    const rate = window.getBuyRate ? window.getBuyRate() : (window.getCurrentRate ? window.getCurrentRate() : 97.50);

    if (rate <= 0) return;

    const amount = receiveValue * rate;
    window.exchangeState.amount = amount;

    const amountInput = document.getElementById('amountInput');
    if (amountInput && document.activeElement !== amountInput) {
        amountInput.value = formatNumber(amount);
    }
}

/**
 * Setup sell mode amount input (USDT)
 */
function setupSellAmountInput() {
    const amountInput = document.getElementById('amountInputSell');
    if (!amountInput) return;

    amountInput.addEventListener('input', (e) => {
        const sanitized = sanitizeNumericInput(e.target.value);
        const numValue = formatInputWithCursor(amountInput, sanitized);
        window.exchangeState.amount = numValue;

        // Calculate RUB receive amount
        const rate = window.getSellRate ? window.getSellRate() : (window.getCurrentRate ? window.getCurrentRate() : 96.80);
        if (rate > 0) {
            window.exchangeState.receiveAmount = numValue * rate;
            const receiveInput = document.getElementById('receiveValueSell');
            if (receiveInput && document.activeElement !== receiveInput) {
                receiveInput.value = formatNumber(window.exchangeState.receiveAmount);
            }
        }
        validateForm();
    });

    amountInput.addEventListener('focus', () => {
        hideSubmitButton();
    });

    amountInput.addEventListener('blur', () => {
        const val = window.exchangeState.amount || 0;
        const rounded = Math.round(val * 100) / 100;
        window.exchangeState.amount = rounded;
        amountInput.value = rounded > 0 ? formatNumber(rounded) : '';
        showSubmitButton();
    });
}

/**
 * Setup sell mode receive input (RUB)
 */
function setupSellReceiveInput() {
    const receiveInput = document.getElementById('receiveValueSell');
    if (!receiveInput) return;

    receiveInput.addEventListener('input', (e) => {
        const sanitized = sanitizeNumericInput(e.target.value);
        const numValue = formatInputWithCursor(receiveInput, sanitized);
        window.exchangeState.receiveAmount = numValue;

        // Calculate USDT amount from RUB
        const rate = window.getSellRate ? window.getSellRate() : (window.getCurrentRate ? window.getCurrentRate() : 96.80);
        if (rate > 0) {
            window.exchangeState.amount = numValue / rate;
            const amountInput = document.getElementById('amountInputSell');
            if (amountInput && document.activeElement !== amountInput) {
                amountInput.value = formatNumber(window.exchangeState.amount);
            }
        }
        validateForm();
    });

    receiveInput.addEventListener('focus', () => {
        hideSubmitButton();
    });

    receiveInput.addEventListener('blur', () => {
        const val = window.exchangeState.receiveAmount || 0;
        const rounded = Math.round(val * 100) / 100;
        window.exchangeState.receiveAmount = rounded;
        receiveInput.value = rounded > 0 ? formatNumber(rounded) : '';
        showSubmitButton();
    });
}

/**
 * Setup bank card input for sell mode
 */
function setupBankCardInput() {
    const bankCardInput = document.getElementById('bankCardInputSell');
    if (!bankCardInput) return;

    bankCardInput.addEventListener('input', (e) => {
        // Format card number with spaces (4 digits groups)
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 16) value = value.slice(0, 16);

        // Add spaces every 4 digits
        const formatted = value.replace(/(\d{4})(?=\d)/g, '$1 ');
        e.target.value = formatted;

        window.exchangeState.bankCard = value;
        validateInput(bankCardInput, 'bankCard');
        validateForm();
    });

    bankCardInput.addEventListener('focus', () => {
        hideSubmitButton();
    });

    bankCardInput.addEventListener('blur', () => {
        validateInput(bankCardInput, 'bankCard');
        showSubmitButton();
    });
}

/**
 * Setup data inputs
 */
function setupDataInputs() {
    // Buy mode inputs
    const buyInputs = [
        { id: 'surnameInput', field: 'surname' },
        { id: 'nameInput', field: 'name' },
        { id: 'patronymicInput', field: 'patronymic' },
        { id: 'phoneInput', field: 'phone' },
        { id: 'emailInput', field: 'email' },
        { id: 'walletInput', field: 'wallet' }
    ];

    // Sell mode inputs
    const sellInputs = [
        { id: 'surnameInputSell', field: 'surname' },
        { id: 'nameInputSell', field: 'name' },
        { id: 'patronymicInputSell', field: 'patronymic' },
        { id: 'phoneInputSell', field: 'phone' },
        { id: 'emailInputSell', field: 'email' }
    ];

    const allInputs = [...buyInputs, ...sellInputs];

    allInputs.forEach(({ id, field }) => {
        const input = document.getElementById(id);
        if (!input) return;

        // Prefill from state
        if (window.exchangeState[field]) {
            input.value = window.exchangeState[field];
            // Mark as valid if prefilled
            validateInput(input, field);
        }

        input.addEventListener('focus', () => {
            hideSubmitButton();
        });

        input.addEventListener('blur', () => {
            validateInput(input, field);
            showSubmitButton();
            // Sync value to other mode's input
            syncInputValue(field, input.value);
        });

        input.addEventListener('input', (e) => {
            let value = e.target.value;
            if (field === 'wallet') {
                value = value.replace(/[^A-Za-z0-9]/g, '');
                e.target.value = value;
            }
            window.exchangeState[field] = value.trim();
            validateInput(input, field);
            // Sync value to other mode's input
            syncInputValue(field, value.trim());
            validateForm();
        });
    });
}

/**
 * Sync input value between buy and sell modes
 */
function syncInputValue(field, value) {
    const buyInput = document.getElementById(getBuyInputId(field));
    const sellInput = document.getElementById(getSellInputId(field));
    
    if (buyInput && buyInput.value !== value) {
        buyInput.value = value;
    }
    if (sellInput && sellInput.value !== value) {
        sellInput.value = value;
    }
}

/**
 * Get buy mode input ID
 */
function getBuyInputId(field) {
    const map = {
        'surname': 'surnameInput',
        'name': 'nameInput',
        'patronymic': 'patronymicInput',
        'phone': 'phoneInput',
        'email': 'emailInput',
        'wallet': 'walletInput'
    };
    return map[field] || '';
}

/**
 * Get sell mode input ID
 */
function getSellInputId(field) {
    const map = {
        'surname': 'surnameInputSell',
        'name': 'nameInputSell',
        'patronymic': 'patronymicInputSell',
        'phone': 'phoneInputSell',
        'email': 'emailInputSell'
    };
    return map[field] || '';
}

/**
 * Validate single input
 */
function validateInput(input, field) {
    const value = window.exchangeState[field] || '';
    let isValid = false;

    switch (field) {
        case 'surname':
        case 'name':
        case 'patronymic':
            isValid = value.length >= 2 && /^[А-Яа-яЁёA-Za-z\-\s]+$/.test(value);
            break;
        case 'phone':
            // Accept various phone formats
            isValid = value.length >= 10 && /^[\+]?[0-9\s\-\(\)]+$/.test(value);
            break;
        case 'email':
            // Basic email validation
            isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
            break;
        case 'wallet':
            isValid = value.length === 34 && value.startsWith('T');
            break;
        case 'bankCard':
            // Bank card: 16 digits
            isValid = value.length === 16 && /^\d{16}$/.test(value);
            break;
    }

    if (input) {
        input.classList.remove('valid', 'invalid');
        if (value.length > 0) {
            input.classList.add(isValid ? 'valid' : 'invalid');
        }
    }
    
    // Also validate the corresponding input in the other mode
    const otherInputId = input.id.includes('Sell') ? getBuyInputId(field) : getSellInputId(field);
    if (otherInputId) {
        const otherInput = document.getElementById(otherInputId);
        if (otherInput) {
            otherInput.classList.remove('valid', 'invalid');
            if (value.length > 0) {
                otherInput.classList.add(isValid ? 'valid' : 'invalid');
            }
        }
    }
    
    return isValid;
}

/**
 * Setup terms checkbox
 */
function setupTermsCheckbox() {
    const checkboxBuy = document.getElementById('termsCheckboxBuy');
    const checkboxSell = document.getElementById('termsCheckboxSell');
    
    if (window.exchangeState.termsAccepted) {
        if (checkboxBuy) checkboxBuy.classList.add('checked');
        if (checkboxSell) checkboxSell.classList.add('checked');
    }
}

/**
 * Toggle terms (syncs both checkboxes)
 */
function toggleTerms() {
    window.exchangeState.termsAccepted = !window.exchangeState.termsAccepted;
    
    const checkboxBuy = document.getElementById('termsCheckboxBuy');
    const checkboxSell = document.getElementById('termsCheckboxSell');
    
    if (checkboxBuy) {
        checkboxBuy.classList.toggle('checked', window.exchangeState.termsAccepted);
    }
    if (checkboxSell) {
        checkboxSell.classList.toggle('checked', window.exchangeState.termsAccepted);
    }
    
    if (window.hapticFeedback) {
        window.hapticFeedback(window.exchangeState.termsAccepted ? 'success' : 'light');
    }
    validateForm();
}

/**
 * Hide submit button (when keyboard is open)
 */
function hideSubmitButton() {
    const submitBtn = document.getElementById('submitExchange');
    if (submitBtn) {
        submitBtn.style.display = 'none';
    }
}

/**
 * Show submit button (when keyboard is closed)
 */
function showSubmitButton() {
    const submitBtn = document.getElementById('submitExchange');
    if (submitBtn) {
        submitBtn.style.display = '';
    }
}

/**
 * Validate form
 */
function validateForm() {
    const submitBtn = document.getElementById('submitExchange');
    if (!submitBtn) return false;

    const s = window.exchangeState;

    // Buy mode: wallet required; Sell mode: no wallet needed
    const walletValid = s.mode === 'buy' ? (s.wallet.length === 34 && s.wallet.startsWith('T')) : true;
    const phoneValid = s.phone.length >= 10 && /^[\+]?[0-9\s\-\(\)]+$/.test(s.phone);
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email);

    const isValid =
        s.amount > 0 &&
        s.surname.length >= 2 &&
        s.name.length >= 2 &&
        s.patronymic.length >= 2 &&
        phoneValid &&
        emailValid &&
        walletValid &&
        s.termsAccepted;

    submitBtn.disabled = !isValid;
    return isValid;
}

/**
 * Set exchange mode
 */
function setExchangeMode(mode) {
    window.exchangeState.mode = mode;

    document.querySelectorAll('.segment').forEach(seg => {
        seg.classList.toggle('active', seg.dataset.segment === mode);
    });

    if (mode === 'buy') {
        window.exchangeState.currency = 'RUB';
        window.exchangeState.receiveCurrency = 'USDT';
    } else {
        window.exchangeState.currency = 'USDT';
        window.exchangeState.receiveCurrency = 'RUB';
    }

    const selectedCurrencyEl = document.getElementById('selectedCurrency');
    const receiveCurrencyEl = document.getElementById('receiveCurrency');
    if (selectedCurrencyEl) selectedCurrencyEl.textContent = window.exchangeState.currency;
    if (receiveCurrencyEl) receiveCurrencyEl.textContent = window.exchangeState.receiveCurrency;

    // Switch between mode containers with animation
    const buyContainer = document.getElementById('buyModeContainer');
    const sellContainer = document.getElementById('sellModeContainer');

    if (mode === 'buy') {
        if (sellContainer) sellContainer.classList.remove('active');
        if (buyContainer) {
            requestAnimationFrame(() => {
                buyContainer.classList.add('active');
            });
        }
    } else {
        if (buyContainer) buyContainer.classList.remove('active');
        if (sellContainer) {
            requestAnimationFrame(() => {
                sellContainer.classList.add('active');
            });
        }
    }

    updateExchangeValues();
    validateForm();
}

/**
 * Update exchange values
 */
window.updateExchangeValues = function() {
    const amount = window.exchangeState.amount || 0;
    const rate = window.getBuyRate && window.getSellRate ? 
        (window.exchangeState.mode === 'buy' ? window.getBuyRate() : window.getSellRate()) : 
        (window.getCurrentRate ? window.getCurrentRate() : 97.50);
    let receiveValue;

    if (window.exchangeState.mode === 'buy') {
        receiveValue = amount / rate;
        window.exchangeState.receiveAmount = receiveValue;
        
        // Update receive input only if it's not focused
        const receiveInput = document.getElementById('receiveValue');
        if (receiveInput && document.activeElement !== receiveInput) {
            receiveInput.value = formatNumber(receiveValue);
        }
    } else {
        receiveValue = amount * rate;
    }

    // Update rate info for both modes
    const exchangeRateValueEl = document.getElementById('exchangeRateValue');
    const exchangeRateValueSellEl = document.getElementById('exchangeRateValueSell');
    
    const rateText = `1 USDT = ${rate.toFixed(2)} RUB`;
    
    if (exchangeRateValueEl) {
        exchangeRateValueEl.textContent = rateText;
    }
    if (exchangeRateValueSellEl) {
        exchangeRateValueSellEl.textContent = rateText;
    }
};

// Modal drag state
let modalDragState = { isDragging: false, startY: 0, currentY: 0 };

/**
 * Setup modal drag
 */
function setupModalDrag() {
    const modal = document.getElementById('currencyModal');
    if (!modal) return;

    const content = modal.querySelector('.modal-content');
    const overlay = modal.querySelector('.modal-overlay');
    const dragAreas = [modal.querySelector('.modal-drag-handle'), modal.querySelector('.modal-header')].filter(Boolean);

    if (!content) return;

    const onStart = (e) => {
        if (!modal.classList.contains('active')) return;
        modalDragState.isDragging = true;
        modalDragState.startY = e.touches[0].clientY;
        modalDragState.currentY = 0;
        content.style.transition = 'none';
        if (overlay) overlay.style.transition = 'none';
    };

    const onMove = (e) => {
        if (!modalDragState.isDragging) return;
        const dy = e.touches[0].clientY - modalDragState.startY;
        if (dy > 0) {
            e.preventDefault();
            modalDragState.currentY = dy;
            content.style.transform = `translateY(${dy * 0.6}px)`;
            if (overlay) overlay.style.backgroundColor = `rgba(0,0,0,${Math.max(0, 0.6 - dy/300)})`;
        }
    };

    const onEnd = () => {
        if (!modalDragState.isDragging) return;
        modalDragState.isDragging = false;
        content.style.transition = '';

        if (modalDragState.currentY > 100) {
            closeCurrencyModal(true);
        } else {
            content.style.transform = '';
            if (overlay) overlay.style.backgroundColor = '';
        }
        modalDragState.currentY = 0;
    };

    dragAreas.forEach(area => {
        area.addEventListener('touchstart', onStart, { passive: true });
        area.addEventListener('touchmove', onMove, { passive: false });
        area.addEventListener('touchend', onEnd, { passive: true });
    });
}

/**
 * Open currency modal
 */
window.openCurrencyModal = function() {
    const modal = document.getElementById('currencyModal');
    const selector = document.getElementById('currencySelector');
    if (!modal) return;

    modal.classList.remove('closing');
    modal.classList.add('active');
    if (selector) selector.classList.add('open');

    document.querySelectorAll('.currency-option').forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.currency === window.exchangeState.currency);
    });

    document.body.style.overflow = 'hidden';
};

/**
 * Close currency modal
 */
window.closeCurrencyModal = function(fromDrag = false) {
    const modal = document.getElementById('currencyModal');
    const selector = document.getElementById('currencySelector');
    if (!modal) return;

    const content = modal.querySelector('.modal-content');
    const overlay = modal.querySelector('.modal-overlay');

    modal.classList.add('closing');

    if (fromDrag && content) {
        content.style.transition = 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)';
        content.style.transform = 'translateY(100%)';
        if (overlay) {
            overlay.style.transition = 'background-color 0.3s ease';
            overlay.style.backgroundColor = 'rgba(0,0,0,0)';
        }
    }

    setTimeout(() => {
        modal.classList.remove('active', 'closing');
        if (selector) selector.classList.remove('open');
        document.body.style.overflow = '';
        if (content) { content.style.transform = ''; content.style.transition = ''; }
        if (overlay) { overlay.style.transition = ''; overlay.style.backgroundColor = ''; }
    }, 300);

    if (window.hapticFeedback) window.hapticFeedback('light');
};

/**
 * Select currency
 */
function selectCurrency(currency) {
    window.exchangeState.currency = currency;

    if (currency === 'RUB') {
        window.exchangeState.receiveCurrency = 'USDT';
        window.exchangeState.mode = 'buy';
    } else {
        window.exchangeState.receiveCurrency = 'RUB';
        window.exchangeState.mode = 'sell';
    }

    const selectedCurrencyEl = document.getElementById('selectedCurrency');
    const receiveCurrencyEl = document.getElementById('receiveCurrency');
    if (selectedCurrencyEl) selectedCurrencyEl.textContent = currency;
    if (receiveCurrencyEl) receiveCurrencyEl.textContent = window.exchangeState.receiveCurrency;

    document.querySelectorAll('.currency-option').forEach(opt => {
        const isSelected = opt.dataset.currency === currency;
        opt.classList.toggle('selected', isSelected);
        if (isSelected) opt.classList.add('just-selected');
    });

    document.querySelectorAll('.segment').forEach(seg => {
        seg.classList.toggle('active', seg.dataset.segment === window.exchangeState.mode);
    });

    updateExchangeValues();

    if (window.hapticFeedback) window.hapticFeedback('success');

    setTimeout(() => {
        document.querySelectorAll('.currency-option').forEach(opt => opt.classList.remove('just-selected'));
        closeCurrencyModal();
    }, 200);
}

/**
 * Submit exchange - sends order to backend API
 */
window.submitExchange = function() {
    if (!validateForm()) {
        if (window.hapticFeedback) window.hapticFeedback('error');

        const tg = window.Telegram?.WebApp;
        let msg = 'Заполните все обязательные поля';

        if (window.exchangeState.amount <= 0) msg = 'Введите сумму';
        else if (!window.exchangeState.phone || window.exchangeState.phone.length < 10) msg = 'Введите номер телефона';
        else if (!window.exchangeState.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(window.exchangeState.email)) msg = 'Введите корректный email';
        else if (!window.exchangeState.termsAccepted) msg = 'Примите условия сервиса';
        else if (window.exchangeState.mode === 'buy' && window.exchangeState.wallet.length !== 34) msg = 'Введите адрес кошелька (34 символа)';

        if (tg) tg.showAlert(msg);
        else alert(msg);
        return;
    }

    const s = window.exchangeState;
    const rate = s.mode === 'buy'
        ? (window.getBuyRate ? window.getBuyRate() : (window.getCurrentRate ? window.getCurrentRate() : 97.50))
        : (window.getSellRate ? window.getSellRate() : (window.getCurrentRate ? window.getCurrentRate() : 96.80));
    const receiveValue = s.mode === 'buy' ? (s.amount / rate).toFixed(8) : (s.amount * rate).toFixed(2);

    const tg = window.Telegram?.WebApp;
    const fullName = `${s.surname} ${s.name} ${s.patronymic}`;

    // Prepare API data
    const apiData = {
        full_name: fullName,
        phone: s.phone,
        email: s.email,
        currency_from: s.currency,
        amount_from: s.amount,
        currency_to: s.receiveCurrency,
        amount_to: parseFloat(receiveValue),
        exchange_rate: rate,
        wallet_address: s.mode === 'buy' ? s.wallet : '',
        bank_card: ''
    };

    console.log('[Exchange] Submit data:', apiData);

    const confirmMessage = s.mode === 'buy'
        ? `Покупка USDT\n\nИмя: ${fullName}\nТелефон: ${s.phone}\nEmail: ${s.email}\nКошелёк: ${s.wallet.slice(0,8)}...${s.wallet.slice(-4)}\n\nОтдаёте: ${formatNumber(s.amount)} ${s.currency}\nПолучите: ${formatNumber(parseFloat(receiveValue))} ${s.receiveCurrency}`
        : `Продажа USDT\n\nИмя: ${fullName}\nТелефон: ${s.phone}\nEmail: ${s.email}\n\nОтдаёте: ${formatNumber(s.amount)} ${s.currency}\nПолучите: ${formatNumber(parseFloat(receiveValue))} ${s.receiveCurrency}`;

    if (tg) {
        tg.showPopup({
            title: 'Подтверждение',
            message: confirmMessage,
            buttons: [
                { id: 'confirm', type: 'default', text: 'Подтвердить' },
                { id: 'cancel', type: 'cancel' }
            ]
        }, async (buttonId) => {
            if (buttonId === 'confirm') {
                await sendOrderToAPI(apiData);
            }
        });
    } else {
        if (confirm(`Подтвердить?\n\n${confirmMessage}`)) {
            sendOrderToAPI(apiData);
        }
    }
};

/**
 * Send order to backend API
 */
async function sendOrderToAPI(orderData) {
    const tg = window.Telegram?.WebApp;
    const submitBtn = document.getElementById('submitExchange');

    // Disable button and show loading
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.querySelector('span').textContent = 'ОТПРАВКА...';
    }

    try {
        // Get initData for authentication
        const initData = tg?.initData || '';

        const response = await fetch(`${getApiBaseUrl()}/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Telegram-Init-Data': initData
            },
            body: JSON.stringify(orderData)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `HTTP error ${response.status}`);
        }

        const result = await response.json();
        console.log('[Exchange] Order created:', result);

        if (window.hapticFeedback) window.hapticFeedback('success');
        if (window.showToast) window.showToast('Заявка создана!', 'success');

        // Reset form
        resetExchangeForm();

        // Go to home page
        if (window.showPage) window.showPage('home');

        // Also send to bot for legacy support
        if (window.sendToBot) {
            window.sendToBot({
                action: 'exchange_created',
                order_id: result.id,
                ...orderData
            });
        }

    } catch (error) {
        console.error('[Exchange] API Error:', error);
        if (window.hapticFeedback) window.hapticFeedback('error');

        const rawMsg = (error && error.message) ? String(error.message) : '';
        const isNetworkError = /load failed|failed to fetch|network error|не удалось выполнить запрос/i.test(rawMsg) || error.name === 'TypeError';
        const errorMsg = isNetworkError
            ? 'Не удалось подключиться к серверу. Проверьте интернет и попробуйте позже.'
            : `Ошибка: ${rawMsg || 'Не удалось создать заявку'}`;
        if (tg) {
            tg.showAlert(errorMsg);
        } else {
            alert(errorMsg);
        }
    } finally {
        // Restore button state
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.querySelector('span').textContent = 'СОЗДАТЬ ЗАЯВКУ';
            validateForm(); // Re-validate to set correct disabled state
        }
    }
}

/**
 * Reset exchange form after successful submission
 */
function resetExchangeForm() {
    // Reset state (keep amount and mode)
    window.exchangeState.surname = '';
    window.exchangeState.name = '';
    window.exchangeState.patronymic = '';
    window.exchangeState.phone = '';
    window.exchangeState.email = '';
    window.exchangeState.wallet = '';
    window.exchangeState.bankCard = '';
    window.exchangeState.termsAccepted = false;

    // Reset input fields
    const inputIds = [
        'surnameInput', 'nameInput', 'patronymicInput', 'phoneInput', 'emailInput', 'walletInput',
        'surnameInputSell', 'nameInputSell', 'patronymicInputSell', 'phoneInputSell', 'emailInputSell',
        'bankCardInputSell', 'amountInputSell', 'receiveValueSell'
    ];

    inputIds.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.value = '';
            input.classList.remove('valid', 'invalid');
        }
    });

    // Reset checkboxes
    const checkboxBuy = document.getElementById('termsCheckboxBuy');
    const checkboxSell = document.getElementById('termsCheckboxSell');
    if (checkboxBuy) checkboxBuy.classList.remove('checked');
    if (checkboxSell) checkboxSell.classList.remove('checked');

    validateForm();
}

console.log('[Exchange] Script loaded');
