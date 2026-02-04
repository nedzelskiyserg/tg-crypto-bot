/**
 * NONAME EX - Telegram Mini App
 * Main Application Script
 */

// Initialize Telegram WebApp
const tg = window.Telegram?.WebApp;

// API Configuration (rates are now fetched from backend which applies markup formula)
// External API is called server-side by backend, not from frontend.
const RATE_API_CONFIG = {
    url: 'https://mosca.moscow/api/v1/rate/',
    accessToken: 'HZAKlDuHaMD5sRpWgeciz6OxeK8b7h76NJHdeqi_OdurDRJBv1mJy4iuyz53wgZRbEmxCiKTojNYgLmRhIzqlA'
};

// Backend API Configuration (for orders)
// В продакшене (miniapp и API на одном домене) используется текущий origin + /api.
// Для локальной разработки (miniapp на :8080, API на :8000) задайте baseUrl в window.BACKEND_API_CONFIG.
const BACKEND_API_CONFIG = {
    baseUrl: '' // пусто = авто: тот же origin + /api (для выкладки на сервер)
};

// Make it globally available
window.BACKEND_API_CONFIG = window.BACKEND_API_CONFIG || BACKEND_API_CONFIG;

// Global rate variables (accessible from all pages)
window.globalBuyRate = 97.50;
window.globalSellRate = 96.80;

// App State
const state = {
    currentRate: 97.50,
    buyRate: 97.50,
    sellRate: 96.80,
    rateChange: 0.5,
    rateLoading: true,
    rateLoadedOnce: false,
    isLoading: false,
    currentPage: 'home',
    exchange: {
        mode: 'buy', // 'buy' or 'sell'
        amount: 10000,
        currency: 'RUB',
        receiveCurrency: 'USDT'
    }
};

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    initTelegramWebApp();
    initButtons();
    initRateUpdates();
    // Preload exchange page (no lazy load)
    loadExchangePage();
    // Check if current user is admin and show admin button
    checkAdminStatus();
});

/**
 * Initialize Telegram WebApp
 */
function initTelegramWebApp() {
    if (!tg) {
        console.warn('Telegram WebApp not available');
        return;
    }

    // Expand to full height
    tg.expand();

    // Request fullscreen mode (available in Telegram WebApp 8.0+)
    if (tg.requestFullscreen) {
        tg.requestFullscreen();
    }

    // Disable vertical swipes to prevent app from closing on scroll
    if (tg.disableVerticalSwipes) {
        tg.disableVerticalSwipes();
    }

    // Set header color
    tg.setHeaderColor('#111111');
    tg.setBackgroundColor('#111111');

    // Enable closing confirmation if needed
    // tg.enableClosingConfirmation();

    // Configure back button
    tg.BackButton.onClick(() => {
        if (state.currentPage !== 'home') {
            showPage('home');
        }
    });

    // Ready signal
    tg.ready();

    // Apply theme
    applyTelegramTheme();

    console.log('Telegram WebApp initialized', {
        platform: tg.platform,
        version: tg.version,
        colorScheme: tg.colorScheme
    });
}

/**
 * Apply Telegram theme colors
 */
function applyTelegramTheme() {
    if (!tg) return;

    const theme = tg.colorScheme || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
}

/**
 * Initialize button click handlers
 */
function initButtons() {
    // Use event delegation for dynamically loaded content
    document.addEventListener('click', (e) => {
        const button = e.target.closest('[data-action]');
        if (button) {
            const action = button.dataset.action;
            handleButtonClick(action, button);
        }
    });

    // Also initialize existing buttons
    const buttons = document.querySelectorAll('[data-action]');
    buttons.forEach(button => {
        button.classList.add('ripple');
        // Touch feedback
        button.addEventListener('touchstart', () => {
            hapticFeedback('light');
        }, { passive: true });
    });
}

/**
 * Handle button clicks
 */
