function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const existing = Array.from(container.children);
    if (existing.some(t => t.textContent.trim() === message.trim())) {
        return;
    }
    if (existing.length >= 3) {
        existing[0].remove();
    }
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
function getCurrentUser() {
    try {
        return JSON.parse(localStorage.getItem('fixtech_user'));
    } catch (e) {
        return null;
    }
}
let adminOrders = [];
let adminParts = [];
let adminServices = [];
let adminUsers = [];
let adminMasters = [];
let chartInstances = {};
document.addEventListener('DOMContentLoaded', async () => {
    const user = getCurrentUser();
    if (!user || user.role !== 'admin') {
        alert('Доступ в панель управления разрешён только администраторам.');
        window.location.href = 'index.html';
        return;
    }
    document.getElementById('adminNameDisplay').textContent = user.name;
    document.getElementById('adminAvatar').textContent = user.name.charAt(0).toUpperCase();
    document.getElementById('btnAdminLogout').addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('fixtech_user');
        window.location.href = 'index.html';
    });
    initTabs();
    await loadInitialData();
    initEventListeners();
});
function initTabs() {
    const tabs = document.querySelectorAll('.admin-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            const targetId = tab.getAttribute('data-tab');
            const targetPane = document.getElementById(targetId);
            if (targetPane) targetPane.classList.add('active');
            if (targetId === 'tab-analytics') {
                renderAnalyticsCharts();
            } else if (targetId === 'tab-kanban') {
                renderKanbanBoard(adminOrders);
            }
        });
    });
}
async function loadInitialData() {
    try {
        await Promise.all([
            loadOrders(),
            loadParts(),
            loadServices(),
            loadUsers(),
            loadMasters(),
            loadAnalyticsOverview()
        ]);
    } catch (err) {
        showToast('Ошибка при загрузке данных: ' + err.message, 'error');
    }
}
async function loadAnalyticsOverview() {
    try {
        const res = await fetch('/api/analytics');
        const data = await res.json();
        const kpi = data.kpi;
        document.getElementById('kpiTotalOrders').textContent = kpi.totalOrders;
        document.getElementById('kpiInWorkOrders').textContent = kpi.inWorkOrders;
        document.getElementById('kpiTotalRevenue').textContent = `${kpi.totalRevenue.toLocaleString('ru-RU')} ₽`;
        document.getElementById('kpiLowStock').textContent = kpi.lowStockCount;
        document.getElementById('badgeOrdersCount').textContent = kpi.totalOrders;
    } catch (err) {
        console.error('Ошибка KPI:', err);
    }
}
async function loadOrders() {
    const res = await fetch('/api/orders');
    adminOrders = await res.json();
    renderOrdersTable(adminOrders);
    renderKanbanBoard(adminOrders);
}
function renderOrdersTable(orders) {
    const tbody = document.getElementById('adminOrdersTableBody');
    if (!tbody) return;
    if (orders.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 40px;">Заявки не найдены.</td></tr>`;
        return;
    }
    const statusMap = {
        received: { text: 'Принята', cls: 'received' },
        diagnostics: { text: 'Диагностика', cls: 'diagnostics' },
        in_progress: { text: 'В ремонте', cls: 'in_progress' },
        ready: { text: 'Готова к выдаче', cls: 'ready' },
        completed: { text: 'Выдана', cls: 'completed' },
        cancelled: { text: 'Отменена', cls: 'cancelled' }
    };
    tbody.innerHTML = orders.map(o => {
        const st = statusMap[o.status] || { text: o.status, cls: '' };
        return `
            <tr>
                <td style="font-family: 'Unbounded', sans-serif; font-weight: 700; color: var(--accent-color);">
                    ${o.id}
                </td>
                <td>
                    <div style="font-weight: 600;">${o.brand_model}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">${o.device_type}</div>
                </td>
                <td>
                    <div style="font-weight: 500;">${o.client_name}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">${o.client_phone}</div>
                </td>
                <td style="max-width: 220px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${o.problem_description}">
                    ${o.problem_description}
                </td>
                <td>
                    ${o.master_name ? `<span style="font-weight:500;">${o.master_name}</span>` : '<span style="color:var(--text-muted);">Не назначен</span>'}
                    <button class="btn-action" style="margin-left: 6px; padding: 2px 6px;" onclick="openAssignMasterModal('${o.id}')" title="Назначить / сменить мастера">✎</button>
                </td>
                <td>
                    <span class="status-badge ${st.cls}">${st.text}</span>
                </td>
                <td style="font-weight: 700; color: #ffffff;">
                    ${o.total_cost.toLocaleString('ru-RU')} ₽
                </td>
                <td>
                    <div style="display: flex; gap: 6px;">
                        <button class="btn-action success" onclick="openPrintFromAdmin('${o.id}')" title="Распечатать квитанцию / акт">Акт</button>
                        <button class="btn-action delete" onclick="deleteOrder('${o.id}')" title="Удалить заявку">✕</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}
const searchOrderInput = document.getElementById('adminOrdersSearch');
const filterOrderStatus = document.getElementById('adminOrdersStatusFilter');
function applyOrderFilters() {
    const q = (searchOrderInput ? searchOrderInput.value : '').toLowerCase().trim();
    const st = filterOrderStatus ? filterOrderStatus.value : 'all';
    let filtered = adminOrders;
    if (st !== 'all') {
        filtered = filtered.filter(o => o.status === st);
    }
    if (q) {
        filtered = filtered.filter(o => 
            o.id.toLowerCase().includes(q) ||
            o.brand_model.toLowerCase().includes(q) ||
            o.client_name.toLowerCase().includes(q) ||
            o.client_phone.toLowerCase().includes(q)
        );
    }
    renderOrdersTable(filtered);
}
if (searchOrderInput) searchOrderInput.addEventListener('input', applyOrderFilters);
if (filterOrderStatus) filterOrderStatus.addEventListener('change', applyOrderFilters);
async function loadMasters() {
    const res = await fetch('/api/masters');
    adminMasters = await res.json();
}
let targetOrderIdForAssign = null;
function openAssignMasterModal(orderId) {
    targetOrderIdForAssign = orderId;
    document.getElementById('assignOrderId').textContent = orderId;
    const select = document.getElementById('assignMasterSelect');
    select.innerHTML = adminMasters.map(m => `
        <option value="${m.id}">${m.name} (${m.email})</option>
    `).join('');
    document.getElementById('assignMasterModal').classList.add('open');
}
document.getElementById('closeAssignModal').addEventListener('click', () => {
    document.getElementById('assignMasterModal').classList.remove('open');
});
document.getElementById('btnSubmitAssign').addEventListener('click', async () => {
    if (!targetOrderIdForAssign) return;
    const masterId = document.getElementById('assignMasterSelect').value;
    try {
        const res = await fetch(`/api/orders/${targetOrderIdForAssign}/assign`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ master_id: masterId })
        });
        if (!res.ok) throw new Error('Ошибка назначения мастера');
        showToast('Мастер успешно назначен на заявку!', 'success');
        document.getElementById('assignMasterModal').classList.remove('open');
        await loadOrders();
        await loadAnalyticsOverview();
    } catch (err) {
        showToast(err.message, 'error');
    }
});
async function deleteOrder(orderId) {
    if (!confirm(`Вы действительно хотите удалить заявку ${orderId}?`)) return;
    try {
        const res = await fetch(`/api/orders/${orderId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Ошибка удаления');
        showToast(`Заявка ${orderId} удалена.`, 'info');
        await loadOrders();
        await loadAnalyticsOverview();
    } catch (err) {
        showToast(err.message, 'error');
    }
}
function renderKanbanBoard(orders) {
    const statuses = ['received', 'diagnostics', 'in_progress', 'ready', 'completed'];
    statuses.forEach(st => {
        const col = document.getElementById(`kanban-col-${st}`);
        const countBadge = document.getElementById(`kanban-count-${st}`);
        if (col) col.innerHTML = '';
        if (countBadge) countBadge.textContent = '0';
    });
    const statusCounts = { received: 0, diagnostics: 0, in_progress: 0, ready: 0, completed: 0 };
    orders.forEach(o => {
        if (!statuses.includes(o.status)) return;
        statusCounts[o.status]++;
        const col = document.getElementById(`kanban-col-${o.status}`);
        if (!col) return;
        const card = document.createElement('div');
        card.className = 'kanban-card';
        card.draggable = true;
        card.setAttribute('data-id', o.id);
        card.innerHTML = `
            <div class="kanban-card-id">
                <span>${o.id}</span>
                <span style="font-size: 0.7rem; color: var(--text-muted);">${o.device_type}</span>
            </div>
            <div class="kanban-card-title">${o.brand_model}</div>
            <div class="kanban-card-desc">${o.problem_description}</div>
            <div class="kanban-card-footer">
                <span class="kanban-card-master">${o.master_name ? o.master_name.split(' ')[0] : 'Без мастера'}</span>
                <span class="kanban-card-price">${o.total_cost > 0 ? o.total_cost + ' ₽' : '0 ₽'}</span>
            </div>
        `;
        card.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', o.id);
            card.classList.add('dragging');
        });
        card.addEventListener('dragend', () => {
            card.classList.remove('dragging');
        });
        col.appendChild(card);
    });
    statuses.forEach(st => {
        const countBadge = document.getElementById(`kanban-count-${st}`);
        if (countBadge) countBadge.textContent = statusCounts[st];
    });
}
let isDropping = false;
function initKanbanDropZones() {
    const cols = document.querySelectorAll('.kanban-col');
    const statusMap = {
        received: 'Принята',
        diagnostics: 'В диагностике',
        in_progress: 'В ремонте',
        ready: 'Готова к выдаче',
        completed: 'Выдана'
    };
    cols.forEach(col => {
        col.addEventListener('dragover', (e) => {
            e.preventDefault();
            col.classList.add('drag-over');
        });
        col.addEventListener('dragleave', () => {
            col.classList.remove('drag-over');
        });
        col.addEventListener('drop', async (e) => {
            e.preventDefault();
            col.classList.remove('drag-over');
            if (isDropping) return;
            const orderId = e.dataTransfer.getData('text/plain');
            const newStatus = col.getAttribute('data-status');
            if (!orderId || !newStatus) return;
            const existingOrder = adminOrders.find(o => o.id === orderId);
            if (existingOrder && existingOrder.status === newStatus) return;
            isDropping = true;
            try {
                const user = getCurrentUser();
                const res = await fetch(`/api/orders/${orderId}/status`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        status: newStatus,
                        author_name: user ? user.name : 'Администратор',
                        comment: `Перемещено на Kanban-доске: ${statusMap[newStatus] || newStatus}`
                    })
                });
                if (!res.ok) throw new Error('Ошибка перемещения заявки');
                showToast(`Заявка ${orderId} перемещена: "${statusMap[newStatus] || newStatus}"`, 'success');
                await loadOrders();
                await loadAnalyticsOverview();
            } catch (err) {
                showToast(err.message, 'error');
            } finally {
                isDropping = false;
            }
        });
    });
}
async function loadParts() {
    const res = await fetch('/api/parts');
    adminParts = await res.json();
    renderPartsTable(adminParts);
}
function renderPartsTable(parts) {
    const tbody = document.getElementById('adminPartsTableBody');
    if (!tbody) return;
    if (parts.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-muted); padding: 40px;">Склад пуст.</td></tr>`;
        return;
    }
    tbody.innerHTML = parts.map(p => {
        const isLow = p.stock_quantity <= p.min_quantity;
        return `
            <tr>
                <td style="font-family: monospace; font-weight: 700; color: var(--accent-color);">${p.sku}</td>
                <td style="font-weight: 600;">${p.name}</td>
                <td><span class="service-category-badge">${p.category}</span></td>
                <td>
                    <span style="font-weight: 700; font-size: 1rem; color: ${isLow ? 'var(--accent-red)' : '#ffffff'};">
                        ${p.stock_quantity} шт.
                    </span>
                </td>
                <td style="color: var(--text-muted);">${p.min_quantity} шт.</td>
                <td style="color: var(--text-muted);">${p.purchase_price.toLocaleString('ru-RU')} ₽</td>
                <td style="font-weight: 700; color: var(--accent-green);">${p.sell_price.toLocaleString('ru-RU')} ₽</td>
                <td>
                    <div style="display: flex; gap: 4px;">
                        <button class="btn-action success" onclick="adjustPartStock(${p.id}, 5)" title="Оприходовать +5 шт.">+5</button>
                        <button class="btn-action success" onclick="adjustPartStock(${p.id}, 10)" title="Оприходовать +10 шт.">+10</button>
                        <button class="btn-action" onclick="adjustPartStock(${p.id}, -1)" title="Списать 1 шт." ${p.stock_quantity <= 0 ? 'disabled' : ''}>-1</button>
                    </div>
                </td>
                <td>
                    <div style="display: flex; gap: 6px;">
                        <button class="btn-action" onclick="openEditPartModal(${p.id})" title="Редактировать">✎</button>
                        <button class="btn-action delete" onclick="deletePart(${p.id})" title="Удалить со склада">✕</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}
async function adjustPartStock(partId, delta) {
    try {
        const res = await fetch(`/api/parts/${partId}/stock`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ delta })
        });
        if (!res.ok) throw new Error('Ошибка обновления остатка');
        await loadParts();
        await loadAnalyticsOverview();
        showToast(`Остаток детали обновлён (${delta > 0 ? '+' + delta : delta} шт.)`, 'info');
    } catch (err) {
        showToast(err.message, 'error');
    }
}
const partModal = document.getElementById('partModal');
const partForm = document.getElementById('partForm');
document.getElementById('btnOpenAddPartModal').addEventListener('click', () => {
    document.getElementById('partModalTitle').textContent = 'Новая деталь на склад';
    document.getElementById('partId').value = '';
    partForm.reset();
    partModal.classList.add('open');
});
document.getElementById('closePartModal').addEventListener('click', () => {
    partModal.classList.remove('open');
});
function openEditPartModal(partId) {
    const part = adminParts.find(p => p.id === partId);
    if (!part) return;
    document.getElementById('partModalTitle').textContent = 'Редактировать деталь';
    document.getElementById('partId').value = part.id;
    document.getElementById('partSku').value = part.sku;
    document.getElementById('partCategory').value = part.category;
    document.getElementById('partName').value = part.name;
    document.getElementById('partStock').value = part.stock_quantity;
    document.getElementById('partMin').value = part.min_quantity;
    document.getElementById('partPurchasePrice').value = part.purchase_price;
    document.getElementById('partSellPrice').value = part.sell_price;
    partModal.classList.add('open');
}
partForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('partId').value;
    const payload = {
        sku: document.getElementById('partSku').value.trim(),
        category: document.getElementById('partCategory').value.trim(),
        name: document.getElementById('partName').value.trim(),
        stock_quantity: Number(document.getElementById('partStock').value),
        min_quantity: Number(document.getElementById('partMin').value),
        purchase_price: Number(document.getElementById('partPurchasePrice').value),
        sell_price: Number(document.getElementById('partSellPrice').value)
    };
    try {
        const url = id ? `/api/parts/${id}` : '/api/parts';
        const method = id ? 'PUT' : 'POST';
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('Ошибка сохранения запчасти');
        partModal.classList.remove('open');
        showToast('Деталь успешно сохранена на складе!', 'success');
        await loadParts();
        await loadAnalyticsOverview();
    } catch (err) {
        showToast(err.message, 'error');
    }
});
async function deletePart(partId) {
    if (!confirm('Удалить деталь из складского каталога?')) return;
    try {
        const res = await fetch(`/api/parts/${partId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Ошибка удаления');
        showToast('Запчасть удалена.', 'info');
        await loadParts();
        await loadAnalyticsOverview();
    } catch (err) {
        showToast(err.message, 'error');
    }
}
const partsSearchInput = document.getElementById('adminPartsSearch');
if (partsSearchInput) {
    partsSearchInput.addEventListener('input', () => {
        const q = partsSearchInput.value.toLowerCase().trim();
        const filtered = adminParts.filter(p => p.sku.toLowerCase().includes(q) || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
        renderPartsTable(filtered);
    });
}
async function loadServices() {
    const res = await fetch('/api/services');
    adminServices = await res.json();
    renderServicesTable(adminServices);
}
function renderServicesTable(services) {
    const tbody = document.getElementById('adminServicesTableBody');
    if (!tbody) return;
    tbody.innerHTML = services.map(s => `
        <tr>
            <td style="font-weight: 600;">${s.title}</td>
            <td><span class="service-category-badge">${s.category}</span></td>
            <td style="font-weight: 700; color: #ffffff;">
                ${s.price === 0 ? 'Бесплатно' : `${s.price.toLocaleString('ru-RU')} ₽`}
            </td>
            <td style="color: var(--text-muted);">${s.estimated_time}</td>
            <td style="color: var(--text-muted); font-size: 0.82rem; max-width: 300px;">${s.description || '—'}</td>
            <td>
                <div style="display: flex; gap: 6px;">
                    <button class="btn-action" onclick="openEditServiceModal(${s.id})" title="Редактировать">✎</button>
                    <button class="btn-action delete" onclick="deleteService(${s.id})" title="Удалить">✕</button>
                </div>
            </td>
        </tr>
    `).join('');
}
const serviceModal = document.getElementById('serviceModal');
const serviceForm = document.getElementById('serviceForm');
document.getElementById('btnOpenAddServiceModal').addEventListener('click', () => {
    document.getElementById('serviceModalTitle').textContent = 'Новая услуга';
    document.getElementById('serviceId').value = '';
    serviceForm.reset();
    serviceModal.classList.add('open');
});
document.getElementById('closeServiceModal').addEventListener('click', () => {
    serviceModal.classList.remove('open');
});
function openEditServiceModal(serviceId) {
    const s = adminServices.find(item => item.id === serviceId);
    if (!s) return;
    document.getElementById('serviceModalTitle').textContent = 'Редактировать услугу';
    document.getElementById('serviceId').value = s.id;
    document.getElementById('serviceTitle').value = s.title;
    document.getElementById('serviceCategory').value = s.category;
    document.getElementById('servicePrice').value = s.price;
    document.getElementById('serviceTime').value = s.estimated_time;
    document.getElementById('serviceDescription').value = s.description || '';
    serviceModal.classList.add('open');
}
serviceForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('serviceId').value;
    const payload = {
        title: document.getElementById('serviceTitle').value.trim(),
        category: document.getElementById('serviceCategory').value,
        price: Number(document.getElementById('servicePrice').value),
        estimated_time: document.getElementById('serviceTime').value.trim(),
        description: document.getElementById('serviceDescription').value.trim()
    };
    try {
        const url = id ? `/api/services/${id}` : '/api/services';
        const method = id ? 'PUT' : 'POST';
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('Ошибка сохранения услуги');
        serviceModal.classList.remove('open');
        showToast('Услуга успешно сохранена!', 'success');
        await loadServices();
    } catch (err) {
        showToast(err.message, 'error');
    }
});
async function deleteService(serviceId) {
    if (!confirm('Удалить услугу из каталога?')) return;
    try {
        const res = await fetch(`/api/services/${serviceId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Ошибка удаления');
        showToast('Услуга удалена.', 'info');
        await loadServices();
    } catch (err) {
        showToast(err.message, 'error');
    }
}
async function loadUsers() {
    const res = await fetch('/api/users');
    adminUsers = await res.json();
    renderUsersTable(adminUsers);
}
function renderUsersTable(users) {
    const tbody = document.getElementById('adminUsersTableBody');
    if (!tbody) return;
    const roleBadges = {
        admin: '<span class="admin-badge">Администратор</span>',
        master: '<span class="admin-badge master-badge">Мастер</span>',
        client: '<span class="status-badge received">Клиент</span>'
    };
    tbody.innerHTML = users.map(u => `
        <tr>
            <td style="color: var(--text-muted); font-size: 0.8rem;">#${u.id}</td>
            <td style="font-weight: 600;">${u.name}</td>
            <td>${u.email}</td>
            <td>${u.phone || '—'}</td>
            <td>${roleBadges[u.role] || u.role}</td>
            <td>
                <select class="btn-action" onchange="changeUserRole(${u.id}, this.value)" style="background: #0f1422; color: #fff;">
                    <option value="client" ${u.role === 'client' ? 'selected' : ''}>Клиент</option>
                    <option value="master" ${u.role === 'master' ? 'selected' : ''}>Мастер</option>
                    <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Администратор</option>
                </select>
            </td>
            <td>
                <button class="btn-action delete" onclick="deleteUser(${u.id})" title="Удалить пользователя">✕</button>
            </td>
        </tr>
    `).join('');
}
async function changeUserRole(userId, newRole) {
    try {
        const res = await fetch(`/api/users/${userId}/role`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: newRole })
        });
        if (!res.ok) throw new Error('Ошибка изменения роли');
        showToast('Роль пользователя изменена.', 'success');
        await loadUsers();
        await loadMasters();
    } catch (err) {
        showToast(err.message, 'error');
    }
}
async function deleteUser(userId) {
    const cur = getCurrentUser();
    if (cur && cur.id === userId) {
        showToast('Нельзя удалить свой собственный аккаунт.', 'warning');
        return;
    }
    if (!confirm('Вы действительно хотите удалить этого пользователя?')) return;
    try {
        const res = await fetch(`/api/users/${userId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Ошибка удаления');
        showToast('Пользователь удален.', 'info');
        await loadUsers();
        await loadMasters();
    } catch (err) {
        showToast(err.message, 'error');
    }
}
const userModal = document.getElementById('userModal');
const userForm = document.getElementById('userForm');
document.getElementById('btnOpenAddUserModal').addEventListener('click', () => {
    userForm.reset();
    userModal.classList.add('open');
});
document.getElementById('closeUserModal').addEventListener('click', () => {
    userModal.classList.remove('open');
});
userForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
        name: document.getElementById('uName').value.trim(),
        email: document.getElementById('uEmail').value.trim(),
        phone: document.getElementById('uPhone').value.trim(),
        password: document.getElementById('uPassword').value,
        role: document.getElementById('uRole').value
    };
    try {
        const res = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Ошибка создания сотрудника');
        userModal.classList.remove('open');
        showToast(`Пользователь ${data.name} успешно создан!`, 'success');
        await loadUsers();
        await loadMasters();
    } catch (err) {
        showToast(err.message, 'error');
    }
});
async function renderAnalyticsCharts() {
    try {
        const res = await fetch('/api/analytics');
        const data = await res.json();
        const ctxStatus = document.getElementById('chartStatus').getContext('2d');
        if (chartInstances.status) chartInstances.status.destroy();
        const statusLabelsMap = {
            received: 'Принята',
            diagnostics: 'В диагностике',
            in_progress: 'В ремонте',
            ready: 'Готова к выдаче',
            completed: 'Выдана',
            cancelled: 'Отменена'
        };
        const statusColors = {
            received: '#38bdf8',
            diagnostics: '#a855f7',
            in_progress: '#f59e0b',
            ready: '#10b981',
            completed: '#0ea5e9',
            cancelled: '#f43f5e'
        };
        chartInstances.status = new Chart(ctxStatus, {
            type: 'doughnut',
            data: {
                labels: data.statusStats.map(s => statusLabelsMap[s.status] || s.status),
                datasets: [{
                    data: data.statusStats.map(s => s.count),
                    backgroundColor: data.statusStats.map(s => statusColors[s.status] || '#64748b'),
                    borderWidth: 2,
                    borderColor: '#0a0d14'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { color: '#ffffff', font: { family: 'Inter' } } }
                }
            }
        });
        const ctxDevices = document.getElementById('chartDevices').getContext('2d');
        if (chartInstances.devices) chartInstances.devices.destroy();
        chartInstances.devices = new Chart(ctxDevices, {
            type: 'bar',
            data: {
                labels: data.deviceStats.map(d => d.device_type),
                datasets: [{
                    label: 'Количество заявок',
                    data: data.deviceStats.map(d => d.count),
                    backgroundColor: 'rgba(56, 189, 248, 0.7)',
                    borderColor: '#38bdf8',
                    borderWidth: 1,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { ticks: { color: '#94a3b8', stepSize: 1 }, grid: { color: 'rgba(255,255,255,0.05)' } },
                    x: { ticks: { color: '#94a3b8' }, grid: { display: false } }
                },
                plugins: { legend: { display: false } }
            }
        });
        const ctxMasters = document.getElementById('chartMasters').getContext('2d');
        if (chartInstances.masters) chartInstances.masters.destroy();
        chartInstances.masters = new Chart(ctxMasters, {
            type: 'bar',
            data: {
                labels: data.masterStats.map(m => m.master.split(' ')[0]),
                datasets: [
                    {
                        label: 'Всего заявок',
                        data: data.masterStats.map(m => m.count),
                        backgroundColor: 'rgba(168, 85, 247, 0.7)',
                        borderRadius: 6
                    },
                    {
                        label: 'Завершено',
                        data: data.masterStats.map(m => m.completed_count),
                        backgroundColor: 'rgba(16, 185, 129, 0.7)',
                        borderRadius: 6
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { ticks: { color: '#94a3b8', stepSize: 1 }, grid: { color: 'rgba(255,255,255,0.05)' } },
                    x: { ticks: { color: '#94a3b8' }, grid: { display: false } }
                },
                plugins: {
                    legend: { position: 'bottom', labels: { color: '#ffffff' } }
                }
            }
        });
        const ctxRevenue = document.getElementById('chartRevenue').getContext('2d');
        if (chartInstances.revenue) chartInstances.revenue.destroy();
        chartInstances.revenue = new Chart(ctxRevenue, {
            type: 'line',
            data: {
                labels: ['Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь'],
                datasets: [{
                    label: 'Выручка (руб)',
                    data: [28000, 34500, 41200, 48900, 56300, data.kpi.totalRevenue + 45000],
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    fill: true,
                    tension: 0.35,
                    borderWidth: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                    x: { ticks: { color: '#94a3b8' }, grid: { display: false } }
                },
                plugins: {
                    legend: { position: 'bottom', labels: { color: '#ffffff' } }
                }
            }
        });
    } catch (err) {
        console.error('Ошибка отрисовки графиков:', err);
    }
}
async function openPrintFromAdmin(orderId) {
    try {
        const res = await fetch(`/api/orders/${orderId}`);
        const order = await res.json();
        document.getElementById('printDocId').textContent = order.id;
        document.getElementById('printDocClient').textContent = `${order.client_name} (${order.client_phone})`;
        document.getElementById('printDocDevice').textContent = `${order.device_type} ${order.brand_model} ${order.serial_number ? '(SN: ' + order.serial_number + ')' : ''}`;
        document.getElementById('printDocProblem').textContent = order.problem_description;
        document.getElementById('printDocMaster').textContent = order.master_name || 'Инженер сервисного центра';
        document.getElementById('printDocTotal').textContent = order.total_cost.toLocaleString('ru-RU');
        const list = document.getElementById('printDocItemsList');
        let rows = '';
        if (order.labor_cost > 0) {
            rows += `
                <tr>
                    <td>Комплекс ремонтно-восстановительных работ</td>
                    <td style="text-align:center;">1</td>
                    <td style="text-align:right;">${order.labor_cost.toLocaleString('ru-RU')} ₽</td>
                    <td style="text-align:right;">${order.labor_cost.toLocaleString('ru-RU')} ₽</td>
                </tr>
            `;
        }
        if (order.parts && order.parts.length > 0) {
            order.parts.forEach(p => {
                rows += `
                    <tr>
                        <td>${p.part_name}</td>
                        <td style="text-align:center;">${p.quantity}</td>
                        <td style="text-align:right;">${p.price_per_unit.toLocaleString('ru-RU')} ₽</td>
                        <td style="text-align:right;">${p.total_price.toLocaleString('ru-RU')} ₽</td>
                    </tr>
                `;
            });
        }
        if (!rows) {
            rows = `<tr><td colspan="4" style="text-align:center; color:#666;">Диагностический осмотр</td></tr>`;
        }
        list.innerHTML = rows;
        const qr = document.getElementById('printDocQR');
        if (qr && window.QRCodeGenerator) {
            const trackUrl = `${window.location.origin}/?track=${order.id}`;
            qr.innerHTML = window.QRCodeGenerator.createSVG(trackUrl, 85);
        }
        document.getElementById('printableReceiptModal').classList.add('open');
    } catch (err) {
        showToast(err.message, 'error');
    }
}
const closePrintModal = document.getElementById('closePrintModal');
if (closePrintModal) {
    closePrintModal.addEventListener('click', () => {
        document.getElementById('printableReceiptModal').classList.remove('open');
    });
}
function initEventListeners() {
    initKanbanDropZones();
}
