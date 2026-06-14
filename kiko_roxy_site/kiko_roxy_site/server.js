const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 8000);
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const DB_PATH = path.join(DATA_DIR, 'store.json');
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || crypto.randomBytes(24).toString('hex');
const customerSessions = new Map();

const defaultProducts = [
  {
    id: 'kr-food-1',
    name: 'Гөлөгний премиум хоол',
    category: 'Амьтны хоол',
    price: 42000,
    stock: 24,
    description: 'Өсөж буй нохойд зориулсан тахиа, будаа, ногоотой өдөр тутмын тэнцвэртэй хоол.',
    image: '',
    badge: 'Dog'
  },
  {
    id: 'kr-food-2',
    name: 'Муурны яргай загасны хоол',
    category: 'Амьтны хоол',
    price: 39000,
    stock: 18,
    description: 'Муурт зориулсан зөөлөн найрлагатай, үнэр сайтай яргай загасны хоол.',
    image: '',
    badge: 'Cat'
  },
  {
    id: 'kr-treat-1',
    name: 'Шүд арчилгааны зажилдаг амттан',
    category: 'Амттан',
    price: 18000,
    stock: 40,
    description: 'Сайн занг урамшуулах, шүдний арчилгаанд туслах шаржигнуур амттан.',
    image: '',
    badge: 'Snack'
  },
  {
    id: 'kr-toy-1',
    name: 'Өдөн саваа тоглоом',
    category: 'Тоглоом',
    price: 15000,
    stock: 30,
    description: 'Идэвхтэй мууранд зориулсан хөнгөн, хөгжилтэй өдөн саваа тоглоом.',
    image: '',
    badge: 'Toy'
  }
];

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml'
};

function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
  if (!fs.existsSync(DB_PATH)) {
    writeDb({
      products: defaultProducts,
      orders: [],
      users: [],
      settings: {
        storeName: 'Kiko and Roxy',
        currency: 'MNT',
        country: 'Mongolia',
        contactEmail: 'admin',
        contactPhone: 'admin'
      }
    });
  }
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  const check = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(check, 'hex'));
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone || '',
    address: user.address || ''
  };
}

function getCustomer(req, db) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const userId = customerSessions.get(token);
  if (!userId) return null;
  return db.users.find(user => user.id === userId) || null;
}

function readDb() {
  ensureDb();
  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  if (!Array.isArray(db.products)) db.products = defaultProducts;
  if (!Array.isArray(db.orders)) db.orders = [];
  if (!Array.isArray(db.users)) db.users = [];
  if (!db.settings) {
    db.settings = {
      storeName: 'Kiko and Roxy',
      currency: 'MNT',
      country: 'Mongolia',
      contactEmail: 'admin',
      contactPhone: 'admin'
    };
  }
  writeDb(db);
  return db;
}

function writeDb(db) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 12_000_000) reject(new Error('Request is too large'));
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(new Error('Invalid JSON'));
      }
    });
  });
}

function isAdmin(req) {
  return req.headers.authorization === `Bearer ${ADMIN_TOKEN}`;
}

function cleanProduct(body, existing = {}) {
  return {
    id: existing.id || `product-${Date.now()}`,
    name: String(body.name || existing.name || '').trim(),
    category: String(body.category || existing.category || 'Pet Shop').trim(),
    price: Number(body.price ?? existing.price ?? 0),
    stock: Number(body.stock ?? existing.stock ?? 0),
    description: String(body.description || existing.description || '').trim(),
    image: body.image ?? existing.image ?? '',
    badge: String(body.badge || existing.badge || 'Pet').trim()
  };
}

