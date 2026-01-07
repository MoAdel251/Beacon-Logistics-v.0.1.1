import { neon } from '@netlify/neon';
const sql = neon(); // automatically uses env NETLIFY_DATABASE_URL
const [post] = await sql`SELECT * FROM posts WHERE id = ${postId}`;
// ---------- Storage & Helpers ----------
const Store = {
  key: 'lc_crm_v1',
  defaultData() {
    return {
      users: [
        { id: 'u_admin', username: 'MH', password: 'Beacon2025', name: 'Mahmoud El Hadary' },
        { id: 'u_admin', username: 'MO', password: 'Beacon2025', name: 'Mohamed Adel' },
        { id: 'u_admin', username: 'MK', password: 'Beacon2025', name: 'Mahmoud Kotb' },
        { id: 'u_admin', username: 'MS', password: 'Beacon2025', name: 'Mohamed Samir' },
        { id: 'u_admin', username: 'AM', password: 'Beacon2025', name: 'Ahmed Makhlouf' }
      ],
      session: null,
      customers: [], shipments: [], drivers: [], invoices: [], clearances: [], deposits: [], driverDeposits: []
    }
  },

  load() { try { return JSON.parse(localStorage.getItem(this.key)) ?? this.defaultData() } catch (e) { return this.defaultData() } },
  save(state) { localStorage.setItem(this.key, JSON.stringify(state)); }
};

function uid(prefix = 'id') { return prefix + '_' + Math.random().toString(36).slice(2, 9); }
function fmt(amount, currency = 'EGP') { try { const locales = { EGP: 'en-EG', USD: 'en-US', EUR: 'de-DE' }; return new Intl.NumberFormat(locales[currency] || 'en-US', { style: 'currency', currency }).format(Number(amount) || 0); } catch (e) { return amount } }

// ---------- App State & Data Access ----------
let state = Store.load();
function saveState() { Store.save(state); renderCurrentView(); renderNav(); updateUserChip(); }

// ---------- Auth UI ----------
function openAuth() { document.getElementById('authOverlay').style.display = 'flex'; document.getElementById('a_msg').textContent = ''; }
function closeAuth() { document.getElementById('authOverlay').style.display = 'none'; document.getElementById('a_user').value = ''; document.getElementById('a_pass').value = ''; }
function doLogin() { const u = document.getElementById('a_user').value.trim(); const p = document.getElementById('a_pass').value; const found = state.users.find(x => x.username === u && x.password === p); if (found) { state.session = { id: found.id, username: found.username, name: found.name }; saveState(); closeAuth(); } else { document.getElementById('a_msg').textContent = 'Invalid credentials'; } }
function logout() { state.session = null; saveState(); openAuth(); }

function demoFill() { // quick demo seed data (with shipment extended fields)
  state.customers = [{ id: uid('cust'), name: 'Nile Imports', contact: '+20 100 123 4567' }, { id: uid('cust'), name: 'Alex Traders', contact: '+20 101 222 3344' }];
  state.shipments = [{
    id: uid('s'),
    ref: 'EG-2025-001',
    customerIds: [state.customers[0].id, state.customers[1].id],
    origin: 'Port Said, Egypt',
    destination: 'Hamburg, Germany',
    bol: 'BOL-998877',
    containers: 'C12345 (40ft Dry)',
    shippingLine: 'Maersk',
    status: 'In Transit'
  }];
  // drivers now have cost, currency, deposited
  state.drivers = [{ id: uid('drv'), name: 'Mohamed', phone: '+20 120 111 2222', cost: 2000, currency: 'EGP', deposited: 0 }];
  state.invoices = [{ id: uid('inv'), no: 'INV-0001', customerId: state.customers[0].id, amount: 15000, currency: 'EGP' }];
  state.clearances = [{ id: 'CLR-1001', customerId: state.customers[0].id, cost: 5000, currency: 'EGP', deposited: 0 }];
  state.deposits = []; state.driverDeposits = [];
  saveState(); closeAuth();
}

// ---------- Navigation & Views ----------
const VIEWS = ['dashboard', 'customers', 'shipments', 'drivers', 'invoices', 'customs', 'deposits_customs', 'deposits_drivers', 'settings', 'logout'];
function renderNav() { const nav = document.getElementById('nav'); nav.innerHTML = ''; VIEWS.forEach(v => { const btn = document.createElement('button'); btn.textContent = labelFor(v); btn.dataset.view = v; btn.className = (currentView === v) ? 'active' : ''; btn.onclick = () => { if (v === 'logout') { if (confirm('Log out?')) logout(); return; } navigate(v); }; nav.appendChild(btn); }); }
function labelFor(v) { return ({ dashboard: '📊 Dashboard', customers: '👥 Customers', shipments: '📦 Shipments', drivers: '🚚 Drivers', invoices: '💰 Invoices', customs: '📑 Customs Clearance', deposits_customs: '🏦 Deposits (Customs)', deposits_drivers: '🏦 Deposits (Drivers)', settings: '⚙️ Settings', logout: '🚪 Log out' })[v] || v }

let currentView = 'dashboard';
function navigate(v) { currentView = v; renderCurrentView(); renderNav(); }
function updateUserChip() { document.getElementById('usernameDisplay').textContent = state.session ? state.session.name : 'Guest'; }

function renderCurrentView() { const view = document.getElementById('view'); view.innerHTML = ''; if (!state.session) { openAuth(); return; } switch (currentView) { case 'dashboard': return renderDashboard(view); case 'customers': return renderCustomers(view); case 'shipments': return renderShipments(view); case 'drivers': return renderDrivers(view); case 'invoices': return renderInvoices(view); case 'customs': return renderClearancesView(view); case 'deposits_customs': return renderDepositsView(view); case 'deposits_drivers': return renderDriverDepositsView(view); case 'settings': return renderSettings(view); default: view.textContent = 'Not found'; } }

