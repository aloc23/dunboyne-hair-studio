
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
        
        <!-- Key Metrics Section (Collapsible) -->
        <div class="collapsible-section expanded" id="kpi-metrics-section">
          <div class="collapsible-header" onclick="toggleCollapse('kpi-metrics-section')">
            <h4>📊 KEY PERFORMANCE INDICATORS</h4>
            <div class="section-summary">
              <div class="summary-chip highlight">Revenue: €${totalGross.toFixed(2)}</div>
              <div class="summary-chip ${operatingProfit >= 0 ? 'highlight' : ''}">Profit: €${operatingProfit.toFixed(2)}</div>
            </div>
            <button class="collapsible-toggle">▼</button>
          </div>
          <div class="collapsible-content">
            <div class="collapsible-body">
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
            </div>
          </div>
        </div>
        
        <!-- Expenses Detail Section (Collapsible) -->
        <div class="collapsible-section expanded" id="kpi-expenses-section">
          <div class="collapsible-header" onclick="toggleCollapse('kpi-expenses-section')">
            <h4>💸 EXPENSES DETAIL</h4>
            <div class="section-summary">
              <div class="summary-chip">Total: €${expNet.toFixed(2)}</div>
              <div class="summary-chip">${expenses.length} Transactions</div>
            </div>
            <button class="collapsible-toggle">▼</button>
          </div>
          <div class="collapsible-content">
            <div class="collapsible-body">
              <table class="table">
                <thead><tr><th>Date</th><th>Category</th><th>Supplier</th><th>Net</th><th>VAT</th><th>Total</th></tr></thead>
                <tbody>
                  ${expenses.map(e=>`<tr><td>${e.date}</td><td>${e.category}</td><td>${e.supplier||''}</td><td>${e.net.toFixed(2)}</td><td>${e.vat.toFixed(2)}</td><td>${e.total.toFixed(2)}</td></tr>`).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
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
  
  // Initialize collapsible sections after rendering
  setTimeout(() => {
    initializeCollapsibleSections();
  }, 100);
}

