/**
 * Admin Panel Page Logic
 * Rate settings management + all orders with filtering/pagination.
 */

const ADMIN_LOG = '[Admin]';

function adminLog(msg, data) {
    if (data !== undefined) console.log(ADMIN_LOG, msg, data);
    else console.log(ADMIN_LOG, msg);
}

function adminError(msg, err) {
    console.error(ADMIN_LOG, msg, err != null ? err : '');
}

// Admin state
window.adminState = {
    currentTab: 'rates',
    telegramId: null,
    // Rate settings
    buyMarkup: 0,
    sellMarkup: 0,
    rawBuy: 0,
    rawSell: 0,
    finalBuy: 0,
    finalSell: 0,
    // Orders
    orders: [],
    ordersPage: 1,
    ordersPageSize: 20,
    ordersTotalPages: 1,
    ordersTotal: 0,
    filters: {
        status: '',
        orderId: '',
        amountMin: '',
        amountMax: '',
        dateFrom: '',
        dateTo: ''
    }
};

function getApiBaseUrl() {
    const config = window.BACKEND_API_CONFIG;
    if (config && config.baseUrl) return config.baseUrl;
    const origin = typeof window !== 'undefined' && window.location && window.location.origin ? window.location.origin : '';
    if (origin && !/localhost|127\.0\.0\.1/.test(origin)) return origin + '/api';
    return 'http://localhost:8000/api';
}

function getInitData() {
    const tg = window.Telegram?.WebApp;
    return tg?.initData || '';
}

function getTelegramId() {
    const tg = window.Telegram?.WebApp;
    return tg?.initDataUnsafe?.user?.id || null;
}

// ============================================
// RATE SETTINGS
// ============================================

async function loadRateSettings() {
    const baseUrl = getApiBaseUrl();
    const telegramId = getTelegramId();
    if (!telegramId) {
        adminError('No telegram ID for rate settings');
        return;
    }

    try {
        const url = baseUrl + '/admin/rate-settings?admin_id=' + telegramId;
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'X-Telegram-Init-Data': getInitData()
            }
        });

        if (!response.ok) {
            adminError('Failed to load rate settings', { status: response.status });
            return;
        }

        const data = await response.json();
        adminLog('Rate settings loaded', data);

        window.adminState.buyMarkup = data.buy_markup_percent;
        window.adminState.sellMarkup = data.sell_markup_percent;
        window.adminState.rawBuy = data.raw_buy_rate;
        window.adminState.rawSell = data.raw_sell_rate;
        window.adminState.finalBuy = data.final_buy_rate;
        window.adminState.finalSell = data.final_sell_rate;

        // Update UI
        updateRateSettingsUI(data);
    } catch (e) {
        adminError('Error loading rate settings', e);
    }
}

function updateRateSettingsUI(data) {
    const rawBuyEl = document.getElementById('adminRawBuy');
    const rawSellEl = document.getElementById('adminRawSell');
    const buyMarkupEl = document.getElementById('adminBuyMarkup');
    const sellMarkupEl = document.getElementById('adminSellMarkup');
    const finalBuyEl = document.getElementById('adminFinalBuy');
    const finalSellEl = document.getElementById('adminFinalSell');
    const updatedInfoEl = document.getElementById('adminUpdatedInfo');
    const updatedTextEl = document.getElementById('adminUpdatedText');

    // У Mosca покупка = sell, продажа = buy — в админке показываем соответственно
    if (rawBuyEl) rawBuyEl.textContent = data.raw_sell_rate.toFixed(2) + ' RUB';
    if (rawSellEl) rawSellEl.textContent = data.raw_buy_rate.toFixed(2) + ' RUB';
    if (buyMarkupEl) buyMarkupEl.value = data.buy_markup_percent;
    if (sellMarkupEl) sellMarkupEl.value = data.sell_markup_percent;
    if (finalBuyEl) finalBuyEl.textContent = data.final_sell_rate.toFixed(2) + ' RUB';
    if (finalSellEl) finalSellEl.textContent = data.final_buy_rate.toFixed(2) + ' RUB';

    if (data.updated_at && updatedInfoEl && updatedTextEl) {
        const d = new Date(data.updated_at);
        const dateStr = d.toLocaleDateString('ru-RU') + ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        updatedTextEl.textContent = 'Обновлено: ' + dateStr + ' (ID: ' + (data.updated_by || 'system') + ')';
        updatedInfoEl.style.display = '';
    }
}

