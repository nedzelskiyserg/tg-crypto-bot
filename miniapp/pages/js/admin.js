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
    filtersOpen: false,
    selectedPeriod: 'all',
    selectedOrder: null,
    filters: {
        status: '',
        type: '',
        orderId: '',
        amountMin: '',
        amountMax: '',
        dateFrom: '',
        dateTo: ''
    },
    // Draft filters (edited on filters page, applied on "ПОКАЗАТЬ")
    draftFilters: {
        status: '',
        type: '',
        orderId: '',
        amountMin: '',
        amountMax: '',
        dateFrom: '',
        dateTo: ''
    },
    draftPeriod: 'all'
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

const adminStatusLabelsShort = {
    pending: 'В обработке',
    confirmed: 'Подтверждено',
    rejected: 'Отклонено',
    cancelled: 'Отменено'
};

const adminPeriodLabels = {
    all: 'Все время',
    today: 'Сегодня',
    week: 'Неделя',
    month: 'Месяц'
};

// ============================================
// FILTERS PAGE NAVIGATION
// ============================================

function openFiltersPage() {
    var st = window.adminState;
    var filtersView = document.getElementById('adminFiltersView');
    var listView = document.getElementById('adminOrdersListView');

    if (!filtersView || !listView) return;

    // Copy current filters to draft
    st.draftFilters = JSON.parse(JSON.stringify(st.filters));
    st.draftPeriod = st.selectedPeriod;

    // Sync draft to UI
    syncDraftFiltersToUI();

    listView.classList.add('hidden');
    filtersView.classList.add('visible');
    st.filtersOpen = true;

    if (window.hapticFeedback) window.hapticFeedback('light');
}

function closeFiltersPage() {
    var filtersView = document.getElementById('adminFiltersView');
    var listView = document.getElementById('adminOrdersListView');

    if (!filtersView || !listView) return;

    filtersView.classList.remove('visible');
    listView.classList.remove('hidden');
    window.adminState.filtersOpen = false;
}

function syncDraftFiltersToUI() {
    var st = window.adminState;

    // Type chips
    document.querySelectorAll('#adminTypeChips .admin-status-chip').forEach(function (chip) {
        chip.classList.toggle('selected', chip.dataset.type === st.draftFilters.type);
    });

    // Status chips
    document.querySelectorAll('#adminStatusChips .admin-status-chip').forEach(function (chip) {
        chip.classList.toggle('selected', chip.dataset.status === st.draftFilters.status);
    });

    // Order ID
    var orderIdEl = document.getElementById('adminFilterOrderId');
    if (orderIdEl) orderIdEl.value = st.draftFilters.orderId || '';

    // Period presets
    document.querySelectorAll('#adminPeriodPresets .admin-period-btn').forEach(function (btn) {
        btn.classList.toggle('active', btn.dataset.period === st.draftPeriod);
    });

    // Custom date visibility
    var customEl = document.getElementById('adminPeriodCustom');
    if (customEl) {
        var isCustom = st.draftPeriod === 'all' || !st.draftPeriod;
        customEl.classList.toggle('visible', isCustom && (st.draftFilters.dateFrom || st.draftFilters.dateTo));
    }

    // Date inputs
    var dateFromEl = document.getElementById('adminFilterDateFrom');
    var dateToEl = document.getElementById('adminFilterDateTo');
    if (dateFromEl) dateFromEl.value = st.draftFilters.dateFrom || '';
    if (dateToEl) dateToEl.value = st.draftFilters.dateTo || '';

    // Amount inputs
    var amountMinEl = document.getElementById('adminFilterAmountMin');
    var amountMaxEl = document.getElementById('adminFilterAmountMax');
    if (amountMinEl) amountMinEl.value = st.draftFilters.amountMin || '';
    if (amountMaxEl) amountMaxEl.value = st.draftFilters.amountMax || '';
}

// ============================================
// PERIOD PRESETS
// ============================================

