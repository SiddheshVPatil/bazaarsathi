/* ================================================
   GST Invoice Generator — pdf.js
   PDF generation using jsPDF + jsPDF-AutoTable.
   Depends on: data.js, script.js (for helpers:
   collectData, calcTotals, amountInWords, fmt, fmtDate,
   and the global: logoBase64)
   ================================================ */

async function downloadPDF() {
  /* ---- Mandatory field validation ---- */
  const errors = [];
  if (!v('seller-name').trim())  errors.push('Business Name (Seller)');
  if (!v('seller-state').trim()) errors.push('State (Seller)');
  if (!v('inv-date').trim())     errors.push('Invoice Date');
  if (!v('pos-state').trim())    errors.push('Place of Supply');
  if (!v('buyer-name').trim())   errors.push('Buyer Name');

  // At least one item must have description and rate > 0
  const hasValidItem = items.some(i => i.desc.trim() && i.rate > 0);
  if (!hasValidItem) errors.push('At least one item with Description and Rate');

  if (errors.length > 0) {
    alert('Please fill these required fields before downloading:\n\n' + errors.map(e => '• ' + e).join('\n'));
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc  = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const d    = collectData();   // from script.js
  const t    = calcTotals();    // from script.js
  const invNo = `${d.prefix}-${d.number}`;
  const W = 210, M = 14;        // page width, margin

  /* ------------------------------------------------
     SECTION 1 — HEADER BAR
     Blue background, logo left, title right
  ------------------------------------------------ */
  doc.setFillColor(15, 76, 129);
  doc.rect(0, 0, W, 28, 'F');

  // Logo or seller name fallback
  if (logoBase64) {
    try { doc.addImage(logoBase64, 'JPEG', M, 6, 35, 16); } catch (e) {}
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(255, 255, 255);
    doc.text(d.seller.name || 'Your Business', M, 16);
  }

  // Invoice type title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  const titleText = d.docType === 'tax' ? 'TAX INVOICE' : 'BILL OF SUPPLY';
  doc.text(titleText, W - M, 13, { align: 'right' });

  // Invoice number below title
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(invNo, W - M, 21, { align: 'right' });

  // Reverse charge notice
  if (d.reverseCharge) {
    doc.setFontSize(7);
    doc.text('REVERSE CHARGE APPLICABLE', W - M, 26, { align: 'right' });
  }

  let y = 34;

  /* ------------------------------------------------
     SECTION 2 — META BAR
     Invoice No | Date | Due Date | Place of Supply
  ------------------------------------------------ */
  doc.setFillColor(240, 244, 255);
  doc.rect(M, y, W - M * 2, 14, 'F');

  // Labels
  doc.setTextColor(80, 80, 100);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('INVOICE NO.',     M + 2, y + 4);
  doc.text('DATE',            75,    y + 4);
  doc.text('DUE DATE',        115,   y + 4);
  doc.text('PLACE OF SUPPLY', 155,   y + 4);

  // Values
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(20, 20, 40);
  doc.setFontSize(8.5);
  doc.text(invNo,                        M + 2, y + 11);
  doc.text(fmtDate(d.date),              75,    y + 11);
  doc.text(d.due ? fmtDate(d.due) : '-', 115,   y + 11);
  doc.text(d.posState || '-',            155,   y + 11);

  y += 20;

  /* ------------------------------------------------
     SECTION 3 — SELLER & BUYER CARDS
  ------------------------------------------------ */
  const colW = (W - M * 2) / 2 - 3;

  doc.setFillColor(250, 250, 252);
  doc.roundedRect(M,            y, colW, 38, 2, 2, 'F');
  doc.roundedRect(M + colW + 6, y, colW, 38, 2, 2, 'F');

  /**
   * Draw one party box (seller or buyer)
   * @param {number} x       - left edge of the box
   * @param {string} label   - "FROM (SELLER)" or "TO (BUYER)"
   * @param {object} party   - { name, gstin, address, state, phone }
   */
  function drawParty(x, label, party) {
    // Section label
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 76, 129);
    doc.text(label, x + 3, y + 5);

    // Business name
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 20, 40);
    doc.text(party.name || '-', x + 3, y + 12);

    // GSTIN, address, state, phone
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 100);

    let py = y + 18;
    if (party.gstin) {
      doc.text('GSTIN: ' + party.gstin, x + 3, py);
      py += 6;
    }
    const addr = (
      (party.address || '').replace(/\n/g, ' | ') +
      (party.state ? ', ' + party.state : '')
    ).trim();
    if (addr) {
      doc.text(doc.splitTextToSize(addr, colW - 5), x + 3, py);
    }
    if (party.phone) {
      doc.text('Ph: ' + party.phone, x + 3, y + 34);
    }
  }

  drawParty(M,            'FROM (SELLER)', d.seller);
  drawParty(M + colW + 9, 'TO (BUYER)',    d.buyer);

  y += 44;

  /* ------------------------------------------------
     SECTION 4 — ITEMS TABLE
     Columns vary: CGST+SGST for intrastate, IGST for interstate
  ------------------------------------------------ */
  const taxCols = t.isInterstate
    ? [
        { header: 'IGST%',    key: 'igstP' },
        { header: 'IGST Amt', key: 'igstA' },
      ]
    : [
        { header: 'CGST%',    key: 'cgstP' },
        { header: 'CGST Amt', key: 'cgstA' },
        { header: 'SGST%',    key: 'sgstP' },
        { header: 'SGST Amt', key: 'sgstA' },
      ];

  // Build row data
  const tableBody = d.items.map((item, i) => {
    const taxable = item.qty * item.rate;
    const gst     = taxable * item.gstRate / 100;

    const row = {
      sno:    i + 1,
      desc:   item.desc  || '-',
      hsn:    item.hsn   || '-',
      qty:    item.qty,
      unit:   item.unit,
      rate:   fmtPDF(item.rate),
      amount: fmtPDF(taxable + gst),
    };

    if (t.isInterstate) {
      row.igstP = item.gstRate + '%';
      row.igstA = fmtPDF(gst);
    } else {
      row.cgstP = (item.gstRate / 2) + '%';
      row.cgstA = fmtPDF(gst / 2);
      row.sgstP = (item.gstRate / 2) + '%';
      row.sgstA = fmtPDF(gst / 2);
    }

    return row;
  });

  doc.autoTable({
    startY: y,
    margin: { left: M, right: M },
    head: [[
      { content: '#',           styles: { halign: 'center' } },
      'Description',
      'HSN/SAC',
      { content: 'Qty',         styles: { halign: 'right' } },
      'Unit',
      { content: 'Rate',        styles: { halign: 'right' } },
      ...taxCols.map(c => ({ content: c.header, styles: { halign: 'right' } })),
      { content: 'Amount',      styles: { halign: 'right' } },
    ]],
    body: tableBody.map(r => [
      { content: r.sno,    styles: { halign: 'center' } },
      r.desc,
      r.hsn,
      { content: r.qty,    styles: { halign: 'right' } },
      r.unit,
      { content: r.rate,   styles: { halign: 'right' } },
      ...taxCols.map(c => ({ content: r[c.key], styles: { halign: 'right' } })),
      { content: r.amount, styles: { halign: 'right', fontStyle: 'bold' } },
    ]),
    headStyles: {
      fillColor:  [26, 26, 46],
      textColor:  255,
      fontSize:   7.5,
      fontStyle:  'bold',
    },
    bodyStyles: {
      fontSize:   8,
      textColor:  [40, 40, 60],
    },
    alternateRowStyles: { fillColor: [248, 249, 255] },
    theme: 'grid',
  });

  y = doc.lastAutoTable.finalY + 6;

  /* ------------------------------------------------
     SECTION 5 — TAX SUMMARY TABLE (right-aligned)
  ------------------------------------------------ */
  const summaryRows = t.isInterstate
    ? [
        ['Taxable Value', fmtPDF(t.subtotal)],
        ['IGST',          fmtPDF(t.totalIGST)],
        ['Grand Total',   fmtPDF(t.grandTotal)],
      ]
    : [
        ['Taxable Value', fmtPDF(t.subtotal)],
        ['CGST',          fmtPDF(t.totalCGST)],
        ['SGST',          fmtPDF(t.totalSGST)],
        ['Grand Total',   fmtPDF(t.grandTotal)],
      ];

  doc.autoTable({
    startY: y,
    margin: { left: W / 2, right: M },
    body: summaryRows,
    bodyStyles: { fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 42, textColor: [80, 80, 100] },
      1: { cellWidth: 35, halign: 'right', fontStyle: 'bold' },
    },
    // Grand total row gets dark background
    didParseCell(data) {
      if (data.row.index === summaryRows.length - 1) {
        data.cell.styles.fillColor = [26, 26, 46];
        data.cell.styles.textColor = [255, 255, 255];
        data.cell.styles.fontSize  = 10;
      }
    },
    theme: 'plain',
  });

  y = doc.lastAutoTable.finalY + 8;

  /* ------------------------------------------------
     SECTION 6 — AMOUNT IN WORDS
  ------------------------------------------------ */
  doc.setFillColor(255, 251, 235);
  doc.roundedRect(M, y, W - M * 2, 10, 2, 2, 'F');
  doc.setFontSize(8);
  doc.setTextColor(120, 80, 20);
  doc.setFont('helvetica', 'italic');
  doc.text('Amount in Words: ' + amountInWords(t.grandTotal), M + 3, y + 6.5);

  y += 16;

  /* ------------------------------------------------
     SECTION 7 — BANK DETAILS & NOTES
  ------------------------------------------------ */
  if (d.bank) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(80, 80, 100);
    doc.text('Bank Details:', M, y);
    doc.setFont('helvetica', 'normal');
    doc.text(d.bank, M + 24, y);
    y += 7;
  }

  if (d.notes) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(80, 80, 100);
    doc.text('Notes:', M, y);
    doc.setFont('helvetica', 'normal');
    doc.text(d.notes, M + 14, y);
    y += 7;
  }

  /* ------------------------------------------------
     SECTION 8 — AUTHORISED SIGNATURE BLOCK
  ------------------------------------------------ */
  doc.setDrawColor(180, 180, 200);
  doc.line(W - M - 52, y + 20, W - M, y + 20);

  doc.setFontSize(8);
  doc.setTextColor(80, 80, 100);
  doc.setFont('helvetica', 'normal');
  doc.text('For ' + (d.seller.name || 'Your Business'), W - M - 26, y + 26, { align: 'center' });
  doc.text('Authorised Signatory',                       W - M - 26, y + 31, { align: 'center' });

  /* ------------------------------------------------
     SECTION 9 — PAGE FOOTER
  ------------------------------------------------ */
  doc.setFontSize(7);
  doc.setTextColor(180, 180, 200);
  doc.text(
    'Generated by BazaarSathi.in - Free GST Invoice Generator. No signup required.',
    W / 2, 290,
    { align: 'center' }
  );

  /* ------------------------------------------------
     SAVE FILE
     Filename: INV-001_BuyerName.pdf
  ------------------------------------------------ */
  const safeBuyerName = (d.buyer.name || 'invoice').replace(/\s+/g, '_');
  doc.save(`${invNo}_${safeBuyerName}.pdf`);
}
