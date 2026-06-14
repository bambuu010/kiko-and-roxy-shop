const money = new Intl.NumberFormat('mn-MN', {
  style: 'currency',
  currency: 'MNT',
  maximumFractionDigits: 0
});

let products = [];
let cart = [];
let activeCategory = 'All';
let searchTerm = '';
let customerToken = localStorage.getItem('krCustomerToken') || '';
let currentCustomer = null;

const api = {
  async request(path, options = {}, authenticated = false) {
    const headers = {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(authenticated && customerToken ? { Authorization: `Bearer ${customerToken}` } : {})
    };
    const response = await fetch(path, { ...options, headers });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Хүсэлт амжилтгүй боллоо.');
    return data;
  }
};

function formatMoney(value) {
  return money.format(Number(value || 0));
}

function escapeText(value) {
  return String(value || '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[char]));
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('visible'), 3600);
}

async function loadShop() {
  try {
    const data = await api.request('/api/products');
    products = data.products || [];
    renderCategories();
    renderProducts();
    renderCart();
  } catch (error) {
    showToast('Бараа ачаалж чадсангүй. Серверээ асаагаад дахин оролдоно уу.');
  }
}

async function loadCurrentCustomer() {
  if (!customerToken) {
    renderAccount();
    return;
  }

  try {
    const data = await api.request('/api/auth/me', {}, true);
    currentCustomer = data.user;
    fillCustomerFields();
  } catch (error) {
    customerToken = '';
    currentCustomer = null;
    localStorage.removeItem('krCustomerToken');
  }

  renderAccount();
}

function categoryLabel(category) {
  return category === 'All' ? 'Бүгд' : category;
}

function renderCategories() {
  const categories = ['All', ...new Set(products.map(product => product.category).filter(Boolean))];
  document.getElementById('categoryFilters').innerHTML = categories.map(category => `
    <button class="${category === activeCategory ? 'active' : ''}" type="button" onclick="setCategory('${escapeText(category)}')">${escapeText(categoryLabel(category))}</button>
  `).join('');
}

function setCategory(category) {
  activeCategory = category || 'All';
  renderCategories();
  renderProducts();
}

function renderProducts() {
  const query = searchTerm.trim().toLowerCase();
  const visible = products.filter(product => {
    const categoryMatch = activeCategory === 'All' || product.category === activeCategory;
    const searchable = `${product.name} ${product.description} ${product.category}`.toLowerCase();
    return categoryMatch && (!query || searchable.includes(query));
  });

  document.getElementById('productGrid').innerHTML = visible.length ? visible.map(product => `
    <article class="product-card">
      <span class="origin-badge">Korea import</span>
      <div class="product-art">${product.image ? `<img src="${escapeText(product.image)}" alt="${escapeText(product.name)}">` : escapeText(product.badge || 'PET')}</div>
      <div class="product-body">
        <p class="category">${escapeText(product.category)}</p>
        <h3>${escapeText(product.name)}</h3>
        <p>${escapeText(product.description)}</p>
        <p>Үлдэгдэл: ${escapeText(product.stock)}</p>
        <div class="price-row">
          <strong>${formatMoney(product.price)}</strong>
          <button class="secondary" type="button" onclick="addToCart('${escapeText(product.id)}')">Сагслах</button>
        </div>
      </div>
    </article>
  `).join('') : '<p class="empty-state">Ийм бараа олдсонгүй.</p>';
}

function addToCart(id) {
  const found = cart.find(item => item.id === id);
  if (found) {
    found.quantity += 1;
  } else {
    cart.push({ id, quantity: 1 });
  }
  renderCart();
  document.getElementById('cart').classList.add('open');
}

function changeQty(id, change) {
  const found = cart.find(item => item.id === id);
  if (!found) return;
  found.quantity += change;
  if (found.quantity <= 0) cart = cart.filter(item => item.id !== id);
  renderCart();
}

function cartLines() {
  return cart.map(item => ({
    ...item,
    product: products.find(product => product.id === item.id)
  })).filter(item => item.product);
}

function renderCart() {
  const lines = cartLines();
  const total = lines.reduce((sum, item) => sum + Number(item.product.price) * item.quantity, 0);
  document.getElementById('cartCount').textContent = lines.reduce((sum, item) => sum + item.quantity, 0);
  document.getElementById('cartTotal').textContent = formatMoney(total);
  document.getElementById('cartItems').innerHTML = lines.length ? lines.map(item => `
    <div class="cart-item">
      <div>
        <strong>${escapeText(item.product.name)}</strong>
        <p>${formatMoney(item.product.price)} x ${item.quantity}</p>
      </div>
      <div>
        <button type="button" onclick="changeQty('${escapeText(item.id)}', -1)">-</button>
        <button type="button" onclick="changeQty('${escapeText(item.id)}', 1)">+</button>
      </div>
    </div>
  `).join('') : '<p>Таны сагс хоосон байна.</p>';
}

function toggleCart() {
  document.getElementById('cart').classList.toggle('open');
}

function toggleAccount() {
  document.getElementById('accountPanel').classList.toggle('open');
}

function showLogin() {
  document.getElementById('accountTitle').textContent = 'Нэвтрэх';
  document.getElementById('loginForm').classList.remove('hidden');
  document.getElementById('signupForm').classList.add('hidden');
  document.getElementById('accountSummary').classList.toggle('hidden', !currentCustomer);
}

function showSignup() {
  document.getElementById('accountTitle').textContent = 'Бүртгүүлэх';
  document.getElementById('loginForm').classList.add('hidden');
  document.getElementById('signupForm').classList.remove('hidden');
  document.getElementById('accountSummary').classList.add('hidden');
}