function getPeriodDates(period) {
    var now = new Date();
    var dateFrom = '';
    var dateTo = '';

    if (period === 'today') {
        dateFrom = formatDateISO(now);
        dateTo = formatDateISO(now);
    } else if (period === 'week') {
        var weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        dateFrom = formatDateISO(weekAgo);
        dateTo = formatDateISO(now);
    } else if (period === 'month') {
        var monthAgo = new Date(now);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        dateFrom = formatDateISO(monthAgo);
        dateTo = formatDateISO(now);
    }

    return { dateFrom: dateFrom, dateTo: dateTo };
}

function formatDateISO(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
}

function selectPeriod(period) {
    var st = window.adminState;
    st.draftPeriod = period;

    // Update UI
    document.querySelectorAll('#adminPeriodPresets .admin-period-btn').forEach(function (btn) {
        btn.classList.toggle('active', btn.dataset.period === period);
    });

    var customEl = document.getElementById('adminPeriodCustom');
    if (period !== 'all') {
        // Set dates from preset
        var dates = getPeriodDates(period);
        st.draftFilters.dateFrom = dates.dateFrom;
        st.draftFilters.dateTo = dates.dateTo;
        if (customEl) customEl.classList.remove('visible');
    } else {
        // Clear dates for "all"
        st.draftFilters.dateFrom = '';
        st.draftFilters.dateTo = '';
        if (customEl) customEl.classList.remove('visible');
        var dateFromEl = document.getElementById('adminFilterDateFrom');
        var dateToEl = document.getElementById('adminFilterDateTo');
        if (dateFromEl) dateFromEl.value = '';
        if (dateToEl) dateToEl.value = '';
    }

    if (window.hapticFeedback) window.hapticFeedback('light');
}

function toggleCustomDates() {
    var st = window.adminState;
    var customEl = document.getElementById('adminPeriodCustom');
    if (!customEl) return;

    // Deselect all period presets
    st.draftPeriod = 'all';
    document.querySelectorAll('#adminPeriodPresets .admin-period-btn').forEach(function (btn) {
        btn.classList.remove('active');
    });

    customEl.classList.add('visible');
}

// ============================================
// ACTIVE FILTER CHIPS
// ============================================

function getActiveFilterCount() {
    var st = window.adminState;
    var count = 0;
    if (st.filters.type) count++;
    if (st.filters.status) count++;
    if (st.filters.orderId) count++;
    if (st.filters.amountMin || st.filters.amountMax) count++;
    if (st.filters.dateFrom || st.filters.dateTo) count++;
    return count;
}

