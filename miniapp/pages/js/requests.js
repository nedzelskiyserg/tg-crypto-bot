/**
 * Requests Page Logic
 * Loads orders from API (GET /api/orders) for the current Telegram user.
 *
 * Логирование: все сообщения в консоли с префиксом [Requests].
 * Как смотреть логи: откройте Mini App в браузере (URL из BotFather) и DevTools → Console;
 * или Telegram Desktop → Mini App → правый клик → Inspect → Console.
 */

const LOG_PREFIX = '[Requests]';

function log(msg, data) {
    if (data !== undefined) console.log(LOG_PREFIX, msg, data);
    else console.log(LOG_PREFIX, msg);
}
function logWarn(msg, data) {
    if (data !== undefined) console.warn(LOG_PREFIX, msg, data);
    else console.warn(LOG_PREFIX, msg);
}
function logError(msg, err) {
    console.error(LOG_PREFIX, msg, err != null ? err : '');
    if (err && err.stack) console.error(LOG_PREFIX, 'stack:', err.stack);
}

// API base URL (same logic as exchange.js)
function getApiBaseUrl() {
    const config = window.BACKEND_API_CONFIG;
    if (config && config.baseUrl) {
        log('getApiBaseUrl: from BACKEND_API_CONFIG', config.baseUrl);
        return config.baseUrl;
    }
    const origin = typeof window !== 'undefined' && window.location && window.location.origin ? window.location.origin : '';
    const url = origin && !/localhost|127\.0\.0\.1/.test(origin) ? origin + '/api' : 'http://localhost:8000/api';
    log('getApiBaseUrl: origin=' + (origin || '(none)') + ' => url=' + url);
    return url;
}

// Requests state (loaded from API)
window.requestsState = {
    currentFilter: 'all',
    requests: [],
    selectedRequest: null,
    loaded: false
};

const statusLabels = {
    processing: 'В ОБРАБОТКЕ',
    pending: 'ОЖИДАЕТ ОПЛАТЫ',
    completed: 'ПОДТВЕРЖДЕНО',
    cancelled: 'ОТМЕНЕНО',
    rejected: 'ОТКЛОНЕНО',
    expired: 'ИСТЕКЛО'
};

// Map backend status to frontend (cancelled = пользователь отменил, rejected = админ отклонил)
function mapApiStatus(apiStatus) {
    if (apiStatus === 'pending') return 'processing';
    if (apiStatus === 'confirmed') return 'completed';
    if (apiStatus === 'cancelled') return 'cancelled';
    if (apiStatus === 'rejected') return 'rejected';
    return 'processing';
}

/**
 * Fetch user orders from API.
 * Returns { ok: true, data: [] } or { ok: false, error: string, status?: number }.
 */
async function fetchOrdersFromApi() {
    const tg = window.Telegram?.WebApp;
    const initData = tg?.initData || '';
    const baseUrl = getApiBaseUrl();
    const url = baseUrl + '/orders';
    log('fetchOrdersFromApi: start', { url: url, initDataLength: initData.length, hasTg: !!tg });
    if (!initData) logWarn('initData is empty — API may return 401');

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-Telegram-Init-Data': initData
            }
        });
        const text = await response.text();
        log('fetchOrdersFromApi: response', { status: response.status, ok: response.ok, bodyLength: (text || '').length });

        if (!response.ok) {
            logError('fetchOrdersFromApi: HTTP error', { status: response.status, body: (text || '').slice(0, 200) });
            if (response.status === 401) {
                return { ok: false, error: 'Не авторизован. Откройте Mini App из Telegram.', status: 401 };
            }
            return { ok: false, error: 'Ошибка сервера: ' + response.status, status: response.status };
        }

        let data;
        try {
            data = JSON.parse(text || '[]');
        } catch (parseErr) {
            logError('fetchOrdersFromApi: parse error', parseErr);
            return { ok: false, error: 'Неверный ответ сервера' };
        }
        const arr = Array.isArray(data) ? data : [];
        log('fetchOrdersFromApi: success', { count: arr.length, firstId: arr[0] ? arr[0].id : null });
        return { ok: true, data: arr };
    } catch (e) {
        logError('fetchOrdersFromApi: network/exception', e);
        const msg = (e && e.message) ? e.message : String(e);
        const isNetwork = /fetch|network|failed|load/i.test(msg);
        return { ok: false, error: isNetwork ? 'Нет связи с сервером. Проверьте интернет.' : msg };
    }
}

