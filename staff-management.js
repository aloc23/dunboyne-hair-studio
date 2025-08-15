// Unified Staff Management Module
// Consolidates staff costs, analysis, and wages comparison functionality

// Initialize the unified staff management system
function initStaffManagement() {
  // Initialize all sub-components
  initStaffCosts();
  initStaffAnalysis();
  initWagesComparison();
  
  console.log('Staff Management: Unified system initialized');
}

// Staff Cost Entry functionality (migrated from staff-costs.js)
function initStaffCosts() {
  // Set default date to today
  const dateField = document.getElementById('staff-cost-date');
  if (dateField) {
    dateField.value = new Date().toISOString().split('T')[0];
  }
  
  // Populate staff member dropdown from wages data
  populateStaffMembersDropdown();
  
  // Set up event listeners for real-time calculations
  addStaffCostEventListeners();
  
  // Render existing staff costs
  renderStaffCostsList();
  
  // Update summary data
  updateStaffCostsSummary();
}

// Populate staff member dropdown from existing wages data
function populateStaffMembersDropdown() {
  const staffSelect = document.getElementById('staff-member');
  if (!staffSelect) return;
  
  const wagesData = getWagesData();
  
  // Clear existing options except first
  staffSelect.innerHTML = '<option value="">Select staff member...</option>';
  
  wagesData.forEach(staff => {
    const option = document.createElement('option');
    option.value = staff.id;
    option.textContent = staff.name;
    option.dataset.rate = staff.hourlyRate || 0;
    staffSelect.appendChild(option);
  });
  
  // Add option to add new staff member
  const addNewOption = document.createElement('option');
  addNewOption.value = 'new';
  addNewOption.textContent = 'Add New Staff Member...';
  staffSelect.appendChild(addNewOption);
}

// Add event listeners for staff costs form
function addStaffCostEventListeners() {
  // Real-time calculation updates
  const inputs = ['staff-hours', 'staff-rate', 'staff-additional'];
  inputs.forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener('input', calculateStaffCostTotals);
      element.addEventListener('change', calculateStaffCostTotals);
    }
  });
  
  // Staff member selection
  const staffMemberSelect = document.getElementById('staff-member');
  if (staffMemberSelect) {
    staffMemberSelect.addEventListener('change', (e) => {
      if (e.target.value === 'new') {
        addNewStaffMember();
      } else if (e.target.value) {
        // Auto-populate rate from selected staff member
        const selectedOption = e.target.selectedOptions[0];
        const rate = selectedOption.dataset.rate || 0;
        const rateField = document.getElementById('staff-rate');
        if (rateField) {
          rateField.value = parseFloat(rate).toFixed(2);
          calculateStaffCostTotals();
        }
      }
    });
  }
  
  // Post staff cost button
  const postButton = document.getElementById('post-staff-cost');
  if (postButton) {
    postButton.addEventListener('click', postStaffCost);
  }
  
  // Reset form button
  const resetButton = document.getElementById('reset-staff-cost');
  if (resetButton) {
    resetButton.addEventListener('click', resetStaffCostForm);
  }
  
  // Clear all staff costs button
  const clearButton = document.getElementById('clear-all-staff-costs');
  if (clearButton) {
    clearButton.addEventListener('click', clearAllStaffCosts);
  }
}

// Calculate staff cost totals in real-time
function calculateStaffCostTotals() {
  const hours = parseFloat(document.getElementById('staff-hours')?.value) || 0;
  const rate = parseFloat(document.getElementById('staff-rate')?.value) || 0;
  const additional = parseFloat(document.getElementById('staff-additional')?.value) || 0;
  
  const grossTotal = (hours * rate) + additional;
  const vatRate = 23; // Standard VAT rate for services
  const vatAmount = grossTotal * (vatRate / 100);
  const totalCost = grossTotal + vatAmount;
  
  const grossTotalEl = document.getElementById('staff-gross-total');
  const vatAmountEl = document.getElementById('staff-vat-amount');
  const totalCostEl = document.getElementById('staff-total-cost');
  
  if (grossTotalEl) grossTotalEl.textContent = grossTotal.toFixed(2);
  if (vatAmountEl) vatAmountEl.textContent = vatAmount.toFixed(2);
  if (totalCostEl) totalCostEl.textContent = totalCost.toFixed(2);
}

