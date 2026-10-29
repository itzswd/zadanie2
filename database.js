const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const crypto = require('node:crypto');
const dbPath = path.join(__dirname, 'workshop.db');
const db = new DatabaseSync(dbPath);
db.exec(`PRAGMA foreign_keys = ON;`);
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        phone TEXT,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('client', 'master', 'admin')),
        created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS services (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        price INTEGER NOT NULL,
        estimated_time TEXT NOT NULL,
        description TEXT,
        icon TEXT
    );
    CREATE TABLE IF NOT EXISTS parts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sku TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        stock_quantity INTEGER NOT NULL DEFAULT 0,
        min_quantity INTEGER NOT NULL DEFAULT 3,
        purchase_price INTEGER NOT NULL DEFAULT 0,
        sell_price INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY, 
        client_id INTEGER,
        client_name TEXT NOT NULL,
        client_phone TEXT NOT NULL,
        client_email TEXT NOT NULL,
        device_type TEXT NOT NULL, 
        brand_model TEXT NOT NULL, 
        serial_number TEXT,
        problem_description TEXT NOT NULL,
        photo_url TEXT,
        status TEXT NOT NULL CHECK(status IN ('received', 'diagnostics', 'in_progress', 'ready', 'completed', 'cancelled')) DEFAULT 'received',
        master_id INTEGER,
        master_name TEXT,
        diagnostic_notes TEXT,
        master_comment TEXT,
        labor_cost INTEGER NOT NULL DEFAULT 0,
        parts_cost INTEGER NOT NULL DEFAULT 0,
        total_cost INTEGER NOT NULL DEFAULT 0,
        urgency TEXT DEFAULT 'standard', 
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT,
        FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (master_id) REFERENCES users(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS order_parts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id TEXT NOT NULL,
        part_id INTEGER NOT NULL,
        part_name TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        price_per_unit INTEGER NOT NULL,
        total_price INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (part_id) REFERENCES parts(id) ON DELETE RESTRICT
    );
    CREATE TABLE IF NOT EXISTS order_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id TEXT NOT NULL,
        old_status TEXT,
        new_status TEXT NOT NULL,
        comment TEXT,
        author_name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id TEXT NOT NULL,
        recipient_email TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        channel TEXT DEFAULT 'email',
        sent_at TEXT NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );
