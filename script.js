/* ================================================
   GST Invoice Generator — script.js
   Application logic: init, UI, form handling,
   calculations, live preview, history, validation.

   PDF generation is in pdf.js.
   Static data (STATES, HSN_DATA etc.) is in data.js.
   Load order in index.html: data.js → script.js → pdf.js
   ================================================ */

/* ---- APP STATE ---- */
let items = [];
let logoBase64 = null;
let docType = 'tax';

/* ---- MODE ---- */

let currentMode = localStorage.getItem('bs_mode') || 'india';



function setMode(mode) {

  currentMode = mode;

  localStorage.setItem('bs_mode', mode);

  document.documentElement.setAttribute('data-mode', mode);



  // Update toggle buttons

  document.getElementById('mode-india').classList.toggle('active', mode === 'india');

  document.getElementById('mode-intl').classList.toggle('active', mode === 'intl');



  // Show/hide India-specific fields

  const indiaOnly = document.querySelectorAll('.india-only');

  const intlOnly = document.querySelectorAll('.intl-only');

  indiaOnly.forEach(el => el.style.display = mode === 'india' ? '' : 'none');

  intlOnly.forEach(el => el.style.display = mode === 'intl' ? '' : 'none');



  if (mode === 'intl') initIntlForm();
  updatePreview();

}

/* ================================================
   INTERNATIONAL FORM STATE & LOGIC
   ================================================ */
let intlItems = [];
let intlDocType = 'invoice';
let intlCurrencySymbol = '$';
let intlSellerCountry = null;

function initIntlForm() {
  // Populate country dropdowns
  ['intl-seller-country', 'intl-buyer-country'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = '<option value="">— Select Country —</option>';
    COUNTRIES.forEach(c => {
      sel.innerHTML += `<option value="${c.code}">${c.name}</option>`;
    });
  });

  // Populate currency dropdown
  const curSel = document.getElementById('intl-currency');
  if (curSel) {
    curSel.innerHTML = '';
    CURRENCIES.forEach(c => {
      curSel.innerHTML += `<option value="${c.code}">${c.code} (${c.symbol})</option>`;
    });
    curSel.value = 'USD';
    intlCurrencySymbol = '$';
  }

  // Set today's date
  const today = new Date().toISOString().split('T')[0];
  const dateEl = document.getElementById('intl-inv-date');
  if (dateEl && !dateEl.value) dateEl.value = today;

  // Auto-increment from history
  const hist = getHistory();
  if (hist.length > 0) {
    const lastNum = parseInt(hist[hist.length - 1].number) || 0;
    const numEl = document.getElementById('intl-inv-number');
    if (numEl && numEl.value === '001') {
      numEl.value = String(lastNum + 1).padStart(3, '0');
    }
  }

  // Seed first item
  if (intlItems.length === 0) addIntlItem();

  updateIntlSummary();

  // Check for saved intl profile
  checkIntlSavedProfile();
}

function setIntlDocType(type) {
  intlDocType = type;
  ['invoice', 'quote', 'receipt'].forEach(t => {
    document.getElementById('itog-' + t)?.classList.toggle('active', t === type);
  });
  updatePreview();
}

function updateIntlCurrency() {
  const sel = document.getElementById('intl-currency');
  const found = CURRENCIES.find(c => c.code === sel?.value);
  intlCurrencySymbol = found ? found.symbol : '$';
  renderIntlItems();
  updateIntlSummary();
  updatePreview();
}

function onIntlCountryChange(side) {
  const selId = `intl-${side}-country`;
  const labelId = `intl-${side}-tax-label`;
  const code = document.getElementById(selId)?.value;
  const country = COUNTRIES.find(c => c.code === code);
  if (!country) return;

  // Update tax label
  const labelEl = document.getElementById(labelId);
  if (labelEl) labelEl.textContent = country.taxLabel + (side === 'buyer' ? ' (optional)' : ' *');

  // If seller country changes, auto-set currency
  if (side === 'seller') {
    intlSellerCountry = country;
    const curSel = document.getElementById('intl-currency');
    const match = CURRENCIES.find(c => c.symbol === country.currency);
    if (match && curSel) {
      curSel.value = match.code;
      updateIntlCurrency();
    }
    // Update items table tax column header label
    const taxHeader = document.getElementById('intl-tax-col-header');
    if (taxHeader) taxHeader.textContent = country.taxName + ' %';
    // Update summary label
    const sumLabel = document.getElementById('intl-sum-tax-label');
    if (sumLabel) sumLabel.textContent = country.taxName;
  }

  updatePreview();
}

/* ---- Intl Items ---- */
function addIntlItem() {
  intlItems.push({ desc: '', qty: 1, unit: 'pcs', rate: 0, taxRate: 0 });
  renderIntlItems();
  updatePreview();
}

function removeIntlItem(idx) {
  if (intlItems.length === 1) return;
  intlItems.splice(idx, 1);
  renderIntlItems();
  updatePreview();
}

function updateIntlItemField(idx, field, value) {
  intlItems[idx][field] = ['qty', 'rate', 'taxRate'].includes(field)
    ? parseFloat(value) || 0
    : value;
  if (field !== 'desc' && field !== 'unit') renderIntlItems();
  updatePreview();
}