// Post staff cost as an expense
function postStaffCost() {
  const date = document.getElementById('staff-cost-date')?.value;
  const staffMemberId = document.getElementById('staff-member')?.value;
  const type = document.getElementById('staff-cost-type')?.value;
  const hours = parseFloat(document.getElementById('staff-hours')?.value) || 0;
  const rate = parseFloat(document.getElementById('staff-rate')?.value) || 0;
  const additional = parseFloat(document.getElementById('staff-additional')?.value) || 0;
  const description = document.getElementById('staff-description')?.value;
  
  if (!date || !staffMemberId || staffMemberId === 'new') {
    alert('Please select a date and staff member');
    return;
  }
  
  if (hours <= 0 && additional <= 0) {
    alert('Please enter hours worked or additional amount');
    return;
  }
  
  // Get staff name
  const staffSelect = document.getElementById('staff-member');
  const staffName = staffSelect?.selectedOptions[0]?.textContent || 'Unknown';
  
  const grossTotal = (hours * rate) + additional;
  const vatRate = 23;
  
  // Create expense entry
  const expense = {
    date: date,
    category: 'Staff Expenses',
    supplier: staffName,
    net: grossTotal,
    vatRate: vatRate,
    // Additional data for staff costs tracking
    staffData: {
      staffId: staffMemberId,
      staffName: staffName,
      type: type,
      hours: hours,
      rate: rate,
      additional: additional,
      description: description
    }
  };
  
  // Post to expenses
  postExpense(expense);
  
  // Render updated lists
  renderStaffCostsList();
  updateStaffCostsSummary();
  
  // Reset form
  resetStaffCostForm();
  
  alert(`Staff cost for ${staffName} posted successfully! Total: €${(grossTotal + (grossTotal * vatRate / 100)).toFixed(2)}`);
}

// Reset staff cost form
function resetStaffCostForm() {
  const dateField = document.getElementById('staff-cost-date');
  const memberField = document.getElementById('staff-member');
  const typeField = document.getElementById('staff-cost-type');
  const hoursField = document.getElementById('staff-hours');
  const rateField = document.getElementById('staff-rate');
  const additionalField = document.getElementById('staff-additional');
  const descField = document.getElementById('staff-description');
  
  if (dateField) dateField.value = new Date().toISOString().split('T')[0];
  if (memberField) memberField.value = '';
  if (typeField) typeField.value = 'wages';
  if (hoursField) hoursField.value = '0';
  if (rateField) rateField.value = '0';
  if (additionalField) additionalField.value = '0';
  if (descField) descField.value = '';
  
  calculateStaffCostTotals();
}

// Add new staff member (simplified)
function addNewStaffMember() {
  const name = prompt('Enter staff member name:');
  if (!name) return;
  
  const hourlyRate = parseFloat(prompt('Enter hourly rate (€):') || '0');
  
  // This would integrate with the wages system
  // For now, just update the rate field
  const rateField = document.getElementById('staff-rate');
  if (rateField) {
    rateField.value = hourlyRate.toFixed(2);
    calculateStaffCostTotals();
  }
}

// Render staff costs list
function renderStaffCostsList() {
  const tbody = document.querySelector('#staff-cost-list tbody');
  if (!tbody) return;
  
  const expenses = listExpenses().filter(exp => exp.category === 'Staff Expenses');
  
  tbody.innerHTML = expenses.slice(-20).reverse().map(exp => {
    const staffData = exp.staffData || {};
    return `
      <tr>
        <td>${exp.date}</td>
        <td>${staffData.staffName || exp.supplier || 'Unknown'}</td>
        <td>${staffData.type || 'N/A'}</td>
        <td>${(staffData.hours || 0).toFixed(1)}</td>
        <td>${(staffData.rate || 0).toFixed(2)}</td>
        <td class="text-right">${exp.net.toFixed(2)}</td>
        <td class="text-right">${exp.vat.toFixed(2)}</td>
        <td class="text-right">${exp.total.toFixed(2)}</td>
        <td>${staffData.description || ''}</td>
        <td><button class="btn btn-icon danger" onclick="deleteStaffCost('${exp.id}')">×</button></td>
      </tr>
    `;
  }).join('');
}

