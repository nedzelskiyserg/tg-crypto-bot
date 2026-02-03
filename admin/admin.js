/**
 * NONAME EX - Admin Panel
 */

// State
let adminId = localStorage.getItem('admin_id') || '';
let currentPage = 'rate';
let ordersCurrentPage = 1;

// API base URL
function getApiBase() {
    const origin = window.location.origin;
    if (origin && !/localhost|127\.0\.0\.1/.test(origin)) return origin + '/api';
    return 'http://localhost:8000/api';
}

// --- Auth ---

function doAuth() {
    const input = document.getElementById('adminIdInput');
    const errorEl = document.getElementById('authError');
    const id = input.value.trim();

    if (!id || isNaN(Number(id))) {
        errorEl.textContent = 'Введите корректный числовой Telegram ID';
        return;
    }

    errorEl.textContent = 'Проверка...';

    // Verify by trying to load rate settings
    fetch(`${getApiBase()}/admin/rate-settings?admin_id=${id}`)
        .then(r => {
            if (r.status === 403) throw new Error('Нет доступа. Вы не являетесь администратором.');
            if (!r.ok) throw new Error('Ошибка сервера');
            return r.json();
        })
        .then(data => {
            adminId = id;
            localStorage.setItem('admin_id', id);
            showPanel(data);
        })
        .catch(err => {
            errorEl.textContent = err.message;
        });
}

function doLogout() {
    adminId = '';
    localStorage.removeItem('admin_id');
    document.getElementById('authScreen').style.display = 'flex';
    document.getElementById('mainPanel').style.display = 'none';
}

function showPanel(rateData) {
    document.getElementById('authScreen').style.display = 'none';
    document.getElementById('mainPanel').style.display = 'flex';
    if (rateData) applyRateData(rateData);
}

// Auto-login
if (adminId) {
    fetch(`${getApiBase()}/admin/rate-settings?admin_id=${adminId}`)
        .then(r => {
            if (!r.ok) throw new Error('Auth failed');
            return r.json();
        })
        .then(data => showPanel(data))
        .catch(() => {
            localStorage.removeItem('admin_id');
            adminId = '';
        });
}

// --- Navigation ---

function switchPage(page) {
    currentPage = page;

    document.querySelectorAll('.nav-item[data-page]').forEach(item => {
        item.classList.toggle('active', item.dataset.page === page);
    });

    document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active'));

    if (page === 'rate') {
        document.getElementById('pageRate').classList.add('active');
        loadRateSettings();
    } else if (page === 'orders') {
        document.getElementById('pageOrders').classList.add('active');
        loadOrders(1);
    }

    // Close mobile nav
    document.querySelector('.sidebar').classList.remove('open');
}

function toggleMobileNav() {
    document.querySelector('.sidebar').classList.toggle('open');
}

// --- Rate Settings ---

function loadRateSettings() {
    fetch(`${getApiBase()}/admin/rate-settings?admin_id=${adminId}`)
        .then(r => r.json())
        .then(data => applyRateData(data))
        .catch(err => console.error('Failed to load rate settings:', err));
}

function applyRateData(data) {
    document.getElementById('rawBuyRate').textContent = data.raw_buy_rate.toFixed(2);
    document.getElementById('rawSellRate').textContent = data.raw_sell_rate.toFixed(2);
    document.getElementById('buyMarkupInput').value = data.buy_markup_percent;
    document.getElementById('sellMarkupInput').value = data.sell_markup_percent;
    document.getElementById('finalBuyRate').textContent = data.final_buy_rate.toFixed(2);
    document.getElementById('finalSellRate').textContent = data.final_sell_rate.toFixed(2);

    // Update formula example
    document.getElementById('exampleRaw').textContent = data.raw_buy_rate.toFixed(2);
    document.getElementById('exampleRaw2').textContent = data.raw_buy_rate.toFixed(2);
    document.getElementById('exampleMarkup').textContent = data.buy_markup_percent;
    document.getElementById('exampleMarkup2').textContent = data.buy_markup_percent;
    const exResult = data.raw_buy_rate * (1 + data.buy_markup_percent / 100);
    document.getElementById('exampleResult').textContent = exResult.toFixed(2);

    if (data.updated_at) {
        const d = new Date(data.updated_at);
        document.getElementById('lastUpdatedNote').textContent =
            `Последнее обновление: ${d.toLocaleString('ru-RU')} (админ: ${data.updated_by})`;
    } else {
        document.getElementById('lastUpdatedNote').textContent = 'Наценка ещё не настраивалась';
    }

    // Live preview on input
    updatePreview();
}