function recalcFinalRates() {
    const buyMarkupEl = document.getElementById('adminBuyMarkup');
    const sellMarkupEl = document.getElementById('adminSellMarkup');
    const finalBuyEl = document.getElementById('adminFinalBuy');
    const finalSellEl = document.getElementById('adminFinalSell');

    const buyMarkup = parseFloat(buyMarkupEl?.value) || 0;
    const sellMarkup = parseFloat(sellMarkupEl?.value) || 0;
    const rawBuy = window.adminState.rawBuy;
    const rawSell = window.adminState.rawSell;

    // Наценка покупки → к rawSell (Mosca sell); наценка продажи → к rawBuy (Mosca buy)
    if (rawSell > 0 && finalBuyEl) {
        finalBuyEl.textContent = (rawSell * (1 + buyMarkup / 100)).toFixed(2) + ' RUB';
    }
    if (rawBuy > 0 && finalSellEl) {
        finalSellEl.textContent = (rawBuy * (1 + sellMarkup / 100)).toFixed(2) + ' RUB';
    }
}

async function saveRateSettings() {
    const baseUrl = getApiBaseUrl();
    const telegramId = getTelegramId();
    if (!telegramId) {
        adminError('No telegram ID for save');
        return;
    }

    const buyMarkupEl = document.getElementById('adminBuyMarkup');
    const sellMarkupEl = document.getElementById('adminSellMarkup');
    const saveBtn = document.getElementById('adminSaveRates');

    const buyMarkup = parseFloat(buyMarkupEl?.value) || 0;
    const sellMarkup = parseFloat(sellMarkupEl?.value) || 0;

    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.querySelector('span').textContent = 'СОХРАНЕНИЕ...';
    }

    try {
        const response = await fetch(baseUrl + '/admin/rate-settings', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-Telegram-Init-Data': getInitData()
            },
            body: JSON.stringify({
                buy_markup_percent: buyMarkup,
                sell_markup_percent: sellMarkup,
                admin_id: telegramId
            })
        });

        if (!response.ok) {
            const text = await response.text();
            adminError('Save failed', { status: response.status, body: text });
            if (window.showToast) window.showToast('Ошибка сохранения', 'error');
            return;
        }

        const data = await response.json();
        adminLog('Rate settings saved', data);
        updateRateSettingsUI(data);

        window.adminState.buyMarkup = data.buy_markup_percent;
        window.adminState.sellMarkup = data.sell_markup_percent;
        window.adminState.rawBuy = data.raw_buy_rate;
        window.adminState.rawSell = data.raw_sell_rate;
        window.adminState.finalBuy = data.final_buy_rate;
        window.adminState.finalSell = data.final_sell_rate;

        if (window.showToast) window.showToast('Настройки сохранены', 'success');
        if (window.hapticFeedback) window.hapticFeedback('success');
    } catch (e) {
        adminError('Error saving rate settings', e);
        if (window.showToast) window.showToast('Ошибка сети', 'error');
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.querySelector('span').textContent = 'СОХРАНИТЬ';
        }
    }
}

// ============================================
// ORDERS MANAGEMENT
// ============================================

const adminStatusLabels = {
    pending: 'В ОБРАБОТКЕ',
    confirmed: 'ПОДТВЕРЖДЕНО',
    rejected: 'ОТКЛОНЕНО',
    cancelled: 'ОТМЕНЕНО'
};