// ---------- Dashboard ----------
function renderDashboard(root) {
  const csum = sumByCurrency(state.invoices, 'amount'); const clsum = sumByCurrency(state.clearances, 'cost'); const depositedSum = sumByCurrency(state.clearances, 'deposited'); const drvCost = sumByCurrency(state.drivers, 'cost'); const drvDeposited = sumByCurrency(state.drivers, 'deposited');
  root.innerHTML = `
        <div class="grid cols-3">
          <div class="card"><div class="muted">Total Customers</div><div style="font-size:26px;font-weight:800">${state.customers.length}</div></div>
          <div class="card"><div class="muted">Total Shipments</div><div style="font-size:26px;font-weight:800">${state.shipments.length}</div></div>
          <div class="card"><div class="muted">Total Invoices</div><div style="font-size:26px;font-weight:800">${state.invoices.length}</div></div>
        </div>
        <div class="card" style="margin-top:12px">
          <h3 style="margin-bottom:6px">Invoice Totals (by currency)</h3>
          <div class="muted">${renderCurrencySums(csum)}</div>
        </div>
        <div class="card" style="margin-top:12px">
          <h3 style="margin-bottom:6px">Customs Totals</h3>
          <div class="muted">Costs: ${renderCurrencySums(clsum)}</div>
          <div class="muted">Deposited: ${renderCurrencySums(depositedSum)}</div>
        </div>
        <div class="card" style="margin-top:12px">
          <h3 style="margin-bottom:6px">Driver Totals</h3>
          <div class="muted">Costs: ${renderCurrencySums(drvCost)}</div>
          <div class="muted">Deposited: ${renderCurrencySums(drvDeposited)}</div>
        </div>
      `;
}

function sumByCurrency(list, field) { const out = {}; list.forEach(it => { const cur = it.currency || 'EGP'; out[cur] = (out[cur] || 0) + (Number(it[field] || 0)); }); return out }
function renderCurrencySums(obj) { return Object.keys(obj).length ? Object.entries(obj).map(([k, v]) => `<div>${fmt(v, k)} <span style="color:var(--muted)">(${k})</span></div>`).join('') : '<div class="muted">—</div>' }

// ---------- Customers ----------
function renderCustomers(root) { root.innerHTML = `<div class="card"><h2>Customers</h2><label>Name</label><input id="c_name" placeholder="Customer name"/><label>Contact</label><input id="c_contact" placeholder="Phone or email"/><div style="display:flex; gap:8px; margin-top:8px"><button class="btn primary" onclick="addCustomer()">Add Customer</button><button class="btn" onclick="seedCustomerSample()">Sample</button></div></div><div class="card"><h3>List</h3><div id="custList"></div></div>`; renderCustomerList(); }
function addCustomer() { const name = document.getElementById('c_name').value.trim(); const contact = document.getElementById('c_contact').value.trim(); if (!name) return alert('Name required'); state.customers.push({ id: uid('cust'), name, contact }); saveState(); document.getElementById('c_name').value = ''; document.getElementById('c_contact').value = ''; }
function renderCustomerList() { const el = document.getElementById('custList'); if (!el) return; el.innerHTML = `<table><thead><tr><th>Name</th><th>Contact</th><th>Actions</th></tr></thead><tbody>${state.customers.map(c => `<tr><td>${c.name}</td><td>${c.contact}</td><td><button class="btn" onclick="openEdit('customer','${c.id}')">✏️ Edit</button> <button class="btn" onclick="deleteRecord('customer','${c.id}')">🗑 Delete</button></td></tr>`).join('')}</tbody></table>`; }
function seedCustomerSample() { state.customers.push({ id: uid('cust'), name: 'Nile Imports', contact: '+20 100 123 4567' }); saveState(); }

// ---------- Shipments (updated with new fields) ----------
function renderShipments(root) {
  // Form for adding shipment with Origin, Destination, BOL, Containers, Shipping Line
  root.innerHTML = `<div class="card"><h2>Shipments</h2>
        <label>Reference</label><input id="s_ref" placeholder="Ref no (e.g., SH-2025-001)"/>
        <label>Customers</label><select id="s_customer" multiple style="min-height:60px">${state.customers.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}</select>
        <div class="row">
          <div><label>Origin</label><input id="s_origin" placeholder="Origin (city/port)"/></div>
          <div><label>Destination</label><input id="s_destination" placeholder="Destination (city/port)"/></div>
        </div>
        <div class="row">
          <div><label>Bill of Lading No.</label><input id="s_bol" placeholder="BOL number"/></div>
          <div><label>Shipping Line</label><input id="s_line" placeholder="Shipping line (e.g., Maersk)"/></div>
        </div>
        <div class="row">
          <div><label>Container No. & Type</label><input id="s_containers" placeholder="e.g. C12345 (40ft Dry) — for multiple, separate with |"/></div>
          <div><label>Status</label><select id="s_status"><option>Pending</option><option>In Transit</option><option>Delivered</option></select></div>
        </div>
        <div style="display:flex; gap:8px; margin-top:8px"><button class="btn primary" onclick="addShipment()">Add Shipment</button></div>
      </div>
      <div class="card"><h3>List</h3><div id="shipList"></div></div>`;
  renderShipList();
}

