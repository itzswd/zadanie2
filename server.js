const express = require('express');
const path = require('node:path');
const db = require('./database.js');
const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.post('/api/auth/register', (req, res) => {
    try {
        const { name, email, phone, password, role } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Пожалуйста, заполните имя, email и пароль.' });
        }
        const existing = db.getUserByEmail(email.toLowerCase().trim());
        if (existing) {
            return res.status(400).json({ error: 'Пользователь с таким email уже зарегистрирован.' });
        }
        const assignedRole = role === 'admin' ? 'client' : (role || 'client');
        const user = db.createUser({
            name: name.trim(),
            email: email.toLowerCase().trim(),
            phone: phone ? phone.trim() : '',
            password,
            role: assignedRole
        });
        res.status(201).json({
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: user.role
        });
    } catch (err) {
        res.status(500).json({ error: 'Ошибка регистрации: ' + err.message });
    }
});
app.post('/api/auth/login', (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Введите email и пароль.' });
        }
        const user = db.getUserByEmail(email.toLowerCase().trim());
        if (!user) {
            return res.status(401).json({ error: 'Неверный email или пароль.' });
        }
        const isValid = db.verifyPassword(password, user.password_hash, user.salt);
        if (!isValid) {
            return res.status(401).json({ error: 'Неверный email или пароль.' });
        }
        res.json({
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: user.role
        });
    } catch (err) {
        res.status(500).json({ error: 'Ошибка авторизации: ' + err.message });
    }
});
app.get('/api/users', (req, res) => {
    try {
        const users = db.getAllUsers();
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.post('/api/users', (req, res) => {
    try {
        const { name, email, phone, password, role } = req.body;
        if (!name || !email || !password || !role) {
            return res.status(400).json({ error: 'Все поля обязательны.' });
        }
        const existing = db.getUserByEmail(email.toLowerCase().trim());
        if (existing) {
            return res.status(400).json({ error: 'Пользователь с таким email уже существует.' });
        }
        const user = db.createUser({
            name: name.trim(),
            email: email.toLowerCase().trim(),
            phone: phone ? phone.trim() : '',
            password,
            role
        });
        res.status(201).json(user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.patch('/api/users/:id/role', (req, res) => {
    try {
        const { role } = req.body;
        if (!['client', 'master', 'admin'].includes(role)) {
            return res.status(400).json({ error: 'Некорректная роль.' });
        }
        const updated = db.updateUserRole(req.params.id, role);
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.delete('/api/users/:id', (req, res) => {
    try {
        db.deleteUser(req.params.id);
        res.json({ success: true, message: 'Пользователь удален' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.get('/api/masters', (req, res) => {
    try {
        const masters = db.getMasters();
        res.json(masters);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.get('/api/services', (req, res) => {
    try {
        const category = req.query.category || null;
        const services = db.getServices(category);
        res.json(services);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.post('/api/services', (req, res) => {
    try {
        const { title, category, price, estimated_time, description, icon } = req.body;
        if (!title || price === undefined) {
            return res.status(400).json({ error: 'Укажите название и цену услуги.' });
        }
        const newService = db.addService({
            title,
            category: category || 'Общие услуги',
            price: Number(price),
            estimated_time: estimated_time || '1–2 часа',
            description: description || '',
            icon: icon || 'tool'
        });
        res.status(201).json(newService);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.put('/api/services/:id', (req, res) => {
    try {
        const { title, category, price, estimated_time, description, icon } = req.body;
        const updated = db.updateService(req.params.id, {
            title,
            category,
            price: Number(price),
            estimated_time,
            description,
            icon
        });
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.delete('/api/services/:id', (req, res) => {
    try {
        db.deleteService(req.params.id);
        res.json({ success: true, message: 'Услуга удалена' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.get('/api/parts', (req, res) => {
    try {
        const parts = db.getParts();
        res.json(parts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.post('/api/parts', (req, res) => {
    try {
        const { sku, name, category, stock_quantity, min_quantity, purchase_price, sell_price } = req.body;
        if (!sku || !name) {
            return res.status(400).json({ error: 'Артикул и наименование обязательны.' });
        }
        const newPart = db.addPart({
            sku,
            name,
            category: category || 'Общее',
            stock_quantity: Number(stock_quantity) || 0,
            min_quantity: Number(min_quantity) || 3,
            purchase_price: Number(purchase_price) || 0,
            sell_price: Number(sell_price) || 0
        });
        res.status(201).json(newPart);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.put('/api/parts/:id', (req, res) => {
    try {
        const { sku, name, category, stock_quantity, min_quantity, purchase_price, sell_price } = req.body;
        const updated = db.updatePart(req.params.id, {
            sku,
            name,
            category,
            stock_quantity: Number(stock_quantity),
            min_quantity: Number(min_quantity),
            purchase_price: Number(purchase_price),
            sell_price: Number(sell_price)
        });
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.patch('/api/parts/:id/stock', (req, res) => {
    try {
        const { delta } = req.body;
        if (delta === undefined) {
            return res.status(400).json({ error: 'Укажите delta.' });
        }
        const updated = db.updatePartStock(req.params.id, Number(delta));
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.delete('/api/parts/:id', (req, res) => {
    try {
        db.deletePart(req.params.id);
        res.json({ success: true, message: 'Запчасть удалена со склада' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.get('/api/orders', (req, res) => {
    try {
        const { status, master_id, client_id, search } = req.query;
        const orders = db.getOrders({ status, master_id, client_id, search });
        res.json(orders);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.get('/api/orders/:id', (req, res) => {
    try {
        const order = db.getOrderById(req.params.id);
        if (!order) {
            return res.status(404).json({ error: 'Заявка с таким номером не найдена.' });
        }
        res.json(order);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.post('/api/orders', (req, res) => {
    try {
        const {
            client_id,
            client_name,
            client_phone,
            client_email,
            device_type,
            brand_model,
            serial_number,
            problem_description,
            photo_url,
            urgency
        } = req.body;
        if (!client_name || !client_phone || !device_type || !brand_model || !problem_description) {
            return res.status(400).json({ error: 'Пожалуйста, заполните все обязательные поля заявки.' });
        }
        const newOrder = db.createOrder({
            client_id,
            client_name,
            client_phone,
            client_email: client_email || 'client@example.com',
            device_type,
            brand_model,
            serial_number,
            problem_description,
            photo_url,
            urgency
        });
        res.status(201).json(newOrder);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.patch('/api/orders/:id/status', (req, res) => {
    try {
        const { status, author_name, comment } = req.body;
        if (!status) {
            return res.status(400).json({ error: 'Укажите новый статус.' });
        }
        const updated = db.updateOrderStatus(req.params.id, status, author_name, comment);
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.patch('/api/orders/:id/assign', (req, res) => {
    try {
        const { master_id } = req.body;
        if (!master_id) {
            return res.status(400).json({ error: 'Укажите ID мастера.' });
        }
        const updated = db.assignMaster(req.params.id, master_id);
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.patch('/api/orders/:id/report', (req, res) => {
    try {
        const { diagnostic_notes, master_comment, labor_cost } = req.body;
        const updated = db.updateMasterReport(req.params.id, {
            diagnostic_notes,
            master_comment,
            labor_cost
        });
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.post('/api/orders/:id/parts', (req, res) => {
    try {
        const { part_id, quantity } = req.body;
        if (!part_id) {
            return res.status(400).json({ error: 'Выберите деталь.' });
        }
        const updated = db.addPartToOrder(req.params.id, Number(part_id), Number(quantity) || 1);
        res.json(updated);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});
app.delete('/api/orders/:id/parts/:orderPartId', (req, res) => {
    try {
        const updated = db.removePartFromOrder(req.params.orderPartId);
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.delete('/api/orders/:id', (req, res) => {
    try {
        db.deleteOrder(req.params.id);
        res.json({ success: true, message: 'Заявка удалена' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.get('/api/analytics', (req, res) => {
    try {
        const data = db.getAnalytics();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.all('/api/*', (req, res) => {
    res.status(404).json({ error: 'API эндпоинт не найден' });
});
const PORT = process.env.PORT || 3000;
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Сервер «Ремонтная мастерская» запущен на http://localhost:${PORT}`);
    });
}
module.exports = app;
