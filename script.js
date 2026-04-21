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

  // Load saved seller profile
  loadSellerProfile();

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
  const hint  = document.getElementById(hintId);
  const val   = input.value.toUpperCase().trim();
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
    const gst     = taxable * item.gstRate / 100;
    const total   = taxable + gst;

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
  const q    = input.value.toLowerCase();
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
  const sellerState  = document.getElementById('seller-state').value;
  const posState     = document.getElementById('pos-state').value;
  const isInterstate = sellerState && posState && sellerState !== posState;

  let subtotal = 0, totalCGST = 0, totalSGST = 0, totalIGST = 0;

  items.forEach(item => {
    const taxable = item.qty * item.rate;
    const gst     = taxable * item.gstRate / 100;
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
function updatePreview() {
  const t = calcTotals();

  // Update sidebar summary
  document.getElementById('sum-subtotal').textContent = '₹' + fmt(t.subtotal);
  document.getElementById('sum-cgst').textContent     = '₹' + fmt(t.totalCGST);
  document.getElementById('sum-sgst').textContent     = '₹' + fmt(t.totalSGST);
  document.getElementById('sum-igst').textContent     = '₹' + fmt(t.totalIGST);
  document.getElementById('sum-total').textContent    = '₹' + fmt(t.grandTotal);

  document.getElementById('cgst-row').style.display      = t.isInterstate ? 'none' : '';
  document.getElementById('sgst-row').style.display      = t.isInterstate ? 'none' : '';
  document.getElementById('igst-row').style.display      = t.isInterstate ? '' : 'none';
  document.getElementById('tax-type-badge').textContent  = t.isInterstate ? 'IGST' : 'CGST+SGST';

  // Render preview pane
  document.getElementById('invoice-preview').innerHTML = buildPreviewHTML(collectData(), t);
}

function collectData() {
  return {
    docType,
    prefix:        v('inv-prefix'),
    number:        v('inv-number'),
    date:          v('inv-date'),
    due:           v('inv-due'),
    posState:      stateName(v('pos-state')),
    reverseCharge: document.getElementById('reverse-charge').checked,
    seller: {
      name:    v('seller-name'),
      gstin:   v('seller-gstin'),
      address: v('seller-address'),
      state:   stateName(v('seller-state')),
      phone:   v('seller-phone'),
      email:   v('seller-email'),
    },
    buyer: {
      name:    v('buyer-name'),
      gstin:   v('buyer-gstin'),
      address: v('buyer-address'),
      state:   stateName(v('buyer-state')),
      phone:   v('buyer-phone'),
    },
    notes: v('inv-notes'),
    bank:  v('inv-bank'),
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
    const gst     = taxable * item.gstRate / 100;
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
      ${d.seller.state  ? `<div class="party-addr">${d.seller.state}</div>` : ''}
      ${d.seller.phone  ? `<div class="party-addr">📞 ${d.seller.phone}</div>` : ''}
      ${d.seller.email  ? `<div class="party-addr">✉ ${d.seller.email}</div>` : ''}
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

  ${d.bank  ? `<div style="margin:0 28px 14px;font-size:11px;color:var(--muted)"><strong>Bank Details:</strong> ${esc(d.bank)}</div>` : ''}
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
    id:       Date.now(),
    invNo:    `${d.prefix}-${d.number}`,
    number:   d.number,
    date:     d.date,
    buyer:    d.buyer.name,
    amount:   t.grandTotal,
    snapshot: d,
    totals:   t,
  });
  localStorage.setItem('gst_history', JSON.stringify(history));
  alert(`Invoice ${d.prefix}-${d.number} saved to history!`);
  renderHistory();
}

function renderHistory() {
  const list    = document.getElementById('history-list');
  const history = getHistory();

  if (!history.length) {
    list.innerHTML = '<div class="history-empty">No saved invoices yet.<br>Generate and save an invoice to see it here.</div>';
    return;
  }

  list.innerHTML = history.slice().reverse().map(h => `
    <div class="history-item">
      <div>
        <div class="inv-no">${h.invNo}</div>
        <div class="hi-meta">${fmtDate(h.date)} &middot; ${h.buyer || '—'}</div>
      </div>
      <div class="hi-right">
        <div class="hi-amount">₹${fmt(h.amount)}</div>
        <div class="history-actions">
          <button class="btn btn-sm btn-outline" onclick="loadInvoice(${h.id})">Load</button>
          <button class="btn btn-sm btn-danger"  onclick="deleteInvoice(${h.id})">✕</button>
        </div>
      </div>
    </div>`
  ).join('');
}

function loadInvoice(id) {
  const h = getHistory().find(x => x.id === id);
  if (!h) return;
  const d = h.snapshot;

  setDocType(d.docType);
  sv('inv-prefix',  d.prefix);
  sv('inv-number',  d.number);
  sv('inv-date',    d.date);
  sv('inv-due',     d.due || '');
  sv('pos-state',   STATES.find(s => s.name === d.posState)?.code || '');
  document.getElementById('reverse-charge').checked = d.reverseCharge;

  sv('seller-name',    d.seller.name);
  sv('seller-gstin',   d.seller.gstin);
  sv('seller-address', d.seller.address);
  sv('seller-state',   STATES.find(s => s.name === d.seller.state)?.code || '');
  sv('seller-phone',   d.seller.phone);
  sv('seller-email',   d.seller.email);

  sv('buyer-name',    d.buyer.name);
  sv('buyer-gstin',   d.buyer.gstin);
  sv('buyer-address', d.buyer.address);
  sv('buyer-state',   STATES.find(s => s.name === d.buyer.state)?.code || '');
  sv('buyer-phone',   d.buyer.phone);

  sv('inv-notes', d.notes);
  sv('inv-bank',  d.bank);

  items = d.items.map(i => ({ ...i }));
  renderItems();
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
  localStorage.setItem('gst_seller', JSON.stringify({
    name:    v('seller-name'),
    gstin:   v('seller-gstin'),
    address: v('seller-address'),
    state:   v('seller-state'),
    phone:   v('seller-phone'),
    email:   v('seller-email'),
    logo:    logoBase64,
  }));
  alert('Seller profile saved! It will auto-fill on your next visit.');
}

function loadSellerProfile() {
  try {
    const p = JSON.parse(localStorage.getItem('gst_seller'));
    if (!p) return;
    sv('seller-name',    p.name);
    sv('seller-gstin',   p.gstin);
    sv('seller-address', p.address);
    sv('seller-state',   p.state);
    sv('seller-phone',   p.phone);
    sv('seller-email',   p.email);
    if (p.logo) {
      logoBase64 = p.logo;
      document.getElementById('logo-display').innerHTML =
        `<img src="${logoBase64}" class="logo-preview"><br>
         <span class="logo-upload-text" style="font-size:10px">Click to change</span>`;
    }
    if (p.gstin) validateGSTIN('seller-gstin', 'seller-gstin-hint');
  } catch (e) {}
}

/* ================================================
   RESET / NEW INVOICE
   ================================================ */
function resetForm() {
  if (!confirm('Start a new invoice? Current data will be cleared.')) return;
  const hist   = getHistory();
  const nextNum = hist.length > 0 ? (parseInt(hist[hist.length - 1].number) || 0) + 1 : 1;
  sv('inv-number', String(nextNum).padStart(3, '0'));
  sv('inv-date', new Date().toISOString().split('T')[0]);
  sv('inv-due', '');
  sv('pos-state', '');
  document.getElementById('reverse-charge').checked = false;
  ['buyer-name', 'buyer-gstin', 'buyer-address', 'buyer-state', 'buyer-phone', 'inv-notes', 'inv-bank']
    .forEach(id => sv(id, ''));
  items = [];
  addItem();
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
    if (n === 0)        return '';
    if (n < 20)         return ones[n] + ' ';
    if (n < 100)        return tens[Math.floor(n / 10)] + ' ' + (n % 10 ? ones[n % 10] + ' ' : '');
    if (n < 1000)       return ones[Math.floor(n / 100)] + ' Hundred ' + (n % 100 ? words(n % 100) : '');
    if (n < 100000)     return words(Math.floor(n / 1000))   + 'Thousand ' + (n % 1000    ? words(n % 1000)    : '');
    if (n < 10000000)   return words(Math.floor(n / 100000)) + 'Lakh '     + (n % 100000  ? words(n % 100000)  : '');
    return                     words(Math.floor(n / 10000000)) + 'Crore '   + (n % 10000000 ? words(n % 10000000) : '');
  }

  const rupees = Math.floor(amount);
  const paise  = Math.round((amount - rupees) * 100);
  let result   = 'Rupees ' + (words(rupees) || 'Zero ').trim();
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

/** Format number in Indian locale with 2 decimals */
function fmt(n) {
  return Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