// Delete staff cost
function deleteStaffCost(expenseId) {
  if (confirm('Are you sure you want to delete this staff cost entry?')) {
    deleteExpense(expenseId);
    renderStaffCostsList();
    updateStaffCostsSummary();
  }
}

// Clear all staff costs
function clearAllStaffCosts() {
  if (confirm('Are you sure you want to clear all staff cost entries? This action cannot be undone.')) {
    const expenses = listExpenses();
    expenses.forEach(exp => {
      if (exp.category === 'Staff Expenses') {
        deleteExpense(exp.id);
      }
    });
    renderStaffCostsList();
    updateStaffCostsSummary();
    alert('All staff costs cleared successfully!');
  }
}

// Update staff costs summary
function updateStaffCostsSummary() {
  const now = new Date();
  const currentMonth = now.toISOString().slice(0, 7); // YYYY-MM
  const currentYear = now.getFullYear().toString();
  
  const staffCosts = listExpenses().filter(exp => exp.category === 'Staff Expenses');
  
  // Monthly summary
  const monthlyData = staffCosts.filter(cost => cost.date.startsWith(currentMonth));
  const monthlyHours = monthlyData.reduce((sum, cost) => sum + ((cost.staffData && cost.staffData.hours) || 0), 0);
  const monthlyCost = monthlyData.reduce((sum, cost) => sum + cost.total, 0);
  const monthlyAvgRate = monthlyHours > 0 ? monthlyData.reduce((sum, cost) => sum + cost.net, 0) / monthlyHours : 0;
  
  // Yearly summary
  const yearlyData = staffCosts.filter(cost => cost.date.startsWith(currentYear));
  const yearlyHours = yearlyData.reduce((sum, cost) => sum + ((cost.staffData && cost.staffData.hours) || 0), 0);
  const yearlyCost = yearlyData.reduce((sum, cost) => sum + cost.total, 0);
  const yearlyAvgRate = yearlyHours > 0 ? yearlyData.reduce((sum, cost) => sum + cost.net, 0) / yearlyHours : 0;
  
  // Update display
  const monthlyHoursEl = document.getElementById('monthly-staff-hours');
  const monthlyCostEl = document.getElementById('monthly-staff-cost');
  const monthlyRateEl = document.getElementById('monthly-avg-rate');
  const yearlyHoursEl = document.getElementById('yearly-staff-hours');
  const yearlyCostEl = document.getElementById('yearly-staff-cost');
  const yearlyRateEl = document.getElementById('yearly-avg-rate');
  
  if (monthlyHoursEl) monthlyHoursEl.textContent = monthlyHours.toFixed(1);
  if (monthlyCostEl) monthlyCostEl.textContent = monthlyCost.toFixed(2);
  if (monthlyRateEl) monthlyRateEl.textContent = monthlyAvgRate.toFixed(2);
  if (yearlyHoursEl) yearlyHoursEl.textContent = yearlyHours.toFixed(1);
  if (yearlyCostEl) yearlyCostEl.textContent = yearlyCost.toFixed(2);
  if (yearlyRateEl) yearlyRateEl.textContent = yearlyAvgRate.toFixed(2);
}

// Staff Analysis functionality (migrated from staff-analysis.js)
function initStaffAnalysis() {
  const analyzeButton = document.getElementById('analyze-staff-costs');
  if (analyzeButton) {
    analyzeButton.addEventListener('click', runStaffAnalysis);
  }
  
  // Set default date range
  const fromField = document.getElementById('staff-from');
  const toField = document.getElementById('staff-to');
  
  if (fromField && toField) {
    const now = new Date();
    const monthAgo = new Date(now);
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    
    fromField.value = monthAgo.toISOString().split('T')[0];
    toField.value = now.toISOString().split('T')[0];
  }
}