function handleButtonClick(action, button) {
    hapticFeedback('medium');

    switch (action) {
        case 'buy-sell':
            showPage('exchange');
            break;

        case 'back':
            showPage('home');
            break;

        case 'rate':
            showPage('rate');
            break;

        case 'requests':
            showPage('requests');
            break;

        case 'view-request':
            // Handled by requests page
            break;

        case 'close-request-modal':
            if (window.closeRequestModal) {
                window.closeRequestModal();
            }
            break;

        case 'support':
            showPage('support');
            break;

        case 'contact-support':
            if (window.openSupportChat) {
                window.openSupportChat();
            } else {
                openSupport();
            }
            break;

        case 'about':
            showPage('about');
            break;

        case 'aml':
            showFeatureInDevelopment('AML Проверка');
            break;

        case 'referral':
            showFeatureInDevelopment('Реферальная программа');
            break;

        case 'admin':
            showPage('admin');
            break;

        case 'rate-details':
            showPage('rate');
            break;

        case 'go-home':
            showPage('home');
            break;

        case 'select-currency':
            if (window.openCurrencyModal) {
                window.openCurrencyModal();
            }
            break;

        case 'close-modal':
            if (window.closeCurrencyModal) {
                window.closeCurrencyModal();
            }
            break;

        case 'submit-exchange':
            if (window.submitExchange) {
                window.submitExchange();
            }
            break;

        default:
            console.log('Unknown action:', action);
    }
}

/**
 * Show specific page
 */
function showPage(pageName) {
    // Hide all pages
    const pages = document.querySelectorAll('.page');
    pages.forEach(page => page.classList.remove('active'));

    state.currentPage = pageName;

    // Configure back button for Telegram
    if (tg) {
        if (pageName !== 'home') {
            tg.BackButton.show();
            if (pageName === 'admin') {
                tg.BackButton.onClick(() => {
                    if (window.adminFiltersVisible && typeof window.closeAdminFiltersPage === 'function') {
                        window.closeAdminFiltersPage();
                    } else {
                        showPage('home');
                    }
                });
            } else {
                tg.BackButton.onClick(() => showPage('home'));
            }
        } else {
            tg.BackButton.hide();
        }
    }

    // Handle different pages
    if (pageName === 'home') {
        const homePage = document.getElementById('pageHome');
        if (homePage) {
            homePage.classList.add('active');
        }
    } else if (pageName === 'exchange') {
        // Exchange page is preloaded, just show it
        loadExchangePage().then(() => {
            const exchangePage = document.querySelector('.page-exchange');
            if (exchangePage) {
                exchangePage.classList.add('active');
                // Re-initialize if needed
                if (window.initExchangePage) {
                    window.initExchangePage();
                }
                if (window.updateExchangeValues) {
                    window.updateExchangeValues();
                }
            }
        });
    } else if (pageName === 'support') {
        // Load support page dynamically
        loadSupportPage();
    } else if (pageName === 'about') {
        // Load about page dynamically
        loadAboutPage().then(() => {
            const aboutPage = document.querySelector('.page-about');
            if (aboutPage) {
                aboutPage.classList.add('active');
                console.log('About page activated');
            } else {
                console.error('About page element not found after loading');
            }
        }).catch((error) => {
            console.error('Error loading about page:', error);
        });
    } else if (pageName === 'requests') {
        // Load requests page dynamically
        loadRequestsPage();
    } else if (pageName === 'rate') {
        // Load rate page dynamically
        loadRatePage();
    } else if (pageName === 'admin') {
        // Load admin page dynamically
        loadAdminPage();
    } else {
        // Other pages
        const targetPage = document.getElementById(`page${pageName.charAt(0).toUpperCase() + pageName.slice(1)}`);
        if (targetPage) {
            targetPage.classList.add('active');
        }
    }

    hapticFeedback('light');
    console.log('Page changed to:', pageName);
}

/**
 * Navigation function
 */
function navigateTo(page) {
    console.log('Navigate to:', page);

    // Show loading state
    showLoading();

    // Send data to bot or navigate
    if (tg) {
        // Option 1: Send data to bot
        // tg.sendData(JSON.stringify({ action: 'navigate', page }));

        // Option 2: Open internal page
        // window.location.href = `${page}.html`;

        // Option 3: Show popup for demo
        tg.showPopup({
            title: getPageTitle(page),
            message: getPageDescription(page),
            buttons: [
                { id: 'open', type: 'default', text: 'Открыть' },
                { id: 'cancel', type: 'cancel' }
            ]
        }, (buttonId) => {
            if (buttonId === 'open') {
                // Handle navigation
                hapticFeedback('success');
            }
            hideLoading();
        });
    } else {
        // Fallback for browser testing
        alert(`Переход на страницу: ${page}`);
        hideLoading();
    }
}

