const money = new Intl.NumberFormat('mn-MN', {
  style: 'currency',
  currency: 'MNT',
  maximumFractionDigits: 0
});

const trackingSteps = ['Захиалсан', 'Баталгаажсан', 'Тээвэрлэгдсэн', 'Дууссан'];
const statusMap = {
  New: 'Захиалсан',
  Confirmed: 'Баталгаажсан',
  Shipped: 'Тээвэрлэгдсэн',
  Completed: 'Дууссан',
  Ready: 'Тээвэрлэгдсэн'
};

let adminToken = sessionStorage.getItem('krManageToken') || sessionStorage.getItem('krOrdersToken') || '';
let products = [];
let orders = [];
const defaultCategories = ['Амьтны хоол', 'Амттан', 'Тоглоом', 'Хэрэгсэл', 'Арчилгаа', 'Хувцас', 'Эрүүл мэнд', 'Бусад'];

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
  showToast.timer = setTimeout(() => toast.classList.remove('visible'), 3200);
}

async function request(path, options = {}, admin = false) {
  const headers = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(admin && adminToken ? { Authorization: `Bearer ${adminToken}` } : {})
  };
  const response = await fetch(path, { ...options, headers });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Хүсэлт амжилтгүй боллоо.');
  return data;
}

async function login(event) {
  event.preventDefault();
  try {
    const data = await request('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({
        username: document.getElementById('manageUsername').value.trim(),
        password: document.getElementById('managePassword').value
      })
    });
    adminToken = data.token;
    sessionStorage.setItem('krManageToken', adminToken);
    sessionStorage.setItem('krOrdersToken', adminToken);
    document.getElementById('manageLoginError').textContent = '';
    showDashboard();
  } catch (error) {
    document.getElementById('manageLoginError').textContent = 'Нэвтрэх нэр эсвэл нууц үг буруу байна.';
  }
}

async function showDashboard() {
  document.getElementById('manageLogin').classList.add('hidden');
  document.getElementById('manageDashboard').classList.remove('hidden');
  document.getElementById('logoutButton').classList.remove('hidden');
  await loadDashboard();
}

function logout() {
  adminToken = '';
  sessionStorage.removeItem('krManageToken');
  sessionStorage.removeItem('krOrdersToken');
  document.getElementById('manageDashboard').classList.add('hidden');
  document.getElementById('manageLogin').classList.remove('hidden');
  document.getElementById('logoutButton').classList.add('hidden');
  document.getElementById('managePassword').value = '';
  document.getElementById('managePassword').focus();
}

async function loadDashboard() {
  try {
    const data = await request('/api/admin/dashboard', {}, true);
    products = data.products || [];
    orders = data.orders || [];
    renderCategorySelect();
    renderStats();
    renderProducts();
    renderOrders();
  } catch (error) {
    logout();
    showToast('Дахин нэвтэрнэ үү.');
  }
}

function renderCategorySelect() {
  const select = document.getElementById('productCategory');
  const selected = select.value;
  const categories = [...new Set([
    ...defaultCategories,
    ...products.map(product => product.category).filter(Boolean)
  ])];

  select.innerHTML = `
    <option value="">Ангилал сонгох</option>
    ${categories.map(category => `<option value="${escapeText(category)}">${escapeText(category)}</option>`).join('')}
  `;

  if (selected && categories.includes(selected)) {
    select.value = selected;
  }
}

function ensureCategoryOption(category) {
  const select = document.getElementById('productCategory');
  if (!category) return;
  const exists = [...select.options].some(option => option.value === category);
  if (!exists) {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    select.appendChild(option);
  }
}

function renderStats() {
  const revenue = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  document.getElementById('manageRevenue').textContent = formatMoney(revenue);
  document.getElementById('manageOrderCount').textContent = orders.length;
  document.getElementById('manageProductCount').textContent = products.length;
}

function productPayload() {
  return {
    name: document.getElementById('productName').value.trim(),
    category: document.getElementById('productCategory').value.trim(),
    price: Number(document.getElementById('productPrice').value || 0),
    stock: Number(document.getElementById('productStock').value || 0),
    badge: document.getElementById('productBadge').value.trim() || 'PET',
    image: document.getElementById('productImage').value.trim(),
    description: document.getElementById('productDescription').value.trim()
  };
}

