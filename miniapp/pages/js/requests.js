/**
 * Requests Page Logic
 * Handles request filtering, viewing details, and actions
 */

// Requests state
window.requestsState = {
    currentFilter: 'all',
    requests: [
        { id: 1, type: 'buy', title: 'Покупка USDT', sendAmount: 25000, sendCurrency: 'RUB', receiveAmount: 256.41, receiveCurrency: 'USDT', rate: 97.50, status: 'processing', date: '30.01.2026', time: '15:42', requestId: '#NE-2026-00128' },
        { id: 2, type: 'sell', title: 'Продажа USDT', sendAmount: 100, sendCurrency: 'USDT', receiveAmount: 9750, receiveCurrency: 'RUB', rate: 97.50, status: 'pending', date: '30.01.2026', time: '14:15', requestId: '#NE-2026-00127' },
        { id: 3, type: 'buy', title: 'Покупка USDT', sendAmount: 10000, sendCurrency: 'RUB', receiveAmount: 102.56, receiveCurrency: 'USDT', rate: 97.50, status: 'completed', date: '29.01.2026', time: '14:32', requestId: '#NE-2026-00123' },
        { id: 4, type: 'buy', title: 'Покупка USDT', sendAmount: 5000, sendCurrency: 'RUB', receiveAmount: 51.28, receiveCurrency: 'USDT', rate: 97.50, status: 'cancelled', date: '28.01.2026', time: '11:20', requestId: '#NE-2026-00119' },
        { id: 5, type: 'sell', title: 'Продажа USDT', sendAmount: 50, sendCurrency: 'USDT', receiveAmount: 4875, receiveCurrency: 'RUB', rate: 97.50, status: 'completed', date: '27.01.2026', time: '09:45', requestId: '#NE-2026-00112' }
    ],
    selectedRequest: null
};

const statusLabels = {
    processing: 'В ОБРАБОТКЕ',
    pending: 'ОЖИДАЕТ ОПЛАТЫ',
    completed: 'ЗАВЕРШЕНО',
    cancelled: 'ОТМЕНЕНО',
    expired: 'ИСТЕКЛО'
};

// Track if global handler is installed
let globalHandlerInstalled = false;

/**
 * Initialize Requests Page
 */
window.initRequestsPage = function() {
    console.log('[Requests] initRequestsPage called');

    // Install global click handler once (captures all clicks early)
    if (!globalHandlerInstalled) {
        document.addEventListener('click', globalClickHandler, true); // capture phase
        globalHandlerInstalled = true;
        console.log('[Requests] Global click handler installed');
    }

    // Wait for elements
    const waitForElements = () => {
        const pageRequests = document.getElementById('pageRequests');
        const filterTabs = document.querySelector('#pageRequests .filter-tabs');
        const requestsList = document.getElementById('requestsList');

        if (!pageRequests || !filterTabs || !requestsList) {
            console.log('[Requests] Elements not ready, waiting...');
            setTimeout(waitForElements, 100);
            return;
        }

        console.log('[Requests] All elements found');

        // Setup modal drag
        const modal = document.getElementById('requestDetailModal');
        if (modal) {
            setupModalDrag(modal);
        }

        // Update UI
        updateRequestsCount();
        animateCardsOnLoad();

        console.log('[Requests] Page initialized');
    };

    setTimeout(waitForElements, 50);
};

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
        console.log('[Requests] Filter clicked:', filter);

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
        console.log('[Requests] Card clicked:', requestId);

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

        console.log('[Requests] Modal overlay clicked');
        closeRequestModal();
        return;
    }

    // Handle modal close button
    const closeBtn = e.target.closest('[data-action="close-request-modal"]');
    if (closeBtn && isInsideModal) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        console.log('[Requests] Modal close clicked');
        closeRequestModal();
        return;
    }

    // Handle cancel request button
    const cancelBtn = e.target.closest('#btnCancelRequest');
    if (cancelBtn && isInsideModal) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        console.log('[Requests] Cancel request clicked');
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
        let shouldShow = filter === 'all' ||
            (filter === 'active' && (status === 'processing' || status === 'pending')) ||
            (filter === 'completed' && status === 'completed');

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

    console.log('[Requests] Filtered:', visibleCount, 'visible');
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
        console.error('[Requests] Request not found:', requestId);
        return;
    }

    window.requestsState.selectedRequest = requestId;

    const modal = document.getElementById('requestDetailModal');
    if (!modal) {
        console.error('[Requests] Modal not found');
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

    console.log('[Requests] Modal opened for:', requestId);
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
 * Cancel request
 */
function cancelRequest(requestId) {
    const request = window.requestsState.requests.find(r => r.id === requestId);
    if (!request) return;

    const doCancel = () => {
        request.status = 'cancelled';
        const card = document.querySelector(`#pageRequests .request-card[data-id="${requestId}"]`);
        if (card) {
            card.dataset.status = 'cancelled';
            const badge = card.querySelector('.request-badge');
            if (badge) badge.textContent = statusLabels.cancelled;
        }
        window.closeRequestModal();
        filterRequests(window.requestsState.currentFilter);
        if (window.showToast) window.showToast('Заявка отменена', 'info');
        if (window.hapticFeedback) window.hapticFeedback('success');
    };

    const tg = window.Telegram?.WebApp;
    if (tg) {
        tg.showPopup({
            title: 'Отменить заявку?',
            message: `Отменить заявку ${request.requestId}?`,
            buttons: [
                { id: 'confirm', type: 'destructive', text: 'Отменить' },
                { id: 'cancel', type: 'cancel' }
            ]
        }, id => { if (id === 'confirm') doCancel(); });
    } else {
        if (confirm(`Отменить ${request.requestId}?`)) doCancel();
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

    console.log('[Requests] Modal drag setup complete');
}

function formatNumber(n) {
    return n.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

console.log('[Requests] Script loaded');