function renderActiveFilterChips() {
    var st = window.adminState;
    var container = document.getElementById('adminActiveFilters');
    var countEl = document.getElementById('adminFilterCount');
    var toggleBtn = document.getElementById('adminOpenFilters');

    if (!container) return;
    container.innerHTML = '';

    var chips = [];

    // Type chip
    if (st.filters.type) {
        chips.push({
            key: 'type',
            text: st.filters.type === 'buy' ? 'Покупка' : 'Продажа'
        });
    }

    // Status chip
    if (st.filters.status) {
        chips.push({
            key: 'status',
            text: adminStatusLabelsShort[st.filters.status] || st.filters.status
        });
    }

    // Order ID chip
    if (st.filters.orderId) {
        chips.push({
            key: 'orderId',
            text: 'ID #' + st.filters.orderId
        });
    }

    // Period chip
    if (st.filters.dateFrom || st.filters.dateTo) {
        var periodText = '';
        if (st.selectedPeriod && st.selectedPeriod !== 'all') {
            periodText = adminPeriodLabels[st.selectedPeriod];
        } else {
            var from = st.filters.dateFrom ? formatDateRu(st.filters.dateFrom) : '';
            var to = st.filters.dateTo ? formatDateRu(st.filters.dateTo) : '';
            if (from && to) periodText = from + ' – ' + to;
            else if (from) periodText = 'от ' + from;
            else if (to) periodText = 'до ' + to;
        }
        chips.push({ key: 'period', text: periodText });
    }

    // Amount chip
    if (st.filters.amountMin || st.filters.amountMax) {
        var amtText = '';
        if (st.filters.amountMin && st.filters.amountMax) {
            amtText = formatAdminAmount(st.filters.amountMin) + ' – ' + formatAdminAmount(st.filters.amountMax) + ' ₽';
        } else if (st.filters.amountMin) {
            amtText = 'от ' + formatAdminAmount(st.filters.amountMin) + ' ₽';
        } else {
            amtText = 'до ' + formatAdminAmount(st.filters.amountMax) + ' ₽';
        }
        chips.push({ key: 'amount', text: amtText });
    }

    var count = chips.length;

    // Update filter button state
    if (toggleBtn) toggleBtn.classList.toggle('has-filters', count > 0);
    if (countEl) {
        if (count > 0) {
            countEl.textContent = count;
            countEl.style.display = '';
        } else {
            countEl.style.display = 'none';
        }
    }

    // Show/hide chips container
    if (count === 0) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'flex';

    chips.forEach(function (chip) {
        var el = document.createElement('button');
        el.className = 'admin-filter-chip';
        el.dataset.filterKey = chip.key;
        el.innerHTML =
            '<span class="admin-filter-chip-text">' + escapeHtmlAdmin(chip.text) + '</span>' +
            '<span class="admin-filter-chip-close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg></span>';
        container.appendChild(el);
    });
}

function formatDateRu(dateStr) {
    if (!dateStr) return '';
    var parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return parts[2] + '.' + parts[1];
}

function removeFilterChip(key) {
    var st = window.adminState;

    if (key === 'status') {
        st.filters.status = '';
    } else if (key === 'period') {
        st.filters.dateFrom = '';
        st.filters.dateTo = '';
        st.selectedPeriod = 'all';
    } else if (key === 'amount') {
        st.filters.amountMin = '';
        st.filters.amountMax = '';
    } else if (key === 'type') {
        st.filters.type = '';
    } else if (key === 'orderId') {
        st.filters.orderId = '';
    }

    st.ordersPage = 1;
    // Update chips immediately so the removed chip disappears before API loads
    renderActiveFilterChips();
    loadAdminOrders();
    if (window.hapticFeedback) window.hapticFeedback('light');
}