`);
function hashPassword(password, salt = null) {
    if (!salt) {
        salt = crypto.randomBytes(16).toString('hex');
    }
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return { hash, salt };
}
function verifyPassword(password, hash, salt) {
    const computed = crypto.scryptSync(password, salt, 64).toString('hex');
    return computed === hash;
}
function seedInitialData() {
    const usersCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    if (usersCount > 0) return; 
    const now = new Date().toISOString();
    const adminPass = hashPassword('admin123');
    const master1Pass = hashPassword('master123');
    const master2Pass = hashPassword('master123');
    const clientPass = hashPassword('client123');
    const insertUser = db.prepare(`
        INSERT INTO users (name, email, phone, password_hash, salt, role, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insertUser.run('Алексей Главный (Админ)', 'admin@remont.ru', '+7 (999) 000-01-01', adminPass.hash, adminPass.salt, 'admin', now);
    insertUser.run('Михаил Инженеров (Мастер)', 'master@remont.ru', '+7 (999) 000-02-02', master1Pass.hash, master1Pass.salt, 'master', now);
    insertUser.run('Дмитрий Пайкин (Мастер BGA)', 'master2@remont.ru', '+7 (999) 000-02-03', master2Pass.hash, master2Pass.salt, 'master', now);
    insertUser.run('Екатерина Клиентова', 'client@mail.ru', '+7 (999) 111-22-33', clientPass.hash, clientPass.salt, 'client', now);
    const insertService = db.prepare(`
        INSERT INTO services (title, category, price, estimated_time, description, icon)
        VALUES (?, ?, ?, ?, ?, ?)
    `);
    const services = [
        ['Диагностика устройства', 'Диагностика', 0, '1–3 часа', 'Комплексная аппаратная и программная проверка на профессиональном оборудовании. Бесплатно при выполнении ремонта.', 'search'],
        ['Замена дисплейного модуля', 'Смартфоны', 1800, '1–2 часа', 'Установка оригинального или премиум-экрана с калибровкой TrueTone и сохранением герметичности.', 'smartphone'],
        ['Замена аккумулятора', 'Смартфоны', 1200, '40 минут', 'Установка нового оригинального АКБ с гарантией 6 месяцев и тестированием циклов зарядки.', 'battery-charging'],
        ['Восстановление после залития', 'Ноутбуки', 3500, '1–2 дня', 'Ультразвуковая чистка платы от окислов, пропайка повреждённых дорожек и компонентов питания.', 'droplet'],
        ['Замена термопасты и чистка', 'Ноутбуки', 1500, '1 час', 'Полный разбор системы охлаждения, удаление пыли, нанесение высокоэффективной термопасты с фазовым переходом.', 'fan'],
        ['Пайка BGA видеочипа / процессора', 'Компьютеры', 4500, '1–3 дня', 'Реболлинг или замена чипа на инфракрасной паяльной станции ИК-650 Pro с соблюдением термопрофиля.', 'cpu'],
        ['Замена разъема питания / Type-C', 'Планшеты', 1400, '1–3 часа', 'Демонтаж сломанного разъема, восстановление контактных площадок и распайка нового порта.', 'plug'],
        ['Восстановление цепи питания платы', 'Смартфоны', 2800, '1 день', 'Поиск короткого замыкания тепловизором, замена пробитых конденсаторов и ШИМ-контроллера.', 'zap'],
        ['Ремонт блока питания ТВ / техники', 'Бытовая техника', 2200, '1–2 дня', 'Ремонт импульсного блока питания, замена силовых ключей, конденсаторов и диодных мостов.', 'tv']
    ];
    for (const s of services) {
        insertService.run(s[0], s[1], s[2], s[3], s[4], s[5]);
    }
    const insertPart = db.prepare(`
        INSERT INTO parts (sku, name, category, stock_quantity, min_quantity, purchase_price, sell_price, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const parts = [
        ['DISP-IP13', 'Дисплей в сборе iPhone 13 / 13 Pro (OLED)', 'Дисплеи', 4, 2, 6500, 9500, now],
        ['DISP-SAMS22', 'Дисплейный модуль Samsung Galaxy S22 Dynamic AMOLED', 'Дисплеи', 2, 2, 7200, 10800, now],
        ['BATT-IP13', 'Аккумуляторная батарея iPhone 13 (3227 mAh Original)', 'Аккумуляторы', 8, 3, 1400, 2400, now],
        ['BATT-MAC13', 'Аккумулятор для MacBook Pro 13 A1708 (54.5 Wh)', 'Аккумуляторы', 3, 2, 2900, 4500, now],
        ['PORT-TYPEC', 'Разъем питания USB Type-C 16-pin угловой', 'Разъемы', 25, 10, 80, 450, now],
        ['PASTE-MX4', 'Термопаста Arctic MX-4 (шприц 4г)', 'Расходники', 12, 4, 450, 850, now],
        ['CHIP-PWM', 'ШИМ-контроллер питания ISL95855HRTZ QFN', 'Микросхемы', 5, 2, 600, 1600, now],
        ['SSD-512NVME', 'SSD накопитель Kingston NV2 512GB M.2 NVMe', 'Накопители', 6, 2, 2800, 4200, now],
        ['KB-MACPRO', 'Клавиатура для MacBook Air 13 M1 русская раскладка', 'Клавиатуры', 1, 2, 1900, 3200, now], 
        ['FAN-ASUSROG', 'Кулер системы охлаждения Asus ROG Strix G15 (GPU)', 'Вентиляторы', 2, 2, 900, 1800, now]
    ];
    for (const p of parts) {
        insertPart.run(p[0], p[1], p[2], p[3], p[4], p[5], p[6], p[7]);
    }
}
seedInitialData();
module.exports = {
    getUserByEmail: (email) => {
        return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    },
    getUserById: (id) => {
        return db.prepare('SELECT id, name, email, phone, role, created_at FROM users WHERE id = ?').get(id);
    },
    getAllUsers: () => {
        return db.prepare('SELECT id, name, email, phone, role, created_at FROM users ORDER BY role, name').all();
    },
    getMasters: () => {
        return db.prepare("SELECT id, name, email, phone FROM users WHERE role = 'master'").all();
    },
    createUser: ({ name, email, phone, password, role = 'client' }) => {
        const { hash, salt } = hashPassword(password);
        const createdAt = new Date().toISOString();
        const res = db.prepare(`
            INSERT INTO users (name, email, phone, password_hash, salt, role, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(name, email, phone || '', hash, salt, role, createdAt);
        return { id: res.lastInsertRowid, name, email, phone, role, created_at: createdAt };
    },
    updateUserRole: (id, newRole) => {
        db.prepare('UPDATE users SET role = ? WHERE id = ?').run(newRole, id);
        return db.prepare('SELECT id, name, email, phone, role FROM users WHERE id = ?').get(id);
    },
    deleteUser: (id) => {
        return db.prepare('DELETE FROM users WHERE id = ?').run(id);
    },
    verifyPassword,
    hashPassword,
    getServices: (category = null) => {
        if (category && category !== 'Все') {
            return db.prepare('SELECT * FROM services WHERE category = ? ORDER BY price ASC').all(category);
        }
        return db.prepare('SELECT * FROM services ORDER BY category, price ASC').all();
    },
    getServiceById: (id) => {
        return db.prepare('SELECT * FROM services WHERE id = ?').get(id);
    },
    addService: ({ title, category, price, estimated_time, description, icon }) => {
        const res = db.prepare(`
            INSERT INTO services (title, category, price, estimated_time, description, icon)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(title, category, price, estimated_time, description, icon || 'tool');
        return { id: res.lastInsertRowid, title, category, price, estimated_time, description, icon };
    },
    updateService: (id, { title, category, price, estimated_time, description, icon }) => {
        db.prepare(`
            UPDATE services
            SET title = ?, category = ?, price = ?, estimated_time = ?, description = ?, icon = ?
            WHERE id = ?
        `).run(title, category, price, estimated_time, description, icon, id);
        return db.prepare('SELECT * FROM services WHERE id = ?').get(id);
    },
    deleteService: (id) => {
        return db.prepare('DELETE FROM services WHERE id = ?').run(id);
    },
    getParts: () => {
        return db.prepare('SELECT * FROM parts ORDER BY name ASC').all();
    },
    getPartById: (id) => {
        return db.prepare('SELECT * FROM parts WHERE id = ?').get(id);
    },
    addPart: ({ sku, name, category, stock_quantity, min_quantity, purchase_price, sell_price }) => {
        const now = new Date().toISOString();
        const res = db.prepare(`
            INSERT INTO parts (sku, name, category, stock_quantity, min_quantity, purchase_price, sell_price, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(sku, name, category, stock_quantity || 0, min_quantity || 3, purchase_price || 0, sell_price || 0, now);
        return { id: res.lastInsertRowid, sku, name, category, stock_quantity, min_quantity, purchase_price, sell_price, updated_at: now };
    },
    updatePartStock: (id, quantityChange) => {
        const now = new Date().toISOString();
        db.prepare(`
            UPDATE parts
            SET stock_quantity = MAX(0, stock_quantity + ?), updated_at = ?
            WHERE id = ?
        `).run(quantityChange, now, id);
        return db.prepare('SELECT * FROM parts WHERE id = ?').get(id);
    },
    updatePart: (id, { sku, name, category, stock_quantity, min_quantity, purchase_price, sell_price }) => {
        const now = new Date().toISOString();
        db.prepare(`
            UPDATE parts
            SET sku = ?, name = ?, category = ?, stock_quantity = ?, min_quantity = ?, purchase_price = ?, sell_price = ?, updated_at = ?
            WHERE id = ?
        `).run(sku, name, category, stock_quantity, min_quantity, purchase_price, sell_price, now, id);
        return db.prepare('SELECT * FROM parts WHERE id = ?').get(id);
    },
    deletePart: (id) => {
        return db.prepare('DELETE FROM parts WHERE id = ?').run(id);
    },
    generateOrderId: () => {
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        return `REP-${randomNum}`;
    },
    getOrders: ({ status = null, master_id = null, client_id = null, search = null } = {}) => {
        let query = 'SELECT * FROM orders WHERE 1=1';
        const params = [];
        if (status && status !== 'all') {
            query += ' AND status = ?';
            params.push(status);
        }
        if (master_id) {
            query += ' AND master_id = ?';
            params.push(master_id);
        }
        if (client_id) {
            query += ' AND client_id = ?';
            params.push(client_id);
        }
        if (search) {
            query += ' AND (id LIKE ? OR client_name LIKE ? OR client_phone LIKE ? OR brand_model LIKE ?)';
            const term = `%${search}%`;
            params.push(term, term, term, term);
        }
        query += ' ORDER BY created_at DESC';
        return db.prepare(query).all(...params);
    },
    getOrderById: (id) => {
        const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
        if (!order) return null;
        const partsUsed = db.prepare('SELECT * FROM order_parts WHERE order_id = ?').all(id);
        const history = db.prepare('SELECT * FROM order_history WHERE order_id = ? ORDER BY created_at ASC').all(id);
        const notifications = db.prepare('SELECT * FROM notifications WHERE order_id = ? ORDER BY sent_at DESC').all(id);
        return {
            ...order,
            parts: partsUsed,
            history,
            notifications
        };
    },
    createOrder: ({ client_id, client_name, client_phone, client_email, device_type, brand_model, serial_number, problem_description, photo_url, urgency = 'standard' }) => {
        const id = module.exports.generateOrderId();
        const now = new Date().toISOString();
        db.prepare(`
            INSERT INTO orders (
                id, client_id, client_name, client_phone, client_email,
                device_type, brand_model, serial_number, problem_description, photo_url,
                status, urgency, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'received', ?, ?, ?)
        `).run(
            id, client_id || null, client_name, client_phone, client_email,
            device_type, brand_model, serial_number || '', problem_description, photo_url || null,
            urgency, now, now
        );
        db.prepare(`
            INSERT INTO order_history (order_id, old_status, new_status, comment, author_name, created_at)
            VALUES (?, NULL, 'received', 'Заявка принята в работу', ?, ?)
        `).run(id, client_name, now);
        db.prepare(`
            INSERT INTO notifications (order_id, recipient_email, title, message, channel, sent_at)
            VALUES (?, ?, ?, ?, 'email', ?)
        `).run(
            id,
            client_email,
            `Заявка ${id} успешно принята!`,
            `Здравствуйте, ${client_name}! Ваша заявка на ремонт ${brand_model} зарегистрирована. Номер для отслеживания: ${id}. Вы можете проверять статус онлайн на нашем сайте.`,
            now
        );
        return module.exports.getOrderById(id);
    },
    updateOrderStatus: (id, newStatus, authorName = 'Система', comment = '') => {
        const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
        if (!order) throw new Error('Заявка не найдена');
        const now = new Date().toISOString();
        const completedAt = (newStatus === 'completed' || newStatus === 'ready') ? now : order.completed_at;
        db.prepare(`
            UPDATE orders
            SET status = ?, updated_at = ?, completed_at = ?
            WHERE id = ?
        `).run(newStatus, now, completedAt, id);
        db.prepare(`
            INSERT INTO order_history (order_id, old_status, new_status, comment, author_name, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(id, order.status, newStatus, comment || `Смена статуса на "${newStatus}"`, authorName, now);
        const statusTitles = {
            received: 'Принята',
            diagnostics: 'В диагностике',
            in_progress: 'В ремонте',
            ready: 'Готова к выдаче',
            completed: 'Выдана',
            cancelled: 'Отменена'
        };
        const readableStatus = statusTitles[newStatus] || newStatus;
        const msg = `Статус ремонта вашего устройства ${order.brand_model} изменился на: "${readableStatus}". ${comment ? 'Комментарий: ' + comment : ''}`;
        db.prepare(`
            INSERT INTO notifications (order_id, recipient_email, title, message, channel, sent_at)
            VALUES (?, ?, ?, ?, 'email', ?)
        `).run(
            id,
            order.client_email,
            `Ремонт ${id}: статус изменён на "${readableStatus}"`,
            msg,
            now
        );
        return module.exports.getOrderById(id);
    },
    assignMaster: (id, masterId) => {
        const master = db.prepare('SELECT id, name FROM users WHERE id = ?').get(masterId);
        if (!master) throw new Error('Мастер не найден');
        const now = new Date().toISOString();
        db.prepare(`
            UPDATE orders
            SET master_id = ?, master_name = ?, updated_at = ?
            WHERE id = ?
        `).run(master.id, master.name, now, id);
        db.prepare(`
            INSERT INTO order_history (order_id, old_status, new_status, comment, author_name, created_at)
            VALUES (?, 'assigned', 'assigned', ?, 'Администратор', ?)
        `).run(id, `Назначен мастер: ${master.name}`, now);
        return module.exports.getOrderById(id);
    },
    updateMasterReport: (id, { diagnostic_notes, master_comment, labor_cost }) => {
        const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
        if (!order) throw new Error('Заявка не найдена');
        const now = new Date().toISOString();
        const newLabor = labor_cost !== undefined ? Number(labor_cost) : order.labor_cost;
        const total = newLabor + order.parts_cost;
        db.prepare(`
            UPDATE orders
            SET diagnostic_notes = COALESCE(?, diagnostic_notes),
                master_comment = COALESCE(?, master_comment),
                labor_cost = ?,
                total_cost = ?,
                updated_at = ?
            WHERE id = ?
        `).run(diagnostic_notes, master_comment, newLabor, total, now, id);
        return module.exports.getOrderById(id);
    },
    addPartToOrder: (orderId, partId, quantity = 1) => {
        const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
        if (!order) throw new Error('Заявка не найдена');
        const part = db.prepare('SELECT * FROM parts WHERE id = ?').get(partId);
        if (!part) throw new Error('Запчасть не найдена');
        if (part.stock_quantity < quantity) {
            throw new Error(`Недостаточно деталей на складе! В наличии: ${part.stock_quantity} шт.`);
        }
        const now = new Date().toISOString();
        const pricePerUnit = part.sell_price;
        const totalPrice = pricePerUnit * quantity;
        db.prepare(`
            UPDATE parts
            SET stock_quantity = stock_quantity - ?, updated_at = ?
            WHERE id = ?
        `).run(quantity, now, partId);
        db.prepare(`
            INSERT INTO order_parts (order_id, part_id, part_name, quantity, price_per_unit, total_price, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(orderId, part.id, part.name, quantity, pricePerUnit, totalPrice, now);
        const partsSum = db.prepare('SELECT SUM(total_price) as sum FROM order_parts WHERE order_id = ?').get(orderId).sum || 0;
        const newTotal = order.labor_cost + partsSum;
        db.prepare(`
            UPDATE orders
            SET parts_cost = ?, total_cost = ?, updated_at = ?
            WHERE id = ?
        `).run(partsSum, newTotal, now, orderId);
        db.prepare(`
            INSERT INTO order_history (order_id, old_status, new_status, comment, author_name, created_at)
            VALUES (?, 'part_added', 'part_added', ?, 'Мастер', ?)
        `).run(orderId, `Списана деталь со склада: ${part.name} (${quantity} шт., ${totalPrice} руб.)`, now);
        return module.exports.getOrderById(orderId);
    },
    removePartFromOrder: (orderPartId) => {
        const item = db.prepare('SELECT * FROM order_parts WHERE id = ?').get(orderPartId);
        if (!item) throw new Error('Элемент не найден');
        const now = new Date().toISOString();
        db.prepare(`
            UPDATE parts
            SET stock_quantity = stock_quantity + ?, updated_at = ?
            WHERE id = ?
        `).run(item.quantity, now, item.part_id);
        db.prepare('DELETE FROM order_parts WHERE id = ?').run(orderPartId);
        const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(item.order_id);
        const partsSum = db.prepare('SELECT SUM(total_price) as sum FROM order_parts WHERE order_id = ?').get(item.order_id).sum || 0;
        const newTotal = order.labor_cost + partsSum;
        db.prepare(`
            UPDATE orders
            SET parts_cost = ?, total_cost = ?, updated_at = ?
            WHERE id = ?
        `).run(partsSum, newTotal, now, item.order_id);
        return module.exports.getOrderById(item.order_id);
    },
    deleteOrder: (id) => {
        return db.prepare('DELETE FROM orders WHERE id = ?').run(id);
    },
    getAnalytics: () => {
        const totalOrders = db.prepare('SELECT COUNT(*) as c FROM orders').get().c;
        const inWorkOrders = db.prepare("SELECT COUNT(*) as c FROM orders WHERE status IN ('received', 'diagnostics', 'in_progress')").get().c;
        const readyOrders = db.prepare("SELECT COUNT(*) as c FROM orders WHERE status = 'ready'").get().c;
        const completedOrders = db.prepare("SELECT COUNT(*) as c FROM orders WHERE status = 'completed'").get().c;
        const totalRevenue = db.prepare("SELECT SUM(total_cost) as s FROM orders WHERE status IN ('ready', 'completed')").get().s || 0;
        const lowStockCount = db.prepare('SELECT COUNT(*) as c FROM parts WHERE stock_quantity <= min_quantity').get().c;
        const deviceStats = db.prepare(`
            SELECT device_type, COUNT(*) as count
            FROM orders
            GROUP BY device_type
            ORDER BY count DESC
        `).all();
        const masterStats = db.prepare(`
            SELECT COALESCE(master_name, 'Не назначен') as master, COUNT(*) as count,
                   SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_count
            FROM orders
            GROUP BY master_name
            ORDER BY count DESC
        `).all();
        const statusStats = db.prepare(`
            SELECT status, COUNT(*) as count
            FROM orders
            GROUP BY status
        `).all();
        const recentNotifications = db.prepare(`
            SELECT * FROM notifications ORDER BY sent_at DESC LIMIT 10
        `).all();
        return {
            kpi: {
                totalOrders,
                inWorkOrders,
                readyOrders,
                completedOrders,
                totalRevenue,
                lowStockCount
            },
            deviceStats,
            masterStats,
            statusStats,
            recentNotifications
        };
    }
};