/**
 * Map API order to frontend format
 */
function mapApiOrderToRequest(apiOrder) {
    const isBuy = (apiOrder.currency_from || '').toUpperCase() === 'RUB';
    const sendAmount = Number(apiOrder.amount_from);
    const receiveAmount = Number(apiOrder.amount_to);
    const rate = Number(apiOrder.exchange_rate);
    const created = apiOrder.created_at ? new Date(apiOrder.created_at) : new Date();
    const dateStr = created.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\./g, '.');
    const timeStr = created.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    return {
        id: apiOrder.id,
        type: isBuy ? 'buy' : 'sell',
        title: isBuy ? 'Покупка USDT' : 'Продажа USDT',
        sendAmount,
        sendCurrency: apiOrder.currency_from || '',
        receiveAmount,
        receiveCurrency: apiOrder.currency_to || '',
        rate,
        status: mapApiStatus(apiOrder.status),
        date: dateStr,
        time: timeStr,
        requestId: '#NE-' + (created.getFullYear()) + '-' + String(apiOrder.id).padStart(5, '0'),
        walletAddress: apiOrder.wallet_address || '',
        bankCard: apiOrder.bank_card || ''
    };
}

/**
 * Render orders list in DOM
 */
function renderOrdersList(orders) {
    log('renderOrdersList: start', { count: orders.length });
    window.requestsState.requests = orders;
    window.requestsState.loaded = true;

    const listEl = document.getElementById('requestsList');
    const emptyEl = document.getElementById('requestsEmpty');
    if (!listEl) {
        logError('renderOrdersList: #requestsList not found');
        return;
    }

    listEl.innerHTML = '';
    if (orders.length === 0) {
        log('renderOrdersList: empty list, show empty state');
        listEl.style.display = 'none';
        if (emptyEl) {
            emptyEl.style.display = 'flex';
        }
        updateRequestsCount();
        filterRequests(window.requestsState.currentFilter);
        return;
    }

    if (emptyEl) emptyEl.style.display = 'none';
    listEl.style.display = '';

    const statusBadgeLabels = {
        processing: 'В ОБРАБОТКЕ',
        pending: 'ОЖИДАЕТ ОПЛАТЫ',
        completed: 'ПОДТВЕРЖДЕНО',
        cancelled: 'ОТМЕНЕНО',   // пользователь отменил вручную
        rejected: 'ОТКЛОНЕНО'    // админ отклонил
    };

    orders.forEach(function (req) {
        const badge = statusBadgeLabels[req.status] || req.status;
        const sendStr = formatRequestAmount(req.sendAmount) + ' ' + req.sendCurrency;
        const receiveStr = formatRequestAmount(req.receiveAmount) + ' ' + req.receiveCurrency;
        const card = document.createElement('div');
        card.className = 'request-card';
        card.dataset.status = req.status;
        card.dataset.id = String(req.id);
        card.innerHTML =
            '<div class="request-accent"></div>' +
            '<div class="request-info">' +
            '<span class="request-title">' + escapeHtml(req.title) + '</span>' +
            '<span class="request-meta">' + escapeHtml(sendStr) + ' → ' + escapeHtml(receiveStr) + '</span>' +
            '</div>' +
            '<div class="request-status">' +
            '<span class="request-badge">' + escapeHtml(badge) + '</span>' +
            '<span class="request-date">' + escapeHtml(req.date) + '</span>' +
            '</div>' +
            '<button class="request-action" data-action="view-request">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>' +
            '</button>';
        listEl.appendChild(card);
    });

    updateRequestsCount();
    filterRequests(window.requestsState.currentFilter);
    animateCardsOnLoad();
    log('renderOrdersList: done', { cards: orders.length });
}

