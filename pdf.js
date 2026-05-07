/* ================================================
   GST Invoice Generator — pdf.js
   PDF generation using jsPDF + jsPDF-AutoTable.
   Depends on: data.js, script.js (for helpers:
   collectData, calcTotals, amountInWords, fmt, fmtDate,
   and the global: logoBase64)
   ================================================ */

// async function downloadPDF() {
//   /* ---- Mandatory field validation ---- */
//   const errors = [];
//   if (!v('seller-name').trim())  errors.push('Business Name (Seller)');
//   if (!v('seller-state').trim()) errors.push('State (Seller)');
//   if (!v('inv-date').trim())     errors.push('Invoice Date');
//   if (!v('pos-state').trim())    errors.push('Place of Supply');
//   if (!v('buyer-name').trim())   errors.push('Buyer Name');

//   // At least one item must have description and rate > 0
//   const hasValidItem = items.some(i => i.desc.trim() && i.rate > 0);
//   if (!hasValidItem) errors.push('At least one item with Description and Rate');

//   if (errors.length > 0) {
//     alert('Please fill these required fields before downloading:\n\n' + errors.map(e => '• ' + e).join('\n'));
//     return;
//   }
//   const { jsPDF } = window.jspdf;
//   const doc  = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
//   const d    = collectData();   // from script.js
//   const t    = calcTotals();    // from script.js
//   const invNo = `${d.prefix}-${d.number}`;
//   const W = 210, M = 14;        // page width, margin

//   /* ------------------------------------------------
//      SECTION 1 — HEADER BAR
//      Blue background, logo left, title right
//   ------------------------------------------------ */
//   doc.setFillColor(15, 76, 129);
//   doc.rect(0, 0, W, 28, 'F');

//   // Logo or seller name fallback
//   if (logoBase64) {
//     try { doc.addImage(logoBase64, 'JPEG', M, 6, 35, 16); } catch (e) {}
//   } else {
//     doc.setFont('helvetica', 'bold');
//     doc.setFontSize(13);
//     doc.setTextColor(255, 255, 255);
//     doc.text(d.seller.name || 'Your Business', M, 16);
//   }

//   // Invoice type title
//   doc.setFont('helvetica', 'bold');
//   doc.setFontSize(16);
//   doc.setTextColor(255, 255, 255);
//   const titleText = d.docType === 'tax' ? 'TAX INVOICE' : 'BILL OF SUPPLY';
//   doc.text(titleText, W - M, 13, { align: 'right' });

//   // Invoice number below title
//   doc.setFontSize(9);
//   doc.setFont('helvetica', 'normal');
//   doc.text(invNo, W - M, 21, { align: 'right' });

//   // Reverse charge notice
//   if (d.reverseCharge) {
//     doc.setFontSize(7);
//     doc.text('REVERSE CHARGE APPLICABLE', W - M, 26, { align: 'right' });
//   }

//   let y = 34;

//   /* ------------------------------------------------
//      SECTION 2 — META BAR
//      Invoice No | Date | Due Date | Place of Supply
//   ------------------------------------------------ */
//   doc.setFillColor(240, 244, 255);
//   doc.rect(M, y, W - M * 2, 14, 'F');

//   // Labels
//   doc.setTextColor(80, 80, 100);
//   doc.setFontSize(7.5);
//   doc.setFont('helvetica', 'bold');
//   doc.text('INVOICE NO.',     M + 2, y + 4);
//   doc.text('DATE',            75,    y + 4);
//   doc.text('DUE DATE',        115,   y + 4);
//   doc.text('PLACE OF SUPPLY', 155,   y + 4);

//   // Values
//   doc.setFont('helvetica', 'normal');
//   doc.setTextColor(20, 20, 40);
//   doc.setFontSize(8.5);
//   doc.text(invNo,                        M + 2, y + 11);
//   doc.text(fmtDate(d.date),              75,    y + 11);
//   doc.text(d.due ? fmtDate(d.due) : '-', 115,   y + 11);
//   doc.text(d.posState || '-',            155,   y + 11);