/**
 * Get page title for popup
 */
function getPageTitle(page) {
    const titles = {
        'buy-sell': 'Купить / Продать USDT',
        'rate': 'Текущий курс',
        'requests': 'Все заявки',
        'support': 'Поддержка',
        'about': 'О нас',
        'aml': 'AML Проверка',
        'referral': 'Реферальная программа'
    };
    return titles[page] || page;
}

/**
 * Get page description for popup
 */
function getPageDescription(page) {
    const descriptions = {
        'buy-sell': 'Быстрый обмен USDT по лучшему курсу',
        'rate': 'Актуальный курс обмена USDT/RUB',
        'requests': 'История ваших заявок на обмен',
        'support': 'Свяжитесь с нашей службой поддержки',
        'about': 'Информация о сервисе NONAME EX',
        'aml': 'Проверка кошелька на чистоту средств',
        'referral': 'Приглашайте друзей и получайте бонусы'
    };
    return descriptions[page] || '';
}

/**
 * Open support
 */
function openSupport() {
    if (tg) {
        // Open support bot or channel
        tg.openTelegramLink('https://t.me/noname_ex_support');
    } else {
        alert('Открытие поддержки...');
    }
}

/**
 * Show rate details
 */
function showRateDetails() {
    if (tg) {
        tg.showPopup({
            title: 'USDT / RUB',
            message: `Текущий курс: ${state.currentRate} ₽\nИзменение: ${state.rateChange >= 0 ? '+' : ''}${state.rateChange}%\n\nОбновлено: ${new Date().toLocaleTimeString('ru-RU')}`,
            buttons: [
                { id: 'refresh', type: 'default', text: 'Обновить' },
                { id: 'close', type: 'cancel' }
            ]
        }, (buttonId) => {
            if (buttonId === 'refresh') {
                updateRate();
            }
        });
    }
}

/**
 * Initialize rate updates
 */
function initRateUpdates() {
    // Update rate immediately on load
    updateRate();
    // Обновление курса раз в минуту
    setInterval(updateRate, 60000);
}

// Лог ошибки курса не чаще раза в минуту
let lastRateErrorLog = 0;
const RATE_ERROR_LOG_INTERVAL = 60000;

function getBackendApiBaseUrl() {
    const config = window.BACKEND_API_CONFIG;
    if (config && config.baseUrl) return config.baseUrl;
    const origin = typeof window !== 'undefined' && window.location && window.location.origin ? window.location.origin : '';
    if (origin && !/localhost|127\.0\.0\.1/.test(origin)) return origin + '/api';
    return 'http://localhost:8000/api';
}

function setRateLoading(loading) {
    state.rateLoading = loading;
    const row = document.querySelector('.rate-cards-row');
    if (row) {
        if (loading) row.classList.add('rate-loading');
        else row.classList.remove('rate-loading');
    }
}

function applyRatesToUI() {
    const buyRateValueEl = document.getElementById('buyRateValue');
    const sellRateValueEl = document.getElementById('sellRateValue');
    // Покупка/продажа поменяны местами: карточка «Покупка» = sell, «Продажа» = buy
    if (buyRateValueEl) buyRateValueEl.textContent = state.sellRate.toFixed(2);
    if (sellRateValueEl) sellRateValueEl.textContent = state.buyRate.toFixed(2);
    if (typeof window.updateRatesFromAPI === 'function') window.updateRatesFromAPI();
    if (window.updateExchangeValues && state.currentPage === 'exchange') window.updateExchangeValues();
}

/**
 * Update rate from backend API (which fetches external rate + applies admin markup formula).
 * Fallback: direct external API call (without markup).
 */