function formatRequestAmount(n) {
    if (n == null || n === '') return '0';
    const num = Number(n);
    if (isNaN(num)) return String(n);
    return num.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function escapeHtml(s) {
    if (s == null) return '';
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
}

// Track if global handler is installed
let globalHandlerInstalled = false;

/**
 * Initialize Requests Page
 */
window.initRequestsPage = function() {
    log('initRequestsPage: called');

    // Install global click handler once (captures all clicks early)
    if (!globalHandlerInstalled) {
        document.addEventListener('click', globalClickHandler, true); // capture phase
        globalHandlerInstalled = true;
        log('initRequestsPage: global click handler installed');
    }

    // Wait for elements
    const waitForElements = () => {
        const pageRequests = document.getElementById('pageRequests');
        const filterTabs = document.querySelector('#pageRequests .filter-tabs');
        const requestsList = document.getElementById('requestsList');

        if (!pageRequests || !filterTabs || !requestsList) {
            log('initRequestsPage: elements not ready', { pageRequests: !!pageRequests, filterTabs: !!filterTabs, requestsList: !!requestsList });
            setTimeout(waitForElements, 100);
            return;
        }

        log('initRequestsPage: all elements found');

        // Setup modal drag
        const modal = document.getElementById('requestDetailModal');
        if (modal) {
            setupModalDrag(modal);
        }

        // Load orders from API and render
        loadAndRenderOrders();
    };

    setTimeout(waitForElements, 50);
};

/**
 * Show loading state in list area
 */
function showRequestsLoading() {
    const listEl = document.getElementById('requestsList');
    const emptyEl = document.getElementById('requestsEmpty');
    if (listEl) {
        listEl.innerHTML = '<div class="requests-loading" style="padding:2rem;text-align:center;color:#888;">Загрузка заявок...</div>';
        listEl.style.display = '';
    }
    if (emptyEl) emptyEl.style.display = 'none';
    log('showRequestsLoading');
}

/**
 * Show error state with message and retry button
 */
function showRequestsError(message, onRetry) {
    const listEl = document.getElementById('requestsList');
    const emptyEl = document.getElementById('requestsEmpty');
    if (!listEl) return;
    listEl.style.display = '';
    emptyEl.style.display = 'none';
    const retryBtn = onRetry
        ? '<button type="button" class="requests-retry-btn" id="requestsRetryBtn" style="margin-top:1rem;padding:0.5rem 1rem;background:#333;color:#fff;border:none;border-radius:8px;cursor:pointer;">Повторить</button>'
        : '';
    listEl.innerHTML =
        '<div class="requests-error" style="padding:2rem 1rem;text-align:center;color:#c00;">' +
        '<div style="margin-bottom:0.5rem;">' + escapeHtml(message) + '</div>' +
        retryBtn +
        '</div>';
    const btn = document.getElementById('requestsRetryBtn');
    if (btn && onRetry) btn.addEventListener('click', onRetry);
    log('showRequestsError', { message: message });
}

/**
 * Load orders from API and render list (or show error)
 */
async function loadAndRenderOrders() {
    log('loadAndRenderOrders: start');
    showRequestsLoading();

    const result = await fetchOrdersFromApi();
    log('loadAndRenderOrders: fetch result', { ok: result.ok, dataLength: result.data ? result.data.length : 0, error: result.error });

    if (!result.ok) {
        showRequestsError(result.error || 'Не удалось загрузить заявки', loadAndRenderOrders);
        return;
    }

    const apiOrders = result.data || [];
    const mapped = apiOrders.map(mapApiOrderToRequest);
    // Убираем дубликаты по id (на случай повторов в ответе API)
    const seenIds = new Set();
    const unique = mapped.filter(function (r) {
        if (seenIds.has(r.id)) return false;
        seenIds.add(r.id);
        return true;
    });
    if (unique.length !== mapped.length) logWarn('loadAndRenderOrders: removed duplicates', { was: mapped.length, now: unique.length });
    log('loadAndRenderOrders: mapped', { count: unique.length });
    renderOrdersList(unique);
}

window.loadAndRenderOrders = loadAndRenderOrders;

/**
 * Global click handler - runs in capture phase before app.js handler
 */
function globalClickHandler(e) {
    // Only handle clicks inside requests page or modal
    const requestsPage = document.getElementById('pageRequests');
    const modal = document.getElementById('requestDetailModal');

    // Check if click is inside requests page or modal
    const isInsideRequestsPage = requestsPage && requestsPage.contains(e.target);
    const isInsideModal = modal && modal.contains(e.target);

    // If click is on a button with data-action, let it bubble to app.js handler
    // unless it's specifically for requests page
    const button = e.target.closest('[data-action]');
    if (button && !isInsideRequestsPage && !isInsideModal) {
        return; // Let app.js handle it
    }

    if (!isInsideRequestsPage && !isInsideModal) {
        return; // Not our page, let it bubble
    }

    // Handle filter tabs
    const filterTab = e.target.closest('.filter-tab');
    if (filterTab && isInsideRequestsPage) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        const filter = filterTab.dataset.filter;
        log('Filter clicked', filter);

        if (filter) {
            setFilter(filter);
            if (window.hapticFeedback) window.hapticFeedback('light');
        }
        return;
    }

    // Handle request cards (click anywhere on card)
    const requestCard = e.target.closest('.request-card');
    if (requestCard && isInsideRequestsPage) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        const requestId = parseInt(requestCard.dataset.id);
        log('Card clicked', requestId);

        if (requestId) {
            openRequestDetail(requestId);
            if (window.hapticFeedback) window.hapticFeedback('medium');
        }
        return;
    }

    // Handle modal overlay click
    if (e.target.classList.contains('modal-overlay') && isInsideModal) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        log('Modal overlay clicked');
        closeRequestModal();
        return;
    }

    // Handle modal close button
    const closeBtn = e.target.closest('[data-action="close-request-modal"]');
    if (closeBtn && isInsideModal) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        log('Modal close clicked');
        closeRequestModal();
        return;
    }

    // Handle cancel request button
    const cancelBtn = e.target.closest('#btnCancelRequest');
    if (cancelBtn && isInsideModal) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        log('Cancel request clicked');
        if (window.requestsState.selectedRequest) {
            cancelRequest(window.requestsState.selectedRequest);
        }
        return;
    }
}