//   y += 20;

//   /* ------------------------------------------------
//      SECTION 3 — SELLER & BUYER CARDS
//   ------------------------------------------------ */
//   const colW = (W - M * 2) / 2 - 3;

//   doc.setFillColor(250, 250, 252);
//   doc.roundedRect(M,            y, colW, 38, 2, 2, 'F');
//   doc.roundedRect(M + colW + 6, y, colW, 38, 2, 2, 'F');

//   /**
//    * Draw one party box (seller or buyer)
//    * @param {number} x       - left edge of the box
//    * @param {string} label   - "FROM (SELLER)" or "TO (BUYER)"
//    * @param {object} party   - { name, gstin, address, state, phone }
//    */
//   function drawParty(x, label, party) {
//     // Section label
//     doc.setFontSize(7);
//     doc.setFont('helvetica', 'bold');
//     doc.setTextColor(15, 76, 129);
//     doc.text(label, x + 3, y + 5);

//     // Business name
//     doc.setFontSize(9);
//     doc.setFont('helvetica', 'bold');
//     doc.setTextColor(20, 20, 40);
//     doc.text(party.name || '-', x + 3, y + 12);

//     // GSTIN, address, state, phone
//     doc.setFontSize(7.5);
//     doc.setFont('helvetica', 'normal');
//     doc.setTextColor(80, 80, 100);

//     let py = y + 18;
//     if (party.gstin) {
//       doc.text('GSTIN: ' + party.gstin, x + 3, py);
//       py += 6;
//     }
//     const addr = (
//       (party.address || '').replace(/\n/g, ' | ') +
//       (party.state ? ', ' + party.state : '')
//     ).trim();
//     if (addr) {
//       doc.text(doc.splitTextToSize(addr, colW - 5), x + 3, py);
//     }
//     if (party.phone) {
//       doc.text('Ph: ' + party.phone, x + 3, y + 34);
//     }
//   }

//   drawParty(M,            'FROM (SELLER)', d.seller);
//   drawParty(M + colW + 9, 'TO (BUYER)',    d.buyer);

//   y += 44;

//   /* ------------------------------------------------
//      SECTION 4 — ITEMS TABLE
//      Columns vary: CGST+SGST for intrastate, IGST for interstate
//   ------------------------------------------------ */
//   const taxCols = t.isInterstate
//     ? [
//         { header: 'IGST%',    key: 'igstP' },
//         { header: 'IGST Amt', key: 'igstA' },
//       ]
//     : [
//         { header: 'CGST%',    key: 'cgstP' },
//         { header: 'CGST Amt', key: 'cgstA' },
//         { header: 'SGST%',    key: 'sgstP' },
//         { header: 'SGST Amt', key: 'sgstA' },
//       ];

//   // Build row data
//   const tableBody = d.items.map((item, i) => {
//     const taxable = item.qty * item.rate;
//     const gst     = taxable * item.gstRate / 100;

//     const row = {
//       sno:    i + 1,
//       desc:   item.desc  || '-',
//       hsn:    item.hsn   || '-',
//       qty:    item.qty,
//       unit:   item.unit,
//       rate:   fmtPDF(item.rate),
//       amount: fmtPDF(taxable + gst),
//     };

//     if (t.isInterstate) {
//       row.igstP = item.gstRate + '%';
//       row.igstA = fmtPDF(gst);
//     } else {
//       row.cgstP = (item.gstRate / 2) + '%';
//       row.cgstA = fmtPDF(gst / 2);
//       row.sgstP = (item.gstRate / 2) + '%';
//       row.sgstA = fmtPDF(gst / 2);
//     }

//     return row;
//   });

