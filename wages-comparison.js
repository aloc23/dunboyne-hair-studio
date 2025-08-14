// Wages Comparison Module

// Default wages data based on staff rates from staff-analysis.js
const DEFAULT_WAGES_DATA = [
  {
    id: 'lorna',
    name: 'Lorna',
    defaultDays: 5,
    hoursPerWeek: 40,
    hourlyRate: 24.34,
    taxRate: 20,
    prsiRate: 4,
    uscRate: 2,
    bonus: 0,
    adjustments: 0
  },
  {
    id: 'julia',
    name: 'Julia',
    defaultDays: 5,
    hoursPerWeek: 37.5,
    hourlyRate: 17.86,
    taxRate: 20,
    prsiRate: 4,
    uscRate: 2,
    bonus: 0,
    adjustments: 0
  },
  {
    id: 'abbey',
    name: 'Abbey',
    defaultDays: 4,
    hoursPerWeek: 32,
    hourlyRate: 14.97,
    taxRate: 20,
    prsiRate: 4,
    uscRate: 2,
    bonus: 0,
    adjustments: 0
  },
  {
    id: 'denise',
    name: 'Denise',
    defaultDays: 5,
    hoursPerWeek: 35,
    hourlyRate: 20.33,
    taxRate: 20,
    prsiRate: 4,
    uscRate: 2,
    bonus: 0,
    adjustments: 0
  },
  {
    id: 'niamh',
    name: 'Niamh',
    defaultDays: 4,
    hoursPerWeek: 30,
    hourlyRate: 17.09,
    taxRate: 20,
    prsiRate: 4,
    uscRate: 2,
    bonus: 0,
    adjustments: 0
  },
  {
    id: 'eva',
    name: 'Eva',
    defaultDays: 3,
    hoursPerWeek: 25,
    hourlyRate: 16.36,
    taxRate: 20,
    prsiRate: 4,
    uscRate: 2,
    bonus: 0,
    adjustments: 0
  }
];

// Calculate wages for a staff member
function calculateWages(staffData) {
  const grossWeekly = staffData.hoursPerWeek * staffData.hourlyRate;
  const taxAmount = (grossWeekly * staffData.taxRate) / 100;
  const prsiAmount = (grossWeekly * staffData.prsiRate) / 100;
  const uscAmount = (grossWeekly * staffData.uscRate) / 100;
  const totalDeductions = taxAmount + prsiAmount + uscAmount;
  const netWeekly = grossWeekly - totalDeductions + staffData.bonus + staffData.adjustments;
  const perHourSummary = netWeekly / staffData.hoursPerWeek;

  return {
    grossWeekly: grossWeekly,
    taxAmount: taxAmount,
    prsiAmount: prsiAmount,
    uscAmount: uscAmount,
    totalDeductions: totalDeductions,
    netWeekly: netWeekly,
    perHourSummary: perHourSummary
  };
}

// Render the wages table
function renderWagesTable() {
  const wagesData = getWagesData();
  const tbody = document.getElementById('wages-table-body');
  
  tbody.innerHTML = wagesData.map(staff => {
    const calculations = calculateWages(staff);
    
    return `
      <tr data-staff-id="${staff.id}">
        <td>
          <input type="text" class="staff-name" value="${staff.name}" data-field="name">
        </td>
        <td>
          <input type="number" class="default-days" value="${staff.defaultDays}" min="1" max="7" data-field="defaultDays">
        </td>
        <td>
          <input type="number" class="hours-per-week" value="${staff.hoursPerWeek}" min="0" step="0.5" data-field="hoursPerWeek">
        </td>
        <td>
          <input type="number" class="hourly-rate" value="${staff.hourlyRate}" min="0" step="0.01" data-field="hourlyRate">
        </td>
        <td class="gross-weekly">€${calculations.grossWeekly.toFixed(2)}</td>
        <td>
          <input type="number" class="tax-rate" value="${staff.taxRate}" min="0" max="100" step="0.1" data-field="taxRate">
          <small class="deduction-amount">(€${calculations.taxAmount.toFixed(2)})</small>
        </td>
        <td>
          <input type="number" class="prsi-rate" value="${staff.prsiRate}" min="0" max="100" step="0.1" data-field="prsiRate">
          <small class="deduction-amount">(€${calculations.prsiAmount.toFixed(2)})</small>
        </td>
        <td>
          <input type="number" class="usc-rate" value="${staff.uscRate}" min="0" max="100" step="0.1" data-field="uscRate">
          <small class="deduction-amount">(€${calculations.uscAmount.toFixed(2)})</small>
        </td>
        <td>
          <input type="number" class="bonus" value="${staff.bonus}" step="0.01" data-field="bonus">
        </td>
        <td>
          <input type="number" class="adjustments" value="${staff.adjustments}" step="0.01" data-field="adjustments">
        </td>
        <td class="net-weekly">€${calculations.netWeekly.toFixed(2)}</td>
        <td class="per-hour-summary">€${calculations.perHourSummary.toFixed(2)}</td>
      </tr>
    `;
  }).join('');

  // Add event listeners for input changes
  addWagesEventListeners();
  updateTotals();
}