function makeOrder(db, body) {
  const requestedItems = Array.isArray(body.items) ? body.items : [];
  const items = requestedItems.map(item => {
    const product = db.products.find(candidate => candidate.id === item.id);
    if (!product) return null;
    const quantity = Math.max(1, Number(item.quantity || 1));
    return {
      id: product.id,
      name: product.name,
      category: product.category,
      price: Number(product.price),
      quantity,
      subtotal: Number(product.price) * quantity
    };
  }).filter(Boolean);

  return {
    id: `KR-${Date.now().toString().slice(-8)}`,
    createdAt: new Date().toISOString(),
    status: 'New',
    paymentMethod: body.paymentMethod || 'Bank transfer',
    paymentStatus: body.paymentMethod === 'Bank transfer' || body.paymentMethod === 'QPay'
      ? 'Waiting for payment confirmation'
      : 'No payment - contact customer',
    deliveryMethod: body.deliveryMethod || 'Shipping',
    customer: {
      name: String(body.customer?.name || '').trim(),
      phone: String(body.customer?.phone || '').trim(),
      email: String(body.customer?.email || '').trim(),
      address: String(body.customer?.address || '').trim(),
      notes: String(body.customer?.notes || '').trim()
    },
    items,
    total: items.reduce((sum, item) => sum + item.subtotal, 0)
  };
}