//   doc.autoTable({
//     startY: y,
//     margin: { left: M, right: M },
//     head: [[
//       { content: '#',           styles: { halign: 'center' } },
//       'Description',
//       'HSN/SAC',
//       { content: 'Qty',         styles: { halign: 'right' } },
//       'Unit',
//       { content: 'Rate',        styles: { halign: 'right' } },
//       ...taxCols.map(c => ({ content: c.header, styles: { halign: 'right' } })),
//       { content: 'Amount',      styles: { halign: 'right' } },
//     ]],
//     body: tableBody.map(r => [
//       { content: r.sno,    styles: { halign: 'center' } },
//       r.desc,
//       r.hsn,
//       { content: r.qty,    styles: { halign: 'right' } },
//       r.unit,
//       { content: r.rate,   styles: { halign: 'right' } },
//       ...taxCols.map(c => ({ content: r[c.key], styles: { halign: 'right' } })),
//       { content: r.amount, styles: { halign: 'right', fontStyle: 'bold' } },
//     ]),
//     headStyles: {
//       fillColor:  [26, 26, 46],
//       textColor:  255,
//       fontSize:   7.5,
//       fontStyle:  'bold',
//     },
//     bodyStyles: {
//       fontSize:   8,
//       textColor:  [40, 40, 60],
//     },
//     alternateRowStyles: { fillColor: [248, 249, 255] },
//     theme: 'grid',
//   });

//   y = doc.lastAutoTable.finalY + 6;

//   /* ------------------------------------------------
//      SECTION 5 — TAX SUMMARY TABLE (right-aligned)
//   ------------------------------------------------ */
//   const summaryRows = t.isInterstate
//     ? [
//         ['Taxable Value', fmtPDF(t.subtotal)],
//         ['IGST',          fmtPDF(t.totalIGST)],
//         ['Grand Total',   fmtPDF(t.grandTotal)],
//       ]
//     : [
//         ['Taxable Value', fmtPDF(t.subtotal)],
//         ['CGST',          fmtPDF(t.totalCGST)],
//         ['SGST',          fmtPDF(t.totalSGST)],
//         ['Grand Total',   fmtPDF(t.grandTotal)],
//       ];

//   doc.autoTable({
//     startY: y,
//     margin: { left: W / 2, right: M },
//     body: summaryRows,
//     bodyStyles: { fontSize: 9 },
//     columnStyles: {
//       0: { cellWidth: 42, textColor: [80, 80, 100] },
//       1: { cellWidth: 35, halign: 'right', fontStyle: 'bold' },
//     },
//     // Grand total row gets dark background
//     didParseCell(data) {
//       if (data.row.index === summaryRows.length - 1) {
//         data.cell.styles.fillColor = [26, 26, 46];
//         data.cell.styles.textColor = [255, 255, 255];
//         data.cell.styles.fontSize  = 10;
//       }
//     },
//     theme: 'plain',
//   });

//   y = doc.lastAutoTable.finalY + 8;

//   /* ------------------------------------------------
//      SECTION 6 — AMOUNT IN WORDS
//   ------------------------------------------------ */
//   doc.setFillColor(255, 251, 235);
//   doc.roundedRect(M, y, W - M * 2, 10, 2, 2, 'F');
//   doc.setFontSize(8);
//   doc.setTextColor(120, 80, 20);
//   doc.setFont('helvetica', 'italic');
//   doc.text('Amount in Words: ' + amountInWords(t.grandTotal), M + 3, y + 6.5);

//   y += 16;

//   /* ------------------------------------------------
//      SECTION 7 — BANK DETAILS & NOTES
//   ------------------------------------------------ */
//   if (d.bank) {
//     doc.setFontSize(8);
//     doc.setFont('helvetica', 'bold');
//     doc.setTextColor(80, 80, 100);
//     doc.text('Bank Details:', M, y);
//     doc.setFont('helvetica', 'normal');
//     doc.text(d.bank, M + 24, y);
//     y += 7;
//   }