function generatePLStatement(svcGross, retailGross, totalGross, net, vat, cogs, expenses, grossProfit, operatingProfit, fromISO, toISO) {
  const expensesByCategory = {};
  let staffExpenses = 0;
  let otherExpenses = 0;
  
  expenses.forEach(e => {
    if (!expensesByCategory[e.category]) expensesByCategory[e.category] = 0;
    expensesByCategory[e.category] += e.net;
    
    if (e.category === 'Staff Expenses') {
      staffExpenses += e.net;
    } else {
      otherExpenses += e.net;
    }
  });

  // Calculate labor costs from actual services performed
  const takings = listTakings(fromISO, toISO);
  const catalog = getCatalog();
  const serviceLaborCosts = takings.reduce((total, taking) => {
    return total + taking.lines.reduce((lineTotal, line) => {
      const service = catalog.find(s => s.id === line.serviceId);
      if (service) {
        // Use laborCost field if available, fallback to labour field
        const laborCost = service.laborCost || service.labour || 0;
        return lineTotal + laborCost * (line.qty || 1);
      }
      return lineTotal;
    }, 0);
  }, 0);

  // Total staff costs including both manual expenses and service labor costs
  const totalStaffCosts = staffExpenses + serviceLaborCosts;

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
    
    <!-- Revenue Section (Collapsible) -->
    <div class="collapsible-section expanded" id="revenue-section">
      <div class="collapsible-header" onclick="toggleCollapse('revenue-section')">
        <h4>💰 REVENUE</h4>
        <div class="section-summary">
          <div class="summary-chip highlight">Total: €${totalGross.toFixed(2)}</div>
          <div class="summary-chip">Net: €${net.toFixed(2)}</div>
        </div>
        <button class="collapsible-toggle">▼</button>
      </div>
      <div class="collapsible-content">
        <div class="collapsible-body">
          <table class="table">
            <tbody>
              <tr><td>&nbsp;&nbsp;Service Revenue</td><td class="text-right">${svcGross.toFixed(2)}</td></tr>
              <tr><td>&nbsp;&nbsp;Retail Revenue</td><td class="text-right">${retailGross.toFixed(2)}</td></tr>
              <tr class="subtotal"><td><strong>Total Revenue (Gross)</strong></td><td class="text-right"><strong>${totalGross.toFixed(2)}</strong></td></tr>
              <tr><td>&nbsp;&nbsp;Less: VAT Output</td><td class="text-right">(${vat.toFixed(2)})</td></tr>
              <tr class="subtotal"><td><strong>Total Revenue (Net)</strong></td><td class="text-right"><strong>${net.toFixed(2)}</strong></td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
    
    <!-- Cost of Goods Sold Section (Collapsible) -->
    <div class="collapsible-section expanded" id="cogs-section">
      <div class="collapsible-header" onclick="toggleCollapse('cogs-section')">
        <h4>📦 COST OF GOODS SOLD</h4>
        <div class="section-summary">
          <div class="summary-chip">COGS: €${cogs.toFixed(2)}</div>
          <div class="summary-chip highlight">Gross Profit: €${grossProfit.toFixed(2)}</div>
        </div>
        <button class="collapsible-toggle">▼</button>
      </div>
      <div class="collapsible-content">
        <div class="collapsible-body">
          <table class="table">
            <tbody>
              <tr><td>&nbsp;&nbsp;Direct Service Costs</td><td class="text-right">(${cogs.toFixed(2)})</td></tr>
              <tr class="subtotal"><td><strong>Gross Profit</strong></td><td class="text-right"><strong>${grossProfit.toFixed(2)}</strong></td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
    
    <!-- Staff Expenses Section (Collapsible) -->
    <div class="collapsible-section expanded" id="staff-expenses-section">
      <div class="collapsible-header" onclick="toggleCollapse('staff-expenses-section')">
        <h4>👥 STAFF EXPENSES</h4>
        <div class="section-summary">
          <div class="summary-chip ${totalStaffCosts > 0 ? 'highlight' : ''}">Total: €${totalStaffCosts.toFixed(2)}</div>
        </div>
        <button class="collapsible-toggle">▼</button>
      </div>
      <div class="collapsible-content">
        <div class="collapsible-body">
          <table class="table">
            <tbody>
              <tr><td>&nbsp;&nbsp;Staff Wages & Salaries</td><td class="text-right">(${staffExpenses.toFixed(2)})</td></tr>
              <tr><td>&nbsp;&nbsp;Service Labor Costs</td><td class="text-right">(${serviceLaborCosts.toFixed(2)})</td></tr>
              <tr class="subtotal"><td><strong>Total Staff Expenses</strong></td><td class="text-right"><strong>(${totalStaffCosts.toFixed(2)})</strong></td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
    
    <!-- Other Operating Expenses Section (Collapsible) -->
    <div class="collapsible-section expanded" id="expenses-section">
      <div class="collapsible-header" onclick="toggleCollapse('expenses-section')">
        <h4>💸 OTHER OPERATING EXPENSES</h4>
        <div class="section-summary">
          <div class="summary-chip">Total: €${otherExpenses.toFixed(2)}</div>
          <div class="summary-chip">${Object.keys(expensesByCategory).filter(cat => cat !== 'Staff Expenses').length} Categories</div>
        </div>
        <button class="collapsible-toggle">▼</button>
      </div>
      <div class="collapsible-content">
        <div class="collapsible-body">
          <table class="table">
            <tbody>
              ${Object.entries(expensesByCategory)
                .filter(([cat]) => cat !== 'Staff Expenses')
                .map(([cat, amount]) => 
                  `<tr><td>&nbsp;&nbsp;${cat}</td><td class="text-right">(${amount.toFixed(2)})</td></tr>`
                ).join('')}
              <tr class="subtotal"><td><strong>Total Other Operating Expenses</strong></td><td class="text-right"><strong>(${otherExpenses.toFixed(2)})</strong></td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
    
    <!-- Net Profit Summary -->
    <div class="collapsible-section expanded" id="profit-section">
      <div class="collapsible-header" onclick="toggleCollapse('profit-section')">
        <h4>📊 NET PROFIT SUMMARY</h4>
        <div class="section-summary">
          <div class="summary-chip ${operatingProfit >= 0 ? 'highlight' : ''}">${operatingProfit >= 0 ? 'Profit' : 'Loss'}: €${operatingProfit.toFixed(2)}</div>
        </div>
        <button class="collapsible-toggle">▼</button>
      </div>
      <div class="collapsible-content">
        <div class="collapsible-body">
          <table class="table">
            <tbody>
              <tr><td>&nbsp;&nbsp;Total Expenses</td><td class="text-right">(${(staffExpenses + otherExpenses).toFixed(2)})</td></tr>
              <tr class="total"><td><strong>NET PROFIT</strong></td><td class="text-right"><strong>${operatingProfit.toFixed(2)}</strong></td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

// Calculate inventory value based on service catalog and usage patterns
function calculateInventoryValue(toISO) {
  const catalog = getCatalog();
  const recentTakings = listTakings(null, toISO);
  
  // Get last 3 months of data for calculating average usage
  const threeMonthsAgo = new Date(toISO || new Date());
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const threeMonthsAgoISO = threeMonthsAgo.toISOString().slice(0, 10);
  const recentUsage = listTakings(threeMonthsAgoISO, toISO);
  
  // Calculate total products cost from recent services using enhanced logic
  const totalProductsCost = recentUsage.reduce((sum, taking) => {
    return sum + taking.lines.reduce((lineSum, line) => {
      const service = catalog.find(s => s.id === line.serviceId);
      if (service) {
        // Use productSupplies field if available, fallback to products field
        const productCost = service.productSupplies || service.products || 0;
        return lineSum + productCost * (line.qty || 1);
      }
      return lineSum;
    }, 0);
  }, 0);
  
  // Enhanced inventory calculation with aggregate service cost data
  // Calculate average monthly usage and apply proper inventory buffer
  const monthlyProductsCost = recentUsage.length > 0 ? totalProductsCost / 3 : 0;
  
  // If no recent usage, calculate estimated inventory from service catalog
  let baseInventoryValue = 0;
  if (monthlyProductsCost === 0) {
    // Calculate average product cost across all services as baseline
    const avgProductCost = catalog.reduce((sum, service) => {
      return sum + (service.productSupplies || service.products || 0);
    }, 0) / Math.max(catalog.length, 1);
    
    // Estimate 2 months of basic inventory for new salon or low activity periods
    baseInventoryValue = avgProductCost * catalog.length * 0.1; // 10% of total services capacity
  }
  
  // Use 1.5 months buffer for active periods, 2 months for baseline
  const estimatedInventory = monthlyProductsCost > 0 
    ? monthlyProductsCost * 1.5 
    : baseInventoryValue * 2;
  
  return Math.max(estimatedInventory, 0);
}

function generateBalanceSheet(fromISO, toISO) {
  const db = loadDB();
  const settings = getSettings();
  
  // Get Balance Sheet data
  const balanceSheetData = getBalanceSheetData();
  
  // Calculate inventory value automatically
  const inventoryValue = calculateInventoryValue(toISO);
  
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
  
  // Calculate total assets including cash, inventory and manual inputs
  const totalAssets = balanceSheetData.cashInBank + inventoryValue;
  
  // Calculate total equity including capital and retained earnings
  const totalEquity = balanceSheetData.capital + retainedEarnings;

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
        <tr>
          <td>&nbsp;&nbsp;Cash at Bank</td>
          <td class="text-right">
            <input type="number" step="0.01" value="${balanceSheetData.cashInBank.toFixed(2)}" 
                   id="cash-in-bank" class="bs-editable-field" onchange="updateBalanceSheetField('cashInBank', this.value)" />
          </td>
        </tr>
        <tr><td>&nbsp;&nbsp;Accounts Receivable</td><td class="text-right">-</td></tr>
        <tr><td>&nbsp;&nbsp;Inventory <span class="text-muted" style="font-size: var(--font-size-xs);">(Auto-calculated)</span></td><td class="text-right">${inventoryValue.toFixed(2)}</td></tr>
        <tr class="subtotal"><td><strong>Total Assets</strong></td><td class="text-right"><strong id="total-assets">${totalAssets.toFixed(2)}</strong></td></tr>
        
        <tr class="section-header"><td colspan="2"><strong>LIABILITIES</strong></td></tr>
        <tr><td>&nbsp;&nbsp;VAT Payable</td><td class="text-right">${vatLiability.toFixed(2)}</td></tr>
        <tr><td>&nbsp;&nbsp;Accounts Payable</td><td class="text-right">-</td></tr>
        <tr class="subtotal"><td><strong>Total Liabilities</strong></td><td class="text-right"><strong>${vatLiability.toFixed(2)}</strong></td></tr>
        
        <tr class="section-header"><td colspan="2"><strong>EQUITY</strong></td></tr>
        <tr>
          <td>&nbsp;&nbsp;Capital</td>
          <td class="text-right">
            <input type="number" step="0.01" value="${balanceSheetData.capital.toFixed(2)}" 
                   id="capital" class="bs-editable-field" onchange="updateBalanceSheetField('capital', this.value)" />
          </td>
        </tr>
        <tr><td>&nbsp;&nbsp;Retained Earnings</td><td class="text-right">${retainedEarnings.toFixed(2)}</td></tr>
        <tr class="subtotal"><td><strong>Total Equity</strong></td><td class="text-right"><strong id="total-equity">${totalEquity.toFixed(2)}</strong></td></tr>
        
        <tr class="total"><td><strong>TOTAL LIABILITIES + EQUITY</strong></td><td class="text-right"><strong id="total-liab-equity">${(vatLiability + totalEquity).toFixed(2)}</strong></td></tr>
      </tbody>
    </table>
    
    <div class="mt">
      <p><em>Note: Inventory value is automatically calculated using product supplies data from the service catalog and recent usage patterns. For active periods, it represents 1.5 months of stock based on service activity. For new or low-activity periods, it estimates 2 months of baseline inventory. Labor costs from services are tracked separately in staff expenses. Cash and Capital values can be edited and will be saved automatically.</em></p>
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

// Enhanced collapsible functionality for report sections
function toggleCollapse(sectionId) {
  const section = document.getElementById(sectionId);
  if (!section) return;
  
  section.classList.toggle('expanded');
  
  // Add some nice visual feedback
  const header = section.querySelector('.collapsible-header');
  if (header) {
    header.style.transform = section.classList.contains('expanded') ? 'none' : 'scale(0.98)';
    setTimeout(() => {
      if (header.style) header.style.transform = '';
    }, 150);
  }
}

// Initialize all collapsible sections as expanded by default
function initializeCollapsibleSections() {
  document.querySelectorAll('.collapsible-section').forEach(section => {
    if (!section.classList.contains('expanded')) {
      section.classList.add('expanded');
    }
  });
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
  
  try {
    // Try to populate service dropdown first
    populateServiceDropdown();
    
    // Add event listeners for real-time calculation
    const inputs = ['analyzer-price', 'analyzer-mins', 'analyzer-products', 'analyzer-utilities', 'analyzer-labour', 'analyzer-margin'];
    const missingInputs = [];
    
    inputs.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        // Remove existing listeners to avoid duplicates
        element.removeEventListener('input', calculateAnalysis);
        element.addEventListener('input', calculateAnalysis);
        console.log(`Successfully added input listener to: ${id}`);
      } else {
        missingInputs.push(id);
      }
    });
    
    // Log missing input elements for diagnostics
    if (missingInputs.length > 0) {
      console.error('Service Analyzer: Missing input elements:', missingInputs);
      console.error('These elements are required for the analyzer to function properly. Please check the HTML structure.');
    }
    
    // Auto-load service data when service is selected (no button click needed)
    const serviceSelect = document.getElementById('analyzer-service');
    if (serviceSelect) {
      console.log('Adding change listener to service select...');
      // Remove existing listeners to avoid duplicates
      serviceSelect.removeEventListener('change', handleServiceSelection);
      serviceSelect.addEventListener('change', handleServiceSelection);
      console.log('Service Analyzer initialization completed successfully');
    } else {
      console.warn('Service Analyzer: Service select element (analyzer-service) not found in DOM');
      console.warn('The service selection functionality will not be available. Please ensure the analyzer-service element exists.');
    }
    
  } catch (error) {
    console.error('Service Analyzer initialization failed:', error);
    console.error('The Service Analyzer may not function properly. Please check console for details and verify DOM structure.');
    
    // Don't throw the error to prevent breaking the app
    if (window.MatrixNova && window.MatrixNova.Notifications) {
      MatrixNova.Notifications.error('Service Analyzer failed to initialize. Check console for details.');
    }
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
  try {
    const catalog = getCatalog();
    const select = document.getElementById('analyzer-service');
    
    if (!select) {
      console.error('Service Analyzer: Cannot populate dropdown - analyzer-service element not found');
      console.error('Please ensure the analyzer-service select element exists in the DOM');
      return;
    }
    
    if (!catalog || !Array.isArray(catalog)) {
      console.error('Service Analyzer: Cannot populate dropdown - invalid catalog data:', catalog);
      return;
    }
    
    // Clear existing options except the first one
    select.innerHTML = '<option value="">Choose a service to analyze...</option>';
    
    catalog.forEach(service => {
      if (service && service.id && service.name && typeof service.price === 'number') {
        const option = document.createElement('option');
        option.value = service.id;
        option.textContent = `${service.name} - €${service.price.toFixed(2)}`;
        select.appendChild(option);
      } else {
        console.warn('Service Analyzer: Skipping invalid service data:', service);
      }
    });
    
    console.log(`Service Analyzer: Successfully populated dropdown with ${catalog.length} services`);
    
  } catch (error) {
    console.error('Service Analyzer: Error populating service dropdown:', error);
    console.error('The service dropdown may not function properly. Please check the catalog data and DOM structure.');
  }
}

