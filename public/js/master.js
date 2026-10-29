function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}
function getCurrentUser() {
    try {
        return JSON.parse(localStorage.getItem('fixtech_user'));
    } catch (e) {
        return null;
    }
}
let masterOrders = [];
let allParts = [];
let currentOrder = null;
document.addEventListener('DOMContentLoaded', async () => {
    const user = getCurrentUser();
    if (!user || (user.role !== 'master' && user.role !== 'admin')) {
        alert('Доступ разрешён только инженерам мастерской.');
        window.location.href = 'index.html';
        return;
    }
    document.getElementById('masterNameDisplay').textContent = user.name;
    document.getElementById('masterAvatar').textContent = user.name.charAt(0).toUpperCase();
    document.getElementById('btnMasterLogout').addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('fixtech_user');
        window.location.href = 'index.html';
    });
    await loadMasterOrders(user);
    await loadWarehouseParts();
    const filterSelect = document.getElementById('masterStatusFilter');
    const searchInput = document.getElementById('masterSearchInput');
    if (filterSelect) filterSelect.addEventListener('change', applyMasterFilters);
    if (searchInput) searchInput.addEventListener('input', applyMasterFilters);
    document.getElementById('btnMrepAddPart').addEventListener('click', addPartToCurrentOrder);
    document.getElementById('btnMasterSaveReport').addEventListener('click', saveMasterReport);
    document.getElementById('closeMasterReportModal').addEventListener('click', closeModal);
    document.getElementById('btnMasterCloseModal').addEventListener('click', closeModal);
});
function closeModal() {
    document.getElementById('masterReportModal').classList.remove('open');
}
async function loadMasterOrders(user) {
    try {
        const url = user.role === 'admin' ? '/api/orders' : `/api/orders?master_id=${user.id}`;
        const res = await fetch(url);
        masterOrders = await res.json();
        updateMasterKPI(masterOrders);
        renderMasterTable(masterOrders);
    } catch (err) {
        showToast('Ошибка загрузки заявок: ' + err.message, 'error');
    }
}
async function loadWarehouseParts() {
    try {
        const res = await fetch('/api/parts');
        allParts = await res.json();
        const select = document.getElementById('mrepPartSelect');
        if (!select) return;
        select.innerHTML = '<option value="">-- Выберите деталь со склада --</option>' +
            allParts.map(p => `
                <option value="${p.id}" ${p.stock_quantity <= 0 ? 'disabled' : ''}>
                    ${p.name} (${p.stock_quantity > 0 ? p.stock_quantity + ' шт.' : 'НЕТ В НАЛИЧИИ'}) — ${p.sell_price.toLocaleString('ru-RU')} ₽
                </option>
            `).join('');
    } catch (err) {
        console.error('Ошибка загрузки склада:', err);
    }
}
function updateMasterKPI(orders) {
    let assigned = orders.length;
    let inWork = 0;
    let ready = 0;
    let earned = 0;
    orders.forEach(o => {
        if (['diagnostics', 'in_progress'].includes(o.status)) inWork++;
        if (o.status === 'ready' || o.status === 'completed') {
            ready++;
            earned += o.labor_cost;
        }
    });
    document.getElementById('kpiMasterAssigned').textContent = assigned;
    document.getElementById('kpiMasterInWork').textContent = inWork;
    document.getElementById('kpiMasterReady').textContent = ready;
    document.getElementById('kpiMasterEarned').textContent = `${earned.toLocaleString('ru-RU')} ₽`;
}
function applyMasterFilters() {
    const statusVal = document.getElementById('masterStatusFilter').value;
    const searchVal = document.getElementById('masterSearchInput').value.toLowerCase().trim();
    let filtered = masterOrders;
    if (statusVal !== 'all') {
        filtered = filtered.filter(o => o.status === statusVal);
    }
    if (searchVal) {
        filtered = filtered.filter(o => 
            o.id.toLowerCase().includes(searchVal) ||
            o.brand_model.toLowerCase().includes(searchVal) ||
            o.client_name.toLowerCase().includes(searchVal) ||
            o.problem_description.toLowerCase().includes(searchVal)
        );
    }
    renderMasterTable(filtered);
}
function renderMasterTable(orders) {
    const tbody = document.getElementById('masterOrdersTableBody');
    if (!tbody) return;
    if (orders.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; color: var(--text-muted); padding: 50px;">
                    Нет назначенных заявок.
                </td>
            </tr>
        `;
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
        const partsSummary = o.parts_cost > 0 ? `Детали: ${o.parts_cost} ₽` : 'Без деталей';
        const laborSummary = o.labor_cost > 0 ? `Работа: ${o.labor_cost} ₽` : 'Работа: 0 ₽';
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
                <td style="max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${o.problem_description}">
                    ${o.problem_description}
                </td>
                <td>
                    <span class="status-badge ${st.cls}">${st.text}</span>
                </td>
                <td style="font-size: 0.8rem; color: var(--text-muted);">
                    <div>${laborSummary}</div>
                    <div>${partsSummary}</div>
                </td>
                <td style="font-weight: 700; color: #ffffff;">
                    ${o.total_cost.toLocaleString('ru-RU')} ₽
                </td>
                <td>
                    <button class="btn-action success" onclick="openMasterReportModal('${o.id}')">
                        Диагностика и отчёт →
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}
async function openMasterReportModal(orderId) {
    try {
        const res = await fetch(`/api/orders/${orderId}`);
        const order = await res.json();
        currentOrder = order;
        document.getElementById('mrepId').textContent = order.id;
        document.getElementById('mrepDevice').textContent = `${order.device_type} • ${order.brand_model}`;
        document.getElementById('mrepStatusSelect').value = order.status;
        document.getElementById('mrepClientProblem').textContent = order.problem_description;
        document.getElementById('mrepDiagnosticNotes').value = order.diagnostic_notes || '';
        document.getElementById('mrepMasterComment').value = order.master_comment || '';
        document.getElementById('mrepLaborCost').value = order.labor_cost || 0;
        renderOrderParts(order.parts || []);
        updateOrderTotalDisplay();
        document.getElementById('masterReportModal').classList.add('open');
    } catch (err) {
        showToast(err.message, 'error');
    }
}
function renderOrderParts(parts) {
    const tbody = document.getElementById('mrepPartsTableBody');
    if (!tbody) return;
    if (parts.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 14px;">Запчасти пока не добавлены.</td></tr>`;
        return;
    }
    tbody.innerHTML = parts.map(p => `
        <tr>
            <td style="font-weight: 600;">${p.part_name}</td>
            <td style="text-align: center;">${p.quantity}</td>
            <td style="text-align: right;">${p.price_per_unit.toLocaleString('ru-RU')} ₽</td>
            <td style="text-align: right; font-weight: 700;">${p.total_price.toLocaleString('ru-RU')} ₽</td>
            <td style="text-align: center;">
                <button type="button" class="btn-action delete" onclick="removePartFromCurrentOrder(${p.id})">
                    Вернуть на склад
                </button>
            </td>
        </tr>
    `).join('');
}
function updateOrderTotalDisplay() {
    if (!currentOrder) return;
    const labor = Number(document.getElementById('mrepLaborCost').value) || 0;
    const partsSum = (currentOrder.parts || []).reduce((sum, p) => sum + p.total_price, 0);
    const total = labor + partsSum;
    document.getElementById('mrepTotalDisplay').textContent = `${total.toLocaleString('ru-RU')} ₽`;
}
document.getElementById('mrepLaborCost').addEventListener('input', updateOrderTotalDisplay);
async function addPartToCurrentOrder() {
    if (!currentOrder) return;
    const partSelect = document.getElementById('mrepPartSelect');
    const partId = partSelect.value;
    const qty = Number(document.getElementById('mrepPartQty').value) || 1;
    if (!partId) {
        showToast('Выберите запчасть из списка.', 'warning');
        return;
    }
    try {
        const res = await fetch(`/api/orders/${currentOrder.id}/parts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ part_id: partId, quantity: qty })
        });
        const updated = await res.json();
        if (!res.ok) throw new Error(updated.error || 'Ошибка списания детали');
        currentOrder = updated;
        renderOrderParts(updated.parts);
        updateOrderTotalDisplay();
        await loadWarehouseParts(); 
        showToast('Деталь успешно списана со склада и добавлена в заказ.', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}
async function removePartFromCurrentOrder(orderPartId) {
    if (!currentOrder) return;
    if (!confirm('Вернуть деталь обратно на склад?')) return;
    try {
        const res = await fetch(`/api/orders/${currentOrder.id}/parts/${orderPartId}`, {
            method: 'DELETE'
        });
        const updated = await res.json();
        if (!res.ok) throw new Error(updated.error || 'Ошибка возврата');
        currentOrder = updated;
        renderOrderParts(updated.parts);
        updateOrderTotalDisplay();
        await loadWarehouseParts();
        showToast('Деталь возвращена на склад.', 'info');
    } catch (err) {
        showToast(err.message, 'error');
    }
}
async function saveMasterReport() {
    if (!currentOrder) return;
    const newStatus = document.getElementById('mrepStatusSelect').value;
    const diagnosticNotes = document.getElementById('mrepDiagnosticNotes').value.trim();
    const masterComment = document.getElementById('mrepMasterComment').value.trim();
    const laborCost = Number(document.getElementById('mrepLaborCost').value) || 0;
    const user = getCurrentUser();
    try {
        const repRes = await fetch(`/api/orders/${currentOrder.id}/report`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                diagnostic_notes: diagnosticNotes,
                master_comment: masterComment,
                labor_cost: laborCost
            })
        });
        if (!repRes.ok) throw new Error('Ошибка обновления отчёта');
        if (newStatus !== currentOrder.status) {
            const stRes = await fetch(`/api/orders/${currentOrder.id}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: newStatus,
                    author_name: user ? user.name : 'Мастер',
                    comment: masterComment || 'Статус изменён мастером в отчёте'
                })
            });
            if (!stRes.ok) throw new Error('Ошибка смены статуса');
        }
        showToast('Отчёт и статус успешно сохранены!', 'success');
        closeModal();
        await loadMasterOrders(user);
    } catch (err) {
        showToast(err.message, 'error');
    }
}