async function updateRate() {
    setRateLoading(true);

    let data = null;

    // Primary: backend /api/rate (applies markup formula from admin panel)
    try {
        const baseUrl = getBackendApiBaseUrl();
        const response = await fetch(baseUrl + '/rate', { method: 'GET', headers: { 'Accept': 'application/json' } });
        if (response.ok) {
            const json = await response.json();
            if (json && (typeof json.buy === 'number' || json.buy != null) && (typeof json.sell === 'number' || json.sell != null)) {
                data = { buy: parseFloat(json.buy), sell: parseFloat(json.sell) };
            }
        }
    } catch (error) {
        const now = Date.now();
        if (now - lastRateErrorLog > RATE_ERROR_LOG_INTERVAL) {
            console.warn('Backend rate API failed:', error.message || error, '— trying external API');
            lastRateErrorLog = now;
        }
    }

    // Fallback: direct external API (without markup)
    if (!data) {
        try {
            const response = await fetch(RATE_API_CONFIG.url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Accept-Language': 'ru',
                    'access-token': RATE_API_CONFIG.accessToken
                }
            });

            if (response.ok) {
                const json = await response.json();
                if (json && typeof json.buy === 'number' && typeof json.sell === 'number') {
                    data = { buy: json.buy, sell: json.sell };
                }
            }
        } catch (error) {
            const now = Date.now();
            if (now - lastRateErrorLog > RATE_ERROR_LOG_INTERVAL) {
                console.warn('External rate API also failed:', error.message || error);
                lastRateErrorLog = now;
            }
        }
    }

    if (data) {
        const previousBuyRate = state.buyRate;
        state.buyRate = parseFloat(data.buy);
        state.sellRate = parseFloat(data.sell);
        state.currentRate = state.buyRate;
        window.globalBuyRate = state.buyRate;
        window.globalSellRate = state.sellRate;
        if (previousBuyRate > 0) {
            state.rateChange = Math.round((state.buyRate - previousBuyRate) * 100) / 100;
        }
        state.rateLoadedOnce = true;
    }
    applyRatesToUI();
    setRateLoading(false);
}

/**
 * Haptic feedback
 */
function hapticFeedback(type = 'light') {
    if (!tg?.HapticFeedback) return;

    switch (type) {
        case 'light':
            tg.HapticFeedback.impactOccurred('light');
            break;
        case 'medium':
            tg.HapticFeedback.impactOccurred('medium');
            break;
        case 'heavy':
            tg.HapticFeedback.impactOccurred('heavy');
            break;
        case 'success':
            tg.HapticFeedback.notificationOccurred('success');
            break;
        case 'warning':
            tg.HapticFeedback.notificationOccurred('warning');
            break;
        case 'error':
            tg.HapticFeedback.notificationOccurred('error');
            break;
        default:
            tg.HapticFeedback.selectionChanged();
    }
}

/**
 * Show loading state
 */
function showLoading() {
    state.isLoading = true;
    document.body.classList.add('loading');
}

/**
 * Hide loading state
 */
function hideLoading() {
    state.isLoading = false;
    document.body.classList.remove('loading');
}

/**
 * Show feature in development notification
 */