function addShipment() {
  const ref = document.getElementById('s_ref').value.trim();
  const customerSelect = document.getElementById('s_customer');
  const customerIds = Array.from(customerSelect.selectedOptions).map(opt => opt.value);
  const origin = document.getElementById('s_origin').value.trim();
  const destination = document.getElementById('s_destination').value.trim();
  const bol = document.getElementById('s_bol').value.trim();
  const line = document.getElementById('s_line').value.trim();
  const containers = document.getElementById('s_containers').value.trim();
  const status = document.getElementById('s_status').value;
  if (!ref) return alert('Reference required');
  if (customerIds.length === 0) return alert('At least one customer required');
  if (customerIds.length > 20) return alert('Maximum 20 customers per shipment');
  // store shipment with new fields
  state.shipments.push({
    id: uid('sh'),
    ref,
    customerIds,
    origin,
    destination,
    bol,
    containers,
    shippingLine: line,
    status
  });
  saveState();
  // clear inputs
  document.getElementById('s_ref').value = '';
  customerSelect.selectedIndex = -1;
  document.getElementById('s_origin').value = '';
  document.getElementById('s_destination').value = '';
  document.getElementById('s_bol').value = '';
  document.getElementById('s_line').value = '';
  document.getElementById('s_containers').value = '';
}

function renderShipList() {
  const el = document.getElementById('shipList');
  if (!el) return;
  // Table headers: Ref | Customers | Origin | Destination | B/L | Containers | Shipping Line | Status | Actions
  el.innerHTML = `<table><thead><tr>
        <th>Ref</th><th>Customers</th><th>Origin</th><th>Destination</th><th>B/L No.</th><th>Containers</th><th>Shipping Line</th><th>Status</th><th>Actions</th>
      </tr></thead><tbody>${state.shipments.map(s => `<tr>
        <td>${s.ref}</td>
        <td>${(s.customerIds || []).map(id => (state.customers.find(c => c.id === id) || {}).name || '-').join(', ')}</td>
        <td>${escapeHtml(s.origin || '-')}</td>
        <td>${escapeHtml(s.destination || '-')}</td>
        <td>${escapeHtml(s.bol || '-')}</td>
        <td>${escapeHtml(s.containers || '-')}</td>
        <td>${escapeHtml(s.shippingLine || '-')}</td>
        <td>${statusBadge(s.status)}</td>
        <td><button class="btn" onclick="openEdit('shipment','${s.id}')">✏️ Edit</button> <button class="btn" onclick="deleteRecord('shipment','${s.id}')">🗑 Delete</button></td>
      </tr>`).join('')}</tbody></table>`;
}

// ---------- Drivers (with cost & deposited) ----------
function renderDrivers(root) {
  root.innerHTML = `<div class="card"><h2>Drivers</h2><label>Name</label><input id="d_name" placeholder="Name"/><label>Phone</label><input id="d_phone" placeholder="Phone"/><div class="row"><div><label>Cost / Settlement</label><input id="d_cost" type="number" placeholder="Amount"/></div><div><label>Currency</label><select id="d_currency"><option>EGP</option><option>USD</option><option>EUR</option></select></div></div><div style="display:flex; gap:8px; margin-top:8px"><button class="btn primary" onclick="addDriver()">Add Driver</button></div></div><div class="card"><h3>List</h3><div id="drvList"></div></div>`;
  renderDriverList();
}

function addDriver() { const name = document.getElementById('d_name').value.trim(); const phone = document.getElementById('d_phone').value.trim(); const cost = parseFloat(document.getElementById('d_cost').value) || 0; const currency = document.getElementById('d_currency').value; if (!name) return alert('Name required'); state.drivers.push({ id: uid('drv'), name, phone, cost, currency, deposited: 0 }); saveState(); document.getElementById('d_name').value = ''; document.getElementById('d_phone').value = ''; document.getElementById('d_cost').value = ''; }

function renderDriverList() { const el = document.getElementById('drvList'); if (!el) return; el.innerHTML = `<table><thead><tr><th>Name</th><th>Phone</th><th>Cost</th><th>Deposited</th><th>Remaining</th><th>Actions</th></tr></thead><tbody>${state.drivers.map(d => `<tr><td>${d.name}</td><td>${d.phone}</td><td>${fmt(d.cost, d.currency)}</td><td>${fmt(d.deposited, d.currency)}</td><td>${fmt(Math.max(0, d.cost - d.deposited), d.currency)}</td><td><button class="btn" onclick="openEdit('driver','${d.id}')">✏️ Edit</button> <button class="btn" onclick="deleteRecord('driver','${d.id}')">🗑 Delete</button></td></tr>`).join('')}</tbody></table>`; }

// ---------- Invoices ----------
function renderInvoices(root) { root.innerHTML = `<div class="card"><h2>Invoices</h2><label>Invoice No.</label><input id="i_no" placeholder="INV-0001"/><label>Customer</label><select id="i_customer">${state.customers.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}</select><div class="row"><div><label>Amount</label><input id="i_amount" type="number"/></div><div><label>Currency</label><select id="i_currency"><option value="EGP">EGP</option><option value="USD">USD</option><option value="EUR">EUR</option></select></div></div><div style="display:flex; gap:8px; margin-top:8px"><button class="btn primary" onclick="addInvoice()">Add Invoice</button></div></div><div class="card"><h3>List</h3><div id="invList"></div></div>`; renderInvoiceList(); }
function addInvoice() { const no = document.getElementById('i_no').value.trim(); const customerId = document.getElementById('i_customer').value; const amount = parseFloat(document.getElementById('i_amount').value); const currency = document.getElementById('i_currency').value; if (!no || isNaN(amount)) return alert('Invoice no and amount required'); state.invoices.push({ id: uid('inv'), no, customerId, amount, currency }); saveState(); document.getElementById('i_no').value = ''; document.getElementById('i_amount').value = ''; }
function renderInvoiceList() { const el = document.getElementById('invList'); if (!el) return; el.innerHTML = `<table><thead><tr><th>No</th><th>Customer</th><th>Amount</th><th>Actions</th></tr></thead><tbody>${state.invoices.map(i => `<tr><td>${i.no}</td><td>${(state.customers.find(c => c.id === i.customerId) || {}).name || '-'}</td><td>${fmt(i.amount, i.currency)}</td><td><button class="btn" onclick="openEdit('invoice','${i.id}')">✏️ Edit</button> <button class="btn" onclick="deleteRecord('invoice','${i.id}')">🗑 Delete</button></td></tr>`).join('')}</tbody></table>`; }

