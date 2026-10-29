const test = require('node:test');
const assert = require('node:assert');
const db = require('./database.js');
const app = require('./server.js');
test('1. Пользователи и хеширование паролей', () => {
    const testEmail = `tester_${Date.now()}@service.ru`;
    const user = db.createUser({
        name: 'Инженер-Тестировщик',
        email: testEmail,
        phone: '+7 999 123-45-67',
        password: 'securePassword2026',
        role: 'master'
    });
    assert.ok(user.id, 'Пользователь должен получить ID');
    assert.strictEqual(user.email, testEmail);
    assert.strictEqual(user.role, 'master');
    const stored = db.getUserByEmail(testEmail);
    assert.notStrictEqual(stored.password_hash, 'securePassword2026');
    assert.ok(stored.salt);
    assert.strictEqual(db.verifyPassword('securePassword2026', stored.password_hash, stored.salt), true);
    assert.strictEqual(db.verifyPassword('wrongPassword', stored.password_hash, stored.salt), false);
    const updated = db.updateUserRole(user.id, 'admin');
    assert.strictEqual(updated.role, 'admin');
    db.deleteUser(user.id);
    assert.strictEqual(db.getUserByEmail(testEmail), undefined);
});
test('2. Каталог услуг и ориентировочных цен', () => {
    const initialServices = db.getServices();
    assert.ok(Array.isArray(initialServices));
    assert.ok(initialServices.length >= 5);
    const newService = db.addService({
        title: 'Тестовая калибровка датчиков',
        category: 'Смартфоны',
        price: 990,
        estimated_time: '30 минут',
        description: 'Калибровка гироскопа и датчика приближения',
        icon: 'smartphone'
    });
    assert.ok(newService.id);
    assert.strictEqual(newService.price, 990);
    const phoneServices = db.getServices('Смартфоны');
    assert.ok(phoneServices.some(s => s.id === newService.id));
    db.deleteService(newService.id);
    const afterDelete = db.getServices();
    assert.ok(!afterDelete.some(s => s.id === newService.id));
});
test('3. Склад запчастей и автоматический учет остатков', () => {
    const sku = `TEST-PART-${Date.now()}`;
    const part = db.addPart({
        sku,
        name: 'Тестовый аккумулятор Li-Ion',
        category: 'Аккумуляторы',
        stock_quantity: 10,
        min_quantity: 3,
        purchase_price: 500,
        sell_price: 1200
    });
    assert.ok(part.id);
    assert.strictEqual(part.stock_quantity, 10);
    const afterStockIn = db.updatePartStock(part.id, 5);
    assert.strictEqual(afterStockIn.stock_quantity, 15);
    const afterStockOut = db.updatePartStock(part.id, -2);
    assert.strictEqual(afterStockOut.stock_quantity, 13);
    db.deletePart(part.id);
    assert.strictEqual(db.getPartById(part.id), undefined);
});
test('4. Жизненный цикл заявки на ремонт (создание, мастер, запчасть, статус)', () => {
    const order = db.createOrder({
        client_name: 'Петр Тестов',
        client_phone: '+7 900 111-22-33',
        client_email: 'petr@test.ru',
        device_type: 'Ноутбук',
        brand_model: 'Lenovo Legion 5',
        serial_number: 'PF2XY999',
        problem_description: 'Не включается после скачка напряжения',
        urgency: 'urgent'
    });
    assert.ok(order.id.startsWith('REP-'));
    assert.strictEqual(order.status, 'received');
    assert.strictEqual(order.total_cost, 0);
    assert.ok(order.history.length >= 1);
    assert.ok(order.notifications.length >= 1);
    const masters = db.getMasters();
    assert.ok(masters.length > 0);
    const master = masters[0];
    const assignedOrder = db.assignMaster(order.id, master.id);
    assert.strictEqual(assignedOrder.master_id, master.id);
    assert.strictEqual(assignedOrder.master_name, master.name);
    db.updateOrderStatus(order.id, 'diagnostics', master.name, 'Проводится осмотр цепи питания');
    db.updateOrderStatus(order.id, 'in_progress', master.name, 'Необходима замена ШИМ и чистка');
    db.updateMasterReport(order.id, {
        diagnostic_notes: 'Пробит входной мосфет по линии 19V',
        master_comment: 'Выполнена замена транзистора',
        labor_cost: 2500
    });
    const updatedWithLabor = db.getOrderById(order.id);
    assert.strictEqual(updatedWithLabor.labor_cost, 2500);
    assert.strictEqual(updatedWithLabor.total_cost, 2500);
    const parts = db.getParts();
    assert.ok(parts.length > 0);
    const testPart = parts[0];
    const initialPartStock = testPart.stock_quantity;
    const withPartOrder = db.addPartToOrder(order.id, testPart.id, 1);
    assert.ok(withPartOrder.parts.length === 1);
    assert.strictEqual(withPartOrder.parts_cost, testPart.sell_price);
    assert.strictEqual(withPartOrder.total_cost, 2500 + testPart.sell_price);
    const partAfterDeduction = db.getPartById(testPart.id);
    assert.strictEqual(partAfterDeduction.stock_quantity, initialPartStock - 1);
    const readyOrder = db.updateOrderStatus(order.id, 'ready', master.name, 'Готово к выдаче клиенту');
    assert.strictEqual(readyOrder.status, 'ready');
    const orderPartId = withPartOrder.parts[0].id;
    db.removePartFromOrder(orderPartId);
    const partRestored = db.getPartById(testPart.id);
    assert.strictEqual(partRestored.stock_quantity, initialPartStock);
    db.deleteOrder(order.id);
    assert.strictEqual(db.getOrderById(order.id), null);
});
test('5. Статистика и аналитика (KPI)', () => {
    const analytics = db.getAnalytics();
    assert.ok(analytics.kpi);
    assert.ok(typeof analytics.kpi.totalOrders === 'number');
    assert.ok(typeof analytics.kpi.inWorkOrders === 'number');
    assert.ok(typeof analytics.kpi.totalRevenue === 'number');
    assert.ok(Array.isArray(analytics.deviceStats));
    assert.ok(Array.isArray(analytics.masterStats));
});
test('6. HTTP API: Авторизация, получение услуг и создание заявки через REST', async (t) => {
    const server = app.listen(0);
    t.after(() => server.close());
    const port = server.address().port;
    const baseUrl = `http://localhost:${port}`;
    const servicesRes = await fetch(`${baseUrl}/api/services`);
    assert.strictEqual(servicesRes.status, 200);
    const services = await servicesRes.json();
    assert.ok(Array.isArray(services));
    const loginOkRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@remont.ru', password: 'admin123' })
    });
    assert.strictEqual(loginOkRes.status, 200);
    const adminUser = await loginOkRes.json();
    assert.strictEqual(adminUser.role, 'admin');
    const loginFailRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@remont.ru', password: 'incorrectPassword' })
    });
    assert.strictEqual(loginFailRes.status, 401);
    const createOrderRes = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            client_name: 'API Тестер',
            client_phone: '+7 (999) 444-55-66',
            client_email: 'api_test@test.ru',
            device_type: 'Смартфон',
            brand_model: 'Google Pixel 7',
            problem_description: 'Быстро разряжается'
        })
    });
    assert.strictEqual(createOrderRes.status, 201);
    const created = await createOrderRes.json();
    assert.ok(created.id);
    await fetch(`${baseUrl}/api/orders/${created.id}`, { method: 'DELETE' });
});