async function handleApi(req, res, pathname) {
  try {
    if (req.method === 'GET' && pathname === '/api/products') {
      const db = readDb();
      return sendJson(res, 200, { products: db.products, settings: db.settings });
    }

    if (req.method === 'POST' && pathname === '/api/orders') {
      const db = readDb();
      const body = await readBody(req);
      const user = getCustomer(req, db);
      if (user) {
        body.customer = {
          name: body.customer?.name || user.name,
          phone: body.customer?.phone || user.phone,
          email: body.customer?.email || user.email,
          address: body.customer?.address || user.address,
          notes: body.customer?.notes || ''
        };
      }
      const order = makeOrder(db, body);
      if (user) order.userId = user.id;
      if (!order.items.length) return sendJson(res, 400, { error: 'Сагс хоосон байна.' });
      if (!order.customer.name || !order.customer.phone || !order.customer.email) {
        return sendJson(res, 400, { error: 'Нэр, утас, имэйл шаардлагатай.' });
      }
      db.orders.unshift(order);
      writeDb(db);
      console.log(`New order ${order.id}: ${order.total} MNT. Contact ${order.customer.phone} / ${order.customer.email}`);
      return sendJson(res, 201, { order });
    }

    if (req.method === 'POST' && pathname === '/api/auth/signup') {
      const db = readDb();
      const body = await readBody(req);
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      const user = {
        id: `user-${Date.now()}`,
        name: String(body.name || '').trim(),
        email,
        phone: String(body.phone || '').trim(),
        address: String(body.address || '').trim(),
        passwordHash: hashPassword(password),
        createdAt: new Date().toISOString()
      };

      if (!user.name || !user.email || !password) {
        return sendJson(res, 400, { error: 'Нэр, имэйл, нууц үг шаардлагатай.' });
      }
      if (db.users.some(existing => existing.email === email)) {
        return sendJson(res, 409, { error: 'Энэ имэйлээр бүртгэл аль хэдийн байна.' });
      }

      db.users.push(user);
      writeDb(db);
      const token = crypto.randomBytes(24).toString('hex');
      customerSessions.set(token, user.id);
      return sendJson(res, 201, { token, user: publicUser(user) });
    }

    if (req.method === 'POST' && pathname === '/api/auth/login') {
      const db = readDb();
      const body = await readBody(req);
      const email = String(body.email || '').trim().toLowerCase();
      const user = db.users.find(existing => existing.email === email);
      if (!user || !verifyPassword(body.password || '', user.passwordHash)) {
        return sendJson(res, 401, { error: 'Имэйл эсвэл нууц үг буруу байна.' });
      }
      const token = crypto.randomBytes(24).toString('hex');
      customerSessions.set(token, user.id);
      return sendJson(res, 200, { token, user: publicUser(user) });
    }

    if (req.method === 'GET' && pathname === '/api/auth/me') {
      const db = readDb();
      const user = getCustomer(req, db);
      if (!user) return sendJson(res, 401, { error: 'Нэвтрэх шаардлагатай.' });
      return sendJson(res, 200, { user: publicUser(user) });
    }

    if (req.method === 'GET' && pathname === '/api/my/orders') {
      const db = readDb();
      const user = getCustomer(req, db);
      if (!user) return sendJson(res, 401, { error: 'Нэвтрэх шаардлагатай.' });
      const orders = db.orders.filter(order => order.userId === user.id);
      return sendJson(res, 200, { orders });
    }

    if (req.method === 'POST' && pathname === '/api/admin/login') {
      const body = await readBody(req);
      if (body.username !== ADMIN_USER || body.password !== ADMIN_PASSWORD) {
        return sendJson(res, 401, { error: 'Нэвтрэх нэр эсвэл нууц үг буруу байна.' });
      }
      return sendJson(res, 200, { token: ADMIN_TOKEN });
    }

    if (pathname.startsWith('/api/admin/') && !isAdmin(req)) {
      return sendJson(res, 401, { error: 'Эзэмшигчээр нэвтрэх шаардлагатай.' });
    }

    if (req.method === 'GET' && pathname === '/api/admin/dashboard') {
      const db = readDb();
      return sendJson(res, 200, db);
    }

    if (req.method === 'POST' && pathname === '/api/admin/products') {
      const db = readDb();
      const product = cleanProduct(await readBody(req));
      if (!product.name || !product.price || !product.description) {
        return sendJson(res, 400, { error: 'Нэр, үнэ, тайлбар шаардлагатай.' });
      }
      db.products.unshift(product);
      writeDb(db);
      return sendJson(res, 201, { product });
    }

    if (req.method === 'PUT' && pathname.startsWith('/api/admin/products/')) {
      const db = readDb();
      const id = pathname.split('/').pop();
      const index = db.products.findIndex(product => product.id === id);
      if (index === -1) return sendJson(res, 404, { error: 'Бараа олдсонгүй.' });
      db.products[index] = cleanProduct(await readBody(req), db.products[index]);
      writeDb(db);
      return sendJson(res, 200, { product: db.products[index] });
    }

    if (req.method === 'DELETE' && pathname.startsWith('/api/admin/products/')) {
      const db = readDb();
      const id = pathname.split('/').pop();
      db.products = db.products.filter(product => product.id !== id);
      writeDb(db);
      return sendJson(res, 200, { products: db.products });
    }

    if (req.method === 'PATCH' && pathname.startsWith('/api/admin/orders/')) {
      const db = readDb();
      const id = pathname.split('/').pop();
      const body = await readBody(req);
      const order = db.orders.find(item => item.id === id);
      if (!order) return sendJson(res, 404, { error: 'Захиалга олдсонгүй.' });
      order.status = body.status || order.status;
      writeDb(db);
      return sendJson(res, 200, { order });
    }

    if (req.method === 'DELETE' && pathname.startsWith('/api/admin/orders/')) {
      const db = readDb();
      const id = pathname.split('/').pop();
      const before = db.orders.length;
      db.orders = db.orders.filter(order => order.id !== id);
      if (db.orders.length === before) return sendJson(res, 404, { error: 'Захиалга олдсонгүй.' });
      writeDb(db);
      return sendJson(res, 200, { orders: db.orders });
    }

    return sendJson(res, 404, { error: 'API зам олдсонгүй.' });
  } catch (error) {
    return sendJson(res, 500, { error: error.message || 'Серверийн алдаа.' });
  }
}

function serveStatic(req, res, pathname) {
  const requestPath = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.resolve(PUBLIC_DIR, `.${decodeURIComponent(requestPath)}`);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': mime[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname.startsWith('/api/')) {
    handleApi(req, res, url.pathname);
    return;
  }
  serveStatic(req, res, url.pathname);
});

ensureDb();
server.listen(PORT, () => {
  console.log(`Kiko and Roxy is ready at http://127.0.0.1:${PORT}`);
  console.log(`Admin login: ${ADMIN_USER} / ${ADMIN_PASSWORD}`);
});