// Main function to run staff cost analysis
async function runStaffAnalysis() {
  const fromISO = document.getElementById('staff-from')?.value;
  const toISO = document.getElementById('staff-to')?.value;
  
  if (!fromISO || !toISO) {
    alert('Please select both start and end dates');
    return;
  }
  
  try {
    // Calculate service labor costs and actual expenses
    const serviceLaborCosts = await calculateServiceLaborCosts(fromISO, toISO);
    const actualStaffExpenses = calculateActualStaffExpenses(fromISO, toISO);
    const staffBreakdown = generateStaffBreakdown(serviceLaborCosts);
    
    const reportHTML = generateStaffAnalysisReport(
      fromISO, 
      toISO, 
      serviceLaborCosts, 
      actualStaffExpenses, 
      staffBreakdown
    );
    
    const outputEl = document.getElementById('staff-analysis-output');
    if (outputEl) {
      outputEl.innerHTML = reportHTML;
    }
    
  } catch (error) {
    console.error('Error running staff analysis:', error);
    alert('Error running staff analysis: ' + error.message);
  }
}

// Calculate total service labor cost for a period
async function calculateServiceLaborCosts(fromISO, toISO) {
  const takings = listTakings(fromISO, toISO);
  const catalog = getCatalog();
  
  let totalServiceLaborCost = 0;
  const serviceDetails = [];
  
  takings.forEach(taking => {
    if (taking.lines) {
      taking.lines.forEach(line => {
        const service = catalog.find(s => s.name === line.name);
        if (service) {
          const laborCost = service.laborCost || service.labour || 0;
          const lineLaborCost = laborCost * (line.qty || 1);
          totalServiceLaborCost += lineLaborCost;
          
          serviceDetails.push({
            date: taking.date,
            serviceName: line.name,
            qty: line.qty || 1,
            laborPerUnit: laborCost,
            totalLabor: lineLaborCost,
            minutes: service.mins || 0
          });
        }
      });
    }
  });
  
  return {
    total: totalServiceLaborCost,
    details: serviceDetails
  };
}

// Calculate actual staff expenses for a period
function calculateActualStaffExpenses(fromISO, toISO) {
  const expenses = listExpenses(fromISO, toISO);
  
  const staffExpenses = expenses.filter(exp => exp.category === 'Staff Expenses');
  const totalStaffExpenses = staffExpenses.reduce((sum, exp) => sum + (exp.net || 0), 0);
  
  return {
    total: totalStaffExpenses,
    details: staffExpenses
  };
}

// Generate staff breakdown for analysis
function generateStaffBreakdown(serviceLaborCosts) {
  // This would use the STAFF_RATES from staff-analysis.js
  const STAFF_RATES = {
    'Lorna': 24.34,
    'Julia': 17.86,
    'Abbey': 14.97,
    'Denise': 20.33,
    'Niamh': 17.09,
    'Eva': 16.36
  };
  
  const AVERAGE_STAFF_RATE = 18.49;
  const breakdown = {};
  
  // Initialize breakdown for each staff member
  Object.entries(STAFF_RATES).forEach(([name, rate]) => {
    breakdown[name] = {
      rate: rate,
      allocatedHours: 0,
      allocatedLaborCost: 0
    };
  });
  
  // Allocate labor costs proportionally
  const totalLaborCost = serviceLaborCosts.total;
  const totalStaffCapacity = Object.values(STAFF_RATES).reduce((sum, rate) => sum + rate, 0);
  
  Object.entries(breakdown).forEach(([name, data]) => {
    const proportion = data.rate / totalStaffCapacity;
    data.allocatedLaborCost = totalLaborCost * proportion;
    data.allocatedHours = data.allocatedLaborCost / data.rate;
  });
  
  return breakdown;
}

