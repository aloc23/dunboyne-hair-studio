
function renderReports(fromISO, toISO){
  const settings = getSettings();
  const vatMode = settings.vatMode;
  const vatRate = settings.vatRate;

  const catalog = getCatalog();
  const takings = listTakings(fromISO, toISO);
  let svcGross = 0, totalGross = 0, net=0, vat=0, retailGross=0, cogs=0;
  for(const t of takings){
    const sum = computeSaleTotals(t.lines, t.retailGross||0, t.vatMode, t.vatRate);
    svcGross += sum.svcGross;
    retailGross += (t.retailGross||0);
    totalGross += sum.totalGross;
    // We need net/vat summation: recompute per-entry for accuracy
    net += (t.vatMode==='include') ? sum.net : sum.net; // both already net
    vat += sum.vat;
    cogs += computeCOGS(t.lines, catalog);
  }
  const expenses = listExpenses(fromISO, toISO);
  const expNet = expenses.reduce((a,e)=>a+e.net,0);
  const expVAT = expenses.reduce((a,e)=>a+e.vat,0);
  const expTotal = expNet + expVAT;

  const grossProfit = totalGross - cogs;
  const operatingProfit = grossProfit - expNet; // exclude input VAT from P&L

  const el = document.getElementById('report-output');
  el.innerHTML = `
    <div class="report-tabs">
      <button class="btn" id="kpi-tab" onclick="showReportTab('kpi')"><span class="icon icon-reports"></span>KPI Summary</button>
      <button class="btn" id="pl-tab" onclick="showReportTab('pl')"><span class="icon icon-reports"></span>P&L Statement</button>
      <button class="btn" id="bs-tab" onclick="showReportTab('bs')"><span class="icon icon-reports"></span>Balance Sheet</button>
      <button class="btn" id="monthly-tab" onclick="showReportTab('monthly')"><span class="icon icon-reports"></span>Monthly Summary</button>
    </div>
    
    <div class="report-content">
      <div id="kpi-content" class="report-section active">
        <div class="row between mb">
          <h3>KPI Summary</h3>
          <div>
            <button class="btn" onclick="exportReport('kpi')"><span class="icon icon-export"></span>Export PDF</button>
            <button class="btn" onclick="exportReportExcel('kpi')"><span class="icon icon-export"></span>Export Excel</button>
            <button class="btn" onclick="emailReport('kpi')"><span class="icon icon-email"></span>Email Report</button>
          </div>
        </div>
        <div class="kpis">
          <div class="chip">Services Gross € ${svcGross.toFixed(2)}</div>
          <div class="chip">Retail Gross € ${retailGross.toFixed(2)}</div>
          <div class="chip">Revenue Gross € ${totalGross.toFixed(2)}</div>
          <div class="chip">VAT Output € ${vat.toFixed(2)}</div>
          <div class="chip">COGS € ${cogs.toFixed(2)}</div>
          <div class="chip">Gross Profit € ${grossProfit.toFixed(2)}</div>
          <div class="chip">Expenses (Net) € ${expNet.toFixed(2)}</div>
          <div class="chip">Operating Profit € ${operatingProfit.toFixed(2)}</div>
        </div>
        <h4 class="mt">Expenses Detail</h4>
        <table class="table">
          <thead><tr><th>Date</th><th>Category</th><th>Supplier</th><th>Net</th><th>VAT</th><th>Total</th></tr></thead>
          <tbody>
            ${expenses.map(e=>`<tr><td>${e.date}</td><td>${e.category}</td><td>${e.supplier||''}</td><td>${e.net.toFixed(2)}</td><td>${e.vat.toFixed(2)}</td><td>${e.total.toFixed(2)}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>

      <div id="pl-content" class="report-section">
        ${generatePLStatement(svcGross, retailGross, totalGross, net, vat, cogs, expenses, grossProfit, operatingProfit, fromISO, toISO)}
      </div>

      <div id="bs-content" class="report-section">
        ${generateBalanceSheet(fromISO, toISO)}
      </div>

      <div id="monthly-content" class="report-section">
        ${generateMonthlySummary(fromISO, toISO)}
      </div>
    </div>
  `;
}

function generatePLStatement(svcGross, retailGross, totalGross, net, vat, cogs, expenses, grossProfit, operatingProfit, fromISO, toISO) {
  const expensesByCategory = {};
  expenses.forEach(e => {
    if (!expensesByCategory[e.category]) expensesByCategory[e.category] = 0;
    expensesByCategory[e.category] += e.net;
  });

  return `
    <div class="row between mb">
      <h3>Profit & Loss Statement</h3>
      <div>
        <button class="btn" onclick="exportReport('pl')"><span class="icon icon-export"></span>Export PDF</button>
        <button class="btn" onclick="exportReportExcel('pl')"><span class="icon icon-export"></span>Export Excel</button>
        <button class="btn" onclick="emailReport('pl')"><span class="icon icon-email"></span>Email Report</button>
      </div>
    </div>
    <div class="report-period">Period: ${fromISO || 'All time'} to ${toISO || 'Present'}</div>
    
    <table class="table pl-table">
      <thead><tr><th>Account</th><th class="text-right">Amount (€)</th></tr></thead>
      <tbody>
        <tr class="section-header"><td colspan="2"><strong>REVENUE</strong></td></tr>
        <tr><td>&nbsp;&nbsp;Service Revenue</td><td class="text-right">${svcGross.toFixed(2)}</td></tr>
        <tr><td>&nbsp;&nbsp;Retail Revenue</td><td class="text-right">${retailGross.toFixed(2)}</td></tr>
        <tr class="subtotal"><td><strong>Total Revenue (Gross)</strong></td><td class="text-right"><strong>${totalGross.toFixed(2)}</strong></td></tr>
        <tr><td>&nbsp;&nbsp;Less: VAT Output</td><td class="text-right">(${vat.toFixed(2)})</td></tr>
        <tr class="subtotal"><td><strong>Total Revenue (Net)</strong></td><td class="text-right"><strong>${net.toFixed(2)}</strong></td></tr>
        
        <tr class="section-header"><td colspan="2"><strong>COST OF GOODS SOLD</strong></td></tr>
        <tr><td>&nbsp;&nbsp;Direct Service Costs</td><td class="text-right">(${cogs.toFixed(2)})</td></tr>
        <tr class="subtotal"><td><strong>Gross Profit</strong></td><td class="text-right"><strong>${grossProfit.toFixed(2)}</strong></td></tr>
        
        <tr class="section-header"><td colspan="2"><strong>OPERATING EXPENSES</strong></td></tr>
        ${Object.entries(expensesByCategory).map(([cat, amount]) => 
          `<tr><td>&nbsp;&nbsp;${cat}</td><td class="text-right">(${amount.toFixed(2)})</td></tr>`
        ).join('')}
        <tr class="subtotal"><td><strong>Total Operating Expenses</strong></td><td class="text-right"><strong>(${expenses.reduce((a,e)=>a+e.net,0).toFixed(2)})</strong></td></tr>
        
        <tr class="total"><td><strong>NET PROFIT</strong></td><td class="text-right"><strong>${operatingProfit.toFixed(2)}</strong></td></tr>
      </tbody>
    </table>
  `;
}

function generateBalanceSheet(fromISO, toISO) {
  const db = loadDB();
  const settings = getSettings();
  
  // Simplified balance sheet - accumulate from beginning
  const allTakings = listTakings(null, toISO);
  const allExpenses = listExpenses(null, toISO);
  
  const totalRevenue = allTakings.reduce((sum, t) => {
    const totals = computeSaleTotals(t.lines, t.retailGross||0, t.vatMode, t.vatRate);
    return sum + totals.net;
  }, 0);
  
  const totalExpenses = allExpenses.reduce((sum, e) => sum + e.net, 0);
  const retainedEarnings = totalRevenue - totalExpenses;
  
  const vatLiability = allTakings.reduce((sum, t) => {
    const totals = computeSaleTotals(t.lines, t.retailGross||0, t.vatMode, t.vatRate);
    return sum + totals.vat;
  }, 0) - allExpenses.reduce((sum, e) => sum + e.vat, 0);

  return `
    <div class="row between mb">
      <h3>Balance Sheet</h3>
      <div>
        <button class="btn" onclick="exportReport('bs')"><span class="icon icon-export"></span>Export PDF</button>
        <button class="btn" onclick="exportReportExcel('bs')"><span class="icon icon-export"></span>Export Excel</button>
        <button class="btn" onclick="emailReport('bs')"><span class="icon icon-email"></span>Email Report</button>
      </div>
    </div>
    <div class="report-period">As of: ${toISO || new Date().toISOString().slice(0,10)}</div>
    
    <table class="table bs-table">
      <thead><tr><th>Account</th><th class="text-right">Amount (€)</th></tr></thead>
      <tbody>
        <tr class="section-header"><td colspan="2"><strong>ASSETS</strong></td></tr>
        <tr><td>&nbsp;&nbsp;Cash at Bank</td><td class="text-right">-</td></tr>
        <tr><td>&nbsp;&nbsp;Accounts Receivable</td><td class="text-right">-</td></tr>
        <tr><td>&nbsp;&nbsp;Inventory</td><td class="text-right">-</td></tr>
        <tr class="subtotal"><td><strong>Total Assets</strong></td><td class="text-right"><strong>-</strong></td></tr>
        
        <tr class="section-header"><td colspan="2"><strong>LIABILITIES</strong></td></tr>
        <tr><td>&nbsp;&nbsp;VAT Payable</td><td class="text-right">${vatLiability.toFixed(2)}</td></tr>
        <tr><td>&nbsp;&nbsp;Accounts Payable</td><td class="text-right">-</td></tr>
        <tr class="subtotal"><td><strong>Total Liabilities</strong></td><td class="text-right"><strong>${vatLiability.toFixed(2)}</strong></td></tr>
        
        <tr class="section-header"><td colspan="2"><strong>EQUITY</strong></td></tr>
        <tr><td>&nbsp;&nbsp;Capital</td><td class="text-right">-</td></tr>
        <tr><td>&nbsp;&nbsp;Retained Earnings</td><td class="text-right">${retainedEarnings.toFixed(2)}</td></tr>
        <tr class="subtotal"><td><strong>Total Equity</strong></td><td class="text-right"><strong>${retainedEarnings.toFixed(2)}</strong></td></tr>
        
        <tr class="total"><td><strong>TOTAL LIABILITIES + EQUITY</strong></td><td class="text-right"><strong>${(vatLiability + retainedEarnings).toFixed(2)}</strong></td></tr>
      </tbody>
    </table>
    
    <div class="mt">
      <p><em>Note: This is a simplified balance sheet. Asset values (cash, inventory) should be updated manually based on actual bank statements and stock counts.</em></p>
    </div>
  `;
}

function generateMonthlySummary(fromISO, toISO) {
  const monthlyData = {};
  const takings = listTakings(fromISO, toISO);
  const expenses = listExpenses(fromISO, toISO);
  const catalog = getCatalog();

  // Group takings by month
  takings.forEach(t => {
    const month = t.date.slice(0, 7); // YYYY-MM
    if (!monthlyData[month]) {
      monthlyData[month] = { revenue: 0, cogs: 0, expenses: 0 };
    }
    const totals = computeSaleTotals(t.lines, t.retailGross||0, t.vatMode, t.vatRate);
    monthlyData[month].revenue += totals.net;
    monthlyData[month].cogs += computeCOGS(t.lines, catalog);
  });

  // Group expenses by month
  expenses.forEach(e => {
    const month = e.date.slice(0, 7);
    if (!monthlyData[month]) {
      monthlyData[month] = { revenue: 0, cogs: 0, expenses: 0 };
    }
    monthlyData[month].expenses += e.net;
  });

  const months = Object.keys(monthlyData).sort();

  return `
    <div class="row between mb">
      <h3>Monthly Summary</h3>
      <div>
        <button class="btn" onclick="exportReport('monthly')"><span class="icon icon-export"></span>Export PDF</button>
        <button class="btn" onclick="exportReportExcel('monthly')"><span class="icon icon-export"></span>Export Excel</button>
        <button class="btn" onclick="emailReport('monthly')"><span class="icon icon-email"></span>Email Report</button>
      </div>
    </div>
    
    <table class="table">
      <thead>
        <tr>
          <th>Month</th>
          <th class="text-right">Revenue (€)</th>
          <th class="text-right">COGS (€)</th>
          <th class="text-right">Gross Profit (€)</th>
          <th class="text-right">Expenses (€)</th>
          <th class="text-right">Net Profit (€)</th>
        </tr>
      </thead>
      <tbody>
        ${months.map(month => {
          const data = monthlyData[month];
          const grossProfit = data.revenue - data.cogs;
          const netProfit = grossProfit - data.expenses;
          return `
            <tr>
              <td>${month}</td>
              <td class="text-right">${data.revenue.toFixed(2)}</td>
              <td class="text-right">${data.cogs.toFixed(2)}</td>
              <td class="text-right">${grossProfit.toFixed(2)}</td>
              <td class="text-right">${data.expenses.toFixed(2)}</td>
              <td class="text-right ${netProfit >= 0 ? 'text-success' : 'text-danger'}">${netProfit.toFixed(2)}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

function showReportTab(tabName) {
  // Hide all report sections
  document.querySelectorAll('.report-section').forEach(section => {
    section.classList.remove('active');
  });
  
  // Remove active class from all tabs
  document.querySelectorAll('.report-tabs .btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  // Show selected section and activate tab
  document.getElementById(`${tabName}-content`).classList.add('active');
  document.getElementById(`${tabName}-tab`).classList.add('active');
}

function exportReport(reportType) {
  const reportContent = document.getElementById(`${reportType}-content`);
  const reportHtml = reportContent.innerHTML;
  
  // Create a new window for PDF generation
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Salon Accounting Report</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .table th, .table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        .table th { background-color: #f5f5f5; }
        .text-right { text-align: right; }
        .section-header td { background-color: #f0f0f0; font-weight: bold; }
        .subtotal td { border-top: 2px solid #333; }
        .total td { border-top: 3px double #333; font-weight: bold; }
        .kpis { display: flex; flex-wrap: wrap; gap: 10px; margin: 20px 0; }
        .chip { background: #e0e0e0; padding: 10px; border-radius: 5px; }
        .btn { display: none; } /* Hide buttons in print */
        .report-period { margin: 10px 0; font-style: italic; }
      </style>
    </head>
    <body>
      <h1>Salon Accounting Report</h1>
      <p>Generated on: ${new Date().toLocaleString()}</p>
      ${reportHtml}
    </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

function exportReportExcel(reportType) {
  // Simple CSV export for Excel compatibility
  const reportContent = document.getElementById(`${reportType}-content`);
  const table = reportContent.querySelector('.table');
  
  if (!table) {
    alert('No table data to export');
    return;
  }
  
  let csv = '';
  const rows = table.querySelectorAll('tr');
  
  rows.forEach(row => {
    const cols = row.querySelectorAll('td, th');
    const rowData = Array.from(cols).map(col => {
      return '"' + col.textContent.replace(/"/g, '""') + '"';
    });
    csv += rowData.join(',') + '\n';
  });
  
  // Download CSV file
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `salon_report_${reportType}_${new Date().toISOString().slice(0,10)}.csv`;
  link.click();
}

// Service Analyzer Functions
function initializeServiceAnalyzer() {
  console.log('Initializing Service Analyzer...');
  
  populateServiceDropdown();
  
  // Add event listeners for real-time calculation
  const inputs = ['analyzer-price', 'analyzer-mins', 'analyzer-products', 'analyzer-utilities', 'analyzer-labour', 'analyzer-margin'];
  inputs.forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      // Remove existing listeners to avoid duplicates
      element.removeEventListener('input', calculateAnalysis);
      element.addEventListener('input', calculateAnalysis);
    }
  });
  
  // Auto-load service data when service is selected (no button click needed)
  const serviceSelect = document.getElementById('analyzer-service');
  if (serviceSelect) {
    console.log('Adding change listener to service select...');
    // Remove existing listeners to avoid duplicates
    serviceSelect.removeEventListener('change', handleServiceSelection);
    serviceSelect.addEventListener('change', handleServiceSelection);
  } else {
    console.log('Service select element not found');
  }
}

function handleServiceSelection(event) {
  console.log('Service selection changed to:', event.target.value);
  if (event.target.value) {
    loadServiceForAnalysis();
  } else {
    resetAnalyzer();
  }
}

function populateServiceDropdown() {
  const catalog = getCatalog();
  const select = document.getElementById('analyzer-service');
  
  // Clear existing options except the first one
  select.innerHTML = '<option value="">Choose a service to analyze...</option>';
  
  catalog.forEach(service => {
    const option = document.createElement('option');
    option.value = service.id;
    option.textContent = `${service.name} - €${service.price.toFixed(2)}`;
    select.appendChild(option);
  });
}

function loadServiceForAnalysis() {
  const serviceId = document.getElementById('analyzer-service').value;
  if (!serviceId) {
    // Hide the cost breakdown section if no service selected
    document.getElementById('cost-breakdown').style.display = 'none';
    return;
  }
  
  const catalog = getCatalog();
  const service = catalog.find(s => s.id === serviceId);
  
  if (!service) {
    matrixNotifications.error('Service not found');
    return;
  }
  
  // Populate the analyzer with current service data
  document.getElementById('analyzer-price').value = service.price.toFixed(2);
  document.getElementById('analyzer-mins').value = service.mins || 0;
  document.getElementById('analyzer-products').value = service.products.toFixed(2);
  document.getElementById('analyzer-utilities').value = service.utilities.toFixed(2);
  document.getElementById('analyzer-labour').value = service.labour.toFixed(2);
  
  // Show the cost breakdown section with smooth animation
  const costBreakdown = document.getElementById('cost-breakdown');
  costBreakdown.style.display = 'block';
  
  // Add Matrix Nova glow effect for enhanced UX
  costBreakdown.classList.add('matrix-glow');
  setTimeout(() => costBreakdown.classList.remove('matrix-glow'), 1000);
  
  // Calculate initial analysis
  calculateAnalysis();
  
  // Show success notification
  matrixNotifications.success(`Loaded data for: ${service.name}`, 3000);
}

function calculateAnalysis() {
  const price = parseFloat(document.getElementById('analyzer-price').value) || 0;
  const mins = parseFloat(document.getElementById('analyzer-mins').value) || 0;
  const products = parseFloat(document.getElementById('analyzer-products').value) || 0;
  const utilities = parseFloat(document.getElementById('analyzer-utilities').value) || 0;
  const labour = parseFloat(document.getElementById('analyzer-labour').value) || 0;
  const targetMargin = parseFloat(document.getElementById('analyzer-margin').value) || 0;
  
  // Calculate totals
  const totalCost = products + utilities + labour;
  const currentMargin = price > 0 ? ((price - totalCost) / price) * 100 : 0;
  const recommendedPrice = targetMargin > 0 ? totalCost / (1 - targetMargin / 100) : totalCost * 1.3;
  const profitPerService = price - totalCost;
  
  // Update display
  document.getElementById('total-cost').textContent = `€${totalCost.toFixed(2)}`;
  document.getElementById('current-margin').textContent = `${currentMargin.toFixed(1)}%`;
  document.getElementById('recommended-price').textContent = `€${recommendedPrice.toFixed(2)}`;
  document.getElementById('profit-per-service').textContent = `€${profitPerService.toFixed(2)}`;
  
  // Add color coding for profit and margin
  const profitElement = document.getElementById('profit-per-service');
  const marginElement = document.getElementById('current-margin');
  
  profitElement.className = `value ${profitPerService >= 0 ? 'text-success' : 'text-danger'}`;
  marginElement.className = `value ${currentMargin >= targetMargin ? 'text-success' : 'text-warning'}`;
  
  // Show save button if we have valid data
  const saveBtn = document.getElementById('save-to-catalog-btn');
  if (price > 0 && totalCost > 0) {
    saveBtn.style.display = 'inline-flex';
  } else {
    saveBtn.style.display = 'none';
  }
}

function saveAnalyzedService() {
  const serviceId = document.getElementById('analyzer-service').value;
  const price = parseFloat(document.getElementById('analyzer-price').value) || 0;
  const mins = parseFloat(document.getElementById('analyzer-mins').value) || 0;
  const products = parseFloat(document.getElementById('analyzer-products').value) || 0;
  const utilities = parseFloat(document.getElementById('analyzer-utilities').value) || 0;
  const labour = parseFloat(document.getElementById('analyzer-labour').value) || 0;
  
  if (!price || !products || !utilities || !labour) {
    matrixNotifications.error('Please fill in all cost fields before saving');
    return;
  }
  
  const catalog = getCatalog();
  
  if (serviceId) {
    // Update existing service
    const service = catalog.find(s => s.id === serviceId);
    if (service) {
      const oldPrice = service.price;
      service.price = price;
      service.mins = mins;
      service.products = products;
      service.utilities = utilities;
      service.labour = labour;
      upsertService(service);
      
      matrixNotifications.success(`Service "${service.name}" updated successfully! Price changed from €${oldPrice.toFixed(2)} to €${price.toFixed(2)}`, 5000);
      
      // Refresh the dropdown to show updated prices
      populateServiceDropdown();
      
      // Set the dropdown to the updated service
      document.getElementById('analyzer-service').value = serviceId;
    }
  } else {
    // Create new service
    const serviceName = prompt('Enter name for new service:');
    if (!serviceName) return;
    
    const newService = {
      name: serviceName,
      price: price,
      mins: mins,
      products: products,
      utilities: utilities,
      labour: labour
    };
    
    upsertService(newService);
    matrixNotifications.success(`New service "${serviceName}" added to catalog with price €${price.toFixed(2)}!`, 5000);
    
    // Refresh the dropdown
    populateServiceDropdown();
    
    // Automatically select the new service
    setTimeout(() => {
      const updatedCatalog = getCatalog();
      const addedService = updatedCatalog.find(s => s.name === serviceName);
      if (addedService) {
        document.getElementById('analyzer-service').value = addedService.id;
      }
    }, 100);
  }
  
  // Refresh catalog display if we're on the catalog tab
  if (window.renderCatalog) {
    renderCatalog();
  }
}

function resetAnalyzer() {
  document.getElementById('analyzer-service').value = '';
  document.getElementById('analyzer-price').value = '';
  document.getElementById('analyzer-mins').value = '';
  document.getElementById('analyzer-products').value = '';
  document.getElementById('analyzer-utilities').value = '';
  document.getElementById('analyzer-labour').value = '';
  document.getElementById('analyzer-margin').value = '30';
  
  document.getElementById('cost-breakdown').style.display = 'none';
  document.getElementById('save-to-catalog-btn').style.display = 'none';
}

function emailReport(reportType) {
  const reportContent = document.getElementById(`${reportType}-content`);
  if (!reportContent) {
    matrixNotifications.error('Report content not found');
    return;
  }
  
  showEmailModal(reportType);
}

function showEmailModal(reportType) {
  // Create modal HTML
  const modalHTML = `
    <div id="email-modal" class="modal-overlay">
      <div class="modal">
        <div class="modal-header">
          <h3><span class="icon icon-email"></span>Email Report</h3>
          <button class="btn subtle modal-close" onclick="closeEmailModal()">
            <span class="icon icon-remove"></span>
          </button>
        </div>
        <div class="modal-body">
          <form id="email-form">
            <div class="form-group">
              <label for="accountant-email">Accountant Email</label>
              <input type="email" id="accountant-email" placeholder="accountant@example.com" required>
            </div>
            <div class="form-group">
              <label for="email-subject">Subject</label>
              <input type="text" id="email-subject" value="Salon Accounting Report - ${reportType.toUpperCase()}" required>
            </div>
            <div class="form-group">
              <label for="email-message">Message</label>
              <textarea id="email-message" rows="4" placeholder="Please find attached the salon accounting report...">Please find attached the salon accounting report for your review.

Generated on: ${new Date().toLocaleString()}

Best regards,
Dunboyne Hair Studio</textarea>
            </div>
            <div class="form-group">
              <label>
                <input type="checkbox" id="include-csv" checked>
                Include CSV export for Excel compatibility
              </label>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn" onclick="closeEmailModal()">Cancel</button>
          <button class="btn primary" onclick="sendEmailReport('${reportType}')">
            <span class="icon icon-email"></span>Send Email
          </button>
        </div>
      </div>
    </div>
  `;
  
  // Add modal to document
  const existingModal = document.getElementById('email-modal');
  if (existingModal) {
    existingModal.remove();
  }
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  // Show modal with animation
  requestAnimationFrame(() => {
    document.getElementById('email-modal').classList.add('active');
  });
  
  // Focus on email input
  document.getElementById('accountant-email').focus();
  
  // Load saved accountant email if available
  const savedEmail = localStorage.getItem('accountant-email');
  if (savedEmail) {
    document.getElementById('accountant-email').value = savedEmail;
  }
}

function closeEmailModal() {
  const modal = document.getElementById('email-modal');
  if (modal) {
    modal.classList.remove('active');
    setTimeout(() => modal.remove(), 300);
  }
}

function sendEmailReport(reportType) {
  const form = document.getElementById('email-form');
  if (!form.checkValidity()) {
    matrixNotifications.error('Please fill in all required fields');
    return;
  }
  
  const email = document.getElementById('accountant-email').value;
  const subject = document.getElementById('email-subject').value;
  const message = document.getElementById('email-message').value;
  const includeCsv = document.getElementById('include-csv').checked;
  
  // Save accountant email for future use
  localStorage.setItem('accountant-email', email);
  
  // Generate report content for email
  const reportContent = document.getElementById(`${reportType}-content`);
  const reportHTML = generateEmailReport(reportType, reportContent);
  
  // Create mailto link with report data
  const mailtoLink = createMailtoLink(email, subject, message, reportHTML, includeCsv);
  
  try {
    // Open email client
    window.location.href = mailtoLink;
    
    // Show success message
    matrixNotifications.success('Email client opened with report data');
    
    // Close modal
    closeEmailModal();
    
    // Also offer to copy the report content
    setTimeout(() => {
      if (confirm('Would you like to copy the report content to clipboard as backup?')) {
        copyReportToClipboard(reportType);
      }
    }, 1000);
    
  } catch (error) {
    console.error('Error opening email client:', error);
    matrixNotifications.error('Could not open email client. Report content copied to clipboard.');
    copyReportToClipboard(reportType);
    closeEmailModal();
  }
}

function generateEmailReport(reportType, reportContent) {
  const reportTitle = getReportTitle(reportType);
  const reportHTML = reportContent.innerHTML;
  
  return `
    <h1>${reportTitle}</h1>
    <p>Generated on: ${new Date().toLocaleString()}</p>
    <hr>
    ${reportHTML}
    <hr>
    <p><em>This report was generated by Dunboyne Hair Studio accounting system.</em></p>
  `;
}

function getReportTitle(reportType) {
  const titles = {
    'kpi': 'KPI Summary Report',
    'pl': 'Profit & Loss Statement',
    'bs': 'Balance Sheet',
    'monthly': 'Monthly Summary Report'
  };
  return titles[reportType] || 'Accounting Report';
}

function createMailtoLink(email, subject, message, reportHTML, includeCsv) {
  const encodedSubject = encodeURIComponent(subject);
  const encodedMessage = encodeURIComponent(
    message + '\n\n' + 
    '--- REPORT DATA ---\n' + 
    stripHTML(reportHTML) + 
    '\n\n' + 
    'Note: For better formatting, please use the PDF or Excel export options.'
  );
  
  return `mailto:${email}?subject=${encodedSubject}&body=${encodedMessage}`;
}

function stripHTML(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

function copyReportToClipboard(reportType) {
  const reportContent = document.getElementById(`${reportType}-content`);
  const reportText = stripHTML(reportContent.innerHTML);
  
  if (navigator.clipboard) {
    navigator.clipboard.writeText(reportText).then(() => {
      matrixNotifications.success('Report content copied to clipboard');
    }).catch(() => {
      fallbackCopyTextToClipboard(reportText);
    });
  } else {
    fallbackCopyTextToClipboard(reportText);
  }
}

function fallbackCopyTextToClipboard(text) {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  
  try {
    document.execCommand('copy');
    matrixNotifications.success('Report content copied to clipboard');
  } catch (err) {
    matrixNotifications.error('Could not copy to clipboard');
  }
  
  document.body.removeChild(textArea);
}

// Initialize service analyzer when the page loads
document.addEventListener('DOMContentLoaded', function() {
  // Use setTimeout to ensure all other DOM manipulation is complete
  setTimeout(() => {
    initializeServiceAnalyzer();
  }, 100);
});

// Also try to initialize when the reports tab or analyzer tab is shown
document.addEventListener('click', function(e) {
  if (e.target.dataset && (e.target.dataset.tab === 'reports' || e.target.dataset.tab === 'analyzer')) {
    setTimeout(() => {
      initializeServiceAnalyzer();
    }, 100);
  }
});
