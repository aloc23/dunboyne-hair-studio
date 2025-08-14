// Staff Costs functionality
// Integrates with the existing expenses system to track staff wages and costs

// Initialize staff costs functionality
function initStaffCosts() {
  // Set default date to today
  document.getElementById('staff-cost-date').value = new Date().toISOString().split('T')[0];
  
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
  document.getElementById('staff-member').addEventListener('change', (e) => {
    if (e.target.value === 'new') {
      addNewStaffMember();
    } else if (e.target.value) {
      // Auto-populate rate from selected staff member
      const selectedOption = e.target.selectedOptions[0];
      const rate = selectedOption.dataset.rate || 0;
      document.getElementById('staff-rate').value = parseFloat(rate).toFixed(2);
      calculateStaffCostTotals();
    }
  });
  
  // Post staff cost button
  document.getElementById('post-staff-cost').addEventListener('click', postStaffCost);
  
  // Reset form button
  document.getElementById('reset-staff-cost').addEventListener('click', resetStaffCostForm);
  
  // Clear all staff costs button
  document.getElementById('clear-all-staff-costs').addEventListener('click', clearAllStaffCosts);
}

// Calculate staff cost totals in real-time
function calculateStaffCostTotals() {
  const hours = parseFloat(document.getElementById('staff-hours').value) || 0;
  const rate = parseFloat(document.getElementById('staff-rate').value) || 0;
  const additional = parseFloat(document.getElementById('staff-additional').value) || 0;
  
  const grossTotal = (hours * rate) + additional;
  const vatRate = 23; // Standard VAT rate for services
  const vatAmount = grossTotal * (vatRate / 100);
  const totalCost = grossTotal + vatAmount;
  
  document.getElementById('staff-gross-total').textContent = grossTotal.toFixed(2);
  document.getElementById('staff-vat-amount').textContent = vatAmount.toFixed(2);
  document.getElementById('staff-total-cost').textContent = totalCost.toFixed(2);
}

// Add new staff member
function addNewStaffMember() {
  const name = prompt('Enter staff member name:');
  if (!name) {
    document.getElementById('staff-member').value = '';
    return;
  }
  
  const rate = prompt('Enter hourly rate (€):');
  const hourlyRate = parseFloat(rate) || 0;
  
  // Add to wages data
  const wagesData = getWagesData();
  const newStaff = {
    id: `staff_${Date.now()}`,
    name: name,
    defaultDays: 5,
    hoursPerWeek: 35,
    hourlyRate: hourlyRate,
    taxRate: 20,
    prsiRate: 4,
    uscRate: 2,
    bonus: 0,
    adjustments: 0
  };
  
  wagesData.push(newStaff);
  saveWagesData(wagesData);
  
  // Refresh dropdown
  populateStaffMembersDropdown();
  
  // Select the new staff member
  document.getElementById('staff-member').value = newStaff.id;
  document.getElementById('staff-rate').value = hourlyRate.toFixed(2);
  calculateStaffCostTotals();
}

// Post staff cost as an expense
function postStaffCost() {
  const date = document.getElementById('staff-cost-date').value;
  const staffMemberId = document.getElementById('staff-member').value;
  const type = document.getElementById('staff-cost-type').value;
  const hours = parseFloat(document.getElementById('staff-hours').value) || 0;
  const rate = parseFloat(document.getElementById('staff-rate').value) || 0;
  const additional = parseFloat(document.getElementById('staff-additional').value) || 0;
  const description = document.getElementById('staff-description').value;
  
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
  const staffName = staffSelect.selectedOptions[0].textContent;
  
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
  document.getElementById('staff-cost-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('staff-member').value = '';
  document.getElementById('staff-cost-type').value = 'wages';
  document.getElementById('staff-hours').value = '0';
  document.getElementById('staff-rate').value = '0';
  document.getElementById('staff-additional').value = '0';
  document.getElementById('staff-description').value = '';
  calculateStaffCostTotals();
}

// Render staff costs list
function renderStaffCostsList() {
  const tbody = document.querySelector('#staff-cost-list tbody');
  const db = loadDB();
  
  // Filter expenses for staff costs
  const staffCosts = db.expenses.filter(exp => exp.category === 'Staff Expenses')
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  
  tbody.innerHTML = '';
  
  staffCosts.forEach(cost => {
    const tr = document.createElement('tr');
    const staffData = cost.staffData || {};
    
    tr.innerHTML = `
      <td>${cost.date}</td>
      <td>${staffData.staffName || cost.supplier}</td>
      <td>${staffData.type || 'wages'}</td>
      <td class="text-right">${(staffData.hours || 0).toFixed(1)}</td>
      <td class="text-right">€${(staffData.rate || 0).toFixed(2)}</td>
      <td class="text-right">€${cost.net.toFixed(2)}</td>
      <td class="text-right">€${cost.vat.toFixed(2)}</td>
      <td class="text-right">€${cost.total.toFixed(2)}</td>
      <td>${staffData.description || ''}</td>
      <td>
        <button class="btn danger btn-icon" onclick="deleteStaffCost('${cost.id}')" title="Delete">
          <span class="icon icon-remove"></span>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Delete staff cost
function deleteStaffCost(expenseId) {
  if (!confirm('Are you sure you want to delete this staff cost entry?')) return;
  
  const db = loadDB();
  db.expenses = db.expenses.filter(exp => exp.id !== expenseId);
  saveDB(db);
  
  renderStaffCostsList();
  updateStaffCostsSummary();
}

// Clear all staff costs
function clearAllStaffCosts() {
  if (!confirm('Are you sure you want to clear all staff cost entries? This cannot be undone.')) return;
  
  const db = loadDB();
  db.expenses = db.expenses.filter(exp => exp.category !== 'Staff Expenses');
  saveDB(db);
  
  renderStaffCostsList();
  updateStaffCostsSummary();
}

// Update staff costs summary
function updateStaffCostsSummary() {
  const db = loadDB();
  const now = new Date();
  const currentMonth = now.toISOString().slice(0, 7); // YYYY-MM
  const currentYear = now.getFullYear().toString();
  
  const staffCosts = db.expenses.filter(exp => exp.category === 'Staff Expenses');
  
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
  document.getElementById('monthly-staff-hours').textContent = monthlyHours.toFixed(1);
  document.getElementById('monthly-staff-cost').textContent = monthlyCost.toFixed(2);
  document.getElementById('monthly-avg-rate').textContent = monthlyAvgRate.toFixed(2);
  
  document.getElementById('yearly-staff-hours').textContent = yearlyHours.toFixed(1);
  document.getElementById('yearly-staff-cost').textContent = yearlyCost.toFixed(2);
  document.getElementById('yearly-avg-rate').textContent = yearlyAvgRate.toFixed(2);
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  // Initialize staff costs when the tab is first clicked
  document.addEventListener('click', function(e) {
    if (e.target.dataset && e.target.dataset.tab === 'staff-costs') {
      setTimeout(() => {
        initStaffCosts();
      }, 100);
    }
  });
});

// Export functions for global access
window.StaffCosts = {
  init: initStaffCosts,
  deleteStaffCost: deleteStaffCost
};