// Generate the staff cost analysis report
function generateStaffAnalysisReport(fromISO, toISO, serviceLaborCosts, actualStaffExpenses, staffBreakdown) {
  const totalServiceLaborCost = serviceLaborCosts.total;
  const totalActualExpenses = actualStaffExpenses.total;
  const difference = totalActualExpenses - totalServiceLaborCost;
  const ratio = totalServiceLaborCost > 0 ? totalActualExpenses / totalServiceLaborCost : 0;
  const utilizationRate = totalActualExpenses > 0 ? (totalServiceLaborCost / totalActualExpenses) * 100 : 0;
  
  return `
    <div class="staff-analysis-report">
      <h4>📊 Staff Cost Analysis Report</h4>
      <div class="period-indicator">
        <span>Period: ${fromISO} to ${toISO}</span>
      </div>
      
      <div class="comparison-table mt">
        <table class="table">
          <thead>
            <tr>
              <th>Metric</th>
              <th class="text-right">Amount (€)</th>
              <th class="text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Service Labor Cost Allocation</strong></td>
              <td class="text-right">${totalServiceLaborCost.toFixed(2)}</td>
              <td class="text-center"><span class="chip">Theoretical</span></td>
            </tr>
            <tr>
              <td><strong>Actual Staff Expenses</strong></td>
              <td class="text-right">${totalActualExpenses.toFixed(2)}</td>
              <td class="text-center"><span class="chip">Actual</span></td>
            </tr>
            <tr class="total">
              <td><strong>Variance</strong></td>
              <td class="text-right ${difference >= 0 ? 'positive' : 'negative'}">${difference >= 0 ? '+' : ''}${difference.toFixed(2)}</td>
              <td class="text-center">
                <span class="chip ${difference >= 0 ? 'warning' : 'success'}">
                  ${difference >= 0 ? 'Over Budget' : 'Under Budget'}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
        
        <div class="kpis mt">
          <div class="chip">
            <strong>Cost Ratio:</strong> ${ratio.toFixed(2)}x
            <small>${ratio > 1 ? 'actual costs are higher' : 'actual costs are lower'}</small>
          </div>
          <div class="chip">
            <strong>Utilization Rate:</strong> ${utilizationRate.toFixed(1)}%
            <small>How well services recover labor costs</small>
          </div>
        </div>
      </div>

      <div class="insights-list mt">
        <h5>📋 Business Insights</h5>
        <ul>
          <li><strong>Labor Cost Recovery:</strong> ${utilizationRate >= 80 ? 'Excellent' : utilizationRate >= 60 ? 'Good' : 'Needs Improvement'} - Your services are ${utilizationRate >= 80 ? 'effectively' : utilizationRate >= 60 ? 'reasonably' : 'poorly'} recovering labor costs through pricing.</li>
          <li><strong>Staff Efficiency:</strong> ${difference < 0 ? 'Positive variance indicates efficient staff utilization or competitive wage structure.' : 'Negative variance suggests either pricing adjustments needed or staff cost optimization opportunities.'}</li>
          <li><strong>Recommended Action:</strong> ${utilizationRate < 70 ? 'Consider reviewing service pricing to improve labor cost recovery.' : ratio > 1.2 ? 'Analyze staff scheduling and wage structure for optimization opportunities.' : 'Current labor cost management appears balanced.'}</li>
        </ul>
      </div>
    </div>
  `;
}

// Wages Comparison functionality (migrated from wages-comparison.js)
function initWagesComparison() {
  const refreshButton = document.getElementById('refresh-comparison');
  if (refreshButton) {
    refreshButton.addEventListener('click', updateWagesComparison);
  }
  
  const addStaffButton = document.getElementById('add-staff-member');
  if (addStaffButton) {
    addStaffButton.addEventListener('click', addWagesStaffMember);
  }
  
  const resetButton = document.getElementById('reset-wages');
  if (resetButton) {
    resetButton.addEventListener('click', resetWagesToDefaults);
  }
  
  // Initialize wages table
  renderWagesTable();
  updateWagesComparison();
}

