// Staff Cost Analysis Module

// Staff hourly rates as provided in requirements
const STAFF_RATES = {
  'Lorna': 24.34,
  'Julia': 17.86,
  'Abbey': 14.97,
  'Denise': 20.33,
  'Niamh': 17.09,
  'Eva': 16.36
};

const AVERAGE_STAFF_RATE = 18.49;

// Get list of all staff members
function getStaffMembers() {
  return Object.keys(STAFF_RATES);
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

// Calculate staff breakdown with proportional distribution
function calculateStaffBreakdown(serviceLaborCosts, totalMinutes) {
  const staffMembers = getStaffMembers();
  const staffBreakdown = {};
  
  // For now, distribute labor costs proportionally based on staff rates
  // This is a simplified approach - in a real system, you'd track which staff performed which service
  const totalRate = Object.values(STAFF_RATES).reduce((sum, rate) => sum + rate, 0);
  
  staffMembers.forEach(staffMember => {
    const rate = STAFF_RATES[staffMember];
    const proportion = rate / totalRate;
    const allocatedLaborCost = serviceLaborCosts.total * proportion;
    const allocatedMinutes = totalMinutes * proportion;
    const allocatedHours = allocatedMinutes / 60;
    
    staffBreakdown[staffMember] = {
      rate: rate,
      allocatedLaborCost: allocatedLaborCost,
      allocatedHours: allocatedHours,
      allocatedMinutes: allocatedMinutes
    };
  });
  
  return staffBreakdown;
}

// Generate the staff cost analysis report
function generateStaffAnalysisReport(fromISO, toISO, serviceLaborCosts, actualStaffExpenses, staffBreakdown) {
  const difference = actualStaffExpenses.total - serviceLaborCosts.total;
  const ratio = serviceLaborCosts.total > 0 ? (actualStaffExpenses.total / serviceLaborCosts.total) : 0;
  const utilizationRate = actualStaffExpenses.total > 0 ? (serviceLaborCosts.total / actualStaffExpenses.total) * 100 : 0;
  
  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-IE', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };
  
  return `
    <div class="row between mb">
      <h3>Staff Cost Analysis</h3>
      <div class="period-indicator">
        <span class="icon icon-calendar"></span>
        ${formatDate(fromISO)} - ${formatDate(toISO)}
      </div>
    </div>
    
    <!-- Summary Comparison -->
    <div class="card mb">
      <h4>📊 COST COMPARISON SUMMARY</h4>
      <table class="table comparison-table">
        <thead>
          <tr>
            <th>Metric</th>
            <th class="text-right">Amount (€)</th>
            <th class="text-center">Status</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Service Labor Cost</strong> <small>(from catalog)</small></td>
            <td class="text-right">${serviceLaborCosts.total.toFixed(2)}</td>
            <td class="text-center"><span class="chip">Expected</span></td>
          </tr>
          <tr>
            <td><strong>Actual Staff Expenses</strong> <small>(recorded)</small></td>
            <td class="text-right">${actualStaffExpenses.total.toFixed(2)}</td>
            <td class="text-center"><span class="chip">Actual</span></td>
          </tr>
          <tr class="total">
            <td><strong>Difference</strong></td>
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
        <div class="chip ${utilizationRate >= 80 ? 'success' : utilizationRate >= 60 ? 'warning' : 'danger'}">
          <strong>Utilization Rate:</strong> ${utilizationRate.toFixed(1)}%
          <small>efficiency of labor cost recovery</small>
        </div>
      </div>
    </div>
    
    <!-- Staff Breakdown -->
    <div class="card mb">
      <h4>👥 STAFF BREAKDOWN</h4>
      <table class="table staff-breakdown-table">
        <thead>
          <tr>
            <th>Staff Member</th>
            <th class="text-right">Hourly Rate (€)</th>
            <th class="text-right">Allocated Hours</th>
            <th class="text-right">Allocated Cost (€)</th>
            <th class="text-center">Rate vs Average</th>
          </tr>
        </thead>
        <tbody>
          ${Object.entries(staffBreakdown).map(([name, data]) => {
            const rateVsAverage = ((data.rate - AVERAGE_STAFF_RATE) / AVERAGE_STAFF_RATE) * 100;
            return `
              <tr>
                <td><strong>${name}</strong></td>
                <td class="text-right">${data.rate.toFixed(2)}</td>
                <td class="text-right">${data.allocatedHours.toFixed(1)}</td>
                <td class="text-right">${data.allocatedLaborCost.toFixed(2)}</td>
                <td class="text-center">
                  <span class="chip ${rateVsAverage >= 0 ? 'warning' : 'success'}">
                    ${rateVsAverage >= 0 ? '+' : ''}${rateVsAverage.toFixed(1)}%
                  </span>
                </td>
              </tr>
            `;
          }).join('')}
          <tr class="total">
            <td><strong>Average Rate</strong></td>
            <td class="text-right"><strong>${AVERAGE_STAFF_RATE.toFixed(2)}</strong></td>
            <td class="text-right"><strong>${Object.values(staffBreakdown).reduce((sum, data) => sum + data.allocatedHours, 0).toFixed(1)}</strong></td>
            <td class="text-right"><strong>${Object.values(staffBreakdown).reduce((sum, data) => sum + data.allocatedLaborCost, 0).toFixed(2)}</strong></td>
            <td class="text-center"><span class="chip">Baseline</span></td>
          </tr>
        </tbody>
      </table>
      
      <div class="mt">
        <h5>📋 Business Insights</h5>
        <ul class="insights-list">
          <li><strong>Labor Cost Recovery:</strong> ${utilizationRate >= 80 ? 'Excellent' : utilizationRate >= 60 ? 'Good' : 'Needs Improvement'} - Your services are ${utilizationRate >= 80 ? 'effectively' : utilizationRate >= 60 ? 'reasonably' : 'poorly'} recovering labor costs through pricing.</li>
          <li><strong>Staff Efficiency:</strong> ${difference < 0 ? 'Positive variance indicates efficient staff utilization or competitive wage structure.' : 'Negative variance suggests either pricing adjustments needed or staff cost optimization opportunities.'}</li>
          <li><strong>Recommended Action:</strong> ${utilizationRate < 70 ? 'Consider reviewing service pricing to improve labor cost recovery.' : ratio > 1.2 ? 'Analyze staff scheduling and wage structure for optimization opportunities.' : 'Current labor cost management appears balanced.'}</li>
        </ul>
      </div>
    </div>
    
    <!-- Detailed Breakdown -->
    <div class="card">
      <h4>📋 DETAILED SERVICE BREAKDOWN</h4>
      <div class="row mb">
        <div class="chip">Total Services: ${serviceLaborCosts.details.length}</div>
        <div class="chip">Total Service Minutes: ${serviceLaborCosts.details.reduce((sum, detail) => sum + (detail.minutes * detail.qty), 0)}</div>
      </div>
      <table class="table service-details-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Service</th>
            <th class="text-right">Qty</th>
            <th class="text-right">Minutes</th>
            <th class="text-right">Labor/Unit (€)</th>
            <th class="text-right">Total Labor (€)</th>
          </tr>
        </thead>
        <tbody>
          ${serviceLaborCosts.details.map(detail => `
            <tr>
              <td>${formatDate(detail.date)}</td>
              <td>${detail.serviceName}</td>
              <td class="text-right">${detail.qty}</td>
              <td class="text-right">${detail.minutes * detail.qty}</td>
              <td class="text-right">${detail.laborPerUnit.toFixed(2)}</td>
              <td class="text-right">${detail.totalLabor.toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// Main function to run staff cost analysis
async function runStaffAnalysis() {
  try {
    const fromISO = document.getElementById('staff-from').value;
    const toISO = document.getElementById('staff-to').value;
    
    if (!fromISO || !toISO) {
      alert('Please select both start and end dates for analysis.');
      return;
    }
    
    if (fromISO > toISO) {
      alert('Start date cannot be after end date.');
      return;
    }
    
    // Calculate service labor costs
    const serviceLaborCosts = await calculateServiceLaborCosts(fromISO, toISO);
    
    // Calculate actual staff expenses
    const actualStaffExpenses = calculateActualStaffExpenses(fromISO, toISO);
    
    // Calculate total minutes for staff breakdown
    const totalMinutes = serviceLaborCosts.details.reduce((sum, detail) => 
      sum + (detail.minutes * detail.qty), 0);
    
    // Calculate staff breakdown
    const staffBreakdown = calculateStaffBreakdown(serviceLaborCosts, totalMinutes);
    
    // Generate and display report
    const reportHTML = generateStaffAnalysisReport(
      fromISO, 
      toISO, 
      serviceLaborCosts, 
      actualStaffExpenses, 
      staffBreakdown
    );
    
    document.getElementById('staff-analysis-output').innerHTML = reportHTML;
    
  } catch (error) {
    console.error('Error running staff analysis:', error);
    alert('Error running staff analysis: ' + error.message);
  }
}

// Initialize staff analysis functionality
function initStaffAnalysis() {
  // Set default date range (last 30 days)
  const today = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(today.getDate() - 30);
  
  document.getElementById('staff-to').value = today.toISOString().slice(0, 10);
  document.getElementById('staff-from').value = thirtyDaysAgo.toISOString().slice(0, 10);
  
  // Bind analyze button
  document.getElementById('analyze-staff-costs').addEventListener('click', runStaffAnalysis);
}

// Export functions for use in main app
window.StaffAnalysis = {
  init: initStaffAnalysis,
  run: runStaffAnalysis,
  STAFF_RATES: STAFF_RATES,
  AVERAGE_STAFF_RATE: AVERAGE_STAFF_RATE
};