// ============================================
// LOAD & RENDER ORDERS
// ============================================

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
        renderActiveFilterChips();
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

    // Client-side type filter
    var filteredOrders = st.orders;
    if (st.filters.type) {
        filteredOrders = st.orders.filter(function (order) {
            var isBuy = (order.currency_from || '').toUpperCase() === 'RUB';
            return st.filters.type === 'buy' ? isBuy : !isBuy;
        });
    }

    if (filteredOrders.length === 0) {
        listEl.style.display = 'none';
        if (emptyEl) emptyEl.style.display = 'flex';
        if (paginationEl) paginationEl.style.display = 'none';
        return;
    }

    filteredOrders.forEach(function (order, index) {
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
        card.dataset.orderId = order.id;
        card.innerHTML =
            '<div class="admin-order-accent status-' + escapeAttr(status) + '"></div>' +
            '<div class="admin-order-info">' +
                '<span class="admin-order-title">#' + order.id + ' ' + escapeHtmlAdmin(title) + '</span>' +
                '<span class="admin-order-meta">' + escapeHtmlAdmin(sendStr) + ' → ' + escapeHtmlAdmin(receiveStr) + '</span>' +
                '<span class="admin-order-meta">TG: ' + (order.user_id || '—') + '</span>' +
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
// TAB SWITCHING
// ============================================

function switchAdminTab(tabName) {
    if (!['rates', 'orders'].includes(tabName)) return;
    window.adminState.currentTab = tabName;

    // Always reset filters view when switching tabs
    var filtersView = document.getElementById('adminFiltersView');
    var listView = document.getElementById('adminOrdersListView');
    if (filtersView) filtersView.classList.remove('visible');
    if (listView) listView.classList.remove('hidden');
    window.adminState.filtersOpen = false;

    // Update tab buttons
    document.querySelectorAll('#pageAdmin .admin-tab').forEach(function (tab) {
        tab.classList.toggle('active', tab.dataset.adminTab === tabName);
    });

    // Update tab content
    document.querySelectorAll('#pageAdmin .admin-tab-content').forEach(function (content) {
        content.classList.toggle('active', content.dataset.tab === tabName);
    });

    // Load data on switch
    if (tabName === 'rates') {
        loadRateSettings();
    } else if (tabName === 'orders') {
        loadAdminOrders();
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

    // Open filters page
    if (e.target.closest('#adminOpenFilters')) {
        e.preventDefault();
        e.stopPropagation();
        openFiltersPage();
        return;
    }

    // Back from filters
    if (e.target.closest('#adminFiltersBack')) {
        e.preventDefault();
        e.stopPropagation();
        closeFiltersPage();
        return;
    }

    // Apply filters
    if (e.target.closest('#adminApplyFilters')) {
        e.preventDefault();
        e.stopPropagation();
        applyOrderFilters();
        return;
    }

    // Reset filters
    if (e.target.closest('#adminResetFilters')) {
        e.preventDefault();
        e.stopPropagation();
        resetOrderFilters();
        return;
    }

    // Modal close
    if (e.target.closest('[data-action="close-admin-modal"]')) {
        e.preventDefault();
        e.stopPropagation();
        closeAdminOrderModal();
        return;
    }

    // Order card click -> open modal
    var orderCard = e.target.closest('.admin-order-card');
    if (orderCard && orderCard.dataset.orderId) {
        e.preventDefault();
        e.stopPropagation();
        openAdminOrderModal(Number(orderCard.dataset.orderId));
        return;
    }

    // Type chip toggle
    var typeChip = e.target.closest('#adminTypeChips .admin-status-chip');
    if (typeChip && typeChip.dataset.type) {
        e.preventDefault();
        e.stopPropagation();
        toggleTypeChip(typeChip.dataset.type);
        return;
    }

    // Status chip toggle
    var statusChip = e.target.closest('#adminStatusChips .admin-status-chip');
    if (statusChip && statusChip.dataset.status) {
        e.preventDefault();
        e.stopPropagation();
        toggleStatusChip(statusChip.dataset.status);
        return;
    }

    // Period preset
    var periodBtn = e.target.closest('.admin-period-btn');
    if (periodBtn && periodBtn.dataset.period) {
        e.preventDefault();
        e.stopPropagation();
        selectPeriod(periodBtn.dataset.period);
        return;
    }

    // Filter chip removal
    var filterChip = e.target.closest('.admin-filter-chip');
    if (filterChip && filterChip.dataset.filterKey) {
        e.preventDefault();
        e.stopPropagation();
        removeFilterChip(filterChip.dataset.filterKey);
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

function toggleStatusChip(status) {
    var st = window.adminState;

    // Toggle: if already selected, deselect
    if (st.draftFilters.status === status) {
        st.draftFilters.status = '';
    } else {
        st.draftFilters.status = status;
    }

    // Update UI
    document.querySelectorAll('#adminStatusChips .admin-status-chip').forEach(function (chip) {
        chip.classList.toggle('selected', chip.dataset.status === st.draftFilters.status);
    });

    if (window.hapticFeedback) window.hapticFeedback('light');
}

function applyOrderFilters() {
    var st = window.adminState;

    // Read current draft input values
    st.draftFilters.orderId = document.getElementById('adminFilterOrderId')?.value || '';
    st.draftFilters.amountMin = document.getElementById('adminFilterAmountMin')?.value || '';
    st.draftFilters.amountMax = document.getElementById('adminFilterAmountMax')?.value || '';

    // If custom dates were entered manually (period = all), read them
    if (st.draftPeriod === 'all' || !st.draftPeriod) {
        var dateFromEl = document.getElementById('adminFilterDateFrom');
        var dateToEl = document.getElementById('adminFilterDateTo');
        st.draftFilters.dateFrom = dateFromEl?.value || '';
        st.draftFilters.dateTo = dateToEl?.value || '';
    }

    // Apply draft to active filters
    st.filters = JSON.parse(JSON.stringify(st.draftFilters));
    st.selectedPeriod = st.draftPeriod;
    st.ordersPage = 1;

    // Close filters page and load
    closeFiltersPage();
    loadAdminOrders();
    if (window.hapticFeedback) window.hapticFeedback('success');
}

function resetOrderFilters() {
    var st = window.adminState;
    st.draftFilters = { status: '', type: '', orderId: '', amountMin: '', amountMax: '', dateFrom: '', dateTo: '' };
    st.draftPeriod = 'all';

    // Reset UI
    syncDraftFiltersToUI();
    if (window.hapticFeedback) window.hapticFeedback('light');
}

// ============================================
// ORDER DETAIL MODAL
// ============================================

function openAdminOrderModal(orderId) {
    var st = window.adminState;
    var order = st.orders.find(function (o) { return o.id == orderId; });
    if (!order) {
        adminError('Order not found', orderId);
        return;
    }

    st.selectedOrder = orderId;
    var modal = document.getElementById('adminOrderModal');
    if (!modal) return;

    var isBuy = (order.currency_from || '').toUpperCase() === 'RUB';
    var title = isBuy ? 'Покупка USDT' : 'Продажа USDT';
    var status = order.status || 'pending';
    var badgeText = adminStatusLabels[status] || status.toUpperCase();
    var created = order.created_at ? new Date(order.created_at) : new Date();
    var dateStr = created.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });
    var timeStr = created.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

    // Status badge
    var badge = modal.querySelector('.admin-detail-badge');
    if (badge) {
        badge.textContent = badgeText;
        badge.className = 'admin-detail-badge badge-' + escapeAttr(status);
    }

    // Fields
    setAdminModalText('adminModalType', title);
    setAdminModalText('adminModalSend', formatAdminAmount(order.amount_from) + ' ' + (order.currency_from || ''));
    setAdminModalText('adminModalReceive', formatAdminAmount(order.amount_to) + ' ' + (order.currency_to || ''));
    setAdminModalText('adminModalRate', '1 USDT = ' + Number(order.exchange_rate || 0).toFixed(2) + ' RUB');
    setAdminModalText('adminModalDate', dateStr + ', ' + timeStr);
    setAdminModalText('adminModalId', '#' + order.id);

    // Wallet
    var walletRow = document.getElementById('adminModalWalletRow');
    if (walletRow) {
        if (order.wallet_address) {
            walletRow.style.display = '';
            setAdminModalText('adminModalWallet', order.wallet_address);
        } else {
            walletRow.style.display = 'none';
        }
    }

    // Bank card
    var cardRow = document.getElementById('adminModalCardRow');
    if (cardRow) {
        if (order.bank_card) {
            cardRow.style.display = '';
            setAdminModalText('adminModalCard', order.bank_card);
        } else {
            cardRow.style.display = 'none';
        }
    }

    // User info: Telegram — юзернейм ссылкой t.me/username (без @)
    var tgEl = document.getElementById('adminModalTgId');
    if (tgEl) {
        var un = order.username ? String(order.username).replace(/^@/, '') : '';
        if (un) {
            tgEl.innerHTML = '<a href="https://t.me/' + escapeHtmlAdmin(un) + '" target="_blank" rel="noopener" class="admin-modal-tg-link">' + escapeHtmlAdmin(un) + '</a>';
        } else {
            tgEl.textContent = order.user_id ? order.user_id : '—';
        }
    }
    setAdminModalText('adminModalName', order.full_name || '—');
    setAdminModalText('adminModalPhone', order.phone || '—');
    setAdminModalText('adminModalEmail', order.email || '—');

    // Show modal
    modal.classList.remove('closing');
    var content = modal.querySelector('.admin-modal-content');
    if (content) {
        content.style.transform = '';
        content.style.transition = '';
    }

    document.body.style.overflow = 'hidden';
    requestAnimationFrame(function () { modal.classList.add('active'); });

    adminLog('Modal opened for order', orderId);
}

function setAdminModalText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text || '—';
}

function closeAdminOrderModal() {
    var modal = document.getElementById('adminOrderModal');
    if (!modal || !modal.classList.contains('active')) return;

    var content = modal.querySelector('.admin-modal-content');
    var overlay = modal.querySelector('.admin-modal-overlay');

    modal.classList.add('closing');

    if (content) {
        content.style.transition = 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)';
        content.style.transform = 'translateY(100%)';
    }
    if (overlay) {
        overlay.style.transition = 'background-color 0.3s ease';
        overlay.style.backgroundColor = 'rgba(0,0,0,0)';
    }

    setTimeout(function () {
        modal.classList.remove('active', 'closing');
        document.body.style.overflow = '';
        window.adminState.selectedOrder = null;
        if (content) { content.style.transform = ''; content.style.transition = ''; }
        if (overlay) { overlay.style.transition = ''; overlay.style.backgroundColor = ''; }
    }, 300);

    if (window.hapticFeedback) window.hapticFeedback('light');
}

function setupAdminModalDrag() {
    var modal = document.getElementById('adminOrderModal');
    if (!modal) return;

    var content = modal.querySelector('.admin-modal-content');
    var overlay = modal.querySelector('.admin-modal-overlay');
    var dragAreas = [modal.querySelector('.admin-modal-drag-handle'), modal.querySelector('.admin-modal-header')].filter(Boolean);

    if (!content || dragAreas.length === 0) return;

    var dragging = false, startY = 0, currentY = 0;

    var onStart = function (e) {
        if (!modal.classList.contains('active')) return;
        dragging = true;
        startY = e.touches[0].clientY;
        currentY = 0;
        content.style.transition = 'none';
        if (overlay) overlay.style.transition = 'none';
    };

    var onMove = function (e) {
        if (!dragging) return;
        var dy = e.touches[0].clientY - startY;
        if (dy > 0) {
            e.preventDefault();
            currentY = dy;
            content.style.transform = 'translateY(' + (dy * 0.5) + 'px)';
            if (overlay) overlay.style.backgroundColor = 'rgba(0,0,0,' + Math.max(0, 0.6 - dy / 400) + ')';
        }
    };

    var onEnd = function () {
        if (!dragging) return;
        dragging = false;
        if (currentY > 80) {
            closeAdminOrderModal();
        } else {
            content.style.transition = 'transform 0.2s ease';
            content.style.transform = 'translateY(0)';
            if (overlay) {
                overlay.style.transition = 'background-color 0.2s ease';
                overlay.style.backgroundColor = 'rgba(0,0,0,0.6)';
            }
            setTimeout(function () {
                content.style.transition = '';
                if (overlay) overlay.style.transition = '';
            }, 200);
        }
        currentY = 0;
    };

    dragAreas.forEach(function (area) {
        area.addEventListener('touchstart', onStart, { passive: true });
        area.addEventListener('touchmove', onMove, { passive: false });
        area.addEventListener('touchend', onEnd, { passive: true });
    });

    adminLog('Modal drag setup complete');
}

function toggleTypeChip(type) {
    var st = window.adminState;
    if (st.draftFilters.type === type) {
        st.draftFilters.type = '';
    } else {
        st.draftFilters.type = type;
    }

    document.querySelectorAll('#adminTypeChips .admin-status-chip').forEach(function (chip) {
        chip.classList.toggle('selected', chip.dataset.type === st.draftFilters.type);
    });

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

    // Setup modal drag
    setupAdminModalDrag();

    // Load rate settings on init (default tab is rates)
    loadRateSettings();
};

adminLog('Script loaded');