// ---------- Customs Clearance ----------
function renderClearancesView(root) { root.innerHTML = `<div class="card"><h2>Customs Clearance</h2><label>Clearance ID</label><input id="cl_id" placeholder="CLR-1234"/><label>Customer</label><select id="cl_customer">${state.customers.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}</select><div class="row"><div><label>Cost</label><input id="cl_cost" type="number"/></div><div><label>Currency</label><select id="cl_currency"><option>EGP</option><option>USD</option><option>EUR</option></select></div></div><div style="display:flex; gap:8px; margin-top:8px"><button class="btn primary" onclick="addClearance()">Add Clearance</button></div></div><div class="card"><h3>List</h3><div id="clearList"></div></div>`; renderClearances(); }
function addClearance() { const id = document.getElementById('cl_id').value.trim(); const customerId = document.getElementById('cl_customer').value; const cost = parseFloat(document.getElementById('cl_cost').value); const currency = document.getElementById('cl_currency').value; if (!id || isNaN(cost)) return alert('ID and cost required'); state.clearances.push({ id, customerId, cost, currency, deposited: 0 }); saveState(); document.getElementById('cl_id').value = ''; document.getElementById('cl_cost').value = ''; }
function renderClearances() { const el = document.getElementById('clearList'); if (!el) return; el.innerHTML = `<table><thead><tr><th>ID</th><th>Customer</th><th>Cost</th><th>Currency</th><th>Deposited</th><th>Remaining</th><th>Actions</th></tr></thead><tbody>${state.clearances.map(c => `<tr><td>${c.id}</td><td>${(state.customers.find(x => x.id === c.customerId) || {}).name || '-'}</td><td>${fmt(c.cost, currencyOr(c))}</td><td>${c.currency}</td><td>${fmt(c.deposited, currencyOr(c))}</td><td>${fmt(Math.max(0, c.cost - c.deposited), currencyOr(c))}</td><td><button class="btn" onclick="openEdit('clearance','${c.id}')">✏️ Edit</button> <button class="btn" onclick="deleteRecord('clearance','${c.id}')">🗑 Delete</button></td></tr>`).join('')}</tbody></table>`; }

function currencyOr(item) { return (item && item.currency) ? item.currency : 'EGP'; }

// ---------- Deposits for Customs ----------
function renderDepositsView(root) { root.innerHTML = `<div class="card"><h2>Bank Deposits (Customs)</h2><label>Deposit ID</label><input id="dp_id" placeholder="DEP-0001"/><label>Clearance</label><select id="dp_clearance">${state.clearances.map(c => `<option value="${c.id}" data-currency="${c.currency}">${c.id} — ${(state.customers.find(x => x.id === c.customerId) || {}).name || '-'} (${c.currency})</option>`).join('')}</select><label>Amount</label><input id="dp_amount" type="number"/><label>Currency</label><select id="dp_currency"><option>EGP</option><option>USD</option><option>EUR</option></select><div id="rateRow" style="display:none"><label>Exchange Rate</label><input id="dp_rate" placeholder="Enter exchange rate (1 deposit currency = X clearance currency)"/></div><div style="display:flex; gap:8px; margin-top:8px"><button class="btn primary" onclick="addDeposit()">Add Deposit</button></div></div><div class="card"><h3>List</h3><div id="depositList"></div></div>`; setupDepositForm(); renderDeposits(); }
function setupDepositForm() { const sel = document.getElementById('dp_clearance'); const dpCur = document.getElementById('dp_currency'); const rateRow = document.getElementById('rateRow'); const rateInput = document.getElementById('dp_rate'); function check() { const opt = sel.options[sel.selectedIndex]; const clearanceCurrency = opt ? opt.dataset.currency : 'EGP'; if (dpCur.value !== clearanceCurrency) { rateRow.style.display = 'block'; rateInput.value = ''; } else { rateRow.style.display = 'none'; rateInput.value = '1'; } } sel.onchange = check; dpCur.onchange = check; check(); }
function addDeposit() { const dpId = document.getElementById('dp_id').value.trim(); const clearanceId = document.getElementById('dp_clearance').value; const amount = parseFloat(document.getElementById('dp_amount').value); const depositCurrency = document.getElementById('dp_currency').value; const rateInput = document.getElementById('dp_rate'); let rate = rateInput ? parseFloat(rateInput.value) : 1; if (!dpId || !clearanceId || isNaN(amount)) return alert('Deposit ID, clearance and amount required'); if (isNaN(rate) || rate <= 0) rate = 1; const clearance = state.clearances.find(c => c.id === clearanceId); if (!clearance) return alert('Clearance not found'); let converted = amount; if (depositCurrency !== clearance.currency) { converted = Number(amount) * Number(rate); } state.deposits.push({ id: dpId, clearanceId, amount, depositCurrency, rate: depositCurrency === clearance.currency ? 1 : rate, convertedAmount: converted, clearanceCurrency: clearance.currency }); clearance.deposited = (Number(clearance.deposited || 0) + Number(converted)); saveState(); document.getElementById('dp_id').value = ''; document.getElementById('dp_amount').value = ''; document.getElementById('dp_rate').value = ''; }
function renderDeposits() { const el = document.getElementById('depositList'); if (!el) return; el.innerHTML = `<table><thead><tr><th>Deposit ID</th><th>Clearance</th><th>Amount</th><th>Deposit Curr</th><th>Converted</th><th>Actions</th></tr></thead><tbody>${state.deposits.map(d => `<tr><td>${d.id}</td><td>${d.clearanceId}</td><td>${fmt(d.amount, d.depositCurrency)}</td><td>${d.depositCurrency}</td><td>${fmt(d.convertedAmount, d.clearanceCurrency)}</td><td><button class="btn" onclick="openEdit('deposit','${d.id}')">✏️ Edit</button> <button class="btn" onclick="deleteRecord('deposit','${d.id}')">🗑 Delete</button></td></tr>`).join('')}</tbody></table>`; }