function renderIntlItems() {
  const tbody = document.getElementById('intl-items-body');
  if (!tbody) return;
  const sym = intlCurrencySymbol;
  tbody.innerHTML = '';

  intlItems.forEach((item, idx) => {
    const taxable = item.qty * item.rate;
    const tax = taxable * item.taxRate / 100;
    const total = taxable + tax;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <input type="text" value="${esc(item.desc)}" placeholder="Description"
          oninput="updateIntlItemField(${idx},'desc',this.value)"
          style="min-width:150px">
      </td>
      <td>
        <input type="number" value="${item.qty}" min="0" step="0.01"
          onchange="updateIntlItemField(${idx},'qty',this.value)"
          style="min-width:50px">
      </td>
      <td>
        <select onchange="updateIntlItemField(${idx},'unit',this.value)" style="min-width:55px">
          ${UNITS.map(u => `<option ${item.unit === u ? 'selected' : ''}>${u}</option>`).join('')}
        </select>
      </td>
      <td>
        <input type="number" value="${item.rate}" min="0" step="0.01"
          onchange="updateIntlItemField(${idx},'rate',this.value)"
          style="min-width:80px">
      </td>
      <td>
        <input type="number" value="${item.taxRate}" min="0" max="100" step="0.1"
          onchange="updateIntlItemField(${idx},'taxRate',this.value)"
          style="min-width:60px">
      </td>
      <td class="amount-cell">${sym}${fmtIntl(total)}</td>
      <td>
        <button class="btn btn-danger" onclick="removeIntlItem(${idx})">✕</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  updateIntlSummary();
}

function calcIntlTotals() {
  let subtotal = 0, totalTax = 0;
  intlItems.forEach(item => {
    const taxable = item.qty * item.rate;
    const tax = taxable * item.taxRate / 100;
    subtotal += taxable;
    totalTax += tax;
  });
  return { subtotal, totalTax, grandTotal: subtotal + totalTax };
}

function updateIntlSummary() {
  const t = calcIntlTotals();
  const sym = intlCurrencySymbol;
  const el = id => document.getElementById(id);
  if (el('intl-sum-subtotal')) el('intl-sum-subtotal').textContent = sym + fmtIntl(t.subtotal);
  if (el('intl-sum-tax')) el('intl-sum-tax').textContent = sym + fmtIntl(t.totalTax);
  if (el('intl-sum-total')) el('intl-sum-total').textContent = sym + fmtIntl(t.grandTotal);
}

/* ---- Intl data collector (used by preview + pdf later) ---- */
function collectIntlData() {
  const vv = id => document.getElementById(id)?.value || '';
  const sellerCountryCode = vv('intl-seller-country');
  const buyerCountryCode = vv('intl-buyer-country');
  const country = COUNTRIES.find(c => c.code === sellerCountryCode) || COUNTRIES[COUNTRIES.length - 1];

  return {
    mode: 'intl',
    docType: intlDocType,
    prefix: vv('intl-inv-prefix'),
    number: vv('intl-inv-number'),
    date: vv('intl-inv-date'),
    due: vv('intl-inv-due'),
    currency: intlCurrencySymbol,
    country,
    seller: {
      name: vv('intl-seller-name'),
      taxId: vv('intl-seller-tax'),
      addr1: vv('intl-seller-addr1'),
      addr2: vv('intl-seller-addr2'),
      city: vv('intl-seller-city'),
      region: vv('intl-seller-region'),
      zip: vv('intl-seller-zip'),
      phone: vv('intl-seller-phone'),
      email: vv('intl-seller-email'),
      web: vv('intl-seller-web'),
      country: COUNTRIES.find(c => c.code === sellerCountryCode)?.name || '',
    },
    buyer: {
      name: vv('intl-buyer-name'),
      taxId: vv('intl-buyer-tax'),
      addr1: vv('intl-buyer-addr1'),
      addr2: vv('intl-buyer-addr2'),
      city: vv('intl-buyer-city'),
      region: vv('intl-buyer-region'),
      zip: vv('intl-buyer-zip'),
      phone: vv('intl-buyer-phone'),
      email: vv('intl-buyer-email'),
      country: COUNTRIES.find(c => c.code === buyerCountryCode)?.name || '',
    },
    notes: vv('intl-inv-notes'),
    bank: vv('intl-inv-bank'),
    terms: vv('intl-inv-terms'),
    items: [...intlItems],
  };
}

/* ================================================
   INTL SELLER PROFILE (localStorage)
   ================================================ */
function saveIntlSellerProfile() {
  const name = document.getElementById('intl-seller-name')?.value || '';
  if (!name.trim()) {
    alert('Please enter your Business Name before saving profile.');
    return;
  }
  const profile = {
    name,
    country: document.getElementById('intl-seller-country')?.value || '',
    taxId: document.getElementById('intl-seller-tax')?.value || '',
    addr1: document.getElementById('intl-seller-addr1')?.value || '',
    addr2: document.getElementById('intl-seller-addr2')?.value || '',
    city: document.getElementById('intl-seller-city')?.value || '',
    region: document.getElementById('intl-seller-region')?.value || '',
    zip: document.getElementById('intl-seller-zip')?.value || '',
    phone: document.getElementById('intl-seller-phone')?.value || '',
    email: document.getElementById('intl-seller-email')?.value || '',
    web: document.getElementById('intl-seller-web')?.value || '',
    currency: document.getElementById('intl-currency')?.value || 'USD',
    logo: logoBase64 || null,
  };
  localStorage.setItem('bs_intl_seller', JSON.stringify(profile));
  alert('Profile saved! It will auto-load next time you switch to International mode.');
  checkIntlSavedProfile();
}

// function loadIntlSellerProfile() {
//   try {
//     const p = JSON.parse(localStorage.getItem('bs_intl_seller'));
//     if (!p) return;

//     const set = (id, val) => {
//       const el = document.getElementById(id);
//       if (el) el.value = val || '';
//     };

//     set('intl-seller-name', p.name);
//     set('intl-seller-country', p.country);
//     set('intl-seller-tax', p.taxId);
//     set('intl-seller-addr1', p.addr1);
//     set('intl-seller-addr2', p.addr2);
//     set('intl-seller-city', p.city);
//     set('intl-seller-region', p.region);
//     set('intl-seller-zip', p.zip);
//     set('intl-seller-phone', p.phone);
//     set('intl-seller-email', p.email);
//     set('intl-seller-web', p.web);
//     set('intl-currency', p.currency);

//     // Trigger country-dependent label updates
//     if (p.country) onIntlCountryChange('seller');

//     // Trigger currency update
//     updateIntlCurrency();

//     // Restore logo
//     if (p.logo) {
//       logoBase64 = p.logo;
//       // Update both logo display areas
//       const indiaDisplay = document.getElementById('logo-display');
//       const intlDisplay = document.getElementById('intl-logo-display');
//       const logoHtml = `<img src="${logoBase64}" class="logo-preview"><br>
//                         <span class="logo-upload-text" style="font-size:10px">Click to change</span>`;
//       if (indiaDisplay) indiaDisplay.innerHTML = logoHtml;
//       if (intlDisplay) intlDisplay.innerHTML = logoHtml;
//     }

//     document.getElementById('intl-profile-banner').style.display = 'none';
//     updatePreview();
//   } catch (e) {
//     console.error('Failed to load intl profile', e);
//   }
// }

function loadIntlSellerProfile() {
  try {
    const p = JSON.parse(localStorage.getItem('bs_intl_seller'));
    if (!p) return;

    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val || '';
    };

    set('intl-seller-name', p.name);
    set('intl-seller-addr1', p.addr1);
    set('intl-seller-addr2', p.addr2);
    set('intl-seller-city', p.city);
    set('intl-seller-region', p.region);
    set('intl-seller-zip', p.zip);
    set('intl-seller-phone', p.phone);
    set('intl-seller-email', p.email);
    set('intl-seller-web', p.web);

    // Set country BEFORE taxId so label updates first
    const countryEl = document.getElementById('intl-seller-country');
    if (countryEl && p.country) {
      countryEl.value = p.country;
      onIntlCountryChange('seller');  // updates tax label + currency
    }

    // Set taxId after country label is updated
    set('intl-seller-tax', p.taxId);

    // Set currency after country (may override country default)
    const curEl = document.getElementById('intl-currency');
    if (curEl && p.currency) {
      curEl.value = p.currency;
      updateIntlCurrency();
    }

    // Restore logo to intl display area only
    if (p.logo) {
      logoBase64 = p.logo;
      const intlDisplay = document.getElementById('intl-logo-display');
      const indiaDisplay = document.getElementById('logo-display');
      const logoHtml = `<img src="${logoBase64}" class="logo-preview"><br>
                        <span class="logo-upload-text" style="font-size:10px">Click to change</span>`;
      if (intlDisplay) intlDisplay.innerHTML = logoHtml;
      if (indiaDisplay) indiaDisplay.innerHTML = logoHtml;
    }

    document.getElementById('intl-profile-banner').style.display = 'none';
    updatePreview();

  } catch (e) {
    console.error('Failed to load intl profile:', e);
  }
}

function deleteIntlSavedProfile() {
  if (!confirm('Delete saved international profile?')) return;
  localStorage.removeItem('bs_intl_seller');
  document.getElementById('intl-profile-banner').style.display = 'none';
}

function checkIntlSavedProfile() {
  const banner = document.getElementById('intl-profile-banner');
  if (!banner) return;
  try {
    const p = JSON.parse(localStorage.getItem('bs_intl_seller'));
    if (p && p.name) {
      banner.innerHTML = `
        <span>💾 Saved profile found: <strong>${esc(p.name)}</strong></span>
        <div style="display:flex;gap:8px">
          <button class="btn btn-sm btn-success" onclick="loadIntlSellerProfile()">Load Profile</button>
          <button class="btn btn-sm btn-danger"  onclick="deleteIntlSavedProfile()">Delete</button>
        </div>`;
      banner.style.display = 'flex';
    } else {
      banner.style.display = 'none';
    }
  } catch (e) {
    banner.style.display = 'none';
  }
}

/* ================================================
   INTL INVOICE HISTORY (localStorage)
   Shares the same gst_history key but stores mode:'intl'
   so history tab shows both India + intl invoices together.
   ================================================ */
// function saveIntlToHistory() {
//   const d = collectIntlData();
//   const t = calcIntlTotals();
//   if (!d.seller.name.trim()) {
//     alert('Please fill Business Name before saving.');
//     return;
//   }
//   const history = getHistory();
//   history.push({
//     id: Date.now(),
//     mode: 'intl',
//     invNo: `${d.prefix}-${d.number}`,
//     number: d.number,
//     date: d.date,
//     buyer: d.buyer.name,
//     amount: t.grandTotal,
//     currency: d.currency,
//     snapshot: d,
//     totals: t,
//   });
//   localStorage.setItem('gst_history', JSON.stringify(history));
//   alert(`Invoice ${d.prefix}-${d.number} saved to history!`);
//   renderHistory();
// }

function saveIntlToHistory() {
  const d = collectIntlData();
  const t = calcIntlTotals();

  if (!d.seller.name.trim()) {
    alert('Please fill Business Name before saving.');
    return;
  }

  // Get the currency code (e.g. 'USD') from the dropdown to store alongside symbol
  const curEl = document.getElementById('intl-currency');
  const curCode = curEl ? curEl.value : 'USD';

  const history = getHistory();
  history.push({
    id: Date.now(),
    mode: 'intl',
    invNo: `${d.prefix}-${d.number}`,
    number: d.number,
    date: d.date,
    buyer: d.buyer.name,
    amount: t.grandTotal,
    currencyCode: curCode,          // e.g. 'USD'
    currency: d.currency,       // e.g. '$'
    snapshot: d,
    totals: t,
  });
  localStorage.setItem('gst_history', JSON.stringify(history));
  alert(`Invoice ${d.prefix}-${d.number} saved to history!`);
  renderHistory();
}

/* ================================================
   PATCH: renderHistory to handle intl entries
   Replaces the existing renderHistory() in script.js
   ================================================ */
// function renderHistory() {
//   const list = document.getElementById('history-list');
//   const history = getHistory();

//   if (!history.length) {
//     list.innerHTML = '<div class="history-empty">No saved invoices yet.<br>Generate and save an invoice to see it here.</div>';
//     return;
//   }

//   list.innerHTML = history.slice().reverse().map(h => {
//     const isIntl = h.mode === 'intl';
//     const sym = isIntl ? (h.currency || '$') : '₹';
//     const modeBadge = isIntl
//       ? `<span class="history-mode-badge intl-badge">🌍 Intl</span>`
//       : `<span class="history-mode-badge india-badge">🇮🇳 GST</span>`;
//     return `
//     <div class="history-item">
//       <div>
//         <div class="inv-no">${h.invNo} ${modeBadge}</div>
//         <div class="hi-meta">${fmtDate(h.date)} &middot; ${h.buyer || '—'}</div>
//       </div>
//       <div class="hi-right">
//         <div class="hi-amount">${sym}${fmtIntl(h.amount)}</div>
//         <div class="history-actions">
//           <button class="btn btn-sm btn-outline" onclick="loadInvoice(${h.id})">Load</button>
//           <button class="btn btn-sm btn-danger"  onclick="deleteInvoice(${h.id})">✕</button>
//         </div>
//       </div>
//     </div>`;
//   }).join('');
// }

function renderHistory() {
  const list = document.getElementById('history-list');
  const history = getHistory();

  if (!history.length) {
    list.innerHTML = '<div class="history-empty">No saved invoices yet.<br>Generate and save an invoice to see it here.</div>';
    return;
  }

  list.innerHTML = history.slice().reverse().map(h => {
    const isIntl = h.mode === 'intl';

    // For intl: use stored currency symbol, fallback chain to avoid ₹ bleed
    let sym = '₹';
    if (isIntl) {
      if (h.currency && h.currency !== '₹') {
        sym = h.currency;
      } else if (h.currencyCode) {
        const found = CURRENCIES.find(c => c.code === h.currencyCode);
        sym = found ? found.symbol : '$';
      } else {
        sym = '$';
      }
    }

    const modeBadge = isIntl
      ? `<span class="history-mode-badge intl-badge">🌍 Intl</span>`
      : `<span class="history-mode-badge india-badge">🇮🇳 GST</span>`;

    return `
    <div class="history-item">
      <div>
        <div class="inv-no">${h.invNo} ${modeBadge}</div>
        <div class="hi-meta">${fmtDate(h.date)} &middot; ${h.buyer || '—'}</div>
      </div>
      <div class="hi-right">
        <div class="hi-amount">${sym}${fmtIntl(h.amount)}</div>
        <div class="history-actions">
          <button class="btn btn-sm btn-outline" onclick="loadInvoice(${h.id})">Load</button>
          <button class="btn btn-sm btn-danger"  onclick="deleteInvoice(${h.id})">✕</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

/* ================================================
   PATCH: loadInvoice to handle intl entries
   Replaces the existing loadInvoice() in script.js
   ================================================ */
function loadInvoice(id) {
  const h = getHistory().find(x => x.id === id);
  if (!h) return;

  if (h.mode === 'intl') {
    // Switch to intl mode first
    setMode('intl');
    const d = h.snapshot;
    const set = (elId, val) => { const el = document.getElementById(elId); if (el) el.value = val || ''; };

    set('intl-inv-prefix', d.prefix);
    set('intl-inv-number', d.number);
    set('intl-inv-date', d.date);
    set('intl-inv-due', d.due || '');
    set('intl-seller-name', d.seller.name);
    set('intl-seller-tax', d.seller.taxId);
    set('intl-seller-addr1', d.seller.addr1);
    set('intl-seller-addr2', d.seller.addr2);
    set('intl-seller-city', d.seller.city);
    set('intl-seller-region', d.seller.region);
    set('intl-seller-zip', d.seller.zip);
    set('intl-seller-phone', d.seller.phone);
    set('intl-seller-email', d.seller.email);
    set('intl-seller-web', d.seller.web);
    set('intl-buyer-name', d.buyer.name);
    set('intl-buyer-tax', d.buyer.taxId);
    set('intl-buyer-addr1', d.buyer.addr1);
    set('intl-buyer-addr2', d.buyer.addr2);
    set('intl-buyer-city', d.buyer.city);
    set('intl-buyer-region', d.buyer.region);
    set('intl-buyer-zip', d.buyer.zip);
    set('intl-buyer-phone', d.buyer.phone);
    set('intl-buyer-email', d.buyer.email);
    set('intl-inv-notes', d.notes);
    set('intl-inv-bank', d.bank);
    set('intl-inv-terms', d.terms);

    // Restore country selects and trigger updates
    const sellerCountryEl = document.getElementById('intl-seller-country');
    if (sellerCountryEl && d.country?.code) {
      sellerCountryEl.value = d.country.code;
      onIntlCountryChange('seller');
    }
    const buyerCountryEl = document.getElementById('intl-buyer-country');
    if (buyerCountryEl && d.buyer.country) {
      const match = COUNTRIES.find(c => c.name === d.buyer.country);
      if (match) { buyerCountryEl.value = match.code; onIntlCountryChange('buyer'); }
    }

    // Restore currency
    const curMatch = CURRENCIES.find(c => c.symbol === d.currency);
    const curEl = document.getElementById('intl-currency');
    if (curEl && curMatch) { curEl.value = curMatch.code; updateIntlCurrency(); }

    // Restore doc type
    setIntlDocType(d.docType || 'invoice');

    // Restore items
    intlItems = (d.items || []).map(i => ({ ...i }));
    renderIntlItems();

  } else {
    // Original India load logic (unchanged)
    setMode('india');
    const d = h.snapshot;
    setDocType(d.docType);
    sv('inv-prefix', d.prefix);
    sv('inv-number', d.number);
    sv('inv-date', d.date);
    sv('inv-due', d.due || '');
    sv('pos-state', STATES.find(s => s.name === d.posState)?.code || '');
    document.getElementById('reverse-charge').checked = d.reverseCharge;
    sv('seller-name', d.seller.name);
    sv('seller-gstin', d.seller.gstin);
    sv('seller-address', d.seller.address);
    sv('seller-state', STATES.find(s => s.name === d.seller.state)?.code || '');
    sv('seller-phone', d.seller.phone);
    sv('seller-email', d.seller.email);
    sv('buyer-name', d.buyer.name);
    sv('buyer-gstin', d.buyer.gstin);
    sv('buyer-address', d.buyer.address);
    sv('buyer-state', STATES.find(s => s.name === d.buyer.state)?.code || '');
    sv('buyer-phone', d.buyer.phone);
    sv('inv-notes', d.notes);
    sv('inv-bank', d.bank);
    items = d.items.map(i => ({ ...i }));
    renderItems();
  }

  updatePreview();
  switchTab('generator');
}

/* ---- Number formatter for intl (no Indian grouping) ---- */
function fmtIntl(n) {
  return Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}



function getMode() { return currentMode; }

/* ---- INIT ---- */
function init() {
  // Populate all state dropdowns
  ['seller-state', 'buyer-state', 'pos-state'].forEach(id => {
    const sel = document.getElementById(id);
    sel.innerHTML = '<option value="">— Select State —</option>';
    STATES.forEach(s => {
      sel.innerHTML += `<option value="${s.code}">${s.name}</option>`;
    });
  });

  // Set today's date
  document.getElementById('inv-date').value = new Date().toISOString().split('T')[0];

  // Auto-increment invoice number from history
  const hist = getHistory();
  if (hist.length > 0) {
    const lastNum = parseInt(hist[hist.length - 1].number) || 0;
    document.getElementById('inv-number').value = String(lastNum + 1).padStart(3, '0');
  }

  // Check if saved profile exists and show load button
  checkSavedProfile();

  // Apply saved mode on load

  setMode(currentMode);

  // Add first empty item row
  addItem();

  // First render
  updatePreview();

  // Close HSN dropdown when clicking outside
  document.addEventListener('click', e => {
    if (!e.target.closest('.hsn-wrapper')) {
      document.querySelectorAll('.hsn-dropdown').forEach(d => d.style.display = 'none');
    }
  });
}

/* ================================================
   DOCUMENT TYPE
   ================================================ */
function setDocType(type) {
  docType = type;
  document.getElementById('tog-tax').classList.toggle('active', type === 'tax');
  document.getElementById('tog-bill').classList.toggle('active', type === 'bill');
  document.getElementById('gstin-field').style.display = type === 'tax' ? '' : 'none';
  updatePreview();
}

/* ================================================
   LOGO UPLOAD
   ================================================ */
function handleLogoUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    logoBase64 = ev.target.result;
    document.getElementById('logo-display').innerHTML =
      `<img src="${logoBase64}" class="logo-preview"><br>
       <span class="logo-upload-text" style="font-size:10px">Click to change</span>`;
    updatePreview();
  };
  reader.readAsDataURL(file);
}

/* ================================================
   GSTIN VALIDATION
   ================================================ */
const STATE_CODES = STATES.map(s => s.code);

function validateGSTIN(inputId, hintId) {
  const input = document.getElementById(inputId);
  const hint = document.getElementById(hintId);
  const val = input.value.toUpperCase().trim();
  input.value = val; // enforce uppercase

  // Empty — clear state
  if (!val) {
    input.className = '';
    hint.textContent = '';
    hint.className = 'field-hint';
    updatePreview();
    return;
  }

  // Length check
  if (val.length < 15) {
    setHint(input, hint, 'invalid', 'warn', `${val.length}/15 characters`);
    return;
  }

  // State code (first 2 digits)
  if (!STATE_CODES.includes(val.substring(0, 2))) {
    setHint(input, hint, 'invalid', 'error', '✗ Invalid state code (first 2 digits)');
    return;
  }

  // PAN format (positions 3–12): 5 letters, 4 digits, 1 letter
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(val.substring(2, 12))) {
    setHint(input, hint, 'invalid', 'error', '✗ Invalid PAN format in GSTIN');
    return;
  }

  // Position 14 must always be 'Z'
  if (val[13] !== 'Z') {
    setHint(input, hint, 'invalid', 'error', '✗ 14th character must be Z');
    return;
  }

  // Checksum (Luhn-style mod-36)
  if (!gstinChecksum(val)) {
    setHint(input, hint, 'invalid', 'error', '✗ Invalid checksum — check last character');
    return;
  }

  // All checks passed
  input.className = 'valid';
  hint.innerHTML = '✓ Valid format &nbsp;<a href="https://services.gst.gov.in/services/searchtp" target="_blank" style="color:var(--accent2);font-size:11px">Verify on GST Portal →</a>';
  hint.className = 'field-hint success';
  updatePreview();
}

function setHint(input, hint, inputClass, hintClass, message) {
  input.className = inputClass;
  hint.textContent = message;
  hint.className = `field-hint ${hintClass}`;
  updatePreview();
}

function gstinChecksum(gstin) {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const val = chars.indexOf(gstin[i]);
    const mul = (i % 2 === 0) ? val : val * 2;
    sum += Math.floor(mul / 36) + (mul % 36);
  }
  return chars[(36 - (sum % 36)) % 36] === gstin[14];
}

/* ================================================
   ITEMS MANAGEMENT
   ================================================ */
function addItem() {
  items.push({ desc: '', hsn: '', qty: 1, unit: 'pcs', rate: 0, gstRate: 18 });
  renderItems();
  updatePreview();
}

function removeItem(idx) {
  if (items.length === 1) return; // keep at least one row
  items.splice(idx, 1);
  renderItems();
  updatePreview();
}

function updateItemField(idx, field, value) {
  items[idx][field] = ['qty', 'rate', 'gstRate'].includes(field)
    ? parseFloat(value) || 0
    : value;
  // Only re-render table for numeric changes (to update amount column)
  if (field !== 'desc' && field !== 'hsn' && field !== 'unit') {
    renderItems();
  }
  updatePreview();
}

function renderItems() {
  const tbody = document.getElementById('items-body');
  tbody.innerHTML = '';

  items.forEach((item, idx) => {
    const taxable = item.qty * item.rate;
    const gst = taxable * item.gstRate / 100;
    const total = taxable + gst;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <input type="text" value="${esc(item.desc)}" placeholder="Description"
          oninput="updateItemField(${idx},'desc',this.value)"
          style="min-width:140px">
      </td>
      <td>
        <div class="hsn-wrapper">
          <input type="text" value="${esc(item.hsn)}" placeholder="HSN/SAC"
            oninput="updateItemField(${idx},'hsn',this.value);showHSN(this,${idx})"
            onfocus="showHSN(this,${idx})"
            style="min-width:80px">
          <div class="hsn-dropdown" id="hsn-drop-${idx}" style="display:none"></div>
        </div>
      </td>
      <td>
        <input type="number" value="${item.qty}" min="0" step="0.01"
          onchange="updateItemField(${idx},'qty',this.value)"
          style="min-width:50px">
      </td>
      <td>
        <select onchange="updateItemField(${idx},'unit',this.value)" style="min-width:55px">
          ${UNITS.map(u => `<option ${item.unit === u ? 'selected' : ''}>${u}</option>`).join('')}
        </select>
      </td>
      <td>
        <input type="number" value="${item.rate}" min="0" step="0.01"
          onchange="updateItemField(${idx},'rate',this.value)"
          style="min-width:75px">
      </td>
      <td>
        <select onchange="updateItemField(${idx},'gstRate',this.value)" style="min-width:65px">
          ${GST_RATES.map(r => `<option value="${r}" ${item.gstRate == r ? 'selected' : ''}>${r}%</option>`).join('')}
        </select>
      </td>
      <td class="amount-cell">₹${fmt(total)}</td>
      <td>
        <button class="btn btn-danger" onclick="removeItem(${idx})">✕</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/* ================================================
   HSN AUTOCOMPLETE
   ================================================ */
function showHSN(input, idx) {
  const q = input.value.toLowerCase();
  const drop = document.getElementById(`hsn-drop-${idx}`);

  const matches = HSN_DATA
    .filter(h => h.code.includes(q) || h.desc.toLowerCase().includes(q))
    .slice(0, 8);

  if (!q || !matches.length) { drop.style.display = 'none'; return; }

  drop.innerHTML = matches.map(h =>
    `<div class="hsn-option" onmousedown="selectHSN(${idx},'${h.code}')">
      <span class="hsn-code">${h.code}</span>${h.desc}
    </div>`
  ).join('');
  drop.style.display = 'block';
}

function selectHSN(idx, code) {
  items[idx].hsn = code;
  renderItems();
  updatePreview();
  document.querySelectorAll('.hsn-dropdown').forEach(d => d.style.display = 'none');
}

/* ================================================
   CALCULATIONS
   ================================================ */
function calcTotals() {
  const sellerState = document.getElementById('seller-state').value;
  const posState = document.getElementById('pos-state').value;
  const isInterstate = sellerState && posState && sellerState !== posState;

  let subtotal = 0, totalCGST = 0, totalSGST = 0, totalIGST = 0;

  items.forEach(item => {
    const taxable = item.qty * item.rate;
    const gst = taxable * item.gstRate / 100;
    subtotal += taxable;
    if (isInterstate) {
      totalIGST += gst;
    } else {
      totalCGST += gst / 2;
      totalSGST += gst / 2;
    }
  });

  return {
    subtotal,
    totalCGST,
    totalSGST,
    totalIGST,
    grandTotal: subtotal + totalCGST + totalSGST + totalIGST,
    isInterstate,
  };
}

/* ================================================
   LIVE PREVIEW
   ================================================ */
// function updatePreview() {
//   const t = calcTotals();

//   // Update sidebar summary
//   document.getElementById('sum-subtotal').textContent = '₹' + fmt(t.subtotal);
//   document.getElementById('sum-cgst').textContent = '₹' + fmt(t.totalCGST);
//   document.getElementById('sum-sgst').textContent = '₹' + fmt(t.totalSGST);
//   document.getElementById('sum-igst').textContent = '₹' + fmt(t.totalIGST);
//   document.getElementById('sum-total').textContent = '₹' + fmt(t.grandTotal);

//   document.getElementById('cgst-row').style.display = t.isInterstate ? 'none' : '';
//   document.getElementById('sgst-row').style.display = t.isInterstate ? 'none' : '';
//   document.getElementById('igst-row').style.display = t.isInterstate ? '' : 'none';
//   document.getElementById('tax-type-badge').textContent = t.isInterstate ? 'IGST' : 'CGST+SGST';

//   // Render preview pane
//   document.getElementById('invoice-preview').innerHTML = buildPreviewHTML(collectData(), t);
// }

function updatePreview() {
  if (currentMode === 'intl') {
    const t = calcIntlTotals();
    updateIntlSummary();
    document.getElementById('invoice-preview').innerHTML = buildIntlPreviewHTML(collectIntlData(), t);
  } else {
    const t = calcTotals();
    document.getElementById('sum-subtotal').textContent = '₹' + fmt(t.subtotal);
    document.getElementById('sum-cgst').textContent = '₹' + fmt(t.totalCGST);
    document.getElementById('sum-sgst').textContent = '₹' + fmt(t.totalSGST);
    document.getElementById('sum-igst').textContent = '₹' + fmt(t.totalIGST);
    document.getElementById('sum-total').textContent = '₹' + fmt(t.grandTotal);
    document.getElementById('cgst-row').style.display = t.isInterstate ? 'none' : '';
    document.getElementById('sgst-row').style.display = t.isInterstate ? 'none' : '';
    document.getElementById('igst-row').style.display = t.isInterstate ? '' : 'none';
    document.getElementById('tax-type-badge').textContent = t.isInterstate ? 'IGST' : 'CGST+SGST';
    document.getElementById('invoice-preview').innerHTML = buildPreviewHTML(collectData(), t);
  }
}

function collectData() {
  return {
    docType,
    prefix: v('inv-prefix'),
    number: v('inv-number'),
    date: v('inv-date'),
    due: v('inv-due'),
    posState: stateName(v('pos-state')),
    reverseCharge: document.getElementById('reverse-charge').checked,
    seller: {
      name: v('seller-name'),
      gstin: v('seller-gstin'),
      address: v('seller-address'),
      state: stateName(v('seller-state')),
      phone: v('seller-phone'),
      email: v('seller-email'),
    },
    buyer: {
      name: v('buyer-name'),
      gstin: v('buyer-gstin'),
      address: v('buyer-address'),
      state: stateName(v('buyer-state')),
      phone: v('buyer-phone'),
    },
    notes: v('inv-notes'),
    bank: v('inv-bank'),
    items: [...items],
  };
}

function buildPreviewHTML(d, t) {
  const invNo = `${d.prefix}-${d.number}`;

  const logoHtml = logoBase64
    ? `<img src="${logoBase64}" class="inv-logo-img">`
    : `<div class="inv-logo-placeholder">${esc(d.seller.name || 'Your Business')}</div>`;

  const taxHeaders = t.isInterstate
    ? `<th class="num">IGST%</th><th class="num">IGST</th>`
    : `<th class="num">CGST%</th><th class="num">CGST</th>
       <th class="num">SGST%</th><th class="num">SGST</th>`;

  const itemRows = d.items.map((item, i) => {
    const taxable = item.qty * item.rate;
    const gst = taxable * item.gstRate / 100;
    const taxCols = t.isInterstate
      ? `<td class="num">${item.gstRate}%</td><td class="num">₹${fmt(gst)}</td>`
      : `<td class="num">${item.gstRate / 2}%</td><td class="num">₹${fmt(gst / 2)}</td>
         <td class="num">${item.gstRate / 2}%</td><td class="num">₹${fmt(gst / 2)}</td>`;
    return `
      <tr>
        <td>${i + 1}</td>
        <td>${esc(item.desc) || '—'}</td>
        <td><span style="font-family:'DM Mono',monospace;font-size:10px;background:#f3f4f6;padding:1px 4px;border-radius:3px">${esc(item.hsn) || '—'}</span></td>
        <td class="num">${item.qty}</td>
        <td>${item.unit}</td>
        <td class="num">₹${fmt(item.rate)}</td>
        ${taxCols}
        <td class="num" style="font-weight:700">₹${fmt(taxable + gst)}</td>
      </tr>`;
  }).join('');

  const taxSummaryRows = t.isInterstate
    ? `<div class="inv-tax-row"><span>Taxable Value</span><span class="tval">₹${fmt(t.subtotal)}</span></div>
       <div class="inv-tax-row"><span>IGST</span><span class="tval">₹${fmt(t.totalIGST)}</span></div>`
    : `<div class="inv-tax-row"><span>Taxable Value</span><span class="tval">₹${fmt(t.subtotal)}</span></div>
       <div class="inv-tax-row"><span>CGST</span><span class="tval">₹${fmt(t.totalCGST)}</span></div>
       <div class="inv-tax-row"><span>SGST</span><span class="tval">₹${fmt(t.totalSGST)}</span></div>`;

  return `
  <div class="inv-header">
    <div>${logoHtml}</div>
    <div class="inv-title-area">
      <div class="inv-title">${d.docType === 'tax' ? 'TAX INVOICE' : 'BILL OF SUPPLY'}</div>
      <div class="inv-subtitle">
        ${invNo}
        ${d.reverseCharge ? '<span class="inv-rc-badge">Reverse Charge</span>' : ''}
      </div>
    </div>
  </div>

  <div class="inv-meta">
    <div class="inv-meta-item">
      <div class="mlabel">Invoice No.</div>
      <div class="mvalue">${invNo}</div>
    </div>
    <div class="inv-meta-item">
      <div class="mlabel">Date</div>
      <div class="mvalue">${fmtDate(d.date)}</div>
    </div>
    <div class="inv-meta-item">
      <div class="mlabel">Due Date</div>
      <div class="mvalue">${d.due ? fmtDate(d.due) : '—'}</div>
    </div>
    <div class="inv-meta-item">
      <div class="mlabel">Place of Supply</div>
      <div class="mvalue">${d.posState || '—'}</div>
    </div>
  </div>

  <div class="inv-parties">
    <div class="inv-party">
      <div class="party-label">From (Seller)</div>
      <div class="party-name">${esc(d.seller.name) || 'Your Business Name'}</div>
      ${d.seller.gstin ? `<div><span class="party-gstin">GSTIN: ${d.seller.gstin}</span></div>` : ''}
      <div class="party-addr">${(d.seller.address || '').replace(/\n/g, '<br>')}</div>
      ${d.seller.state ? `<div class="party-addr">${d.seller.state}</div>` : ''}
      ${d.seller.phone ? `<div class="party-addr">📞 ${d.seller.phone}</div>` : ''}
      ${d.seller.email ? `<div class="party-addr">✉ ${d.seller.email}</div>` : ''}
    </div>
    <div class="inv-party">
      <div class="party-label">To (Buyer)</div>
      <div class="party-name">${esc(d.buyer.name) || 'Buyer Name'}</div>
      ${d.buyer.gstin ? `<div><span class="party-gstin">GSTIN: ${d.buyer.gstin}</span></div>` : ''}
      <div class="party-addr">${(d.buyer.address || '').replace(/\n/g, '<br>')}</div>
      ${d.buyer.state ? `<div class="party-addr">${d.buyer.state}</div>` : ''}
      ${d.buyer.phone ? `<div class="party-addr">📞 ${d.buyer.phone}</div>` : ''}
    </div>
  </div>

  <div class="inv-items-wrap">
    <table>
      <thead>
        <tr>
          <th>#</th><th>Description</th><th>HSN/SAC</th>
          <th class="num">Qty</th><th>Unit</th><th class="num">Rate</th>
          ${taxHeaders}
          <th class="num">Amount</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>
  </div>

  <div class="inv-tax-summary">
    ${taxSummaryRows}
    <div class="inv-tax-row total-row">
      <span>Grand Total</span>
      <span class="tval">₹${fmt(t.grandTotal)}</span>
    </div>
  </div>

  <div class="inv-words">
    Amount in Words: <strong>${amountInWords(t.grandTotal)}</strong>
  </div>

  ${d.bank ? `<div style="margin:0 28px 14px;font-size:11px;color:var(--muted)"><strong>Bank Details:</strong> ${esc(d.bank)}</div>` : ''}
  ${d.notes ? `<div style="margin:0 28px 14px;font-size:11px;color:var(--muted)"><strong>Notes:</strong> ${esc(d.notes)}</div>` : ''}

  <div class="inv-footer">
    <div class="disclaimer">
      Generated by BazaarSathi.in<br>
      Computer generated invoice.
    </div>
    <div class="sig-block">
      <div class="sig-label">For ${esc(d.seller.name || 'Your Business')}</div>
      <div style="height:34px"></div>
      <div class="sig-line"></div>
      <div class="sig-label">Authorised Signatory</div>
    </div>
  </div>`;
}

function buildIntlPreviewHTML(d, t) {
  const invNo = `${d.prefix}-${d.number}`;
  const sym = d.currency || '$';
  const country = d.country || {};

  const docLabel = d.docType === 'quote' ? 'QUOTATION'
    : d.docType === 'receipt' ? 'RECEIPT'
      : 'INVOICE';

  const logoHtml = logoBase64
    ? `<img src="${logoBase64}" class="inv-logo-img">`
    : `<div class="inv-logo-placeholder">${esc(d.seller.name || 'Your Business')}</div>`;

  // Seller address block
  function formatIntlAddress(p) {
    return [p.addr1, p.addr2, p.city, p.region, p.zip, p.country]
      .filter(Boolean).join(', ');
  }

  // Items rows
  const itemRows = d.items.map((item, i) => {
    const taxable = item.qty * item.rate;
    const tax = taxable * item.taxRate / 100;
    const total = taxable + tax;
    return `
      <tr>
        <td>${i + 1}</td>
        <td>${esc(item.desc) || '—'}</td>
        <td class="num">${item.qty}</td>
        <td>${item.unit}</td>
        <td class="num">${sym}${fmtIntl(item.rate)}</td>
        <td class="num">${item.taxRate}%</td>
        <td class="num">${sym}${fmtIntl(tax)}</td>
        <td class="num" style="font-weight:700">${sym}${fmtIntl(total)}</td>
      </tr>`;
  }).join('');

  return `
  <div class="inv-header">
    <div>${logoHtml}</div>
    <div class="inv-title-area">
      <div class="inv-title">${docLabel}</div>
      <div class="inv-subtitle">${invNo}</div>
    </div>
  </div>

  <div class="inv-meta" style="grid-template-columns:repeat(4,1fr)">
    <div class="inv-meta-item">
      <div class="mlabel">Invoice No.</div>
      <div class="mvalue">${invNo}</div>
    </div>
    <div class="inv-meta-item">
      <div class="mlabel">Date</div>
      <div class="mvalue">${fmtDate(d.date)}</div>
    </div>
    <div class="inv-meta-item">
      <div class="mlabel">Due Date</div>
      <div class="mvalue">${d.due ? fmtDate(d.due) : '—'}</div>
    </div>
    <div class="inv-meta-item">
      <div class="mlabel">Currency</div>
      <div class="mvalue">${sym}</div>
    </div>
  </div>

  <div class="inv-parties">
    <div class="inv-party">
      <div class="party-label">From (Seller)</div>
      <div class="party-name">${esc(d.seller.name) || 'Your Business'}</div>
      ${d.seller.taxId
      ? `<div><span class="party-gstin">${country.taxLabel || 'Tax ID'}: ${esc(d.seller.taxId)}</span></div>`
      : ''}
      <div class="party-addr">${formatIntlAddress(d.seller)}</div>
      ${d.seller.phone ? `<div class="party-addr">📞 ${d.seller.phone}</div>` : ''}
      ${d.seller.email ? `<div class="party-addr">✉ ${d.seller.email}</div>` : ''}
      ${d.seller.web ? `<div class="party-addr">🌐 ${d.seller.web}</div>` : ''}
    </div>
    <div class="inv-party">
      <div class="party-label">To (Buyer)</div>
      <div class="party-name">${esc(d.buyer.name) || 'Client Name'}</div>
      ${d.buyer.taxId
      ? `<div><span class="party-gstin">Tax ID: ${esc(d.buyer.taxId)}</span></div>`
      : ''}
      <div class="party-addr">${formatIntlAddress(d.buyer)}</div>
      ${d.buyer.phone ? `<div class="party-addr">📞 ${d.buyer.phone}</div>` : ''}
      ${d.buyer.email ? `<div class="party-addr">✉ ${d.buyer.email}</div>` : ''}
    </div>
  </div>

  <div class="inv-items-wrap">
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Description</th>
          <th class="num">Qty</th>
          <th>Unit</th>
          <th class="num">Rate</th>
          <th class="num">${country.taxName || 'Tax'} %</th>
          <th class="num">${country.taxName || 'Tax'}</th>
          <th class="num">Amount</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>
  </div>

  <div class="inv-tax-summary">
    <div class="inv-tax-row">
      <span>Subtotal</span>
      <span class="tval">${sym}${fmtIntl(t.subtotal)}</span>
    </div>
    <div class="inv-tax-row">
      <span>${country.taxName || 'Tax'}</span>
      <span class="tval">${sym}${fmtIntl(t.totalTax)}</span>
    </div>
    <div class="inv-tax-row total-row">
      <span>Total</span>
      <span class="tval">${sym}${fmtIntl(t.grandTotal)}</span>
    </div>
  </div>

  ${d.bank ? `<div style="margin:0 28px 14px;font-size:11px;color:var(--muted)"><strong>Payment Details:</strong> ${esc(d.bank)}</div>` : ''}
  ${d.notes ? `<div style="margin:0 28px 14px;font-size:11px;color:var(--muted)"><strong>Notes:</strong> ${esc(d.notes)}</div>` : ''}
  ${d.terms ? `<div style="margin:0 28px 14px;font-size:11px;color:var(--muted)"><strong>Terms:</strong> ${esc(d.terms)}</div>` : ''}

  <div class="inv-footer">
    <div class="disclaimer">
      Generated by BazaarSathi.in<br>
      Computer generated ${docLabel.toLowerCase()}.
    </div>
    <div class="sig-block">
      <div class="sig-label">For ${esc(d.seller.name || 'Your Business')}</div>
      <div style="height:34px"></div>
      <div class="sig-line"></div>
      <div class="sig-label">Authorised Signatory</div>
    </div>
  </div>`;
}

/* ================================================
   INVOICE HISTORY (localStorage)
   ================================================ */
function getHistory() {
  try { return JSON.parse(localStorage.getItem('gst_history') || '[]'); }
  catch (e) { return []; }
}

function saveToHistory() {
  const d = collectData();
  const t = calcTotals();
  const history = getHistory();
  history.push({
    id: Date.now(),
    invNo: `${d.prefix}-${d.number}`,
    number: d.number,
    date: d.date,
    buyer: d.buyer.name,
    amount: t.grandTotal,
    snapshot: d,
    totals: t,
  });
  localStorage.setItem('gst_history', JSON.stringify(history));
  alert(`Invoice ${d.prefix}-${d.number} saved to history!`);
  renderHistory();
}

// function renderHistory() {
//   const list = document.getElementById('history-list');
//   const history = getHistory();

//   if (!history.length) {
//     list.innerHTML = '<div class="history-empty">No saved invoices yet.<br>Generate and save an invoice to see it here.</div>';
//     return;
//   }

//   list.innerHTML = history.slice().reverse().map(h => `
//     <div class="history-item">
//       <div>
//         <div class="inv-no">${h.invNo}</div>
//         <div class="hi-meta">${fmtDate(h.date)} &middot; ${h.buyer || '—'}</div>
//       </div>
//       <div class="hi-right">
//         <div class="hi-amount">₹${fmt(h.amount)}</div>
//         <div class="history-actions">
//           <button class="btn btn-sm btn-outline" onclick="loadInvoice(${h.id})">Load</button>
//           <button class="btn btn-sm btn-danger"  onclick="deleteInvoice(${h.id})">✕</button>
//         </div>
//       </div>
//     </div>`
//   ).join('');
// }

function renderHistory() {
  const list = document.getElementById('history-list');
  const history = getHistory();

  if (!history.length) {
    list.innerHTML = '<div class="history-empty">No saved invoices yet.<br>Generate and save an invoice to see it here.</div>';
    return;
  }

  list.innerHTML = history.slice().reverse().map(h => {
    const isIntl = h.mode === 'intl';

    let sym = '₹';
    if (isIntl) {
      if (h.currencyCode) {
        const found = CURRENCIES.find(c => c.code === h.currencyCode);
        sym = found ? found.symbol : (h.currency && h.currency !== '₹' ? h.currency : '$');
      } else if (h.currency && h.currency !== '₹') {
        sym = h.currency;
      } else {
        sym = '$';
      }
    }

    const modeBadge = isIntl
      ? `<span class="history-mode-badge intl-badge">🌍 Intl</span>`
      : `<span class="history-mode-badge india-badge">🇮🇳 GST</span>`;

    const amountStr = isIntl ? fmtIntl(h.amount) : fmt(h.amount);

    return `
    <div class="history-item">
      <div>
        <div class="inv-no">${h.invNo} ${modeBadge}</div>
        <div class="hi-meta">${fmtDate(h.date)} &middot; ${h.buyer || '—'}</div>
      </div>
      <div class="hi-right">
        <div class="hi-amount">${sym}${amountStr}</div>
        <div class="history-actions">
          <button class="btn btn-sm btn-outline" onclick="loadInvoice(${h.id})">Load</button>
          <button class="btn btn-sm btn-danger"  onclick="deleteInvoice(${h.id})">✕</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

// function loadInvoice(id) {
//   const h = getHistory().find(x => x.id === id);
//   if (!h) return;
//   const d = h.snapshot;

//   setDocType(d.docType);
//   sv('inv-prefix', d.prefix);
//   sv('inv-number', d.number);
//   sv('inv-date', d.date);
//   sv('inv-due', d.due || '');
//   sv('pos-state', STATES.find(s => s.name === d.posState)?.code || '');
//   document.getElementById('reverse-charge').checked = d.reverseCharge;

//   sv('seller-name', d.seller.name);
//   sv('seller-gstin', d.seller.gstin);
//   sv('seller-address', d.seller.address);
//   sv('seller-state', STATES.find(s => s.name === d.seller.state)?.code || '');
//   sv('seller-phone', d.seller.phone);
//   sv('seller-email', d.seller.email);

//   sv('buyer-name', d.buyer.name);
//   sv('buyer-gstin', d.buyer.gstin);
//   sv('buyer-address', d.buyer.address);
//   sv('buyer-state', STATES.find(s => s.name === d.buyer.state)?.code || '');
//   sv('buyer-phone', d.buyer.phone);

//   sv('inv-notes', d.notes);
//   sv('inv-bank', d.bank);

//   items = d.items.map(i => ({ ...i }));
//   renderItems();
//   updatePreview();
//   switchTab('generator');
// }

function loadInvoice(id) {
  const h = getHistory().find(x => x.id === id);
  if (!h) return;

  if (h.mode === 'intl') {
    setMode('intl');
    const d = h.snapshot;
    const set = (elId, val) => {
      const el = document.getElementById(elId);
      if (el) el.value = val || '';
    };

    set('intl-inv-prefix', d.prefix);
    set('intl-inv-number', d.number);
    set('intl-inv-date', d.date);
    set('intl-inv-due', d.due || '');

    // Country first so labels update before taxId fills
    const sellerCountryEl = document.getElementById('intl-seller-country');
    if (sellerCountryEl && d.country?.code) {
      sellerCountryEl.value = d.country.code;
      onIntlCountryChange('seller');
    }
    const buyerCountryEl = document.getElementById('intl-buyer-country');
    if (buyerCountryEl && d.buyer?.country) {
      const match = COUNTRIES.find(c => c.name === d.buyer.country);
      if (match) { buyerCountryEl.value = match.code; onIntlCountryChange('buyer'); }
    }

    set('intl-seller-name', d.seller.name);
    set('intl-seller-tax', d.seller.taxId);
    set('intl-seller-addr1', d.seller.addr1);
    set('intl-seller-addr2', d.seller.addr2);
    set('intl-seller-city', d.seller.city);
    set('intl-seller-region', d.seller.region);
    set('intl-seller-zip', d.seller.zip);
    set('intl-seller-phone', d.seller.phone);
    set('intl-seller-email', d.seller.email);
    set('intl-seller-web', d.seller.web);

    set('intl-buyer-name', d.buyer.name);
    set('intl-buyer-tax', d.buyer.taxId);
    set('intl-buyer-addr1', d.buyer.addr1);
    set('intl-buyer-addr2', d.buyer.addr2);
    set('intl-buyer-city', d.buyer.city);
    set('intl-buyer-region', d.buyer.region);
    set('intl-buyer-zip', d.buyer.zip);
    set('intl-buyer-phone', d.buyer.phone);
    set('intl-buyer-email', d.buyer.email);

    set('intl-inv-notes', d.notes);
    set('intl-inv-bank', d.bank);
    set('intl-inv-terms', d.terms);

    // Currency
    const curEl = document.getElementById('intl-currency');
    if (curEl && h.currencyCode) {
      curEl.value = h.currencyCode;
      updateIntlCurrency();
    }

    // Doc type
    setIntlDocType(d.docType || 'invoice');

    // Items
    intlItems = (d.items || []).map(i => ({ ...i }));
    renderIntlItems();

  } else {
    // India
    setMode('india');
    const d = h.snapshot;
    setDocType(d.docType);
    sv('inv-prefix', d.prefix);
    sv('inv-number', d.number);
    sv('inv-date', d.date);
    sv('inv-due', d.due || '');
    sv('pos-state', STATES.find(s => s.name === d.posState)?.code || '');
    document.getElementById('reverse-charge').checked = d.reverseCharge;
    sv('seller-name', d.seller.name);
    sv('seller-gstin', d.seller.gstin);
    sv('seller-address', d.seller.address);
    sv('seller-state', STATES.find(s => s.name === d.seller.state)?.code || '');
    sv('seller-phone', d.seller.phone);
    sv('seller-email', d.seller.email);
    sv('buyer-name', d.buyer.name);
    sv('buyer-gstin', d.buyer.gstin);
    sv('buyer-address', d.buyer.address);
    sv('buyer-state', STATES.find(s => s.name === d.buyer.state)?.code || '');
    sv('buyer-phone', d.buyer.phone);
    sv('inv-notes', d.notes);
    sv('inv-bank', d.bank);
    items = d.items.map(i => ({ ...i }));
    renderItems();
  }

  updatePreview();
  switchTab('generator');
}

function deleteInvoice(id) {
  if (!confirm('Delete this invoice?')) return;
  localStorage.setItem('gst_history', JSON.stringify(getHistory().filter(h => h.id !== id)));
  renderHistory();
}

function clearHistory() {
  if (!confirm('Clear ALL saved invoices? This cannot be undone.')) return;
  localStorage.removeItem('gst_history');
  renderHistory();
}

/* ================================================
   SELLER PROFILE (localStorage)
   ================================================ */
function saveSellerProfile() {
  const name = v('seller-name');
  if (!name) { alert('Please enter your Business Name before saving profile.'); return; }
  localStorage.setItem('gst_seller', JSON.stringify({
    name,
    gstin: v('seller-gstin'),
    address: v('seller-address'),
    state: v('seller-state'),
    phone: v('seller-phone'),
    email: v('seller-email'),
    logo: logoBase64,
  }));
  alert('Profile saved! Use "Load Profile" button next time to fill your details.');
  checkSavedProfile();
}

/** Show a banner if a saved profile exists — user can choose to load it or ignore */
function checkSavedProfile() {
  const banner = document.getElementById('profile-banner');
  if (!banner) return;
  try {
    const p = JSON.parse(localStorage.getItem('gst_seller'));
    if (p && p.name) {
      banner.innerHTML = `
        <span>💾 Saved profile found: <strong>${esc(p.name)}</strong></span>
        <div style="display:flex;gap:8px">
          <button class="btn btn-sm btn-success" onclick="loadSellerProfile()">Load Profile</button>
          <button class="btn btn-sm btn-danger" onclick="deleteSavedProfile()">Delete</button>
        </div>`;
      banner.style.display = 'flex';
    } else {
      banner.style.display = 'none';
    }
  } catch (e) { banner.style.display = 'none'; }
}

function loadSellerProfile() {
  try {
    const p = JSON.parse(localStorage.getItem('gst_seller'));
    if (!p) return;
    sv('seller-name', p.name);
    sv('seller-gstin', p.gstin);
    sv('seller-address', p.address);
    sv('seller-state', p.state);
    sv('seller-phone', p.phone);
    sv('seller-email', p.email);
    if (p.logo) {
      logoBase64 = p.logo;
      document.getElementById('logo-display').innerHTML =
        `<img src="${logoBase64}" class="logo-preview"><br>
         <span class="logo-upload-text" style="font-size:10px">Click to change</span>`;
    }
    if (p.gstin) validateGSTIN('seller-gstin', 'seller-gstin-hint');
    updatePreview();
    document.getElementById('profile-banner').style.display = 'none';
  } catch (e) { }
}

function deleteSavedProfile() {
  if (!confirm('Delete saved profile?')) return;
  localStorage.removeItem('gst_seller');
  document.getElementById('profile-banner').style.display = 'none';
}

/* ================================================
   RESET / NEW INVOICE
   ================================================ */
// function resetForm() {
//   if (!confirm('Start a new invoice? Current data will be cleared.')) return;
//   const hist = getHistory();
//   const nextNum = hist.length > 0 ? (parseInt(hist[hist.length - 1].number) || 0) + 1 : 1;
//   sv('inv-number', String(nextNum).padStart(3, '0'));
//   sv('inv-date', new Date().toISOString().split('T')[0]);
//   sv('inv-due', '');
//   sv('pos-state', '');
//   document.getElementById('reverse-charge').checked = false;
//   ['buyer-name', 'buyer-gstin', 'buyer-address', 'buyer-state', 'buyer-phone', 'inv-notes', 'inv-bank']
//     .forEach(id => sv(id, ''));
//   items = [];
//   addItem();
//   updatePreview();
// }

function resetForm() {
  if (!confirm('Start a new invoice? Current data will be cleared.')) return;
  const hist = getHistory();
  const nextNum = hist.length > 0 ? (parseInt(hist[hist.length - 1].number) || 0) + 1 : 1;
  const nextStr = String(nextNum).padStart(3, '0');

  if (currentMode === 'intl') {
    // Clear intl form
    sv('intl-inv-number', nextStr);
    sv('intl-inv-date', new Date().toISOString().split('T')[0]);
    sv('intl-inv-due', '');
    ['intl-seller-name', 'intl-seller-tax', 'intl-seller-addr1', 'intl-seller-addr2',
      'intl-seller-city', 'intl-seller-region', 'intl-seller-zip',
      'intl-seller-phone', 'intl-seller-email', 'intl-seller-web',
      'intl-buyer-name', 'intl-buyer-tax', 'intl-buyer-addr1', 'intl-buyer-addr2',
      'intl-buyer-city', 'intl-buyer-region', 'intl-buyer-zip',
      'intl-buyer-phone', 'intl-buyer-email',
      'intl-inv-notes', 'intl-inv-bank', 'intl-inv-terms'
    ].forEach(id => sv(id, ''));

    // Reset country selects
    sv('intl-seller-country', '');
    sv('intl-buyer-country', '');

    // Reset doc type and items
    setIntlDocType('invoice');
    intlItems = [];
    addIntlItem();
    updateIntlSummary();

  } else {
    // Original India reset
    sv('inv-number', nextStr);
    sv('inv-date', new Date().toISOString().split('T')[0]);
    sv('inv-due', '');
    sv('pos-state', '');
    document.getElementById('reverse-charge').checked = false;
    ['buyer-name', 'buyer-gstin', 'buyer-address', 'buyer-state',
      'buyer-phone', 'inv-notes', 'inv-bank'
    ].forEach(id => sv(id, ''));
    items = [];
    addItem();
  }

  updatePreview();
}

/* ================================================
   TABS
   ================================================ */
function switchTab(tab) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  document.querySelectorAll('.tab')[tab === 'generator' ? 0 : 1].classList.add('active');
}

/* ================================================
   AMOUNT IN WORDS (Indian number system)
   ================================================ */
function amountInWords(amount) {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen',
    'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function words(n) {
    if (n === 0) return '';
    if (n < 20) return ones[n] + ' ';
    if (n < 100) return tens[Math.floor(n / 10)] + ' ' + (n % 10 ? ones[n % 10] + ' ' : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred ' + (n % 100 ? words(n % 100) : '');
    if (n < 100000) return words(Math.floor(n / 1000)) + 'Thousand ' + (n % 1000 ? words(n % 1000) : '');
    if (n < 10000000) return words(Math.floor(n / 100000)) + 'Lakh ' + (n % 100000 ? words(n % 100000) : '');
    return words(Math.floor(n / 10000000)) + 'Crore ' + (n % 10000000 ? words(n % 10000000) : '');
  }

  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  let result = 'Rupees ' + (words(rupees) || 'Zero ').trim();
  if (paise > 0) result += ' and ' + words(paise).trim() + ' Paise';
  return result + ' Only';
}

/* ================================================
   UTILITY HELPERS
   ================================================ */
/** Get form input value */
function v(id) { return document.getElementById(id)?.value || ''; }

/** Set form input value */
function sv(id, val) { const el = document.getElementById(id); if (el) el.value = val || ''; }

/** Format number in Indian locale with 2 decimals — for HTML preview only */
function fmt(n) {
  return Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Format number for PDF — avoids rupee symbol and locale issues in jsPDF.
 * Uses plain commas in Indian grouping (e.g. 11,80,00,000.00)
 */
function fmtPDF(n) {
  const num = Number(n || 0);
  const [intPart, decPart] = num.toFixed(2).split('.');
  // Indian grouping: last 3 digits, then groups of 2
  const int = parseInt(intPart);
  if (int === 0) return 'Rs. 0.' + decPart;
  let s = intPart;
  let result = s.slice(-3);
  s = s.slice(0, -3);
  while (s.length > 0) {
    result = s.slice(-2) + ',' + result;
    s = s.slice(0, -2);
  }
  // Remove leading comma if any
  result = result.replace(/^,/, '');
  return 'Rs. ' + result + '.' + decPart;
}

/** Escape HTML special characters */
function esc(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Format date as "21 Apr 2025" */
function fmtDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch (e) { return d; }
}

/** Get state name from state code */
function stateName(code) {
  return STATES.find(s => s.code === code)?.name || '';
}

/* ================================================
   BOOT
   ================================================ */
init();