/**
 * Set active filter
 */
function setFilter(filter) {
    if (!['all', 'active', 'completed'].includes(filter)) return;

    window.requestsState.currentFilter = filter;

    // Update tabs UI
    document.querySelectorAll('#pageRequests .filter-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.filter === filter);
    });

    // Filter cards
    filterRequests(filter);
}

/**
 * Filter requests by status
 */
function filterRequests(filter) {
    const cards = document.querySelectorAll('#pageRequests .request-card');
    let visibleCount = 0;

    cards.forEach(card => {
        const status = card.dataset.status;
        // Активные: в обработке или ожидает оплаты. Завершены: подтверждённые, отменённые, отклонённые.
        let shouldShow = filter === 'all' ||
            (filter === 'active' && (status === 'processing' || status === 'pending')) ||
            (filter === 'completed' && (status === 'completed' || status === 'cancelled' || status === 'rejected'));

        if (shouldShow) {
            card.classList.remove('hidden');
            card.style.display = '';
            card.style.opacity = '0';
            card.style.transform = 'translateY(15px)';

            setTimeout(() => {
                card.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }, visibleCount * 40);

            visibleCount++;
        } else {
            card.classList.add('hidden');
            card.style.display = 'none';
        }
    });

    // Update count
    const countEl = document.getElementById('requestsCount');
    if (countEl) countEl.textContent = visibleCount;

    // Empty state
    const emptyState = document.getElementById('requestsEmpty');
    const requestsList = document.getElementById('requestsList');
    if (emptyState) emptyState.style.display = visibleCount === 0 ? 'flex' : 'none';
    if (requestsList) requestsList.style.display = visibleCount === 0 ? 'none' : '';

    log('Filtered', { visibleCount: visibleCount });
}