//   if (d.notes) {
//     doc.setFont('helvetica', 'bold');
//     doc.setTextColor(80, 80, 100);
//     doc.text('Notes:', M, y);
//     doc.setFont('helvetica', 'normal');
//     doc.text(d.notes, M + 14, y);
//     y += 7;
//   }

//   /* ------------------------------------------------
//      SECTION 8 — AUTHORISED SIGNATURE BLOCK
//   ------------------------------------------------ */
//   doc.setDrawColor(180, 180, 200);
//   doc.line(W - M - 52, y + 20, W - M, y + 20);

//   doc.setFontSize(8);
//   doc.setTextColor(80, 80, 100);
//   doc.setFont('helvetica', 'normal');
//   doc.text('For ' + (d.seller.name || 'Your Business'), W - M - 26, y + 26, { align: 'center' });
//   doc.text('Authorised Signatory',                       W - M - 26, y + 31, { align: 'center' });

//   /* ------------------------------------------------
//      SECTION 9 — PAGE FOOTER
//   ------------------------------------------------ */
//   doc.setFontSize(7);
//   doc.setTextColor(180, 180, 200);
//   doc.text(
//     'Generated by BazaarSathi.in - Free GST Invoice Generator. No signup required.',
//     W / 2, 290,
//     { align: 'center' }
//   );

//   /* ------------------------------------------------
//      SAVE FILE
//      Filename: INV-001_BuyerName.pdf
//   ------------------------------------------------ */
//   const safeBuyerName = (d.buyer.name || 'invoice').replace(/\s+/g, '_');
//   doc.save(`${invNo}_${safeBuyerName}.pdf`);
// }