// Add event listeners for real-time updates
function addWagesEventListeners() {
  const inputs = document.querySelectorAll('#wages-table-body input');
  
  inputs.forEach(input => {
    input.addEventListener('change', (e) => {
      updateStaffData(e.target);
      updateTotals();
      refreshComparison();
    });
    
    input.addEventListener('input', (e) => {
      // Real-time calculation for better UX
      updateRowCalculations(e.target.closest('tr'));
      updateTotals();
    });
  });
}

// Update staff data when input changes
function updateStaffData(input) {
  const row = input.closest('tr');
  const staffId = row.dataset.staffId;
  const field = input.dataset.field;
  const value = input.type === 'number' ? parseFloat(input.value) || 0 : input.value;
  
  const wagesData = getWagesData();
  const staffIndex = wagesData.findIndex(s => s.id === staffId);
  
  if (staffIndex >= 0) {
    wagesData[staffIndex][field] = value;
    saveWagesData(wagesData);
    updateRowCalculations(row);
  }
}

// Update calculations for a specific row
function updateRowCalculations(row) {
  const staffId = row.dataset.staffId;
  const wagesData = getWagesData();
  const staff = wagesData.find(s => s.id === staffId);
  
  if (staff) {
    const calculations = calculateWages(staff);
    
    // Update calculated fields
    row.querySelector('.gross-weekly').textContent = `€${calculations.grossWeekly.toFixed(2)}`;
    row.querySelector('.net-weekly').textContent = `€${calculations.netWeekly.toFixed(2)}`;
    row.querySelector('.per-hour-summary').textContent = `€${calculations.perHourSummary.toFixed(2)}`;
    
    // Update deduction amounts
    const taxAmountSpan = row.querySelector('.tax-rate + .deduction-amount');
    const prsiAmountSpan = row.querySelector('.prsi-rate + .deduction-amount');
    const uscAmountSpan = row.querySelector('.usc-rate + .deduction-amount');
    
    if (taxAmountSpan) taxAmountSpan.textContent = `(€${calculations.taxAmount.toFixed(2)})`;
    if (prsiAmountSpan) prsiAmountSpan.textContent = `(€${calculations.prsiAmount.toFixed(2)})`;
    if (uscAmountSpan) uscAmountSpan.textContent = `(€${calculations.uscAmount.toFixed(2)})`;
  }
}

// Update totals display
function updateTotals() {
  const wagesData = getWagesData();
  
  const totalWeeklyHours = wagesData.reduce((sum, staff) => sum + staff.hoursPerWeek, 0);
  const totalWeeklyCost = wagesData.reduce((sum, staff) => {
    const calculations = calculateWages(staff);
    return sum + calculations.netWeekly;
  }, 0);
  
  document.getElementById('total-weekly-hours').textContent = totalWeeklyHours.toFixed(1);
  document.getElementById('total-weekly-cost').textContent = totalWeeklyCost.toFixed(2);
}