function loadServiceForAnalysis() {
  try {
    const serviceSelect = document.getElementById('analyzer-service');
    if (!serviceSelect) {
      console.error('Service Analyzer: Cannot load service - analyzer-service element not found');
      return;
    }
    
    const serviceId = serviceSelect.value;
    if (!serviceId) {
      // Hide the cost breakdown section if no service selected
      const costBreakdown = document.getElementById('cost-breakdown');
      if (costBreakdown) {
        costBreakdown.style.display = 'none';
      }
      return;
    }
    
    const catalog = getCatalog();
    if (!catalog || !Array.isArray(catalog)) {
      console.error('Service Analyzer: Cannot load service - invalid catalog data');
      if (window.MatrixNova && window.MatrixNova.Notifications) {
        MatrixNova.Notifications.error('Unable to load service data - catalog not available');
      }
      return;
    }
    
    const service = catalog.find(s => s.id === serviceId);
    
    if (!service) {
      console.error(`Service Analyzer: Service with ID ${serviceId} not found in catalog`);
      if (window.MatrixNova && window.MatrixNova.Notifications) {
        MatrixNova.Notifications.error('Service not found');
      }
      return;
    }
    
    // Check if required input elements exist before populating
    const requiredElements = ['analyzer-price', 'analyzer-mins', 'analyzer-products', 'analyzer-utilities', 'analyzer-labour'];
    const missingElements = [];
    
    requiredElements.forEach(id => {
      const element = document.getElementById(id);
      if (!element) {
        missingElements.push(id);
      }
    });
    
    if (missingElements.length > 0) {
      console.error('Service Analyzer: Cannot load service data - missing required elements:', missingElements);
      if (window.MatrixNova && window.MatrixNova.Notifications) {
        MatrixNova.Notifications.error('Some analyzer input fields are missing from the page');
      }
      return;
    }
    
    // Populate the analyzer with current service data
    document.getElementById('analyzer-price').value = service.price.toFixed(2);
    document.getElementById('analyzer-mins').value = service.mins || 0;
    document.getElementById('analyzer-products').value = (service.products || 0).toFixed(2);
    document.getElementById('analyzer-utilities').value = (service.utilities || 0).toFixed(2);
    document.getElementById('analyzer-labour').value = (service.labour || 0).toFixed(2);
    
    // Show the cost breakdown section with smooth animation
    const costBreakdown = document.getElementById('cost-breakdown');
    if (costBreakdown) {
      costBreakdown.style.display = 'block';
      
      // Add Matrix Nova glow effect for enhanced UX
      costBreakdown.classList.add('matrix-glow');
      setTimeout(() => costBreakdown.classList.remove('matrix-glow'), 1000);
    } else {
      console.warn('Service Analyzer: cost-breakdown element not found - visual feedback will not be shown');
    }
    
    // Calculate initial analysis
    calculateAnalysis();
    
    // Show success notification
    if (window.MatrixNova && window.MatrixNova.Notifications) {
      MatrixNova.Notifications.success(`Loaded data for: ${service.name}`, 3000);
    }
    
    console.log(`Service Analyzer: Successfully loaded service data for: ${service.name}`);
    
  } catch (error) {
    console.error('Service Analyzer: Error loading service for analysis:', error);
    if (window.MatrixNova && window.MatrixNova.Notifications) {
      MatrixNova.Notifications.error('Failed to load service data. Check console for details.');
    }
  }
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
    if (window.MatrixNova && window.MatrixNova.Notifications) {
      MatrixNova.Notifications.error('Please fill in all cost fields before saving');
    }
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
      
      if (window.MatrixNova && window.MatrixNova.Notifications) {
        MatrixNova.Notifications.success(`Service "${service.name}" updated successfully! Price changed from €${oldPrice.toFixed(2)} to €${price.toFixed(2)}`, 5000);
      }
      
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
    if (window.MatrixNova && window.MatrixNova.Notifications) {
      MatrixNova.Notifications.success(`New service "${serviceName}" added to catalog with price €${price.toFixed(2)}!`, 5000);
    }
    
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
    if (window.MatrixNova && window.MatrixNova.Notifications) {
      MatrixNova.Notifications.error('Report content not found');
    }
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
    if (window.MatrixNova && window.MatrixNova.Notifications) {
      MatrixNova.Notifications.error('Please fill in all required fields');
    }
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
    if (window.MatrixNova && window.MatrixNova.Notifications) {
      MatrixNova.Notifications.success('Email client opened with report data');
    }
    
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
    if (window.MatrixNova && window.MatrixNova.Notifications) {
      MatrixNova.Notifications.error('Could not open email client. Report content copied to clipboard.');
    }
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
      if (window.MatrixNova && window.MatrixNova.Notifications) {
        MatrixNova.Notifications.success('Report content copied to clipboard');
      }
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
    if (window.MatrixNova && window.MatrixNova.Notifications) {
      MatrixNova.Notifications.success('Report content copied to clipboard');
    }
  } catch (err) {
    if (window.MatrixNova && window.MatrixNova.Notifications) {
      MatrixNova.Notifications.error('Could not copy to clipboard');
    }
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

// Balance Sheet field update function
function updateBalanceSheetField(field, value) {
  const currentData = getBalanceSheetData();
  
  if (field === 'cashInBank') {
    updateBalanceSheetData(value, currentData.capital);
  } else if (field === 'capital') {
    updateBalanceSheetData(currentData.cashInBank, value);
  }
  
  // Recalculate and update totals
  updateBalanceSheetTotals();
}

function updateBalanceSheetTotals() {
  const balanceSheetData = getBalanceSheetData();
  const inventoryValue = parseFloat(document.querySelector('.bs-table tr:nth-child(5) td:nth-child(2)').textContent) || 0;
  const vatLiability = parseFloat(document.querySelector('.bs-table tr:nth-child(7) td:nth-child(2)').textContent) || 0;
  const retainedEarnings = parseFloat(document.querySelector('.bs-table tr:nth-child(11) td:nth-child(2)').textContent) || 0;
  
  const totalAssets = balanceSheetData.cashInBank + inventoryValue;
  const totalEquity = balanceSheetData.capital + retainedEarnings;
  const totalLiabEquity = vatLiability + totalEquity;
  
  // Update the display
  const totalAssetsElement = document.getElementById('total-assets');
  const totalEquityElement = document.getElementById('total-equity');
  const totalLiabEquityElement = document.getElementById('total-liab-equity');
  
  if (totalAssetsElement) totalAssetsElement.textContent = totalAssets.toFixed(2);
  if (totalEquityElement) totalEquityElement.textContent = totalEquity.toFixed(2);
  if (totalLiabEquityElement) totalLiabEquityElement.textContent = totalLiabEquity.toFixed(2);
}