/**
 * Animate cards on load
 */
function animateCardsOnLoad() {
    const cards = document.querySelectorAll('#pageRequests .request-card:not(.hidden)');
    cards.forEach((card, i) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(15px)';
        setTimeout(() => {
            card.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, i * 50 + 100);
    });
}

/**
 * Update requests count
 */
function updateRequestsCount() {
    const cards = document.querySelectorAll('#pageRequests .request-card:not(.hidden)');
    const countEl = document.getElementById('requestsCount');
    if (countEl) countEl.textContent = cards.length;
}

/**
 * Open request detail modal
 */
function openRequestDetail(requestId) {
    const request = window.requestsState.requests.find(r => r.id === requestId);
    if (!request) {
        logError('Request not found', requestId);
        return;
    }

    window.requestsState.selectedRequest = requestId;

    const modal = document.getElementById('requestDetailModal');
    if (!modal) {
        logError('Modal not found');
        return;
    }

    // Populate modal
    const badge = modal.querySelector('.detail-badge');
    if (badge) {
        badge.textContent = statusLabels[request.status];
        badge.className = `detail-badge status-${request.status}`;
    }

    setTextContent('modalRequestType', request.title);
    setTextContent('modalRequestSend', `${formatNumber(request.sendAmount)} ${request.sendCurrency}`);
    setTextContent('modalRequestReceive', `${formatNumber(request.receiveAmount)} ${request.receiveCurrency}`);
    setTextContent('modalRequestRate', `1 USDT = ${request.rate.toFixed(2)} RUB`);
    setTextContent('modalRequestDate', `${request.date}, ${request.time}`);
    setTextContent('modalRequestId', request.requestId);

    // Show wallet for buy orders only
    const walletRow = document.getElementById('modalWalletRow');
    if (walletRow) {
        if (request.type === 'buy' && request.walletAddress) {
            walletRow.style.display = '';
            setTextContent('modalRequestWallet', request.walletAddress);
        } else {
            walletRow.style.display = 'none';
        }
    }

    // Show/hide cancel button
    const actionsEl = document.getElementById('modalRequestActions');
    if (actionsEl) {
        const canCancel = ['processing', 'pending'].includes(request.status);
        actionsEl.style.display = canCancel ? 'flex' : 'none';
    }

    // Reset modal
    modal.classList.remove('closing');
    const content = modal.querySelector('.modal-content');
    if (content) {
        content.style.transform = '';
        content.style.transition = '';
    }

    // Show
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => modal.classList.add('active'));

    log('Modal opened for', requestId);
}

function setTextContent(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

/**
 * Close modal
 */
window.closeRequestModal = function(fromDrag) {
    const modal = document.getElementById('requestDetailModal');
    if (!modal || !modal.classList.contains('active')) return;

    const content = modal.querySelector('.modal-content');
    const overlay = modal.querySelector('.modal-overlay');

    modal.classList.add('closing');

    if (content) {
        content.style.transition = 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)';
        content.style.transform = 'translateY(100%)';
    }
    if (overlay) {
        overlay.style.transition = 'background-color 0.3s ease';
        overlay.style.backgroundColor = 'rgba(0,0,0,0)';
    }

    setTimeout(() => {
        modal.classList.remove('active', 'closing');
        document.body.style.overflow = '';
        window.requestsState.selectedRequest = null;
        if (content) { content.style.transform = ''; content.style.transition = ''; }
        if (overlay) { overlay.style.transition = ''; overlay.style.backgroundColor = ''; }
    }, 300);

    if (window.hapticFeedback) window.hapticFeedback('light');
};

/**
 * Cancel request (вызов API + обновление UI)
 */