// Render wages table
function renderWagesTable() {
  const tbody = document.getElementById('wages-table-body');
  if (!tbody) return;
  
  const wagesData = getWagesData();
  
  tbody.innerHTML = wagesData.map(staff => {
    const grossWeekly = staff.hoursPerWeek * staff.hourlyRate;
    const taxAmount = grossWeekly * (staff.taxPercent / 100);
    const prsiAmount = grossWeekly * (staff.prsiPercent / 100);
    const uscAmount = grossWeekly * (staff.uscPercent / 100);
    const netWeekly = grossWeekly - taxAmount - prsiAmount - uscAmount + (staff.bonus || 0) + (staff.adjustments || 0);
    const perHourSummary = netWeekly / staff.hoursPerWeek;
    
    return `
      <tr>
        <td><input type="text" value="${staff.name}" onchange="updateStaffWageData('${staff.id}', 'name', this.value)"></td>
        <td><input type="number" value="${staff.defaultDays}" min="1" max="7" onchange="updateStaffWageData('${staff.id}', 'defaultDays', this.value)"></td>
        <td><input type="number" value="${staff.hoursPerWeek}" step="0.5" onchange="updateStaffWageData('${staff.id}', 'hoursPerWeek', this.value)"></td>
        <td><input type="number" value="${staff.hourlyRate}" step="0.01" onchange="updateStaffWageData('${staff.id}', 'hourlyRate', this.value)"></td>
        <td>€${grossWeekly.toFixed(2)}</td>
        <td>
          <input type="number" value="${staff.taxPercent}" step="0.1" onchange="updateStaffWageData('${staff.id}', 'taxPercent', this.value)">
          <span class="deduction-amount">(€${taxAmount.toFixed(2)})</span>
        </td>
        <td>
          <input type="number" value="${staff.prsiPercent}" step="0.1" onchange="updateStaffWageData('${staff.id}', 'prsiPercent', this.value)">
          <span class="deduction-amount">(€${prsiAmount.toFixed(2)})</span>
        </td>
        <td>
          <input type="number" value="${staff.uscPercent}" step="0.1" onchange="updateStaffWageData('${staff.id}', 'uscPercent', this.value)">
          <span class="deduction-amount">(€${uscAmount.toFixed(2)})</span>
        </td>
        <td><input type="number" value="${staff.bonus || 0}" step="0.01" onchange="updateStaffWageData('${staff.id}', 'bonus', this.value)"></td>
        <td><input type="number" value="${staff.adjustments || 0}" step="0.01" onchange="updateStaffWageData('${staff.id}', 'adjustments', this.value)"></td>
        <td class="net-weekly">€${netWeekly.toFixed(2)}</td>
        <td class="per-hour-summary">€${perHourSummary.toFixed(2)}</td>
      </tr>
    `;
  }).join('');
}

// Update wages comparison summary
function updateWagesComparison() {
  const wagesData = getWagesData();
  
  let totalWeeklyHours = 0;
  let totalWeeklyCost = 0;
  
  wagesData.forEach(staff => {
    const grossWeekly = staff.hoursPerWeek * staff.hourlyRate;
    const taxAmount = grossWeekly * (staff.taxPercent / 100);
    const prsiAmount = grossWeekly * (staff.prsiPercent / 100);
    const uscAmount = grossWeekly * (staff.uscPercent / 100);
    const netWeekly = grossWeekly - taxAmount - prsiAmount - uscAmount + (staff.bonus || 0) + (staff.adjustments || 0);
    
    totalWeeklyHours += staff.hoursPerWeek;
    totalWeeklyCost += netWeekly;
  });
  
  const hoursEl = document.getElementById('total-weekly-hours');
  const costEl = document.getElementById('total-weekly-cost');
  
  if (hoursEl) hoursEl.textContent = totalWeeklyHours.toFixed(1);
  if (costEl) costEl.textContent = totalWeeklyCost.toFixed(2);
  
  // Generate comparison analysis
  generateWagesComparisonAnalysis(wagesData, totalWeeklyCost);
}