function renderAccount() {
  const button = document.querySelector('.account-pill');
  const summary = document.getElementById('accountSummary');
  const greeting = document.getElementById('accountGreeting');

  if (currentCustomer) {
    button.textContent = currentCustomer.name;
    greeting.textContent = `${currentCustomer.name} (${currentCustomer.email}) хэрэглэгчээр нэвтэрсэн байна.`;
    summary.classList.remove('hidden');
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('signupForm').classList.add('hidden');
    document.getElementById('accountTitle').textContent = 'Миний бүртгэл';
    return;
  }

  button.textContent = 'Нэвтрэх';
  summary.classList.add('hidden');
  showLogin();
}

function fillCustomerFields() {
  if (!currentCustomer) return;
  document.getElementById('customerName').value = currentCustomer.name || '';
  document.getElementById('customerPhone').value = currentCustomer.phone || '';
  document.getElementById('customerEmail').value = currentCustomer.email || '';
  document.getElementById('customerAddress').value = currentCustomer.address || '';
}

async function loginCustomer(event) {
  event.preventDefault();
  try {
    const data = await api.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: document.getElementById('loginEmail').value.trim(),
        password: document.getElementById('loginPassword').value
      })
    });
    customerToken = data.token;
    currentCustomer = data.user;
    localStorage.setItem('krCustomerToken', customerToken);
    fillCustomerFields();
    renderAccount();
    loadMyOrders();
    showToast('Амжилттай нэвтэрлээ.');
  } catch (error) {
    showToast(error.message);
  }
}

async function signupCustomer(event) {
  event.preventDefault();
  try {
    const data = await api.request('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        name: document.getElementById('signupName').value.trim(),
        email: document.getElementById('signupEmail').value.trim(),
        phone: document.getElementById('signupPhone').value.trim(),
        address: document.getElementById('signupAddress').value.trim(),
        password: document.getElementById('signupPassword').value
      })
    });
    customerToken = data.token;
    currentCustomer = data.user;
    localStorage.setItem('krCustomerToken', customerToken);
    document.getElementById('signupForm').reset();
    fillCustomerFields();
    renderAccount();
    loadMyOrders();
    showToast('Бүртгэл амжилттай үүслээ.');
  } catch (error) {
    showToast(error.message);
  }
}

function logoutCustomer() {
  customerToken = '';
  currentCustomer = null;
  localStorage.removeItem('krCustomerToken');
  document.getElementById('myOrdersPanel').classList.add('hidden');
  document.getElementById('myOrdersList').innerHTML = '';
  renderAccount();
  showToast('Системээс гарлаа.');
}

async function loadMyOrders() {
  if (!customerToken) {
    showToast('Захиалгаа харахын тулд нэвтэрнэ үү.');
    return;
  }

  try {
    const data = await api.request('/api/my/orders', {}, true);
    renderMyOrders(data.orders || []);
  } catch (error) {
    showToast(error.message);
  }
}

function renderMyOrders(orders) {
  const panel = document.getElementById('myOrdersPanel');
  const list = document.getElementById('myOrdersList');
  panel.classList.remove('hidden');

  list.innerHTML = orders.length ? orders.map(order => `
    <article class="my-order">
      <strong>${escapeText(order.id)} - ${escapeText(order.status)}</strong>
      <p>${new Date(order.createdAt).toLocaleString()}</p>
      <p>Төлбөр: ${escapeText(order.paymentMethod || 'Банкны шилжүүлэг')} - ${escapeText(order.paymentStatus)}</p>
      <p>Хүргэлт: ${escapeText(order.deliveryMethod)}</p>
      <p>${order.items.map(item => `${escapeText(item.name)} x ${item.quantity}`).join(', ')}</p>
      <strong>${formatMoney(order.total)}</strong>
    </article>
  `).join('') : '<p>Одоогоор захиалга алга.</p>';
}

async function submitOrder(event) {
  event.preventDefault();
  const lines = cartLines();
  if (!lines.length) {
    showToast('Таны сагс хоосон байна.');
    return;
  }

  const payload = {
    deliveryMethod: document.getElementById('deliveryMethod').value,
    paymentMethod: document.getElementById('paymentMethod').value,
    customer: {
      name: document.getElementById('customerName').value.trim(),
      phone: document.getElementById('customerPhone').value.trim(),
      email: document.getElementById('customerEmail').value.trim(),
      address: document.getElementById('customerAddress').value.trim(),
      notes: document.getElementById('customerNotes').value.trim()
    },
    items: lines.map(item => ({ id: item.id, quantity: item.quantity }))
  };

  try {
    const data = await api.request('/api/orders', {
      method: 'POST',
      body: JSON.stringify(payload)
    }, Boolean(customerToken));
    cart = [];
    renderCart();
    document.getElementById('orderForm').reset();
    fillCustomerFields();
    if (customerToken) loadMyOrders();
    document.getElementById('cart').classList.remove('open');
    showToast(`Захиалга ${data.order.id} илгээгдлээ. Бид төлбөр болон хүргэлтийг баталгаажуулахаар холбогдоно.`);
  } catch (error) {
    showToast(error.message);
  }
}

function setupSearch() {
  const input = document.getElementById('searchInput');
  const button = document.getElementById('searchButton');
  if (!input) return;

  input.addEventListener('input', () => {
    searchTerm = input.value;
    renderProducts();
  });

  button?.addEventListener('click', () => {
    searchTerm = input.value;
    renderProducts();
    document.getElementById('shop').scrollIntoView({ behavior: 'smooth' });
  });
}

document.getElementById('orderForm').addEventListener('submit', submitOrder);
document.getElementById('loginForm').addEventListener('submit', loginCustomer);
document.getElementById('signupForm').addEventListener('submit', signupCustomer);

setupSearch();
loadShop();
loadCurrentCustomer();
renderCart();