function cancelRequest(requestId) {
    const request = window.requestsState.requests.find(r => r.id === requestId);
    if (!request) return;

    const applyCancelInUI = function () {
        request.status = 'cancelled';
        const card = document.querySelector('#pageRequests .request-card[data-id="' + requestId + '"]');
        if (card) {
            card.dataset.status = 'cancelled';
            card.classList.add('status-cancelled');
            const badge = card.querySelector('.request-badge');
            if (badge) badge.textContent = statusLabels.cancelled;
        }
        window.closeRequestModal();
        filterRequests(window.requestsState.currentFilter);
        if (window.showToast) window.showToast('Заявка отменена', 'info');
        if (window.hapticFeedback) window.hapticFeedback('success');
    };

    const doCancel = function () {
        const tg = window.Telegram?.WebApp;
        const initData = tg?.initData || '';
        const url = getApiBaseUrl() + '/orders/' + requestId;
        fetch(url, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'X-Telegram-Init-Data': initData
            },
            body: JSON.stringify({ status: 'cancelled' })
        })
            .then(function (res) {
                if (res.ok) {
                    applyCancelInUI();
                    log('cancelRequest: API success', requestId);
                } else {
                    logWarn('cancelRequest: API error', { status: res.status });
                    applyCancelInUI();
                }
            })
            .catch(function (err) {
                logError('cancelRequest: network error', err);
                applyCancelInUI();
            });
    };

    const tg = window.Telegram?.WebApp;
    if (tg) {
        tg.showPopup({
            title: 'Отменить заявку?',
            message: 'Отменить заявку ' + (request.requestId || '#' + requestId) + '?',
            buttons: [
                { id: 'confirm', type: 'destructive', text: 'Отменить' },
                { id: 'cancel', type: 'cancel' }
            ]
        }, function (id) { if (id === 'confirm') doCancel(); });
    } else {
        if (confirm('Отменить заявку ' + (request.requestId || '#' + requestId) + '?')) doCancel();
    }
}

/**
 * Setup modal drag
 */
function setupModalDrag(modal) {
    const content = modal.querySelector('.modal-content');
    const overlay = modal.querySelector('.modal-overlay');
    const dragAreas = [modal.querySelector('.modal-drag-handle'), modal.querySelector('.modal-header')].filter(Boolean);

    if (!content || dragAreas.length === 0) return;

    let dragging = false, startY = 0, currentY = 0;

    const onStart = e => {
        if (!modal.classList.contains('active')) return;
        dragging = true;
        startY = e.touches[0].clientY;
        currentY = 0;
        content.style.transition = 'none';
        if (overlay) overlay.style.transition = 'none';
    };

    const onMove = e => {
        if (!dragging) return;
        const dy = e.touches[0].clientY - startY;
        if (dy > 0) {
            e.preventDefault();
            currentY = dy;
            content.style.transform = `translateY(${dy * 0.5}px)`;
            if (overlay) overlay.style.backgroundColor = `rgba(0,0,0,${Math.max(0, 0.6 - dy/400)})`;
        }
    };

    const onEnd = () => {
        if (!dragging) return;
        dragging = false;
        if (currentY > 80) {
            window.closeRequestModal(true);
        } else {
            content.style.transition = 'transform 0.2s ease';
            content.style.transform = 'translateY(0)';
            if (overlay) {
                overlay.style.transition = 'background-color 0.2s ease';
                overlay.style.backgroundColor = 'rgba(0,0,0,0.6)';
            }
            setTimeout(() => {
                content.style.transition = '';
                if (overlay) overlay.style.transition = '';
            }, 200);
        }
        currentY = 0;
    };

    dragAreas.forEach(area => {
        area.addEventListener('touchstart', onStart, { passive: true });
        area.addEventListener('touchmove', onMove, { passive: false });
        area.addEventListener('touchend', onEnd, { passive: true });
    });

    log('Modal drag setup complete');
}

function formatNumber(n) {
    return n.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/**
 * Format bank card number with spaces (1234 5678 9012 3456)
 */
function formatBankCard(card) {
    if (!card) return '';
    // Remove any non-digits
    const digits = card.replace(/\D/g, '');
    // Add space every 4 digits
    return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
}

// Expose logger for debugging from console: window.requestsLog = true to see extra details
window.requestsLog = window.requestsLog || false;
log('Script loaded', { version: '3' });
