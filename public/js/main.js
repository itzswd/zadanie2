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
function setCurrentUser(user) {
    if (user) {
        localStorage.setItem('fixtech_user', JSON.stringify(user));
    } else {
        localStorage.removeItem('fixtech_user');
    }
    updateAuthNav();
}
function updateAuthNav() {
    const container = document.getElementById('authNavContainer');
    if (!container) return;
    const user = getCurrentUser();
    if (!user) {
        container.innerHTML = `<button class="btn-pill btn-primary" id="btnLoginOpen">Войти</button>`;
        document.getElementById('btnLoginOpen').addEventListener('click', () => openAuthModal('login'));
    } else {
        let portalBtn = '';
        if (user.role === 'admin') {
            portalBtn = `<a href="admin.html" class="btn-pill" style="border-color: var(--accent-amber); color: var(--accent-amber);">Админ-панель</a>`;
        } else if (user.role === 'master') {
            portalBtn = `<a href="master.html" class="btn-pill" style="border-color: var(--accent-color); color: var(--accent-color);">Мастерская</a>`;
        } else {
            portalBtn = `<a href="cabinet.html" class="btn-pill" style="border-color: var(--accent-green); color: var(--accent-green);">Мои заявки</a>`;
        }
        container.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                ${portalBtn}
                <button class="btn-pill" id="btnLogout" title="Выйти (${user.name})">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                </button>
            </div>
        `;
        document.getElementById('btnLogout').addEventListener('click', () => {
            setCurrentUser(null);
            showToast('Вы успешно вышли из системы.', 'info');
            location.reload();
        });
    }
}
let allServices = [];
async function loadServices() {
    const container = document.getElementById('servicesContainer');
    if (!container) return;
    try {
        const res = await fetch('/api/services');
        allServices = await res.json();
        renderServices(allServices);
    } catch (err) {
        container.innerHTML = `<p style="color: var(--accent-red);">Ошибка загрузки услуг: ${err.message}</p>`;
    }
}
function renderServices(services) {
    const container = document.getElementById('servicesContainer');
    if (!container) return;
    if (services.length === 0) {
        container.innerHTML = `<p style="color: var(--text-muted); grid-column: 1/-1; text-align: center; padding: 40px;">Услуги не найдены.</p>`;
        return;
    }
    container.innerHTML = services.map(s => `
        <div class="service-card">
            <div>
                <span class="service-category-badge">${s.category}</span>
                <h3 class="service-title">${s.title}</h3>
                <p class="service-desc">${s.description || 'Профессиональное устранение неисправности.'}</p>
            </div>
            <div class="service-footer">
                <div>
                    <div class="service-price">
                        ${s.price === 0 ? 'Бесплатно' : `${s.price.toLocaleString('ru-RU')} ₽`}
                    </div>
                    <span class="service-time">Срок: ${s.estimated_time}</span>
                </div>
                <button class="btn-pill btn-primary" onclick="selectServiceForOrder('${s.category}', '${s.title}')">
                    Выбрать →
                </button>
            </div>
        </div>
    `).join('');
}
function selectServiceForOrder(category, title) {
    const typeSelect = document.getElementById('deviceType');
    const problemInput = document.getElementById('problemDescription');
    if (typeSelect) {
        for (let opt of typeSelect.options) {
            if (opt.value === category || (category === 'Диагностика' && opt.value === 'Смартфон')) {
                typeSelect.value = opt.value;
                break;
            }
        }
    }
    if (problemInput) {
        problemInput.value = `Требуется услуга: ${title}. `;
    }
    const reqSection = document.getElementById('request');
    if (reqSection) {
        reqSection.scrollIntoView({ behavior: 'smooth' });
    }
}
const categoryPills = document.querySelectorAll('.category-pill');
categoryPills.forEach(pill => {
    pill.addEventListener('click', () => {
        categoryPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        applyServicesFilter();
    });
});
const searchInput = document.getElementById('servicesSearchInput');
if (searchInput) {
    searchInput.addEventListener('input', applyServicesFilter);
}
function applyServicesFilter() {
    const activePill = document.querySelector('.category-pill.active');
    const selectedCategory = activePill ? activePill.getAttribute('data-category') : 'Все';
    const query = (searchInput ? searchInput.value : '').toLowerCase().trim();
    let filtered = allServices;
    if (selectedCategory !== 'Все') {
        filtered = filtered.filter(s => s.category === selectedCategory);
    }
    if (query) {
        filtered = filtered.filter(s => s.title.toLowerCase().includes(query) || (s.description && s.description.toLowerCase().includes(query)));
    }
    renderServices(filtered);
}
const photoDropArea = document.getElementById('photoDropArea');
const photoInput = document.getElementById('photoInput');
const photoPreview = document.getElementById('photoPreview');
let uploadedPhotoBase64 = null;
if (photoDropArea && photoInput) {
    photoDropArea.addEventListener('click', () => photoInput.click());
    photoDropArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        photoDropArea.style.borderColor = 'var(--accent-color)';
    });
    photoDropArea.addEventListener('dragleave', () => {
        photoDropArea.style.borderColor = 'rgba(255, 255, 255, 0.15)';
    });
    photoDropArea.addEventListener('drop', (e) => {
        e.preventDefault();
        photoDropArea.style.borderColor = 'rgba(255, 255, 255, 0.15)';
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handlePhotoFile(e.dataTransfer.files[0]);
        }
    });
    photoInput.addEventListener('change', () => {
        if (photoInput.files && photoInput.files[0]) {
            handlePhotoFile(photoInput.files[0]);
        }
    });
}
function handlePhotoFile(file) {
    if (!file.type.startsWith('image/')) {
        showToast('Пожалуйста, выберите файл изображения (PNG, JPG).', 'error');
        return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
        uploadedPhotoBase64 = e.target.result;
        if (photoPreview) {
            photoPreview.src = uploadedPhotoBase64;
            photoPreview.style.display = 'block';
        }
    };
    reader.readAsDataURL(file);
}
const orderForm = document.getElementById('orderForm');
if (orderForm) {
    orderForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = getCurrentUser();
        const payload = {
            client_id: user ? user.id : null,
            client_name: document.getElementById('clientName').value.trim(),
            client_phone: document.getElementById('clientPhone').value.trim(),
            client_email: document.getElementById('clientEmail').value.trim() || (user ? user.email : ''),
            device_type: document.getElementById('deviceType').value,
            brand_model: document.getElementById('brandModel').value.trim(),
            serial_number: document.getElementById('serialNumber').value.trim(),
            problem_description: document.getElementById('problemDescription').value.trim(),
            photo_url: uploadedPhotoBase64
        };
        try {
            const res = await fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Ошибка при отправке');
            }
            orderForm.reset();
            if (photoPreview) photoPreview.style.display = 'none';
            uploadedPhotoBase64 = null;
            showToast(`Заявка успешно создана! Номер: ${data.id}`, 'success');
            openTrackModal(data.id);
        } catch (err) {
            showToast(err.message, 'error');
        }
    });
}
const orderTrackModal = document.getElementById('orderTrackModal');
const closeTrackModal = document.getElementById('closeTrackModal');
let currentTrackedOrder = null;
if (closeTrackModal) {
    closeTrackModal.addEventListener('click', () => orderTrackModal.classList.remove('open'));
}
if (orderTrackModal) {
    orderTrackModal.addEventListener('click', (e) => {
        if (e.target === orderTrackModal) orderTrackModal.classList.remove('open');
    });
}
async function openTrackModal(orderId) {
    if (!orderId) return;
    try {
        const res = await fetch(`/api/orders/${orderId.trim()}`);
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Заявка не найдена');
        }
        const order = await res.json();
        currentTrackedOrder = order;
        document.getElementById('trackModalOrderId').textContent = order.id;
        document.getElementById('trackModalDevice').textContent = `${order.device_type} • ${order.brand_model}`;
        document.getElementById('trackModalClient').textContent = `${order.client_name} (${order.client_phone})`;
        document.getElementById('trackModalProblem').textContent = order.problem_description;
        document.getElementById('trackModalMaster').textContent = order.master_name || 'Ожидает назначения';
        document.getElementById('trackModalDiagnosis').textContent = order.diagnostic_notes || 'В процессе первичного осмотра';
        document.getElementById('trackModalCost').textContent = `${order.total_cost.toLocaleString('ru-RU')} ₽`;
        const partsText = order.parts && order.parts.length > 0 
            ? order.parts.map(p => `${p.part_name} (${p.quantity} шт.)`).join(', ')
            : 'Запчасти не использовались';
        document.getElementById('trackModalParts').textContent = partsText;
        const badge = document.getElementById('trackModalStatusBadge');
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
            const el = document.getElementById(`step-${st}`);
            if (el) {
                el.classList.remove('active', 'completed');
                if (idx < currentIdx) {
                    el.classList.add('completed');
                } else if (idx === currentIdx) {
                    el.classList.add('active');
                }
            }
        });
        const qrContainer = document.getElementById('trackModalQRCode');
        if (qrContainer && window.QRCodeGenerator) {
            const trackUrl = `${window.location.origin}/?track=${order.id}`;
            qrContainer.innerHTML = window.QRCodeGenerator.createSVG(trackUrl, 75);
        }
        orderTrackModal.classList.add('open');
    } catch (err) {
        showToast(err.message, 'error');
    }
}
const btnQuickTrack = document.getElementById('btnQuickTrack');
if (btnQuickTrack) {
    btnQuickTrack.addEventListener('click', () => {
        const id = prompt('Введите номер заявки (например, REP-1042):');
        if (id) openTrackModal(id.trim());
    });
}
const btnHeroTrackSubmit = document.getElementById('btnHeroTrackSubmit');
const heroTrackInput = document.getElementById('heroTrackInput');
const trackLinks = document.querySelectorAll('a[href="#track"]');
trackLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const heroSection = document.getElementById('hero');
        const trackCard = document.getElementById('track');
        const heroInput = document.getElementById('heroTrackInput');
        if (window.scrollY > 80 && heroSection) {
            heroSection.scrollIntoView({ behavior: 'smooth' });
        }
        if (heroInput) {
            setTimeout(() => {
                heroInput.focus();
                if (trackCard) {
                    trackCard.style.borderColor = 'var(--accent-color)';
                    trackCard.style.boxShadow = '0 0 35px rgba(56, 189, 248, 0.4)';
                    setTimeout(() => {
                        trackCard.style.borderColor = '';
                        trackCard.style.boxShadow = '';
                    }, 1400);
                }
            }, 300);
        }
    });
});

if (btnHeroTrackSubmit && heroTrackInput) {
    btnHeroTrackSubmit.addEventListener('click', () => {
        if (heroTrackInput.value.trim()) {
            openTrackModal(heroTrackInput.value.trim());
        } else {
            showToast('Введите номер заявки', 'warning');
        }
    });
    heroTrackInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && heroTrackInput.value.trim()) {
            openTrackModal(heroTrackInput.value.trim());
        }
    });
}
const btnPrintReceiptBtn = document.getElementById('btnPrintReceiptBtn');
const printableReceiptModal = document.getElementById('printableReceiptModal');
const closePrintModal = document.getElementById('closePrintModal');
if (closePrintModal) {
    closePrintModal.addEventListener('click', () => printableReceiptModal.classList.remove('open'));
}
if (printableReceiptModal) {
    printableReceiptModal.addEventListener('click', (e) => {
        if (e.target === printableReceiptModal) printableReceiptModal.classList.remove('open');
    });
}
if (btnPrintReceiptBtn) {
    btnPrintReceiptBtn.addEventListener('click', () => {
        if (!currentTrackedOrder) return;
        renderPrintDocument(currentTrackedOrder);
        printableReceiptModal.classList.add('open');
    });
}
function renderPrintDocument(order) {
    document.getElementById('printDocId').textContent = order.id;
    document.getElementById('printDocDate').textContent = new Date(order.created_at).toLocaleDateString('ru-RU');
    document.getElementById('printDocClient').textContent = `${order.client_name} (${order.client_phone})`;
    document.getElementById('printDocDevice').textContent = `${order.device_type} ${order.brand_model} ${order.serial_number ? '(SN: ' + order.serial_number + ')' : ''}`;
    document.getElementById('printDocProblem').textContent = order.problem_description;
    document.getElementById('printDocMaster').textContent = order.master_name || 'Инженер сервисного центра';
    document.getElementById('printDocDiagnosis').textContent = order.diagnostic_notes || 'Диагностика проведена, дефекты устранены';
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
        rows = `<tr><td colspan="4" style="text-align:center; color:#666;">Диагностический осмотр (без списания запчастей)</td></tr>`;
    }
    list.innerHTML = rows;
    const qrContainer = document.getElementById('printDocQR');
    if (qrContainer && window.QRCodeGenerator) {
        const trackUrl = `${window.location.origin}/?track=${order.id}`;
        qrContainer.innerHTML = window.QRCodeGenerator.createSVG(trackUrl, 85);
    }
}
const authModal = document.getElementById('authModal');
const closeAuthModal = document.getElementById('closeAuthModal');
const authTabLogin = document.getElementById('authTabLogin');
const authTabRegister = document.getElementById('authTabRegister');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
function openAuthModal(tab = 'login') {
    if (tab === 'login') {
        authTabLogin.classList.add('btn-primary');
        authTabRegister.classList.remove('btn-primary');
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
    } else {
        authTabRegister.classList.add('btn-primary');
        authTabLogin.classList.remove('btn-primary');
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
    }
    authModal.classList.add('open');
}
if (closeAuthModal) {
    closeAuthModal.addEventListener('click', () => authModal.classList.remove('open'));
}
if (authModal) {
    authModal.addEventListener('click', (e) => {
        if (e.target === authModal) authModal.classList.remove('open');
    });
}
if (authTabLogin) authTabLogin.addEventListener('click', () => openAuthModal('login'));
if (authTabRegister) authTabRegister.addEventListener('click', () => openAuthModal('register'));
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Ошибка авторизации');
            setCurrentUser(data);
            authModal.classList.remove('open');
            showToast(`Добро пожаловать, ${data.name}!`, 'success');
            if (data.role === 'admin') {
                window.location.href = 'admin.html';
            } else if (data.role === 'master') {
                window.location.href = 'master.html';
            } else {
                window.location.href = 'cabinet.html';
            }
        } catch (err) {
            showToast(err.message, 'error');
        }
    });
}
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('regName').value.trim();
        const email = document.getElementById('regEmail').value.trim();
        const phone = document.getElementById('regPhone').value.trim();
        const password = document.getElementById('regPassword').value;
        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, phone, password, role: 'client' })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Ошибка регистрации');
            setCurrentUser(data);
            authModal.classList.remove('open');
            showToast('Регистрация успешна! Добро пожаловать.', 'success');
            window.location.href = 'cabinet.html';
        } catch (err) {
            showToast(err.message, 'error');
        }
    });
}
function prefillClientForm() {
    const user = getCurrentUser();
    if (user) {
        const nameEl = document.getElementById('clientName');
        const phoneEl = document.getElementById('clientPhone');
        const emailEl = document.getElementById('clientEmail');
        if (nameEl && !nameEl.value) nameEl.value = user.name;
        if (phoneEl && !phoneEl.value && user.phone) phoneEl.value = user.phone;
        if (emailEl && !emailEl.value) emailEl.value = user.email;
    }
}
document.addEventListener('DOMContentLoaded', () => {
    updateAuthNav();
    loadServices();
    prefillClientForm();
    const urlParams = new URLSearchParams(window.location.search);
    const trackParam = urlParams.get('track');
    if (trackParam) {
        openTrackModal(trackParam);
    }
});