async function downloadPDF() {
  // Route to correct generator based on mode
  if (typeof currentMode !== 'undefined' && currentMode === 'intl') {
    return downloadIntlPDF();
  }

  /* ---- India: Mandatory field validation ---- */
  const errors = [];
  if (!v('seller-name').trim()) errors.push('Business Name (Seller)');
  if (!v('seller-state').trim()) errors.push('State (Seller)');
  if (!v('inv-date').trim()) errors.push('Invoice Date');
  if (!v('pos-state').trim()) errors.push('Place of Supply');
  if (!v('buyer-name').trim()) errors.push('Buyer Name');

  const hasValidItem = items.some(i => i.desc.trim() && i.rate > 0);
  if (!hasValidItem) errors.push('At least one item with Description and Rate');

  if (errors.length > 0) {
    alert('Please fill these required fields before downloading:\n\n' + errors.map(e => '• ' + e).join('\n'));
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const d = collectData();
  const t = calcTotals();
  const invNo = `${d.prefix}-${d.number}`;
  const W = 210, M = 14;

  doc.setFillColor(15, 76, 129);
  doc.rect(0, 0, W, 28, 'F');

  if (logoBase64) {
    try { doc.addImage(logoBase64, 'JPEG', M, 6, 35, 16); } catch (e) { }
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(255, 255, 255);
    doc.text(d.seller.name || 'Your Business', M, 16);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  const titleText = d.docType === 'tax' ? 'TAX INVOICE' : 'BILL OF SUPPLY';
  doc.text(titleText, W - M, 13, { align: 'right' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(invNo, W - M, 21, { align: 'right' });
  if (d.reverseCharge) {
    doc.setFontSize(7);
    doc.text('REVERSE CHARGE APPLICABLE', W - M, 26, { align: 'right' });
  }

  let y = 34;

  doc.setFillColor(240, 244, 255);
  doc.rect(M, y, W - M * 2, 14, 'F');
  doc.setTextColor(80, 80, 100);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('INVOICE NO.', M + 2, y + 4);
  doc.text('DATE', 75, y + 4);
  doc.text('DUE DATE', 115, y + 4);
  doc.text('PLACE OF SUPPLY', 155, y + 4);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(20, 20, 40);
  doc.setFontSize(8.5);
  doc.text(invNo, M + 2, y + 11);
  doc.text(fmtDate(d.date), 75, y + 11);
  doc.text(d.due ? fmtDate(d.due) : '-', 115, y + 11);
  doc.text(d.posState || '-', 155, y + 11);
  y += 20;

  const colW = (W - M * 2) / 2 - 3;
  doc.setFillColor(250, 250, 252);
  doc.roundedRect(M, y, colW, 38, 2, 2, 'F');
  doc.roundedRect(M + colW + 6, y, colW, 38, 2, 2, 'F');

  function drawParty(x, label, party) {
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 76, 129);
    doc.text(label, x + 3, y + 5);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 20, 40);
    doc.text(party.name || '-', x + 3, y + 12);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 100);
    let py = y + 18;
    if (party.gstin) { doc.text('GSTIN: ' + party.gstin, x + 3, py); py += 6; }
    const addr = ((party.address || '').replace(/\n/g, ' | ') + (party.state ? ', ' + party.state : '')).trim();
    if (addr) {
      const lines = doc.splitTextToSize(addr, colW - 6);
      doc.text(lines.slice(0, 2), x + 3, py);
      py += lines.slice(0, 2).length * 5;
    }
    if (party.phone) doc.text('Ph: ' + party.phone, x + 3, py);
  }

  drawParty(M, 'FROM (SELLER)', d.seller);
  drawParty(M + colW + 6, 'TO (BUYER)', d.buyer);
  y += 44;

  const isInterstate = t.isInterstate;
  const taxHeaders = isInterstate
    ? [{ content: 'IGST%', styles: { halign: 'right' } }, { content: 'IGST', styles: { halign: 'right' } }]
    : [
      { content: 'CGST%', styles: { halign: 'right' } }, { content: 'CGST', styles: { halign: 'right' } },
      { content: 'SGST%', styles: { halign: 'right' } }, { content: 'SGST', styles: { halign: 'right' } }
    ];

  const tableRows = d.items
    .filter(i => i.desc.trim() || i.rate > 0)
    .map((item, i) => {
      const taxable = item.qty * item.rate;
      const gst = taxable * item.gstRate / 100;
      const taxCols = isInterstate
        ? [{ content: item.gstRate + '%', styles: { halign: 'right' } }, { content: fmtPDF(gst), styles: { halign: 'right' } }]
        : [
          { content: (item.gstRate / 2) + '%', styles: { halign: 'right' } }, { content: fmtPDF(gst / 2), styles: { halign: 'right' } },
          { content: (item.gstRate / 2) + '%', styles: { halign: 'right' } }, { content: fmtPDF(gst / 2), styles: { halign: 'right' } }
        ];
      return [
        { content: i + 1 },
        { content: item.desc },
        { content: item.hsn || '-' },
        { content: item.qty, styles: { halign: 'right' } },
        { content: item.unit },
        { content: fmtPDF(item.rate), styles: { halign: 'right' } },
        ...taxCols,
        { content: fmtPDF(taxable + gst), styles: { halign: 'right', fontStyle: 'bold' } }
      ];
    });

  doc.autoTable({
    startY: y,
    head: [[
      '#', 'Description', 'HSN/SAC',
      { content: 'Qty', styles: { halign: 'right' } },
      'Unit',
      { content: 'Rate', styles: { halign: 'right' } },
      ...taxHeaders,
      { content: 'Amount', styles: { halign: 'right' } }
    ]],
    body: tableRows,
    theme: 'grid',
    headStyles: { fillColor: [26, 26, 46], textColor: 255, fontSize: 7, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7.5, textColor: [40, 40, 60] },
    alternateRowStyles: { fillColor: [248, 249, 255] },
    margin: { left: M, right: M },
  });

  y = doc.lastAutoTable.finalY + 6;

  // Tax summary box
  const summaryItems = isInterstate
    ? [['Taxable Value', fmtPDF(t.subtotal)], ['IGST', fmtPDF(t.totalIGST)]]
    : [['Taxable Value', fmtPDF(t.subtotal)], ['CGST', fmtPDF(t.totalCGST)], ['SGST', fmtPDF(t.totalSGST)]];

  const boxW = 80, boxX = W - M - boxW;
  doc.setFillColor(248, 249, 255);
  doc.roundedRect(boxX, y, boxW, summaryItems.length * 8 + 12, 2, 2, 'F');
  let sy = y + 7;
  summaryItems.forEach(([label, val]) => {
    doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(80, 80, 100);
    doc.text(label, boxX + 4, sy);
    doc.text(val, boxX + boxW - 4, sy, { align: 'right' });
    sy += 8;
  });
  doc.setFillColor(26, 26, 46);
  doc.roundedRect(boxX, sy - 3, boxW, 10, 2, 2, 'F');
  doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
  doc.text('Grand Total', boxX + 4, sy + 4);
  doc.text(fmtPDF(t.grandTotal), boxX + boxW - 4, sy + 4, { align: 'right' });
  y = sy + 14;

  // Amount in words
  doc.setFillColor(255, 251, 235);
  doc.roundedRect(M, y, W - M * 2, 10, 2, 2, 'F');
  doc.setFontSize(7.5); doc.setFont('helvetica', 'italic'); doc.setTextColor(80, 60, 20);
  doc.text('Amount in Words: ' + amountInWords(t.grandTotal), M + 3, y + 6);
  y += 16;

  if (d.bank) {
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(40, 40, 60);
    doc.text('Bank Details:', M, y); y += 5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(80, 80, 100);
    doc.text(d.bank, M, y); y += 10;
  }
  if (d.notes) {
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(40, 40, 60);
    doc.text('Notes:', M, y); y += 5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(80, 80, 100);
    const noteLines = doc.splitTextToSize(d.notes, W - M * 2);
    doc.text(noteLines, M, y); y += noteLines.length * 5 + 5;
  }

  // Footer
  doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(120, 120, 140);
  doc.text('Generated by BazaarSathi.in | Computer generated invoice.', M, y);
  doc.setFont('helvetica', 'bold'); doc.setTextColor(40, 40, 60);
  doc.text('For ' + (d.seller.name || 'Your Business'), W - M, y - 10, { align: 'right' });
  doc.setDrawColor(40, 40, 60);
  doc.line(W - M - 40, y - 4, W - M, y - 4);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
  doc.setTextColor(120, 120, 140);
  doc.text('Authorised Signatory', W - M, y, { align: 'right' });

  const safeBuyerName = (d.buyer.name || 'invoice').replace(/\s+/g, '_');
  doc.save(`${invNo}_${safeBuyerName}.pdf`);
}



/* ================================================
   INTERNATIONAL PDF GENERATOR
   ================================================ */
async function downloadIntlPDF() {
  const d = collectIntlData();
  const t = calcIntlTotals();

  /* ---- Validation ---- */
  const errors = [];
  if (!d.seller.name.trim()) errors.push('Business Name (Seller)');
  if (!d.date.trim()) errors.push('Invoice Date');
  if (!d.buyer.name.trim()) errors.push('Client Name');
  const hasValidItem = d.items.some(i => i.desc.trim() && i.rate > 0);
  if (!hasValidItem) errors.push('At least one item with Description and Rate');
  if (errors.length > 0) {
    alert('Please fill these required fields:\n\n' + errors.map(e => '• ' + e).join('\n'));
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210, M = 14;
  const sym = d.currency || '$';
  const invNo = `${d.prefix}-${d.number}`;
  const country = d.country || {};

  const docLabel = d.docType === 'quote' ? 'QUOTATION'
    : d.docType === 'receipt' ? 'RECEIPT'
      : 'INVOICE';

  /* ---- HEADER ---- */
  doc.setFillColor(15, 76, 129);
  doc.rect(0, 0, W, 28, 'F');

  if (logoBase64) {
    try { doc.addImage(logoBase64, 'JPEG', M, 6, 35, 16); } catch (e) { }
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(255, 255, 255);
    doc.text(d.seller.name || 'Your Business', M, 16);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text(docLabel, W - M, 13, { align: 'right' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(invNo, W - M, 21, { align: 'right' });

  let y = 34;

  /* ---- META BAR ---- */
  doc.setFillColor(240, 244, 255);
  doc.rect(M, y, W - M * 2, 14, 'F');
  doc.setTextColor(80, 80, 100);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('INVOICE NO.', M + 2, y + 4);
  doc.text('DATE', 75, y + 4);
  doc.text('DUE DATE', 115, y + 4);
  doc.text('CURRENCY', 155, y + 4);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(20, 20, 40);
  doc.setFontSize(8.5);
  doc.text(invNo, M + 2, y + 11);
  doc.text(fmtDate(d.date), 75, y + 11);
  doc.text(d.due ? fmtDate(d.due) : '-', 115, y + 11);
  doc.text(sym, 155, y + 11);
  y += 20;

  /* ---- SELLER / BUYER CARDS ---- */
  const colW = (W - M * 2) / 2 - 3;
  doc.setFillColor(250, 250, 252);
  doc.roundedRect(M, y, colW, 44, 2, 2, 'F');
  doc.roundedRect(M + colW + 6, y, colW, 44, 2, 2, 'F');

  function drawIntlParty(x, label, party, taxLabel) {
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 76, 129);
    doc.text(label, x + 3, y + 5);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 20, 40);
    doc.text(party.name || '-', x + 3, y + 12);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 100);

    let py = y + 18;
    if (party.taxId) {
      doc.text((taxLabel || 'Tax ID') + ': ' + party.taxId, x + 3, py);
      py += 5;
    }
    const addrParts = [party.addr1, party.addr2, party.city, party.region, party.zip, party.country]
      .filter(Boolean).join(', ');
    if (addrParts) {
      const lines = doc.splitTextToSize(addrParts, colW - 6);
      doc.text(lines.slice(0, 3), x + 3, py);
      py += lines.slice(0, 3).length * 4.5;
    }
    if (party.phone) { doc.text('Ph: ' + party.phone, x + 3, py); py += 4.5; }
    if (party.email) { doc.text(party.email, x + 3, py); }
  }

  drawIntlParty(M, 'FROM (SELLER)', d.seller, country.taxLabel);
  drawIntlParty(M + colW + 6, 'TO (BUYER)', d.buyer, 'Tax ID');
  y += 50;

  /* ---- ITEMS TABLE ---- */
  const tableRows = d.items
    .filter(i => i.desc.trim() || i.rate > 0)
    .map((item, i) => {
      const taxable = item.qty * item.rate;
      const tax = taxable * item.taxRate / 100;
      const total = taxable + tax;
      return [
        { content: i + 1 },
        { content: item.desc || '-' },
        { content: item.qty, styles: { halign: 'right' } },
        { content: item.unit },
        { content: sym + fmtIntl(item.rate), styles: { halign: 'right' } },
        { content: item.taxRate + '%', styles: { halign: 'right' } },
        { content: sym + fmtIntl(tax), styles: { halign: 'right' } },
        { content: sym + fmtIntl(total), styles: { halign: 'right', fontStyle: 'bold' } },
      ];
    });

  doc.autoTable({
    startY: y,
    head: [[
      '#', 'Description',
      { content: 'Qty', styles: { halign: 'right' } },
      'Unit',
      { content: 'Rate', styles: { halign: 'right' } },
      { content: (country.taxName || 'Tax') + ' %', styles: { halign: 'right' } },
      { content: country.taxName || 'Tax', styles: { halign: 'right' } },
      { content: 'Amount', styles: { halign: 'right' } },
    ]],
    body: tableRows,
    theme: 'grid',
    headStyles: { fillColor: [26, 26, 46], textColor: 255, fontSize: 7, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7.5, textColor: [40, 40, 60] },
    alternateRowStyles: { fillColor: [248, 249, 255] },
    margin: { left: M, right: M },
  });

  y = doc.lastAutoTable.finalY + 6;

  /* ---- TAX SUMMARY BOX ---- */
  const boxW = 80, boxX = W - M - boxW;
  doc.setFillColor(248, 249, 255);
  doc.roundedRect(boxX, y, boxW, 26, 2, 2, 'F');
  let sy = y + 7;

  doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(80, 80, 100);
  doc.text('Subtotal', boxX + 4, sy);
  doc.text(sym + fmtIntl(t.subtotal), boxX + boxW - 4, sy, { align: 'right' });
  sy += 8;
  doc.text((country.taxName || 'Tax'), boxX + 4, sy);
  doc.text(sym + fmtIntl(t.totalTax), boxX + boxW - 4, sy, { align: 'right' });
  sy += 8;

  doc.setFillColor(26, 26, 46);
  doc.roundedRect(boxX, sy - 3, boxW, 10, 2, 2, 'F');
  doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
  doc.text('Total', boxX + 4, sy + 4);
  doc.text(sym + fmtIntl(t.grandTotal), boxX + boxW - 4, sy + 4, { align: 'right' });
  y = sy + 24;

  /* ---- PAYMENT / NOTES / TERMS ---- */
  if (d.bank) {
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(40, 40, 60);
    doc.text('Payment Details:', M, y); y += 5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(80, 80, 100);
    const bankLines = doc.splitTextToSize(d.bank, W - M * 2);
    doc.text(bankLines, M, y); y += bankLines.length * 5 + 5;
  }
  if (d.notes) {
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(40, 40, 60);
    doc.text('Notes:', M, y); y += 5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(80, 80, 100);
    const noteLines = doc.splitTextToSize(d.notes, W - M * 2);
    doc.text(noteLines, M, y); y += noteLines.length * 5 + 5;
  }
  if (d.terms) {
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(40, 40, 60);
    doc.text('Terms & Conditions:', M, y); y += 5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(80, 80, 100);
    const termLines = doc.splitTextToSize(d.terms, W - M * 2);
    doc.text(termLines, M, y); y += termLines.length * 5 + 5;
  }

  /* ---- FOOTER ---- */
  doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(120, 120, 140);
  doc.text('Generated by BazaarSathi.in | Computer generated ' + docLabel.toLowerCase() + '.', M, y);
  doc.setFont('helvetica', 'bold'); doc.setTextColor(40, 40, 60);
  doc.text('For ' + (d.seller.name || 'Your Business'), W - M, y - 10, { align: 'right' });
  doc.setDrawColor(40, 40, 60);
  doc.line(W - M - 40, y - 4, W - M, y - 4);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(120, 120, 140);
  doc.text('Authorised Signatory', W - M, y, { align: 'right' });

  const safeName = (d.buyer.name || 'invoice').replace(/\s+/g, '_');
  doc.save(`${invNo}_${safeName}.pdf`);
}

 // Footer
  doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(120, 120, 140);
  doc.text('Generated by BazaarSathi.in | Computer generated invoice.', M, y);
  doc.setFont('helvetica', 'bold'); doc.setTextColor(40, 40, 60);
  doc.text('For ' + (d.seller.name || 'Your Business'), W - M, y - 10, { align: 'right' });
  doc.setDrawColor(40, 40, 60);
  doc.line(W - M - 40, y - 4, W - M, y - 4);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
  doc.setTextColor(120, 120, 140);
  doc.text('Authorised Signatory', W - M, y, { align: 'right' });

  const safeBuyerName = (d.buyer.name || 'invoice').replace(/\s+/g, '_');
  doc.save(`${invNo}_${safeBuyerName}.pdf`);