function showFeatureInDevelopment(featureName) {
    hapticFeedback('light');
    
    const tg = window.Telegram?.WebApp;
    const message = `${featureName}\n\nДанный функционал находится в разработке и будет доступен в ближайшее время. Следите за обновлениями!`;
    
    if (tg) {
        tg.showAlert(message);
    } else {
        alert(message);
    }
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        padding: 12px 24px;
        background: var(--color-bg-card);
        color: var(--color-text-primary);
        border-radius: 8px;
        font-size: 14px;
        z-index: 1000;
        animation: fadeInUp 0.3s ease;
    `;

    document.body.appendChild(toast);

    // Remove after 3 seconds
    setTimeout(() => {
        toast.style.animation = 'fadeInUp 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/**
 * Load exchange page dynamically
 */
let exchangePageLoaded = false;
let exchangeStylesLoaded = false;
let exchangeScriptLoaded = false;

async function loadExchangePage() {
    const container = document.getElementById('pageExchangeContainer');
    if (!container) return Promise.resolve();

    // Load CSS if not loaded
    if (!exchangeStylesLoaded) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'pages/css/exchange.css';
        document.head.appendChild(link);
        exchangeStylesLoaded = true;
    }

    // Load HTML if not loaded
    if (!exchangePageLoaded) {
        try {
            const response = await fetch('pages/exchange.html');
            const html = await response.text();
            container.innerHTML = html;
            exchangePageLoaded = true;
        } catch (error) {
            console.error('Failed to load exchange page:', error);
            return Promise.reject(error);
        }
    }

    // Load JS if not loaded (async, doesn't block page display)
    if (!exchangeScriptLoaded) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'pages/js/exchange.js';
            script.onload = () => {
                exchangeScriptLoaded = true;
                // Initialize exchange page
                if (window.initExchangePage) {
                    window.initExchangePage();
                }
                // Update values
                if (window.updateExchangeValues) {
                    window.updateExchangeValues();
                }
                resolve();
            };
            script.onerror = () => {
                console.error('Failed to load exchange script');
                reject(new Error('Failed to load exchange script'));
            };
            document.body.appendChild(script);
        });
    } else {
        // Re-initialize if already loaded
        if (window.initExchangePage) {
            window.initExchangePage();
        }
        if (window.updateExchangeValues) {
            window.updateExchangeValues();
        }
        return Promise.resolve();
    }
}

/**
 * Load requests page dynamically
 */
let requestsPageLoaded = false;
let requestsStylesLoaded = false;
let requestsScriptLoaded = false;

async function loadRequestsPage() {
    const container = document.getElementById('pageRequestsContainer');
    if (!container) return;

    // Load CSS if not loaded
    if (!requestsStylesLoaded) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'pages/css/requests.css';
        document.head.appendChild(link);
        requestsStylesLoaded = true;
    }

    // Load HTML if not loaded
    if (!requestsPageLoaded) {
        try {
            const response = await fetch('pages/requests.html');
            const html = await response.text();
            container.innerHTML = html;
            requestsPageLoaded = true;
        } catch (error) {
            console.error('Failed to load requests page:', error);
            return;
        }
    }

    // Load JS if not loaded
    if (!requestsScriptLoaded) {
        return new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = 'pages/js/requests.js?v=3';
            script.onload = () => {
                requestsScriptLoaded = true;
                // Initialize requests page
                if (window.initRequestsPage) {
                    window.initRequestsPage();
                }
                // Show the page
                const requestsPage = container.querySelector('.page-requests');
                if (requestsPage) {
                    requestsPage.classList.add('active');
                }
                resolve();
            };
            script.onerror = () => {
                console.error('Failed to load requests script');
                resolve();
            };
            document.body.appendChild(script);
        });
    } else {
        // Re-initialize if already loaded
        if (window.initRequestsPage) {
            window.initRequestsPage();
        }
        // Show the page
        const requestsPage = container.querySelector('.page-requests');
        if (requestsPage) {
            requestsPage.classList.add('active');
        }
    }
}

/**
 * Load about page dynamically
 */
let aboutPageLoaded = false;
let aboutStylesLoaded = false;
let aboutScriptLoaded = false;

async function loadAboutPage() {
    const container = document.getElementById('pageAboutContainer');
    if (!container) {
        console.error('About page container not found');
        return Promise.resolve();
    }

    // Load CSS if not loaded
    if (!aboutStylesLoaded) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'pages/css/about.css';
        document.head.appendChild(link);
        aboutStylesLoaded = true;
    }

    // Load HTML if not loaded
    if (!aboutPageLoaded) {
        try {
            const response = await fetch('pages/about.html');
            const html = await response.text();
            container.innerHTML = html;
            aboutPageLoaded = true;
        } catch (error) {
            console.error('Failed to load about page:', error);
            return Promise.resolve();
        }
    }

    // Load JS if not loaded
    if (!aboutScriptLoaded) {
        return new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = 'pages/js/about.js';
            script.onload = () => {
                aboutScriptLoaded = true;
                // Initialize about page
                if (window.initAboutPage) {
                    window.initAboutPage();
                }
                resolve();
            };
            script.onerror = () => {
                console.error('Failed to load about script');
                aboutScriptLoaded = true; // Mark as loaded to prevent retries
                resolve();
            };
            document.body.appendChild(script);
        });
    } else {
        // Re-initialize if already loaded
        if (window.initAboutPage) {
            window.initAboutPage();
        }
        // Return resolved promise for consistency
        return Promise.resolve();
    }
}

/**
 * Load support page dynamically
 */
let supportPageLoaded = false;
let supportStylesLoaded = false;
let supportScriptLoaded = false;

async function loadSupportPage() {
    const container = document.getElementById('pageSupportContainer');
    if (!container) return;

    // Load CSS if not loaded
    if (!supportStylesLoaded) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'pages/css/support.css';
        document.head.appendChild(link);
        supportStylesLoaded = true;
    }

    // Load HTML if not loaded
    if (!supportPageLoaded) {
        try {
            const response = await fetch('pages/support.html');
            const html = await response.text();
            container.innerHTML = html;
            supportPageLoaded = true;
        } catch (error) {
            console.error('Failed to load support page:', error);
            return;
        }
    }

    // Load JS if not loaded
    if (!supportScriptLoaded) {
        return new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = 'pages/js/support.js';
            script.onload = () => {
                supportScriptLoaded = true;
                // Initialize support page
                if (window.initSupportPage) {
                    window.initSupportPage();
                }
                // Show the page
                const supportPage = container.querySelector('.page-support');
                if (supportPage) {
                    supportPage.classList.add('active');
                }
                resolve();
            };
            script.onerror = () => {
                console.error('Failed to load support script');
                resolve();
            };
            document.body.appendChild(script);
        });
    } else {
        // Re-initialize if already loaded
        if (window.initSupportPage) {
            window.initSupportPage();
        }
        // Show the page
        const supportPage = container.querySelector('.page-support');
        if (supportPage) {
            supportPage.classList.add('active');
        }
    }
}

/**
 * Load rate page dynamically
 */
let ratePageLoaded = false;
let rateStylesLoaded = false;
let rateScriptLoaded = false;

async function loadRatePage() {
    const container = document.getElementById('pageRateContainer');
    if (!container) return;

    // Load CSS if not loaded
    if (!rateStylesLoaded) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'pages/css/rate.css?v=' + Date.now();
        document.head.appendChild(link);
        rateStylesLoaded = true;
    }

    // Load HTML if not loaded
    if (!ratePageLoaded) {
        try {
            const response = await fetch('pages/rate.html?v=' + Date.now());
            const html = await response.text();
            container.innerHTML = html;
            ratePageLoaded = true;
        } catch (error) {
            console.error('Failed to load rate page:', error);
            return;
        }
    }

    // Load JS if not loaded
    if (!rateScriptLoaded) {
        return new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = 'pages/js/rate.js?v=' + Date.now();
            script.onload = () => {
                rateScriptLoaded = true;
                // Initialize rate page
                if (window.initRatePage) {
                    window.initRatePage();
                }
                // Show the page
                const ratePage = container.querySelector('.page-rate');
                if (ratePage) {
                    ratePage.classList.add('active');
                }
                // Force update rates after page is shown
                setTimeout(() => {
                    if (typeof window.updateRatesFromAPI === 'function') {
                        window.updateRatesFromAPI();
                    }
                }, 200);
                resolve();
            };
            script.onerror = () => {
                console.error('Failed to load rate script');
                resolve();
            };
            document.body.appendChild(script);
        });
    } else {
        // Re-initialize if already loaded
        if (window.initRatePage) {
            window.initRatePage();
        }
        // Show the page
        const ratePage = container.querySelector('.page-rate');
        if (ratePage) {
            ratePage.classList.add('active');
        }
        // Force update rates when showing the page
        if (typeof window.updateRatesFromAPI === 'function') {
            setTimeout(() => {
                window.updateRatesFromAPI();
            }, 100);
        }
    }
}

/**
 * Check if the current Telegram user is an admin and show/hide admin button
 */
async function checkAdminStatus() {
    const tg = window.Telegram?.WebApp;
    const initData = tg?.initData || '';
    if (!initData) {
        console.log('No initData, skipping admin check');
        return;
    }

    try {
        const baseUrl = getBackendApiBaseUrl();
        const response = await fetch(baseUrl + '/admin/check', {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'X-Telegram-Init-Data': initData
            }
        });

        if (response.ok) {
            const data = await response.json();
            if (data.is_admin) {
                const adminBtn = document.getElementById('btnAdminPanel');
                if (adminBtn) {
                    adminBtn.style.display = '';
                    // Apply animation like other buttons
                    adminBtn.style.animationDelay = '0.4s';
                }
                console.log('Admin access granted for user', data.telegram_id);
            }
        }
    } catch (e) {
        console.log('Admin check failed (non-critical):', e.message || e);
    }
}

/**
 * Load admin page dynamically
 */
let adminPageLoaded = false;
let adminStylesLoaded = false;
let adminScriptLoaded = false;

function getAdminPageBaseUrl() {
    const path = window.location.pathname || '/';
    const dir = path.endsWith('/') ? path.slice(0, -1) : path.replace(/\/[^/]*$/, '');
    const base = (dir ? dir + '/' : '/');
    return window.location.origin + base;
}

async function loadAdminPage() {
    const container = document.getElementById('pageAdminContainer');
    if (!container) return;

    const baseUrl = getAdminPageBaseUrl();
    if (!baseUrl) return;

    // Load CSS if not loaded (cache-bust for updates)
    if (!adminStylesLoaded) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = baseUrl + 'pages/css/admin.css?v=2';
        document.head.appendChild(link);
        adminStylesLoaded = true;
    }

    // Always fetch latest HTML; use absolute URL + cache-bust so updates are visible
    const adminHtmlUrl = baseUrl + 'pages/admin.html?t=' + Date.now();
    try {
        const response = await fetch(adminHtmlUrl, { cache: 'no-store' });
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const html = await response.text();
        if (!html || html.indexOf('admin-filters-open-btn') === -1) {
            console.warn('Admin HTML may be outdated (missing admin-filters-open-btn)');
        }
        container.innerHTML = html;
    } catch (error) {
        console.error('Failed to load admin page:', error);
        return;
    }

    // Load JS if not loaded (use baseUrl + version so updates are picked up)
    if (!adminScriptLoaded) {
        return new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = baseUrl + 'pages/js/admin.js?v=2';
            script.onload = () => {
                adminScriptLoaded = true;
                if (window.initAdminPage) {
                    window.initAdminPage();
                }
                const adminPage = container.querySelector('.page-admin');
                if (adminPage) {
                    adminPage.classList.add('active');
                }
                resolve();
            };
            script.onerror = () => {
                console.error('Failed to load admin script');
                resolve();
            };
            document.body.appendChild(script);
        });
    } else {
        if (window.initAdminPage) {
            window.initAdminPage();
        }
        const adminPage = container.querySelector('.page-admin');
        if (adminPage) {
            adminPage.classList.add('active');
        }
    }
}

/**
 * Format currency
 */
function formatCurrency(value, currency = 'RUB') {
    return new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2
    }).format(value);
}

/**
 * Get current rate based on exchange mode (for exchange page)
 */
function getCurrentRate() {
    // If exchange page is active, return rate based on mode
    if (window.exchangeState && window.exchangeState.mode === 'sell') {
        return state.sellRate || 96.80;
    }
    return state.buyRate || 97.50;
}

/**
 * Get buy rate
 */
/** Курс для режима «Покупка» (карточка ПОКУПКА) — берём sell из API */
function getBuyRate() {
    return state.sellRate || 96.80;
}

/** Курс для режима «Продажа» (карточка ПРОДАЖА) — берём buy из API */
function getSellRate() {
    return state.buyRate || 97.50;
}

/**
 * Send data to Telegram bot
 */
function sendToBot(data) {
    if (tg) {
        tg.sendData(JSON.stringify(data));
    } else {
        console.log('Data to send:', data);
    }
}


// Export for external use
window.NoNameEx = {
    state,
    updateRate,
    navigateTo,
    showPage,
    sendToBot,
    showToast,
    getCurrentRate,
    hapticFeedback
};

// Make functions globally available for exchange page
window.getCurrentRate = getCurrentRate;
window.getBuyRate = getBuyRate;
window.getSellRate = getSellRate;
window.hapticFeedback = hapticFeedback;
window.sendToBot = sendToBot;
window.showToast = showToast;
window.showPage = showPage;