// Generate wages comparison analysis
function generateWagesComparisonAnalysis(wagesData, totalWeeklyCost) {
  const outputEl = document.getElementById('wages-comparison-output');
  if (!outputEl) return;
  
  const monthlyWageCost = totalWeeklyCost * 4.33;
  const utilitiesCost = calcUtilPerHour() * totalWeeklyHours * 4.33;
  const totalOperatingCost = monthlyWageCost + utilitiesCost;
  
  const html = `
    <h4>📊 WAGE vs LABOR COST COMPARISON</h4>
    <table class="table">
      <thead>
        <tr>
          <th>Metric</th>
          <th>Weekly (€)</th>
          <th>Monthly (€)</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Total Wage Cost</strong><br><small>(net wages)</small></td>
          <td>${totalWeeklyCost.toFixed(2)}</td>
          <td>${monthlyWageCost.toFixed(2)}</td>
          <td><span class="chip">Actual</span></td>
        </tr>
        <tr>
          <td><strong>Utilities Cost</strong><br><small>(operational)</small></td>
          <td>${(utilitiesCost / 4.33).toFixed(2)}</td>
          <td>${utilitiesCost.toFixed(2)}</td>
          <td><span class="chip">Fixed</span></td>
        </tr>
        <tr class="total">
          <td><strong>Total Operating Cost</strong></td>
          <td>${(totalOperatingCost / 4.33).toFixed(2)}</td>
          <td>${totalOperatingCost.toFixed(2)}</td>
          <td><span class="chip">Combined</span></td>
        </tr>
      </tbody>
    </table>
    
    <div class="insights-list mt">
      <h5>📋 Management Insights</h5>
      <ul>
        <li><strong>Cost Control:</strong> Total weekly wage cost of €${totalWeeklyCost.toFixed(2)} represents the direct labor expense.</li>
        <li><strong>Efficiency Ratio:</strong> Wage cost per hour: €${(totalWeeklyCost / totalWeeklyHours).toFixed(2)}, including utilities: €${(totalOperatingCost / 4.33 / totalWeeklyHours).toFixed(2)}.</li>
        <li><strong>Recommendation:</strong> Current wage structure appears well-aligned with operational requirements.</li>
      </ul>
    </div>
  `;
  
  outputEl.innerHTML = html;
}

// Helper functions
function getWagesData() {
  // This would come from your existing wages data
  // For now, return default data based on STAFF_RATES
  const defaultData = [
    { id: 'lorna', name: 'Lorna', defaultDays: 5, hoursPerWeek: 40, hourlyRate: 24.34, taxPercent: 20, prsiPercent: 4, uscPercent: 2, bonus: 0, adjustments: 0 },
    { id: 'julia', name: 'Julia', defaultDays: 5, hoursPerWeek: 37.5, hourlyRate: 17.86, taxPercent: 20, prsiPercent: 4, uscPercent: 2, bonus: 0, adjustments: 0 },
    { id: 'abbey', name: 'Abbey', defaultDays: 4, hoursPerWeek: 32, hourlyRate: 14.97, taxPercent: 20, prsiPercent: 4, uscPercent: 2, bonus: 0, adjustments: 0 },
    { id: 'denise', name: 'Denise', defaultDays: 5, hoursPerWeek: 35, hourlyRate: 20.33, taxPercent: 20, prsiPercent: 4, uscPercent: 2, bonus: 0, adjustments: 0 },
    { id: 'niamh', name: 'Niamh', defaultDays: 4, hoursPerWeek: 30, hourlyRate: 17.09, taxPercent: 20, prsiPercent: 4, uscPercent: 2, bonus: 0, adjustments: 0 },
    { id: 'eva', name: 'Eva', defaultDays: 3, hoursPerWeek: 25, hourlyRate: 16.36, taxPercent: 20, prsiPercent: 4, uscPercent: 2, bonus: 0, adjustments: 0 }
  ];
  
  return defaultData;
}

function updateStaffWageData(staffId, field, value) {
  // This would update the wages data in storage
  console.log(`Updating ${staffId}.${field} to ${value}`);
  renderWagesTable();
  updateWagesComparison();
}

function addWagesStaffMember() {
  const name = prompt('Enter staff member name:');
  if (name) {
    alert('New staff member functionality would be implemented here');
  }
}

function resetWagesToDefaults() {
  if (confirm('Reset all wage data to defaults?')) {
    renderWagesTable();
    updateWagesComparison();
  }
}

// Initialize the unified staff management system when this script loads
if (typeof window !== 'undefined') {
  window.StaffManagement = {
    init: initStaffManagement,
    initStaffCosts,
    initStaffAnalysis,
    initWagesComparison,
    runStaffAnalysis,
    updateWagesComparison
  };
}