async function saveProduct(event) {
  event.preventDefault();
  const id = document.getElementById('productId').value;
  const payload = productPayload();

  try {
    if (id) {
      await request(`/api/admin/products/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      }, true);
      showToast('Бараа шинэчлэгдлээ.');
    } else {
      await request('/api/admin/products', {
        method: 'POST',
        body: JSON.stringify(payload)
      }, true);
      showToast('Шинэ бараа нэмэгдлээ.');
    }
    clearProductForm();
    await loadDashboard();
  } catch (error) {
    showToast(error.message);
  }
}

function editProduct(id) {
  const product = products.find(item => item.id === id);
  if (!product) return;
  document.getElementById('productFormTitle').textContent = 'Бараа засах';
  document.getElementById('productId').value = product.id;
  document.getElementById('productName').value = product.name || '';
  ensureCategoryOption(product.category);
  document.getElementById('productCategory').value = product.category || '';
  document.getElementById('productPrice').value = product.price || 0;
  document.getElementById('productStock').value = product.stock || 0;
  document.getElementById('productBadge').value = product.badge || '';
  document.getElementById('productImage').value = product.image || '';
  document.getElementById('productDescription').value = product.description || '';
  document.getElementById('productName').focus();
}

function clearProductForm() {
  document.getElementById('productForm').reset();
  document.getElementById('productId').value = '';
  document.getElementById('productFormTitle').textContent = 'Шинэ бараа нэмэх';
}

async function deleteProduct(id) {
  if (!confirm('Энэ барааг устгах уу?')) return;
  try {
    await request(`/api/admin/products/${encodeURIComponent(id)}`, { method: 'DELETE' }, true);
    await loadDashboard();
    showToast('Бараа устгагдлаа.');
  } catch (error) {
    showToast(error.message);
  }
}

function renderProducts() {
  const list = document.getElementById('productsList');
  list.innerHTML = products.length ? products.map(product => `
    <article class="admin-row product-manage-row">
      <div>
        <strong>${escapeText(product.name)}</strong>
        <p>${escapeText(product.category)} · ${formatMoney(product.price)} · Үлдэгдэл: ${escapeText(product.stock)}</p>
        <p>${escapeText(product.description)}</p>
      </div>
      <div class="row-actions">
        <button class="secondary" type="button" onclick="editProduct('${escapeText(product.id)}')">Засах</button>
        <button class="danger" type="button" onclick="deleteProduct('${escapeText(product.id)}')">Устгах</button>
      </div>
    </article>
  `).join('') : '<p class="empty-state">Одоогоор бараа алга.</p>';
}

function normalizedStatus(status) {
  return statusMap[status] || status || 'Захиалсан';
}

function renderTracking(status) {
  const current = normalizedStatus(status);
  const currentIndex = Math.max(0, trackingSteps.indexOf(current));
  return `
    <div class="tracking">
      ${trackingSteps.map((step, index) => `
        <div class="tracking-step ${index <= currentIndex ? 'active' : ''}">
          <span>${index + 1}</span>
          <p>${step}</p>
        </div>
      `).join('')}
    </div>
  `;
}

function renderOrders() {
  const list = document.getElementById('manageOrdersList');
  list.innerHTML = orders.length ? orders.map(order => `
    <article class="order-row">
      <div>
        <strong>${escapeText(order.id)} - ${escapeText(normalizedStatus(order.status))}</strong>
        <p>${new Date(order.createdAt).toLocaleString()} - ${escapeText(order.deliveryMethod)}</p>
        <p><strong>Төлбөр:</strong> ${escapeText(order.paymentMethod || 'Банкны шилжүүлэг')} - ${escapeText(order.paymentStatus)}</p>
        <p><strong>Захиалагч:</strong> ${escapeText(order.customer?.name)}</p>
        <p><strong>Утас:</strong> ${escapeText(order.customer?.phone)}</p>
        <p><strong>Имэйл:</strong> ${escapeText(order.customer?.email)}</p>
        <p><strong>Хаяг:</strong> ${escapeText(order.customer?.address || 'Хаяг байхгүй')}</p>
        <p><strong>Тэмдэглэл:</strong> ${escapeText(order.customer?.notes || 'Тэмдэглэл байхгүй')}</p>
        ${renderTracking(order.status)}
        <div class="order-items">
          ${(order.items || []).map(item => `
            <div>
              <span>${escapeText(item.name)} x ${escapeText(item.quantity)}</span>
              <strong>${formatMoney(item.subtotal)}</strong>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="order-actions">
        <strong>${formatMoney(order.total)}</strong>
        <button class="secondary" type="button" onclick="updateOrder('${escapeText(order.id)}', 'Confirmed')">Баталгаажсан</button>
        <button class="secondary" type="button" onclick="updateOrder('${escapeText(order.id)}', 'Shipped')">Тээвэрлэгдсэн</button>
        <button class="secondary" type="button" onclick="updateOrder('${escapeText(order.id)}', 'Completed')">Дууссан</button>
        <button class="danger" type="button" onclick="deleteOrder('${escapeText(order.id)}')">Устгах</button>
      </div>
    </article>
  `).join('') : '<p class="empty-state">Одоогоор захиалга алга.</p>';
}

async function updateOrder(id, status) {
  try {
    await request(`/api/admin/orders/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    }, true);
    await loadDashboard();
    showToast('Захиалгын төлөв шинэчлэгдлээ.');
  } catch (error) {
    showToast(error.message);
  }
}

async function deleteOrder(id) {
  if (!confirm('Энэ захиалгыг устгах уу?')) return;
  try {
    await request(`/api/admin/orders/${encodeURIComponent(id)}`, { method: 'DELETE' }, true);
    await loadDashboard();
    showToast('Захиалга устгагдлаа.');
  } catch (error) {
    showToast(error.message);
  }
}

function showProductsTab() {
  document.getElementById('productsPanel').classList.remove('hidden');
  document.getElementById('ordersPanel').classList.add('hidden');
  document.getElementById('productsTab').classList.add('active');
  document.getElementById('ordersTab').classList.remove('active');
}

function showOrdersTab() {
  document.getElementById('productsPanel').classList.add('hidden');
  document.getElementById('ordersPanel').classList.remove('hidden');
  document.getElementById('productsTab').classList.remove('active');
  document.getElementById('ordersTab').classList.add('active');
}

document.getElementById('manageLoginForm').addEventListener('submit', login);
document.getElementById('productForm').addEventListener('submit', saveProduct);
document.getElementById('clearProductButton').addEventListener('click', clearProductForm);
document.getElementById('refreshButton').addEventListener('click', loadDashboard);
document.getElementById('logoutButton').addEventListener('click', logout);
document.getElementById('productsTab').addEventListener('click', showProductsTab);
document.getElementById('ordersTab').addEventListener('click', showOrdersTab);

if (adminToken) {
  showDashboard();
}
