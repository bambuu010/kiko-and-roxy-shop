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

let adminToken = sessionStorage.getItem('krOrdersToken') || '';
let orders = [];

function formatMoney(value) {
  return money.format(Number(value || 0));
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
        username: document.getElementById('ordersUsername').value.trim(),
        password: document.getElementById('ordersPassword').value
      })
    });
    adminToken = data.token;
    sessionStorage.setItem('krOrdersToken', adminToken);
    document.getElementById('ordersLoginError').textContent = '';
    showDashboard();
  } catch (error) {
    document.getElementById('ordersLoginError').textContent = error.message;
  }
}

async function showDashboard() {
  document.getElementById('ordersLogin').classList.add('hidden');
  document.getElementById('ordersDashboard').classList.remove('hidden');
  await loadOrders();
}

function showLogin() {
  adminToken = '';
  sessionStorage.removeItem('krOrdersToken');
  document.getElementById('ordersDashboard').classList.add('hidden');
  document.getElementById('ordersLogin').classList.remove('hidden');
  document.getElementById('ordersPassword').focus();
}

async function loadOrders() {
  try {
    const data = await request('/api/admin/dashboard', {}, true);
    orders = data.orders || [];
    renderStats();
    renderOrders();
  } catch (error) {
    if (String(error.message).includes('нэвтрэх') || String(error.message).includes('login') || String(error.message).includes('required')) {
      showLogin();
    }
    showToast(error.message);
  }
}

function renderStats() {
  const revenue = orders.reduce((sum, order) => sum + Number(order.total), 0);
  const newOrders = orders.filter(order => normalizedStatus(order.status) === 'Захиалсан').length;
  document.getElementById('ordersRevenue').textContent = formatMoney(revenue);
  document.getElementById('ordersCount').textContent = orders.length;
  document.getElementById('newOrdersCount').textContent = newOrders;
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
  const list = document.getElementById('ordersList');

  list.innerHTML = orders.length ? orders.map(order => `
    <article class="order-row">
      <div>
        <strong>${order.id} - ${normalizedStatus(order.status)}</strong>
        <p>${new Date(order.createdAt).toLocaleString()} - ${order.deliveryMethod}</p>
        <p><strong>Төлбөр:</strong> ${order.paymentMethod || 'Банкны шилжүүлэг'} - ${order.paymentStatus}</p>
        <p><strong>Захиалагч:</strong> ${order.customer.name}</p>
        <p><strong>Утас:</strong> ${order.customer.phone}</p>
        <p><strong>Имэйл:</strong> ${order.customer.email}</p>
        <p><strong>Хаяг:</strong> ${order.customer.address || 'Хаяг байхгүй'}</p>
        <p><strong>Тэмдэглэл:</strong> ${order.customer.notes || 'Тэмдэглэл байхгүй'}</p>
        ${renderTracking(order.status)}
        <div class="order-items">
          ${order.items.map(item => `
            <div>
              <span>${item.name} x ${item.quantity}</span>
              <strong>${formatMoney(item.subtotal)}</strong>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="order-actions">
        <strong>${formatMoney(order.total)}</strong>
        <button class="secondary" type="button" onclick="updateOrder('${order.id}', 'Confirmed')">Баталгаажсан</button>
        <button class="secondary" type="button" onclick="updateOrder('${order.id}', 'Shipped')">Тээвэрлэгдсэн</button>
        <button class="secondary" type="button" onclick="updateOrder('${order.id}', 'Completed')">Дууссан</button>
        <button class="danger" type="button" onclick="deleteOrder('${order.id}')">Устгах</button>
      </div>
    </article>
  `).join('') : '<p>Одоогоор захиалга алга.</p>';
}

async function updateOrder(id, status) {
  try {
    await request(`/api/admin/orders/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    }, true);
    await loadOrders();
    showToast(`Захиалга ${id} шинэчлэгдлээ.`);
  } catch (error) {
    showToast(error.message);
  }
}

async function deleteOrder(id) {
  if (!confirm(`Захиалга ${id}-г устгах уу?`)) return;

  try {
    await request(`/api/admin/orders/${id}`, { method: 'DELETE' }, true);
    await loadOrders();
    showToast(`Захиалга ${id} устгагдлаа.`);
  } catch (error) {
    showToast(error.message);
  }
}

document.getElementById('ordersLoginForm').addEventListener('submit', login);

if (adminToken) {
  showDashboard();
}
