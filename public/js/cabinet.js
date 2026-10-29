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
let clientOrders = [];
let selectedOrder = null;
document.addEventListener('DOMContentLoaded', async () => {
    const user = getCurrentUser();
    if (!user) {
        alert('Пожалуйста, авторизуйтесь для входа в личный кабинет.');
        window.location.href = 'index.html';
        return;
    }
    document.getElementById('userNameDisplay').textContent = user.name;
    document.getElementById('userAvatar').textContent = user.name.charAt(0).toUpperCase();
    document.getElementById('btnCabinetLogout').addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('fixtech_user');
        window.location.href = 'index.html';
    });
    await loadClientOrders(user);
    document.getElementById('cabinetStatusFilter').addEventListener('change', (e) => {
        const filterVal = e.target.value;
        if (filterVal === 'all') {
            renderTable(clientOrders);
        } else {
            renderTable(clientOrders.filter(o => o.status === filterVal));
        }
    });
});
async function loadClientOrders(user) {
    try {
        const res = await fetch(`/api/orders?client_id=${user.id}`);
        clientOrders = await res.json();
        if (clientOrders.length === 0 && user.email) {
            const allRes = await fetch(`/api/orders`);
            const all = await allRes.json();
            clientOrders = all.filter(o => o.client_email && o.client_email.toLowerCase() === user.email.toLowerCase());
        }
        updateClientKPI(clientOrders);
        renderTable(clientOrders);
        renderNotifications(clientOrders);
    } catch (err) {
        showToast('Ошибка загрузки данных: ' + err.message, 'error');
    }
}
function updateClientKPI(orders) {
    let active = 0, ready = 0, completed = 0, totalSpent = 0;
    orders.forEach(o => {
        if (['received', 'diagnostics', 'in_progress'].includes(o.status)) active++;
        if (o.status === 'ready') ready++;
        if (o.status === 'completed') completed++;
        if (['ready', 'completed'].includes(o.status)) totalSpent += o.total_cost;
    });
    document.getElementById('kpiActiveCount').textContent = active;
    document.getElementById('kpiReadyCount').textContent = ready;
    document.getElementById('kpiCompletedCount').textContent = completed;
    document.getElementById('kpiTotalSpent').textContent = `${totalSpent.toLocaleString('ru-RU')} ₽`;
}
function renderTable(orders) {
    const tbody = document.getElementById('cabinetOrdersTableBody');
    if (!tbody) return;
    if (orders.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; color: var(--text-muted); padding: 50px;">
                    У вас пока нет оформленных заявок на ремонт.
                    <div style="margin-top: 14px;">
                        <a href="index.html#request" class="btn-pill btn-primary">Оформить первую заявку →</a>
                    </div>
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
        const dateStr = new Date(o.created_at).toLocaleDateString('ru-RU');
        return `
            <tr>
                <td style="font-family: 'Unbounded', sans-serif; font-weight: 700; color: var(--accent-color);">
                    ${o.id}
                </td>
                <td>
                    <div style="font-weight: 600;">${o.brand_model}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">${o.device_type}</div>
                </td>
                <td style="max-width: 260px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${o.problem_description}">
                    ${o.problem_description}
                </td>
                <td>${dateStr}</td>
                <td>${o.master_name || '<span style="color:var(--text-muted);">Не назначен</span>'}</td>
                <td>
                    <span class="status-badge ${st.cls}">${st.text}</span>
                </td>
                <td style="font-weight: 700; color: #ffffff;">
                    ${o.total_cost > 0 ? o.total_cost.toLocaleString('ru-RU') + ' ₽' : '—'}
                </td>
                <td>
                    <div style="display: flex; gap: 6px;">
                        <button class="btn-action" onclick="openCabinetDetailModal('${o.id}')">Детали</button>
                        <button class="btn-action success" onclick="openPrintFromCabinet('${o.id}')">Квитанция</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}
function renderNotifications(orders) {
    const container = document.getElementById('cabinetNotificationsContainer');
    if (!container) return;
    let allNotifs = [];
    orders.forEach(o => {
        if (o.notifications && o.notifications.length > 0) {
            allNotifs.push(...o.notifications);
        }
    });
    allNotifs.sort((a, b) => new Date(b.sent_at) - new Date(a.sent_at));
    if (allNotifs.length === 0) {
        container.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem;">Новых системных уведомлений нет.</p>`;
        return;
    }
    container.innerHTML = allNotifs.map(n => `
        <div style="background: var(--glass-panel); border: var(--border-glass); border-left: 3px solid var(--accent-color); padding: 14px 18px; border-radius: 8px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span style="font-weight: 700; font-size: 0.9rem; color: #ffffff;">${n.title}</span>
                <span style="font-size: 0.75rem; color: var(--text-muted);">${new Date(n.sent_at).toLocaleString('ru-RU')}</span>
            </div>
            <div style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.4;">${n.message}</div>
        </div>
    `).join('');
}
async function openCabinetDetailModal(orderId) {
    try {
        const res = await fetch(`/api/orders/${orderId}`);
        const order = await res.json();
        selectedOrder = order;
        document.getElementById('cadId').textContent = order.id;
        document.getElementById('cadDevice').textContent = `${order.device_type} • ${order.brand_model}`;
        document.getElementById('cadProblem').textContent = order.problem_description;
        document.getElementById('cadMaster').textContent = order.master_name || 'Ожидает назначения инженера';
        document.getElementById('cadDiagnosis').textContent = order.diagnostic_notes || 'В процессе первичной проверки';
        document.getElementById('cadComment').textContent = order.master_comment || 'Нет комментариев';
        document.getElementById('cadLabor').textContent = `${order.labor_cost.toLocaleString('ru-RU')} ₽`;
        document.getElementById('cadTotal').textContent = `${order.total_cost.toLocaleString('ru-RU')} ₽`;
        const partsStr = order.parts && order.parts.length > 0
            ? order.parts.map(p => `${p.part_name} (${p.quantity} шт. × ${p.price_per_unit} ₽)`).join(', ')
            : 'Запчасти не использовались';
        document.getElementById('cadPartsList').textContent = partsStr;
        const badge = document.getElementById('cadStatusBadge');
        badge.className = `status-badge ${order.status}`;
        const statusMap = {
            received: 'Принята',
            diagnostics: 'В диагностике',
            in_progress: 'В ремонте',
            ready: 'Готова к выдаче',
            completed: 'Выдана',
            cancelled: 'Отменена'
        };
        badge.textContent = statusMap[order.status] || order.status;
        const stepOrder = ['received', 'diagnostics', 'in_progress', 'ready', 'completed'];
        const currentIdx = stepOrder.indexOf(order.status);
        stepOrder.forEach((st, idx) => {
            const el = document.getElementById(`cstep-${st}`);
            if (el) {
                el.classList.remove('active', 'completed');
                if (idx < currentIdx) el.classList.add('completed');
                else if (idx === currentIdx) el.classList.add('active');
            }
        });
        const qrContainer = document.getElementById('cadQR');
        if (qrContainer && window.QRCodeGenerator) {
            const trackUrl = `${window.location.origin}/?track=${order.id}`;
            qrContainer.innerHTML = window.QRCodeGenerator.createSVG(trackUrl, 75);
        }
        document.getElementById('cabinetDetailModal').classList.add('open');
    } catch (err) {
        showToast(err.message, 'error');
    }
}
const closeCabinetModal = document.getElementById('closeCabinetModal');
if (closeCabinetModal) {
    closeCabinetModal.addEventListener('click', () => {
        document.getElementById('cabinetDetailModal').classList.remove('open');
    });
}
const btnCabinetPrintDoc = document.getElementById('btnCabinetPrintDoc');
if (btnCabinetPrintDoc) {
    btnCabinetPrintDoc.addEventListener('click', () => {
        if (!selectedOrder) return;
        openPrintFromCabinet(selectedOrder.id);
    });
}
async function openPrintFromCabinet(orderId) {
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