// Generate comparison analysis
function generateComparisonAnalysis() {
  const wagesData = getWagesData();
  const totalWeeklyCost = wagesData.reduce((sum, staff) => {
    const calculations = calculateWages(staff);
    return sum + calculations.netWeekly;
  }, 0);
  
  // Calculate monthly cost (assume 4.33 weeks per month)
  const monthlyWageCost = totalWeeklyCost * 4.33;
  
  // Get utilities cost per hour from existing data
  const utilsPerHour = calcUtilPerHour ? calcUtilPerHour() : 0;
  const totalWeeklyHours = wagesData.reduce((sum, staff) => sum + staff.hoursPerWeek, 0);
  const monthlyUtilsCost = utilsPerHour * totalWeeklyHours * 4.33;
  
  // Get staff rates from staff-analysis.js
  const staffRatesComparison = wagesData.map(staff => {
    const analysisRate = window.StaffAnalysis?.STAFF_RATES?.[staff.name] || 0;
    const variance = staff.hourlyRate - analysisRate;
    const variancePercent = analysisRate > 0 ? (variance / analysisRate) * 100 : 0;
    
    return {
      name: staff.name,
      wagesRate: staff.hourlyRate,
      analysisRate: analysisRate,
      variance: variance,
      variancePercent: variancePercent
    };
  });
  
  return `
    <div class="comparison-summary">
      <h4>📊 WAGE vs LABOR COST COMPARISON</h4>
      <table class="table comparison-table">
        <thead>
          <tr>
            <th>Metric</th>
            <th class="text-right">Weekly (€)</th>
            <th class="text-right">Monthly (€)</th>
            <th class="text-center">Status</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Total Wage Cost</strong> <small>(net wages)</small></td>
            <td class="text-right">${totalWeeklyCost.toFixed(2)}</td>
            <td class="text-right">${monthlyWageCost.toFixed(2)}</td>
            <td class="text-center"><span class="chip">Actual</span></td>
          </tr>
          <tr>
            <td><strong>Utilities Cost</strong> <small>(operational)</small></td>
            <td class="text-right">${(utilsPerHour * totalWeeklyHours).toFixed(2)}</td>
            <td class="text-right">${monthlyUtilsCost.toFixed(2)}</td>
            <td class="text-center"><span class="chip">Fixed</span></td>
          </tr>
          <tr class="total">
            <td><strong>Total Operating Cost</strong></td>
            <td class="text-right">${(totalWeeklyCost + (utilsPerHour * totalWeeklyHours)).toFixed(2)}</td>
            <td class="text-right">${(monthlyWageCost + monthlyUtilsCost).toFixed(2)}</td>
            <td class="text-center">
              <span class="chip warning">Combined</span>
            </td>
          </tr>
        </tbody>
      </table>
      
      <div class="mt">
        <h5>👥 HOURLY RATE COMPARISON</h5>
        <table class="table staff-comparison-table">
          <thead>
            <tr>
              <th>Staff Member</th>
              <th class="text-right">Wages Rate (€/h)</th>
              <th class="text-right">Analysis Rate (€/h)</th>
              <th class="text-right">Variance (€)</th>
              <th class="text-center">Variance %</th>
            </tr>
          </thead>
          <tbody>
            ${staffRatesComparison.map(staff => `
              <tr>
                <td><strong>${staff.name}</strong></td>
                <td class="text-right">${staff.wagesRate.toFixed(2)}</td>
                <td class="text-right">${staff.analysisRate.toFixed(2)}</td>
                <td class="text-right ${staff.variance >= 0 ? 'positive' : 'negative'}">${staff.variance >= 0 ? '+' : ''}${staff.variance.toFixed(2)}</td>
                <td class="text-center">
                  <span class="chip ${Math.abs(staff.variancePercent) <= 5 ? 'success' : Math.abs(staff.variancePercent) <= 15 ? 'warning' : 'danger'}">
                    ${staff.variance >= 0 ? '+' : ''}${staff.variancePercent.toFixed(1)}%
                  </span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div class="insights-list mt">
          <h5>📋 Management Insights</h5>
          <ul>
            <li><strong>Cost Control:</strong> Total weekly wage cost of €${totalWeeklyCost.toFixed(2)} represents the direct labor expense.</li>
            <li><strong>Rate Alignment:</strong> ${staffRatesComparison.filter(s => Math.abs(s.variancePercent) <= 5).length}/${staffRatesComparison.length} staff rates align closely with analysis rates (±5%).</li>
            <li><strong>Efficiency Ratio:</strong> Wage cost per hour: €${(totalWeeklyCost / totalWeeklyHours).toFixed(2)}, including utilities: €${((totalWeeklyCost + utilsPerHour * totalWeeklyHours) / totalWeeklyHours).toFixed(2)}.</li>
            <li><strong>Recommendation:</strong> ${staffRatesComparison.some(s => s.variancePercent > 15) ? 'Review high-variance rates for cost optimization opportunities.' : 'Current wage structure appears well-aligned with operational requirements.'}</li>
          </ul>
        </div>
      </div>
    </div>
  `;
}

// Refresh comparison analysis
function refreshComparison() {
  const comparisonOutput = document.getElementById('wages-comparison-output');
  if (comparisonOutput) {
    comparisonOutput.innerHTML = generateComparisonAnalysis();
  }
}

// Add new staff member
function addStaffMember() {
  const wagesData = getWagesData();
  const newStaff = {
    id: `staff_${Date.now()}`,
    name: 'New Staff',
    defaultDays: 5,
    hoursPerWeek: 35,
    hourlyRate: 18.49, // Average rate
    taxRate: 20,
    prsiRate: 4,
    uscRate: 2,
    bonus: 0,
    adjustments: 0
  };
  
  wagesData.push(newStaff);
  saveWagesData(wagesData);
  renderWagesTable();
  refreshComparison();
}

// Reset wages to defaults
function resetWages() {
  if (confirm('Are you sure you want to reset all wages data to defaults? This cannot be undone.')) {
    saveWagesData(DEFAULT_WAGES_DATA.map(staff => ({...staff})));
    renderWagesTable();
    refreshComparison();
  }
}

// Initialize wages comparison functionality
function initWagesComparison() {
  // Ensure wages data exists
  if (!getWagesData() || getWagesData().length === 0) {
    saveWagesData(DEFAULT_WAGES_DATA.map(staff => ({...staff})));
  }
  
  // Render initial table
  renderWagesTable();
  refreshComparison();
  
  // Bind event listeners
  document.getElementById('add-staff-member').addEventListener('click', addStaffMember);
  document.getElementById('reset-wages').addEventListener('click', resetWages);
  document.getElementById('refresh-comparison').addEventListener('click', refreshComparison);
}

// Export functions for use in main app
window.WagesComparison = {
  init: initWagesComparison,
  render: renderWagesTable,
  refresh: refreshComparison,
  DEFAULT_WAGES_DATA: DEFAULT_WAGES_DATA
};