// ---------- Deposits for Drivers ----------
function renderDriverDepositsView(root) {
  root.innerHTML = `<div class="card"><h2>Bank Deposits (Drivers)</h2><label>Deposit ID</label><input id="ddp_id" placeholder="DDP-0001"/><label>Driver</label><select id="ddp_driver">${state.drivers.map(d => `<option value="${d.id}" data-currency="${d.currency}">${d.name} — ${d.id} (${d.currency})</option>`).join('')}</select><label>Amount</label><input id="ddp_amount" type="number"/><label>Currency</label><select id="ddp_currency"><option>EGP</option><option>USD</option><option>EUR</option></select><div id="drRateRow" style="display:none"><label>Exchange Rate</label><input id="ddp_rate" placeholder="Enter exchange rate (1 deposit currency = X driver currency)"/></div><div style="display:flex; gap:8px; margin-top:8px"><button class="btn primary" onclick="addDriverDeposit()">Add Driver Deposit</button></div></div><div class="card"><h3>List</h3><div id="driverDepositList"></div></div>`;
  setupDriverDepositForm(); renderDriverDeposits();
}
function setupDriverDepositForm() { const sel = document.getElementById('ddp_driver'); const dpCur = document.getElementById('ddp_currency'); const rateRow = document.getElementById('drRateRow'); const rateInput = document.getElementById('ddp_rate'); function check() { const opt = sel.options[sel.selectedIndex]; const driverCurrency = opt ? opt.dataset.currency : 'EGP'; if (dpCur.value !== driverCurrency) { rateRow.style.display = 'block'; rateInput.value = ''; } else { rateRow.style.display = 'none'; rateInput.value = '1'; } } sel.onchange = check; dpCur.onchange = check; check(); }
function addDriverDeposit() { const dpId = document.getElementById('ddp_id').value.trim(); const driverId = document.getElementById('ddp_driver').value; const amount = parseFloat(document.getElementById('ddp_amount').value); const depositCurrency = document.getElementById('ddp_currency').value; const rateInput = document.getElementById('ddp_rate'); let rate = rateInput ? parseFloat(rateInput.value) : 1; if (!dpId || !driverId || isNaN(amount)) return alert('Deposit ID, driver and amount required'); if (isNaN(rate) || rate <= 0) rate = 1; const driver = state.drivers.find(d => d.id === driverId); if (!driver) return alert('Driver not found'); let converted = amount; if (depositCurrency !== driver.currency) { converted = Number(amount) * Number(rate); } state.driverDeposits.push({ id: dpId, driverId, amount, depositCurrency, rate: depositCurrency === driver.currency ? 1 : rate, convertedAmount: converted, driverCurrency: driver.currency }); driver.deposited = (Number(driver.deposited || 0) + Number(converted)); saveState(); document.getElementById('ddp_id').value = ''; document.getElementById('ddp_amount').value = ''; document.getElementById('ddp_rate').value = ''; }
function renderDriverDeposits() { const el = document.getElementById('driverDepositList'); if (!el) return; el.innerHTML = `<table><thead><tr><th>Deposit ID</th><th>Driver</th><th>Amount</th><th>Deposit Curr</th><th>Converted</th><th>Actions</th></tr></thead><tbody>${state.driverDeposits.map(d => `<tr><td>${d.id}</td><td>${(state.drivers.find(x => x.id === d.driverId) || {}).name || d.driverId}</td><td>${fmt(d.amount, d.depositCurrency)}</td><td>${d.depositCurrency}</td><td>${fmt(d.convertedAmount, d.driverCurrency)}</td><td><button class="btn" onclick="openEdit('driver_deposit','${d.id}')">✏️ Edit</button> <button class="btn" onclick="deleteRecord('driver_deposit','${d.id}')">🗑 Delete</button></td></tr>`).join('')}</tbody></table>`; }

// ---------- Generic Edit / Delete Handlers (updated shipment edit/save) ----------
function openEdit(type, id) { const item = findByType(type, id); if (!item) return alert('Item not found'); const modal = document.getElementById('editModal'); const body = document.getElementById('modalBody'); body.innerHTML = renderEditForm(type, item); modal.classList.add('active'); }
function closeModal() { const modal = document.getElementById('editModal'); modal.classList.remove('active'); document.getElementById('modalBody').innerHTML = ''; }