async function loadAdminOrders() {
    const baseUrl = getApiBaseUrl();
    const telegramId = getTelegramId();
    if (!telegramId) {
        adminError('No telegram ID for orders');
        return;
    }

    const listEl = document.getElementById('adminOrdersList');
    const emptyEl = document.getElementById('adminOrdersEmpty');
    const paginationEl = document.getElementById('adminPagination');

    if (listEl) listEl.innerHTML = '<div class="admin-loading">Загрузка заявок...</div>';
    if (emptyEl) emptyEl.style.display = 'none';

    const st = window.adminState;
    const params = new URLSearchParams();
    params.set('admin_id', telegramId);
    params.set('page', st.ordersPage);
    params.set('page_size', st.ordersPageSize);

    if (st.filters.status) params.set('status', st.filters.status);
    if (st.filters.orderId) params.set('order_id', st.filters.orderId);
    if (st.filters.amountMin) params.set('amount_min', st.filters.amountMin);
    if (st.filters.amountMax) params.set('amount_max', st.filters.amountMax);
    if (st.filters.dateFrom) params.set('date_from', st.filters.dateFrom);
    if (st.filters.dateTo) params.set('date_to', st.filters.dateTo);

    try {
        const response = await fetch(baseUrl + '/admin/orders?' + params.toString(), {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'X-Telegram-Init-Data': getInitData()
            }
        });

        if (!response.ok) {
            adminError('Failed to load orders', { status: response.status });
            if (listEl) listEl.innerHTML = '<div class="admin-loading" style="color:#c00;">Ошибка загрузки</div>';
            return;
        }

        const data = await response.json();
        adminLog('Orders loaded', { total: data.total, page: data.page, pages: data.total_pages });

        st.orders = data.orders || [];
        st.ordersTotal = data.total;
        st.ordersPage = data.page;
        st.ordersTotalPages = data.total_pages;

        renderAdminOrders();
    } catch (e) {
        adminError('Error loading orders', e);
        if (listEl) listEl.innerHTML = '<div class="admin-loading" style="color:#c00;">Ошибка сети</div>';
    }
}

function renderAdminOrders() {
    const listEl = document.getElementById('adminOrdersList');
    const emptyEl = document.getElementById('adminOrdersEmpty');
    const paginationEl = document.getElementById('adminPagination');
    const totalEl = document.getElementById('adminOrdersTotal');
    const pageInfoEl = document.getElementById('adminPageInfo');
    const prevBtn = document.getElementById('adminPrevPage');
    const nextBtn = document.getElementById('adminNextPage');

    const st = window.adminState;

    if (totalEl) totalEl.textContent = st.ordersTotal;

    if (!listEl) return;
    listEl.innerHTML = '';

    if (st.orders.length === 0) {
        listEl.style.display = 'none';
        if (emptyEl) emptyEl.style.display = 'flex';
        if (paginationEl) paginationEl.style.display = 'none';
        return;
    }

    listEl.style.display = '';
    if (emptyEl) emptyEl.style.display = 'none';

    st.orders.forEach(function (order, index) {
        const isBuy = (order.currency_from || '').toUpperCase() === 'RUB';
        const title = isBuy ? 'Покупка USDT' : 'Продажа USDT';
        const sendStr = formatAdminAmount(order.amount_from) + ' ' + (order.currency_from || '');
        const receiveStr = formatAdminAmount(order.amount_to) + ' ' + (order.currency_to || '');
        const status = order.status || 'pending';
        const badgeText = adminStatusLabels[status] || status.toUpperCase();
        const created = order.created_at ? new Date(order.created_at) : new Date();
        const dateStr = created.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });
        const timeStr = created.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

        const card = document.createElement('div');
        card.className = 'admin-order-card';
        card.innerHTML =
            '<div class="admin-order-accent status-' + escapeAttr(status) + '"></div>' +
            '<div class="admin-order-info">' +
                '<span class="admin-order-title">#' + order.id + ' ' + escapeHtmlAdmin(title) + '</span>' +
                '<span class="admin-order-meta">' + escapeHtmlAdmin(sendStr) + ' → ' + escapeHtmlAdmin(receiveStr) + '</span>' +
                '<span class="admin-order-meta">TG: ' + (order.telegram_id || '—') + '</span>' +
            '</div>' +
            '<div class="admin-order-right">' +
                '<span class="admin-order-badge badge-' + escapeAttr(status) + '">' + escapeHtmlAdmin(badgeText) + '</span>' +
                '<span class="admin-order-date">' + dateStr + ' ' + timeStr + '</span>' +
            '</div>';

        listEl.appendChild(card);

        // Stagger animation
        setTimeout(function () {
            card.classList.add('visible');
        }, index * 30 + 50);
    });

    // Pagination
    if (st.ordersTotalPages > 1 && paginationEl) {
        paginationEl.style.display = 'flex';
        if (pageInfoEl) pageInfoEl.textContent = st.ordersPage + ' / ' + st.ordersTotalPages;
        if (prevBtn) prevBtn.disabled = st.ordersPage <= 1;
        if (nextBtn) nextBtn.disabled = st.ordersPage >= st.ordersTotalPages;
    } else if (paginationEl) {
        paginationEl.style.display = 'none';
    }
}