function updatePreview() {
    const rawBuy = parseFloat(document.getElementById('rawBuyRate').textContent) || 0;
    const rawSell = parseFloat(document.getElementById('rawSellRate').textContent) || 0;
    const buyMarkup = parseFloat(document.getElementById('buyMarkupInput').value) || 0;
    const sellMarkup = parseFloat(document.getElementById('sellMarkupInput').value) || 0;

    const finalBuy = rawBuy * (1 + buyMarkup / 100);
    const finalSell = rawSell * (1 + sellMarkup / 100);

    document.getElementById('finalBuyRate').textContent = finalBuy.toFixed(2);
    document.getElementById('finalSellRate').textContent = finalSell.toFixed(2);

    // Update example
    document.getElementById('exampleMarkup').textContent = buyMarkup;
    document.getElementById('exampleMarkup2').textContent = buyMarkup;
    const exResult = rawBuy * (1 + buyMarkup / 100);
    document.getElementById('exampleResult').textContent = exResult.toFixed(2);
}

// Attach live preview
document.getElementById('buyMarkupInput').addEventListener('input', updatePreview);
document.getElementById('sellMarkupInput').addEventListener('input', updatePreview);

function saveMarkup() {
    const buyMarkup = parseFloat(document.getElementById('buyMarkupInput').value);
    const sellMarkup = parseFloat(document.getElementById('sellMarkupInput').value);
    const statusEl = document.getElementById('saveStatus');
    const btn = document.getElementById('saveMarkupBtn');

    if (isNaN(buyMarkup) || isNaN(sellMarkup)) {
        statusEl.textContent = 'Введите корректные значения';
        statusEl.className = 'save-status error';
        return;
    }

    btn.disabled = true;
    btn.textContent = 'СОХРАНЕНИЕ...';
    statusEl.textContent = '';

    fetch(`${getApiBase()}/admin/rate-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            buy_markup_percent: buyMarkup,
            sell_markup_percent: sellMarkup,
            admin_id: parseInt(adminId),
        }),
    })
        .then(r => {
            if (!r.ok) throw new Error('Ошибка сохранения');
            return r.json();
        })
        .then(data => {
            applyRateData(data);
            statusEl.textContent = 'Наценка успешно сохранена!';
            statusEl.className = 'save-status success';
        })
        .catch(err => {
            statusEl.textContent = err.message;
            statusEl.className = 'save-status error';
        })
        .finally(() => {
            btn.disabled = false;
            btn.textContent = 'СОХРАНИТЬ НАЦЕНКУ';
            setTimeout(() => {
                if (statusEl.classList.contains('success')) statusEl.textContent = '';
            }, 3000);
        });
}

// --- Orders ---

function getFilters() {
    const params = new URLSearchParams();
    params.set('admin_id', adminId);

    const orderId = document.getElementById('filterOrderId').value.trim();
    const status = document.getElementById('filterStatus').value;
    const amountMin = document.getElementById('filterAmountMin').value.trim();
    const amountMax = document.getElementById('filterAmountMax').value.trim();
    const dateFrom = document.getElementById('filterDateFrom').value;
    const dateTo = document.getElementById('filterDateTo').value;

    if (orderId) params.set('order_id', orderId);
    if (status) params.set('status', status);
    if (amountMin) params.set('amount_min', amountMin);
    if (amountMax) params.set('amount_max', amountMax);
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo) params.set('date_to', dateTo);

    return params;
}

function loadOrders(page) {
    ordersCurrentPage = page || 1;
    const params = getFilters();
    params.set('page', ordersCurrentPage);
    params.set('page_size', 20);

    const body = document.getElementById('ordersBody');
    body.innerHTML = '<tr><td colspan="8" class="empty-state">Загрузка...</td></tr>';

    fetch(`${getApiBase()}/admin/orders?${params.toString()}`)
        .then(r => {
            if (r.status === 403) throw new Error('Нет доступа');
            if (!r.ok) throw new Error('Ошибка загрузки');
            return r.json();
        })
        .then(data => {
            renderOrders(data);
        })
        .catch(err => {
            body.innerHTML = `<tr><td colspan="8" class="empty-state">${err.message}</td></tr>`;
            document.getElementById('ordersInfo').textContent = '';
            document.getElementById('pagination').innerHTML = '';
        });
}

function renderOrders(data) {
    const body = document.getElementById('ordersBody');
    const info = document.getElementById('ordersInfo');
    const pagination = document.getElementById('pagination');

    if (!data.orders || data.orders.length === 0) {
        body.innerHTML = '<tr><td colspan="8" class="empty-state">Заявки не найдены</td></tr>';
        info.textContent = `Всего: ${data.total}`;
        pagination.innerHTML = '';
        return;
    }

    info.textContent = `Показано ${data.orders.length} из ${data.total} (стр. ${data.page}/${data.total_pages})`;

    body.innerHTML = data.orders.map(order => {
        const date = new Date(order.created_at);
        const dateStr = date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });
        const timeStr = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        const isBuy = order.currency_from === 'RUB';
        const typeLabel = isBuy ? 'Покупка' : 'Продажа';
        const typeClass = isBuy ? 'type-buy' : 'type-sell';

        const statusLabels = {
            pending: 'Ожидает',
            confirmed: 'Подтверждена',
            rejected: 'Отклонена',
            cancelled: 'Отменена',
        };
        const statusLabel = statusLabels[order.status] || order.status;

        const amountFrom = formatAmount(order.amount_from);
        const amountTo = formatAmount(order.amount_to);

        return `<tr>
            <td><strong>${order.id}</strong></td>
            <td>${dateStr}<br><small style="color:var(--text-muted)">${timeStr}</small></td>
            <td><span class="${typeClass}">${typeLabel}</span></td>
            <td>${amountFrom} ${order.currency_from}</td>
            <td>${amountTo} ${order.currency_to}</td>
            <td>${parseFloat(order.exchange_rate).toFixed(2)}</td>
            <td>${order.full_name}</td>
            <td><span class="status-badge status-${order.status}">${statusLabel}</span></td>
        </tr>`;
    }).join('');

    // Pagination
    let paginationHtml = '';
    if (data.total_pages > 1) {
        paginationHtml += `<button ${data.page <= 1 ? 'disabled' : ''} onclick="loadOrders(${data.page - 1})">&laquo;</button>`;

        const startPage = Math.max(1, data.page - 2);
        const endPage = Math.min(data.total_pages, data.page + 2);

        if (startPage > 1) {
            paginationHtml += `<button onclick="loadOrders(1)">1</button>`;
            if (startPage > 2) paginationHtml += `<span style="color:var(--text-muted)">...</span>`;
        }

        for (let i = startPage; i <= endPage; i++) {
            paginationHtml += `<button class="${i === data.page ? 'active' : ''}" onclick="loadOrders(${i})">${i}</button>`;
        }

        if (endPage < data.total_pages) {
            if (endPage < data.total_pages - 1) paginationHtml += `<span style="color:var(--text-muted)">...</span>`;
            paginationHtml += `<button onclick="loadOrders(${data.total_pages})">${data.total_pages}</button>`;
        }

        paginationHtml += `<button ${data.page >= data.total_pages ? 'disabled' : ''} onclick="loadOrders(${data.page + 1})">&raquo;</button>`;
    }
    pagination.innerHTML = paginationHtml;
}

function formatAmount(val) {
    const num = parseFloat(val);
    if (isNaN(num)) return val;
    if (num === Math.floor(num)) return num.toLocaleString('ru-RU');
    return num.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
}

function clearFilters() {
    document.getElementById('filterOrderId').value = '';
    document.getElementById('filterStatus').value = '';
    document.getElementById('filterAmountMin').value = '';
    document.getElementById('filterAmountMax').value = '';
    document.getElementById('filterDateFrom').value = '';
    document.getElementById('filterDateTo').value = '';
    loadOrders(1);
}

// Handle Enter in auth input
document.getElementById('adminIdInput').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') doAuth();
});

// Click outside sidebar to close on mobile
document.addEventListener('click', function(e) {
    const sidebar = document.querySelector('.sidebar');
    const toggle = document.getElementById('mobileNavToggle');
    if (sidebar.classList.contains('open') &&
        !sidebar.contains(e.target) &&
        !toggle.contains(e.target)) {
        sidebar.classList.remove('open');
    }
});