function renderEditForm(type, item) {
  if (type === 'customer') {
    return `<h3>Edit Customer</h3><label>Name</label><input id="edit_name" value="${escapeHtml(item.name || '')}"/><label>Contact</label><input id="edit_contact" value="${escapeHtml(item.contact || '')}"/><div style="display:flex; gap:8px; margin-top:12px"><button class="btn primary" onclick="saveEdit('customer','${item.id}')">Save</button><button class="btn" onclick="closeModal()">Cancel</button></div>`;
  }
  if (type === 'shipment') {
    // include the new shipment fields
    return `<h3>Edit Shipment</h3>
          <label>Reference</label><input id="edit_ref" value="${escapeHtml(item.ref || '')}" />
          <label>Customers</label><select id="edit_customer" multiple style="min-height:60px">${state.customers.map(c => `<option value="${c.id}" ${(item.customerIds || []).includes(c.id) ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}</select>
          <div class="row">
            <div><label>Origin</label><input id="edit_origin" value="${escapeHtml(item.origin || '')}" /></div>
            <div><label>Destination</label><input id="edit_destination" value="${escapeHtml(item.destination || '')}" /></div>
          </div>
          <div class="row">
            <div><label>Bill of Lading No.</label><input id="edit_bol" value="${escapeHtml(item.bol || '')}" /></div>
            <div><label>Shipping Line</label><input id="edit_line" value="${escapeHtml(item.shippingLine || '')}" /></div>
          </div>
          <div class="row">
            <div><label>Container No. & Type</label><input id="edit_containers" value="${escapeHtml(item.containers || '')}" /></div>
            <div><label>Status</label><select id="edit_status"><option ${item.status === 'Pending' ? 'selected' : ''}>Pending</option><option ${item.status === 'In Transit' ? 'selected' : ''}>In Transit</option><option ${item.status === 'Delivered' ? 'selected' : ''}>Delivered</option></select></div>
          </div>
          <div style="display:flex; gap:8px; margin-top:12px"><button class="btn primary" onclick="saveEdit('shipment','${item.id}')">Save</button><button class="btn" onclick="closeModal()">Cancel</button></div>`;
  }
  if (type === 'driver') {
    return `<h3>Edit Driver</h3><label>Name</label><input id="edit_name" value="${escapeHtml(item.name || '')}"/><label>Phone</label><input id="edit_phone" value="${escapeHtml(item.phone || '')}"/><div class="row" style="margin-top:8px"><div><label>Cost</label><input id="edit_cost" type="number" value="${item.cost || 0}"/></div><div><label>Currency</label><select id="edit_currency"><option ${item.currency === 'EGP' ? 'selected' : ''}>EGP</option><option ${item.currency === 'USD' ? 'selected' : ''}>USD</option><option ${item.currency === 'EUR' ? 'selected' : ''}>EUR</option></select></div></div><div style="display:flex; gap:8px; margin-top:12px"><button class="btn primary" onclick="saveEdit('driver','${item.id}')">Save</button><button class="btn" onclick="closeModal()">Cancel</button></div>`;
  }
  if (type === 'invoice') {
    return `<h3>Edit Invoice</h3><label>Invoice No.</label><input id="edit_no" value="${escapeHtml(item.no || '')}"/><label>Customer</label><select id="edit_customer">${state.customers.map(c => `<option value="${c.id}" ${c.id === item.customerId ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}</select><label>Amount</label><input id="edit_amount" type="number" value="${item.amount || 0}"/><label>Currency</label><select id="edit_currency"><option ${item.currency === 'EGP' ? 'selected' : ''}>EGP</option><option ${item.currency === 'USD' ? 'selected' : ''}>USD</option><option ${item.currency === 'EUR' ? 'selected' : ''}>EUR</option></select><div style="display:flex; gap:8px; margin-top:12px"><button class="btn primary" onclick="saveEdit('invoice','${item.id}')">Save</button><button class="btn" onclick="closeModal()">Cancel</button></div>`;
  }
  if (type === 'clearance') {
    return `<h3>Edit Clearance</h3><label>ID</label><input id="edit_id" value="${escapeHtml(item.id || '')}" disabled/><label>Customer</label><select id="edit_customer">${state.customers.map(c => `<option value="${c.id}" ${c.id === item.customerId ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}</select><label>Cost</label><input id="edit_cost" type="number" value="${item.cost || 0}"/><label>Currency</label><select id="edit_currency"><option ${item.currency === 'EGP' ? 'selected' : ''}>EGP</option><option ${item.currency === 'USD' ? 'selected' : ''}>USD</option><option ${item.currency === 'EUR' ? 'selected' : ''}>EUR</option></select><div style="display:flex; gap:8px; margin-top:12px"><button class="btn primary" onclick="saveEdit('clearance','${item.id}')">Save</button><button class="btn" onclick="closeModal()">Cancel</button></div>`;
  }
  if (type === 'deposit') {
    return `<h3>Edit Deposit (Customs)</h3><label>Deposit ID</label><input id="edit_id" value="${escapeHtml(item.id || '')}" disabled/><label>Clearance</label><select id="edit_clearance">${state.clearances.map(c => `<option value="${c.id}" ${c.id === item.clearanceId ? 'selected' : ''}>${escapeHtml(c.id)}</option>`).join('')}</select><label>Amount</label><input id="edit_amount" type="number" value="${item.amount || 0}"/><label>Deposit Currency</label><select id="edit_depcurrency"><option ${item.depositCurrency === 'EGP' ? 'selected' : ''}>EGP</option><option ${item.depositCurrency === 'USD' ? 'selected' : ''}>USD</option><option ${item.depositCurrency === 'EUR' ? 'selected' : ''}>EUR</option></select><label>Exchange Rate</label><input id="edit_rate" type="number" value="${item.rate || 1}" step="0.0001"/><div style="display:flex; gap:8px; margin-top:12px"><button class="btn primary" onclick="saveEdit('deposit','${item.id}')">Save</button><button class="btn" onclick="closeModal()">Cancel</button></div>`;
  }
  if (type === 'driver_deposit') {
    return `<h3>Edit Driver Deposit</h3><label>Deposit ID</label><input id="edit_id" value="${escapeHtml(item.id || '')}" disabled/><label>Driver</label><select id="edit_driver">${state.drivers.map(c => `<option value="${c.id}" ${c.id === item.driverId ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}</select><label>Amount</label><input id="edit_amount" type="number" value="${item.amount || 0}"/><label>Deposit Currency</label><select id="edit_depcurrency"><option ${item.depositCurrency === 'EGP' ? 'selected' : ''}>EGP</option><option ${item.depositCurrency === 'USD' ? 'selected' : ''}>USD</option><option ${item.depositCurrency === 'EUR' ? 'selected' : ''}>EUR</option></select><label>Exchange Rate</label><input id="edit_rate" type="number" value="${item.rate || 1}" step="0.0001"/><div style="display:flex; gap:8px; margin-top:12px"><button class="btn primary" onclick="saveEdit('driver_deposit','${item.id}')">Save</button><button class="btn" onclick="closeModal()">Cancel</button></div>`;
  }
  return `<div>Unsupported edit type</div>`;
}

function saveEdit(type, id) {
  if (type === 'customer') { const name = document.getElementById('edit_name').value.trim(); const contact = document.getElementById('edit_contact').value.trim(); const idx = state.customers.findIndex(x => x.id === id); if (idx > -1) { state.customers[idx].name = name; state.customers[idx].contact = contact; saveState(); closeModal(); } }
  if (type === 'shipment') { const ref = document.getElementById('edit_ref').value.trim(); const customerSelect = document.getElementById('edit_customer'); const customerIds = Array.from(customerSelect.selectedOptions).map(opt => opt.value); const origin = document.getElementById('edit_origin').value.trim(); const destination = document.getElementById('edit_destination').value.trim(); const bol = document.getElementById('edit_bol').value.trim(); const line = document.getElementById('edit_line').value.trim(); const containers = document.getElementById('edit_containers').value.trim(); const status = document.getElementById('edit_status').value; const idx = state.shipments.findIndex(x => x.id === id); if (idx > -1) { if (customerIds.length === 0) return alert('At least one customer required'); if (customerIds.length > 20) return alert('Maximum 20 customers per shipment'); state.shipments[idx].ref = ref; state.shipments[idx].customerIds = customerIds; state.shipments[idx].origin = origin; state.shipments[idx].destination = destination; state.shipments[idx].bol = bol; state.shipments[idx].shippingLine = line; state.shipments[idx].containers = containers; state.shipments[idx].status = status; saveState(); closeModal(); } }
  if (type === 'driver') { const name = document.getElementById('edit_name').value.trim(); const phone = document.getElementById('edit_phone').value.trim(); const cost = parseFloat(document.getElementById('edit_cost').value) || 0; const currency = document.getElementById('edit_currency').value; const idx = state.drivers.findIndex(x => x.id === id); if (idx > -1) { state.drivers[idx].name = name; state.drivers[idx].phone = phone; const prevDeposited = Number(state.drivers[idx].deposited || 0); state.drivers[idx].cost = cost; state.drivers[idx].currency = currency; state.drivers[idx].deposited = Math.min(prevDeposited, cost); saveState(); closeModal(); } }
  if (type === 'invoice') { const no = document.getElementById('edit_no').value.trim(); const customerId = document.getElementById('edit_customer').value; const amount = parseFloat(document.getElementById('edit_amount').value); const currency = document.getElementById('edit_currency').value; const idx = state.invoices.findIndex(x => x.id === id); if (idx > -1) { state.invoices[idx].no = no; state.invoices[idx].customerId = customerId; state.invoices[idx].amount = amount; state.invoices[idx].currency = currency; saveState(); closeModal(); } }
  if (type === 'clearance') { const customerId = document.getElementById('edit_customer').value; const cost = parseFloat(document.getElementById('edit_cost').value); const currency = document.getElementById('edit_currency').value; const idx = state.clearances.findIndex(x => x.id === id); if (idx > -1) { state.clearances[idx].customerId = customerId; state.clearances[idx].cost = cost; state.clearances[idx].currency = currency; state.clearances[idx].deposited = Math.min(Number(state.clearances[idx].deposited || 0), Number(cost)); saveState(); closeModal(); } }
  if (type === 'deposit') { const clearanceId = document.getElementById('edit_clearance').value; const amount = parseFloat(document.getElementById('edit_amount').value); const depCurrency = document.getElementById('edit_depcurrency').value; const rate = parseFloat(document.getElementById('edit_rate').value) || 1; const idx = state.deposits.findIndex(x => x.id === id); if (idx > -1) { const prev = state.deposits[idx]; const oldClear = state.clearances.find(c => c.id === prev.clearanceId); if (oldClear) { oldClear.deposited = Math.max(0, Number(oldClear.deposited || 0) - Number(prev.convertedAmount || 0)); } const newClear = state.clearances.find(c => c.id === clearanceId); if (!newClear) return alert('Clearance not found'); const newConverted = (depCurrency === newClear.currency) ? amount : amount * rate; state.deposits[idx].clearanceId = clearanceId; state.deposits[idx].amount = amount; state.deposits[idx].depositCurrency = depCurrency; state.deposits[idx].rate = rate; state.deposits[idx].convertedAmount = newConverted; state.deposits[idx].clearanceCurrency = newClear.currency; newClear.deposited = (Number(newClear.deposited || 0) + Number(newConverted)); saveState(); closeModal(); } }
  if (type === 'driver_deposit') { const driverId = document.getElementById('edit_driver').value; const amount = parseFloat(document.getElementById('edit_amount').value); const depCurrency = document.getElementById('edit_depcurrency').value; const rate = parseFloat(document.getElementById('edit_rate').value) || 1; const idx = state.driverDeposits.findIndex(x => x.id === id); if (idx > -1) { const prev = state.driverDeposits[idx]; const oldDrv = state.drivers.find(c => c.id === prev.driverId); if (oldDrv) { oldDrv.deposited = Math.max(0, Number(oldDrv.deposited || 0) - Number(prev.convertedAmount || 0)); } const newDrv = state.drivers.find(c => c.id === driverId); if (!newDrv) return alert('Driver not found'); const newConverted = (depCurrency === newDrv.currency) ? amount : amount * rate; state.driverDeposits[idx].driverId = driverId; state.driverDeposits[idx].amount = amount; state.driverDeposits[idx].depositCurrency = depCurrency; state.driverDeposits[idx].rate = rate; state.driverDeposits[idx].convertedAmount = newConverted; state.driverDeposits[idx].driverCurrency = newDrv.currency; newDrv.deposited = (Number(newDrv.deposited || 0) + Number(newConverted)); saveState(); closeModal(); } }
}

function deleteRecord(type, id) {
  if (!confirm('Delete this record?')) return;
  if (type === 'customer') {
    state.customers = state.customers.filter(x => x.id !== id); // also remove relations
    state.shipments = state.shipments.map(s => ({ ...s, customerIds: (s.customerIds || []).filter(cid => cid !== id) })).filter(s => s.customerIds.length > 0); // remove customer from shipments, and remove shipment if no customers left
    state.invoices = state.invoices.filter(i => i.customerId !== id); // remove clearances & related deposits
    const removedClearances = state.clearances.filter(c => c.customerId === id).map(c => c.id);
    state.deposits = state.deposits.filter(d => !removedClearances.includes(d.clearanceId));
    state.clearances = state.clearances.filter(c => c.customerId !== id);
    saveState();
  }
  if (type === 'shipment') { state.shipments = state.shipments.filter(x => x.id !== id); saveState(); }
  if (type === 'driver') { // remove driver and its deposits, revert deposited amounts
    const drv = state.drivers.find(d => d.id === id);
    const relDeps = state.driverDeposits.filter(dd => dd.driverId === id);
    // revert amounts from driver's deposited (not strictly necessary if deleting driver)
    relDeps.forEach(dep => { /* no-op */ });
    state.driverDeposits = state.driverDeposits.filter(dd => dd.driverId !== id);
    state.drivers = state.drivers.filter(x => x.id !== id); saveState();
  }
  if (type === 'invoice') { state.invoices = state.invoices.filter(x => x.id !== id); saveState(); }
  if (type === 'clearance') { // remove clearances and associated deposits
    state.deposits = state.deposits.filter(d => d.clearanceId !== id); state.clearances = state.clearances.filter(c => c.id !== id); saveState();
  }
  if (type === 'deposit') { // customs deposit deletion -> subtract convertedAmount from clearance
    const dep = state.deposits.find(d => d.id === id); if (dep) { const cl = state.clearances.find(c => c.id === dep.clearanceId); if (cl) { cl.deposited = Math.max(0, Number(cl.deposited || 0) - Number(dep.convertedAmount || 0)); } state.deposits = state.deposits.filter(d => d.id !== id); saveState(); }
  }
  if (type === 'driver_deposit') { const dep = state.driverDeposits.find(d => d.id === id); if (dep) { const dr = state.drivers.find(c => c.id === dep.driverId); if (dr) { dr.deposited = Math.max(0, Number(dr.deposited || 0) - Number(dep.convertedAmount || 0)); } state.driverDeposits = state.driverDeposits.filter(d => d.id !== id); saveState(); } }
}

function findByType(type, id) {
  if (type === 'customer') return state.customers.find(x => x.id === id);
  if (type === 'shipment') return state.shipments.find(x => x.id === id);
  if (type === 'driver') return state.drivers.find(x => x.id === id);
  if (type === 'invoice') return state.invoices.find(x => x.id === id);
  if (type === 'clearance') return state.clearances.find(x => x.id === id);
  if (type === 'deposit') return state.deposits.find(x => x.id === id);
  if (type === 'driver_deposit') return state.driverDeposits.find(x => x.id === id);
  return null;
}

function escapeHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

// ---------- Settings ----------
function renderSettings(root) { root.innerHTML = `<div class="card"><h2>Settings</h2><div class="hint">Manage users & reset data</div><label>Users</label><div id="usersList" class="muted"></div><div style="display:flex; gap:8px; margin-top:8px"><button class="btn" onclick="addUserPrompt()">Add User</button><button class="btn" onclick="resetUserPasswords()">Reset Passwords</button><button class="btn" onclick="resetUsers()">Reset Users</button><button class="btn" onclick="if(confirm('Clear all data? This cannot be undone.')){ state = Store.defaultData(); saveState(); }">Factory Reset</button></div></div>`; renderUsers(); }
function renderUsers() { const el = document.getElementById('usersList'); if (!el) return; el.innerHTML = state.users.map(u => `<div style="padding:8px 0">${u.username} — ${u.name} <button onclick="deleteUser('${u.id}')" style="margin-left:8px">Delete</button></div>`).join(''); }
function addUserPrompt() { const username = prompt('Username'); const password = prompt('Password'); const name = prompt('Name'); if (!username || !password) return alert('username & password required'); state.users.push({ id: uid('u'), username, password, name }); saveState(); }
function deleteUser(id) { state.users = state.users.filter(u => u.id !== id); saveState(); }
function resetUserPasswords() { if (confirm('Reset all user passwords to default?')) { state.users.forEach(u => u.password = 'Beacon2025'); saveState(); } }
function resetUsers() { if (confirm('Reset users to default? This will remove all added users and reset passwords.')) { state.users = Store.defaultData().users; saveState(); } }

// ---------- Init ----------
(function init() {
  // Migrate old shipments with customerId to customerIds
  state.shipments = state.shipments.map(s => {
    if (s.customerId && !s.customerIds) {
      s.customerIds = [s.customerId];
      delete s.customerId;
    }
    return s;
  });
  if (!state.session) openAuth(); else closeAuth(); renderNav(); renderCurrentView(); updateUserChip(); const modal = document.getElementById('editModal'); modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
})();