function formatAdminAmount(n) {
    if (n == null || n === '') return '0';
    const num = Number(n);
    if (isNaN(num)) return String(n);
    return num.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function escapeHtmlAdmin(s) {
    if (s == null) return '';
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
}

function escapeAttr(s) {
    if (s == null) return '';
    return String(s).replace(/[^a-zA-Z0-9_-]/g, '');
}

// ============================================
// FILTERS PAGE (separate screen)
// ============================================

function openAdminFiltersPage() {
    window.adminFiltersVisible = true;
    window.closeAdminFiltersPage = closeAdminFiltersPage;

    var page = document.getElementById('adminFiltersPage');
    var tabs = document.getElementById('adminTabOrders');
    if (page) page.classList.add('active');
    if (page) page.setAttribute('aria-hidden', 'false');
    if (tabs) tabs.classList.add('filters-overlay-hidden');

    syncFiltersFormFromState();
    if (window.hapticFeedback) window.hapticFeedback('light');
}

function closeAdminFiltersPage() {
    window.adminFiltersVisible = false;
    window.closeAdminFiltersPage = null;

    var page = document.getElementById('adminFiltersPage');
    var tabs = document.getElementById('adminTabOrders');
    if (page) page.classList.remove('active');
    if (page) page.setAttribute('aria-hidden', 'true');
    if (tabs) tabs.classList.remove('filters-overlay-hidden');

    renderActiveFilters();
    if (window.hapticFeedback) window.hapticFeedback('light');
}

function syncFiltersFormFromState() {
    var st = window.adminState.filters;
    setElValue('adminFilterStatus', st.status);
    setElValue('adminFilterOrderId', st.orderId);
    setElValue('adminFilterAmountMin', st.amountMin);
    setElValue('adminFilterAmountMax', st.amountMax);
    setElValue('adminFilterDateFrom', st.dateFrom);
    setElValue('adminFilterDateTo', st.dateTo);
}

function setElValue(id, val) {
    var el = document.getElementById(id);
    if (el) el.value = val || '';
}

function readFiltersFormIntoState() {
    var st = window.adminState.filters;
    st.status = document.getElementById('adminFilterStatus')?.value || '';
    st.orderId = document.getElementById('adminFilterOrderId')?.value || '';
    st.amountMin = document.getElementById('adminFilterAmountMin')?.value || '';
    st.amountMax = document.getElementById('adminFilterAmountMax')?.value || '';
    st.dateFrom = document.getElementById('adminFilterDateFrom')?.value || '';
    st.dateTo = document.getElementById('adminFilterDateTo')?.value || '';
}

function applyFromFiltersPage() {
    readFiltersFormIntoState();
    window.adminState.ordersPage = 1;
    closeAdminFiltersPage();
    loadAdminOrders();
    if (window.showToast) window.showToast('Фильтры применены', 'success');
    if (window.hapticFeedback) window.hapticFeedback('success');
}

function resetFromFiltersPage() {
    window.adminState.filters = { status: '', orderId: '', amountMin: '', amountMax: '', dateFrom: '', dateTo: '' };
    window.adminState.ordersPage = 1;
    syncFiltersFormFromState();
    closeAdminFiltersPage();
    loadAdminOrders();
    if (window.showToast) window.showToast('Фильтры сброшены', 'success');
    if (window.hapticFeedback) window.hapticFeedback('light');
}

function hasAnyFilter() {
    var f = window.adminState.filters;
    return !!(f.status || f.orderId || f.amountMin || f.amountMax || f.dateFrom || f.dateTo);
}

var adminFilterChipLabels = {
    status: 'Статус',
    orderId: 'ID заявки',
    amountMin: 'Сумма от',
    amountMax: 'Сумма до',
    dateFrom: 'Дата от',
    dateTo: 'Дата до'
};

var adminFilterDisplayValue = {
    status: function (v) { return adminStatusLabels[v] || v; },
    orderId: function (v) { return '#' + v; },
    amountMin: function (v) { return v + ' ₽'; },
    amountMax: function (v) { return v + ' ₽'; },
    dateFrom: function (v) { return v; },
    dateTo: function (v) { return v; }
};

function renderActiveFilters() {
    var bar = document.getElementById('adminActiveFiltersBar');
    var chipsWrap = document.getElementById('adminActiveFiltersChips');
    if (!bar || !chipsWrap) return;

    if (!hasAnyFilter()) {
        bar.style.display = 'none';
        return;
    }

    bar.style.display = '';
    chipsWrap.innerHTML = '';

    var f = window.adminState.filters;
    var keys = ['status', 'orderId', 'amountMin', 'amountMax', 'dateFrom', 'dateTo'];
    keys.forEach(function (key) {
        var val = f[key];
        if (!val) return;
        var label = adminFilterChipLabels[key] || key;
        var displayVal = (adminFilterDisplayValue[key] || function (v) { return v; })(val);
        var chip = document.createElement('div');
        chip.className = 'admin-filter-chip';
        chip.dataset.filterKey = key;
        chip.innerHTML = '<span class="admin-filter-chip-text">' + escapeHtmlAdmin(label + ': ' + displayVal) + '</span><button type="button" class="admin-filter-chip-remove" data-filter-key="' + escapeAttr(key) + '" aria-label="Убрать фильтр">×</button>';
        chipsWrap.appendChild(chip);
    });
}

function removeOneFilter(key) {
    if (!window.adminState.filters[key]) return;
    window.adminState.filters[key] = '';
    var id = 'adminFilter' + key.charAt(0).toUpperCase() + key.slice(1);
    var el = document.getElementById(id);
    if (el) el.value = '';
    window.adminState.ordersPage = 1;
    loadAdminOrders();
    renderActiveFilters();
    if (window.hapticFeedback) window.hapticFeedback('light');
}

// ============================================
// TAB SWITCHING
// ============================================

function switchAdminTab(tabName) {
    if (!['rates', 'orders'].includes(tabName)) return;
    window.adminState.currentTab = tabName;

    // Update tab buttons
    document.querySelectorAll('#pageAdmin .admin-tab').forEach(function (tab) {
        tab.classList.toggle('active', tab.dataset.adminTab === tabName);
    });

    // Update tab content
    document.querySelectorAll('#pageAdmin .admin-tab-content').forEach(function (content) {
        content.classList.toggle('active', content.dataset.tab === tabName);
    });

    // Load data on first switch
    if (tabName === 'rates') {
        loadRateSettings();
    } else if (tabName === 'orders') {
        loadAdminOrders();
        renderActiveFilters();
    }

    if (window.hapticFeedback) window.hapticFeedback('light');
}

// ============================================
// EVENT HANDLERS
// ============================================

let adminGlobalHandlerInstalled = false;

function adminGlobalClickHandler(e) {
    const adminPage = document.getElementById('pageAdmin');
    if (!adminPage || !adminPage.contains(e.target)) return;

    // Tab clicks
    const tab = e.target.closest('.admin-tab');
    if (tab && tab.dataset.adminTab) {
        e.preventDefault();
        e.stopPropagation();
        switchAdminTab(tab.dataset.adminTab);
        return;
    }

    // Save rates
    if (e.target.closest('#adminSaveRates')) {
        e.preventDefault();
        e.stopPropagation();
        saveRateSettings();
        return;
    }

    // Open filters page (from orders tab)
    if (e.target.closest('#adminOpenFiltersBtn') || e.target.closest('#adminChangeFiltersBtn')) {
        e.preventDefault();
        e.stopPropagation();
        openAdminFiltersPage();
        return;
    }

    // Clear all filters (from active filters bar)
    if (e.target.closest('#adminClearAllFiltersBtn')) {
        e.preventDefault();
        e.stopPropagation();
        resetOrderFilters();
        return;
    }

    // Apply filters (on filters page)
    if (e.target.closest('#adminFiltersApplyBtn')) {
        e.preventDefault();
        e.stopPropagation();
        applyFromFiltersPage();
        return;
    }

    // Reset filters (on filters page)
    if (e.target.closest('#adminFiltersResetBtn')) {
        e.preventDefault();
        e.stopPropagation();
        resetFromFiltersPage();
        return;
    }

    // Remove one filter chip
    var chipRemove = e.target.closest('.admin-filter-chip-remove');
    if (chipRemove && chipRemove.dataset.filterKey) {
        e.preventDefault();
        e.stopPropagation();
        removeOneFilter(chipRemove.dataset.filterKey);
        return;
    }

    // Pagination prev
    if (e.target.closest('#adminPrevPage')) {
        e.preventDefault();
        e.stopPropagation();
        if (window.adminState.ordersPage > 1) {
            window.adminState.ordersPage--;
            loadAdminOrders();
        }
        return;
    }

    // Pagination next
    if (e.target.closest('#adminNextPage')) {
        e.preventDefault();
        e.stopPropagation();
        if (window.adminState.ordersPage < window.adminState.ordersTotalPages) {
            window.adminState.ordersPage++;
            loadAdminOrders();
        }
        return;
    }
}

function applyOrderFilters() {
    const st = window.adminState;
    st.filters.status = document.getElementById('adminFilterStatus')?.value || '';
    st.filters.orderId = document.getElementById('adminFilterOrderId')?.value || '';
    st.filters.amountMin = document.getElementById('adminFilterAmountMin')?.value || '';
    st.filters.amountMax = document.getElementById('adminFilterAmountMax')?.value || '';
    st.filters.dateFrom = document.getElementById('adminFilterDateFrom')?.value || '';
    st.filters.dateTo = document.getElementById('adminFilterDateTo')?.value || '';
    st.ordersPage = 1;
    loadAdminOrders();
    if (window.hapticFeedback) window.hapticFeedback('light');
}

function resetOrderFilters() {
    const st = window.adminState;
    st.filters = { status: '', orderId: '', amountMin: '', amountMax: '', dateFrom: '', dateTo: '' };
    st.ordersPage = 1;
    syncFiltersFormFromState();

    loadAdminOrders();
    renderActiveFilters();
    if (window.showToast) window.showToast('Фильтры сброшены', 'success');
    if (window.hapticFeedback) window.hapticFeedback('light');
}

// ============================================
// INIT
// ============================================

window.initAdminPage = function () {
    adminLog('initAdminPage: called');

    window.adminState.telegramId = getTelegramId();

    if (!adminGlobalHandlerInstalled) {
        document.addEventListener('click', adminGlobalClickHandler, true);
        adminGlobalHandlerInstalled = true;
        adminLog('Global click handler installed');
    }

    // Markup input live preview
    const buyInput = document.getElementById('adminBuyMarkup');
    const sellInput = document.getElementById('adminSellMarkup');
    if (buyInput) buyInput.addEventListener('input', recalcFinalRates);
    if (sellInput) sellInput.addEventListener('input', recalcFinalRates);

    // Load rate settings on init (default tab is rates)
    loadRateSettings();
};

adminLog('Script loaded');
