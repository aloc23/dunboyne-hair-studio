
// Tab logic
document.querySelectorAll('#tabs .tab').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('#tabs .tab').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.tabpane').forEach(p=>p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-'+btn.dataset.tab).classList.add('active');
  });
});

// Settings init
const settings = getSettings();
document.getElementById('vat-mode').value = settings.vatMode || 'include';
document.getElementById('vat-rate').value = settings.vatRate ?? 23;

// Utilities table
function renderUtilities(){
  const tbody = document.querySelector('#utilities-table tbody');
  const s = getSettings();
  tbody.innerHTML = '';
  s.utilities.forEach((u,idx)=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input value="${u.name}"/></td>
      <td><input type="number" step="0.01" value="${u.perMonth.toFixed(2)}"/></td>
      <td><button class="btn" data-idx="${idx}">✕</button></td>`;
    tbody.appendChild(tr);
    tr.querySelectorAll('input')[0].addEventListener('change', (e)=>{ u.name = e.target.value; saveSettings(s); calcUtilPerHour(); });
    tr.querySelectorAll('input')[1].addEventListener('change', (e)=>{ u.perMonth = +e.target.value; saveSettings(s); calcUtilPerHour(); });
    tr.querySelector('button').addEventListener('click',()=>{ s.utilities.splice(idx,1); saveSettings(s); renderUtilities(); calcUtilPerHour(); });
  });
}
function calcUtilPerHour(){
  const s = getSettings();
  const perMonth = s.utilities.reduce((a,u)=>a+(u.perMonth||0),0);
  // approx hours open per month (assume 182 hours ~ 42h/week * 4.33)
  const eurHr = perMonth / 182;
  document.getElementById('util-eur-hr').textContent = eurHr.toFixed(2);
  return eurHr;
}
document.getElementById('add-utility').addEventListener('click', ()=>{
  const s = getSettings();
  s.utilities.push({name:'Utility', perMonth:0});
  saveSettings(s);
  renderUtilities(); calcUtilPerHour();
});
renderUtilities(); calcUtilPerHour();

// Expense categories
function renderCats(){
  const s = getSettings();
  const ul = document.getElementById('cat-list');
  ul.innerHTML = '';
  s.categories.forEach((c,i)=>{
    const li = document.createElement('li'); li.textContent = c; ul.appendChild(li);
  });
  // populate dropdown
  const sel = document.getElementById('exp-category');
  sel.innerHTML = s.categories.map(c=>`<option>${c}</option>`).join('');
}
renderCats();
document.getElementById('add-cat').addEventListener('click',()=>{
  const s = getSettings();
  const val = document.getElementById('new-cat').value.trim();
  if(val){ s.categories.push(val); saveSettings(s); renderCats(); document.getElementById('new-cat').value=''; }
});

// Catalog
function renderCatalog(){
  const tbody = document.querySelector('#catalog-table tbody');
  const catalog = getCatalog();
  tbody.innerHTML = '';
  catalog.forEach(svc=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input value="${svc.name}"/></td>
      <td><input type="number" step="0.01" value="${svc.price.toFixed(2)}"/></td>
      <td><input type="number" step="1" value="${svc.mins}"/></td>
      <td><input type="number" step="0.01" value="${svc.products.toFixed(2)}"/></td>
      <td><input type="number" step="0.01" value="${svc.utilities.toFixed(2)}"/></td>
      <td><input type="number" step="0.01" value="${svc.labour.toFixed(2)}"/></td>
      <td>${svc.totalCost.toFixed(2)}</td>
      <td><button class="btn" data-id="${svc.id}">Delete</button></td>
    `;
    tbody.appendChild(tr);
    const inputs = tr.querySelectorAll('input');
    const update = ()=>{
      const [name, price, mins, products, utilities, labour] = Array.from(inputs).map(i=>i.type==='number'?+i.value:i.value);
      upsertService({...svc, name, price, mins, products, utilities, labour});
      renderCatalog();
      renderServiceLines(); // refresh dropdowns
    };
    inputs.forEach(inp=> inp.addEventListener('change', update));
    tr.querySelector('button').addEventListener('click',()=>{ deleteService(svc.id); renderCatalog(); renderServiceLines(); });
  });
}
document.getElementById('add-service').addEventListener('click',()=>{
  upsertService({name:'New Service', price:0, mins:30, products:0, utilities:0, labour:0});
  renderCatalog(); 
  renderServiceLines();
  MatrixNova.Notifications.success('New service added to catalog');
});
document.getElementById('export-price-list').addEventListener('click',()=>{
  const w = window.open('', '_blank');
  const catalog = getCatalog();
  w.document.write('<h2>Price List</h2><table border="1" cellpadding="6" cellspacing="0"><tr><th>Service</th><th>Price</th><th>Duration</th></tr>');
  catalog.forEach(s=> w.document.write(`<tr><td>${s.name}</td><td>€ ${s.price.toFixed(2)}</td><td>${s.mins} mins</td></tr>`));
  w.document.write('</table>');
  w.document.close(); w.focus(); w.print();
});
renderCatalog();

// Takings: service lines with enhanced Matrix Nova styling
function newLineRow(){
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><select class="svc form-input"></select></td>
    <td><input type="number" class="qty form-input" min="1" step="1" value="1"/></td>
    <td><input type="number" class="price form-input" step="0.01"/></td>
    <td><input type="number" class="disc form-input" step="0.01" value="0"/></td>
    <td><input type="number" class="vouch form-input" step="0.01" value="0"/></td>
    <td class="linetotal">0.00</td>
    <td><button class="btn btn-icon danger" title="Remove service line">×</button></td>
  `;
  
  // populate service options with enhanced styling
  const sel = tr.querySelector('.svc');
  const catalog = getCatalog();
  sel.innerHTML = '<option value="">Select a service...</option>' + 
    catalog.map(s=>`<option value="${s.id}" data-price="${s.price}">${s.name} - €${s.price.toFixed(2)}</option>`).join('');
  
  // default price to catalog
  const priceInput = tr.querySelector('.price');
  const qtyInput = tr.querySelector('.qty');
  const discInput = tr.querySelector('.disc');
  const vouchInput = tr.querySelector('.vouch');
  
  function recalc(){
    const qty = +qtyInput.value || 0;
    const price = +priceInput.value || 0;
    const disc = +discInput.value || 0;
    const vouch = +vouchInput.value || 0;
    const gross = (price*qty) - disc - vouch;
    tr.querySelector('.linetotal').textContent = (gross>0?gross:0).toFixed(2);
    renderKPIs();
  }
  
  sel.addEventListener('change', ()=>{
    const opt = sel.selectedOptions[0];
    if (opt && opt.dataset.price) {
      priceInput.value = (+opt.dataset.price).toFixed(2);
      
      // Add visual feedback
      priceInput.classList.add('matrix-glow');
      setTimeout(() => priceInput.classList.remove('matrix-glow'), 1000);
      
      // Show notification if available
      if (window.MatrixNova && window.MatrixNova.Notifications) {
        MatrixNova.Notifications.success(`Selected ${opt.textContent}`);
      }
    }
    recalc();
  });
  
  [priceInput, qtyInput, discInput, vouchInput].forEach(i=> {
    i.addEventListener('input', recalc);
    i.addEventListener('focus', (e) => e.target.classList.add('focused'));
    i.addEventListener('blur', (e) => e.target.classList.remove('focused'));
  });
  
  tr.querySelector('button').addEventListener('click',()=>{ 
    tr.remove(); 
    renderKPIs();
    if (window.MatrixNova && window.MatrixNova.Notifications) {
      MatrixNova.Notifications.info('Service line removed');
    }
  });
  
  // init price
  const first = catalog[0];
  if(first){ 
    sel.value = first.id;
    priceInput.value = first.price.toFixed(2); 
  }
  return tr;
}

function renderServiceLines(){
  const tbody = document.querySelector('#service-lines tbody');
  if(tbody.children.length===0){
    tbody.appendChild(newLineRow());
  }else{
    // update options on existing rows
    tbody.querySelectorAll('tr').forEach(tr=>{
      const sel = tr.querySelector('.svc');
      if (sel) {
        const selected = sel.value;
        const catalog = getCatalog();
        sel.innerHTML = '<option value="">Select a service...</option>' + 
          catalog.map(s=>`<option value="${s.id}" data-price="${s.price}">${s.name} - €${s.price.toFixed(2)}</option>`).join('');
        if([...sel.options].some(o=>o.value===selected)){
          sel.value = selected;
        }else if(catalog[0]){
          sel.value = catalog[0].id;
          tr.querySelector('.price').value = catalog[0].price.toFixed(2);
        }
      }
    });
  }
  renderKPIs();
}
document.getElementById('add-line').addEventListener('click', ()=>{
  document.querySelector('#service-lines tbody').appendChild(newLineRow());
  renderKPIs();
});
renderServiceLines();

function renderKPIs(){
  const rows = Array.from(document.querySelectorAll('#service-lines tbody tr'));
  const lines = rows.map(tr=>{
    const serviceId = tr.querySelector('.svc')?.value || '';
    const qty = +tr.querySelector('.qty').value || 0;
    const unitPrice = +tr.querySelector('.price').value || 0;
    const discount = +tr.querySelector('.disc').value || 0;
    const voucher = +tr.querySelector('.vouch').value || 0;
    return {serviceId, qty, unitPrice, discount, voucher};
  }).filter(l => l.serviceId); // Only include lines with selected services
  
  const retailGross = +document.getElementById('retail-gross').value || 0;
  const vatMode = document.getElementById('vat-mode').value;
  const vatRate = +document.getElementById('vat-rate').value || 23;
  const totals = computeSaleTotals(lines, retailGross, vatMode, vatRate);
  const cogs = computeCOGS(lines, getCatalog());
  const kpis = document.getElementById('takings-kpis');
  kpis.innerHTML = `
    <div class="chip success">Svc Gross € ${totals.svcGross.toFixed(2)}</div>
    <div class="chip info">Retail Gross € ${retailGross.toFixed(2)}</div>
    <div class="chip">Revenue Gross € ${totals.totalGross.toFixed(2)}</div>
    <div class="chip warning">VAT € ${totals.vat.toFixed(2)}</div>
    <div class="chip danger">COGS € ${cogs.toFixed(2)}</div>
    <div class="chip success">Gross Profit € ${(totals.totalGross-cogs).toFixed(2)}</div>
  `;
}
['retail-gross','vat-mode','vat-rate','cash-in','card-in'].forEach(id=>{
  const el = document.getElementById(id);
  if(el) el.addEventListener('input', renderKPIs);
});

document.getElementById('post-takings').addEventListener('click', ()=>{
  const date = document.getElementById('takings-date').value;
  if(!date){ 
    if (window.MatrixNova && window.MatrixNova.Notifications) {
      MatrixNova.Notifications.error('Please select a date');
    } else {
      alert('Pick a date');
    }
    return; 
  }
  
  const mode = document.getElementById('takings-mode').value;
  const vatMode = document.getElementById('vat-mode').value;
  const vatRate = +document.getElementById('vat-rate').value || 23;
  const rows = Array.from(document.querySelectorAll('#service-lines tbody tr'));
  const lines = rows.map(tr=>{
    const serviceId = tr.querySelector('.svc')?.value || '';
    const qty = +tr.querySelector('.qty').value || 0;
    const unitPrice = +tr.querySelector('.price').value || 0;
    const discount = +tr.querySelector('.disc').value || 0;
    const voucher = +tr.querySelector('.vouch').value || 0;
    return {serviceId, qty, unitPrice, discount, voucher};
  }).filter(l=>l.qty>0 && l.serviceId);
  
  if(lines.length === 0) {
    if (window.MatrixNova && window.MatrixNova.Notifications) {
      MatrixNova.Notifications.warning('Please add at least one service line');
    } else {
      alert('Please add at least one service line');
    }
    return;
  }
  
  const entry = {
    date, mode, vatMode, vatRate,
    lines,
    retailGross:+document.getElementById('retail-gross').value || 0,
    cash:+document.getElementById('cash-in').value || 0,
    card:+document.getElementById('card-in').value || 0
  };
  
  // Show loading state
  const btn = document.getElementById('post-takings');
  if (window.MatrixNova && window.MatrixNova.Loading) {
    MatrixNova.Loading.show(btn.parentElement);
  }
  
  setTimeout(() => {
    try {
      postTakings(entry);
      if (window.MatrixNova && window.MatrixNova.Notifications) {
        MatrixNova.Notifications.success('Takings posted successfully!');
      } else {
        alert('Takings posted');
      }
      
      // reset
      document.querySelector('#service-lines tbody').innerHTML='';
      renderServiceLines();
      document.getElementById('retail-gross').value='0';
      document.getElementById('cash-in').value='0';
      document.getElementById('card-in').value='0';
      renderKPIs();
      renderTakingsList();
    } catch (error) {
      if (window.MatrixNova && window.MatrixNova.Notifications) {
        MatrixNova.Notifications.error('Error posting takings: ' + error.message);
      } else {
        alert('Error posting takings: ' + error.message);
      }
    } finally {
      if (window.MatrixNova && window.MatrixNova.Loading) {
        MatrixNova.Loading.hide(btn.parentElement);
      }
    }
  }, 500); // Simulate some processing time
});

document.getElementById('reset-takings').addEventListener('click', ()=>{
  document.querySelector('#service-lines tbody').innerHTML='';
  renderServiceLines(); renderKPIs();
});

// Expenses with enhanced feedback
document.getElementById('post-expense').addEventListener('click', ()=>{
  const date = document.getElementById('exp-date').value;
  const category = document.getElementById('exp-category').value;
  const supplier = document.getElementById('exp-supplier').value;
  const net = +document.getElementById('exp-net').value || 0;
  const vatRate = +document.getElementById('exp-vat-rate').value || 0;
  
  if(!date){ 
    MatrixNova.Notifications.error('Please select a date');
    return; 
  }
  if(net<=0){ 
    MatrixNova.Notifications.error('Please enter a valid net amount');
    return; 
  }
  
  const btn = document.getElementById('post-expense');
  MatrixNova.Loading.show(btn.parentElement);
  
  setTimeout(() => {
    try {
      postExpense({date, category, supplier, net, vatRate});
      renderExpenseList();
      MatrixNova.Notifications.success('Expense posted successfully!');
      
      // Clear form
      document.getElementById('exp-supplier').value = '';
      document.getElementById('exp-net').value = '0';
    } catch (error) {
      MatrixNova.Notifications.error('Error posting expense: ' + error.message);
    } finally {
      MatrixNova.Loading.hide(btn.parentElement);
    }
  }, 300);
});

document.getElementById('reset-expense').addEventListener('click', ()=>{
  if (confirm('Are you sure you want to reset the expense form and clear all expense entries? This action cannot be undone.')) {
    // Reset all expense form fields
    document.getElementById('exp-date').value = '';
    document.getElementById('exp-supplier').value = '';
    document.getElementById('exp-net').value = '0';
    document.getElementById('exp-vat-rate').value = '23';
    
    // Reset category to first option
    const categorySelect = document.getElementById('exp-category');
    if (categorySelect.options.length > 0) {
      categorySelect.selectedIndex = 0;
    }
    
    // Clear all expenses from persistent storage
    clearAllExpenses();
    
    // Refresh the expense list UI
    renderExpenseList();
    
    // Show notification if available
    if (window.MatrixNova && window.MatrixNova.Notifications) {
      MatrixNova.Notifications.success('Expense form reset and all expenses cleared successfully!');
    } else {
      alert('Expense form reset and all expenses cleared!');
    }
  }
});

// Clear all expenses functionality
document.getElementById('clear-all-expenses').addEventListener('click', ()=>{
  if (confirm('Are you sure you want to clear all expense entries? This action cannot be undone.')) {
    const btn = document.getElementById('clear-all-expenses');
    
    // Add loading state if MatrixNova is available
    if (window.MatrixNova && window.MatrixNova.Loading) {
      MatrixNova.Loading.show(btn.parentElement);
    }
    
    setTimeout(() => {
      try {
        clearAllExpenses();
        renderExpenseList();
        
        // Show success notification if available
        if (window.MatrixNova && window.MatrixNova.Notifications) {
          MatrixNova.Notifications.success('All expenses cleared successfully!');
        } else {
          alert('All expenses cleared!');
        }
      } catch (error) {
        // Show error notification if available
        if (window.MatrixNova && window.MatrixNova.Notifications) {
          MatrixNova.Notifications.error('Error clearing expenses: ' + error.message);
        } else {
          alert('Error clearing expenses: ' + error.message);
        }
      } finally {
        // Hide loading state if MatrixNova is available
        if (window.MatrixNova && window.MatrixNova.Loading) {
          MatrixNova.Loading.hide(btn.parentElement);
        }
      }
    }, 300);
  }
});

// Clear all takings functionality
document.getElementById('clear-all-takings').addEventListener('click', ()=>{
  if (confirm('Are you sure you want to clear all takings entries? This action cannot be undone.')) {
    const btn = document.getElementById('clear-all-takings');
    
    // Add loading state if MatrixNova is available
    if (window.MatrixNova && window.MatrixNova.Loading) {
      MatrixNova.Loading.show(btn.parentElement);
    }
    
    setTimeout(() => {
      try {
        clearAllTakings();
        renderTakingsList();
        
        // Show success notification if available
        if (window.MatrixNova && window.MatrixNova.Notifications) {
          MatrixNova.Notifications.success('All takings cleared successfully!');
        } else {
          alert('All takings cleared!');
        }
      } catch (error) {
        // Show error notification if available
        if (window.MatrixNova && window.MatrixNova.Notifications) {
          MatrixNova.Notifications.error('Error clearing takings: ' + error.message);
        } else {
          alert('Error clearing takings: ' + error.message);
        }
      } finally {
        // Hide loading state if MatrixNova is available
        if (window.MatrixNova && window.MatrixNova.Loading) {
          MatrixNova.Loading.hide(btn.parentElement);
        }
      }
    }, 300);
  }
});

function renderExpenseList(){
  const tbody = document.querySelector('#exp-list tbody');
  const exps = listExpenses();
  tbody.innerHTML = exps.slice(-20).reverse().map(e=>`<tr>
    <td>${e.date}</td><td>${e.category}</td><td>${e.supplier||''}</td>
    <td>${e.net.toFixed(2)}</td><td>${e.vat.toFixed(2)}</td><td>${e.total.toFixed(2)}</td>
  </tr>`).join('');
}
renderExpenseList();

function renderTakingsList(){
  const tbody = document.querySelector('#takings-list tbody');
  const takings = listTakings();
  tbody.innerHTML = takings.slice(-20).reverse().map(t=>{
    const servicesGross = t.lines?.reduce((sum, line) => sum + (line.unitPrice * line.qty - (line.discount||0) - (line.voucher||0)), 0) || 0;
    const totalGross = servicesGross + (t.retailGross||0);
    const vatAmount = t.vatMode === 'include' ? totalGross - (totalGross / (1 + (t.vatRate||23)/100)) : totalGross * ((t.vatRate||23)/100);
    const netAmount = t.vatMode === 'include' ? totalGross - vatAmount : totalGross;
    
    return `<tr>
      <td>${t.date}</td>
      <td>${t.mode||'daily'}</td>
      <td>${servicesGross.toFixed(2)}</td>
      <td>${(t.retailGross||0).toFixed(2)}</td>
      <td>${netAmount.toFixed(2)}</td>
      <td>${vatAmount.toFixed(2)}</td>
      <td>${totalGross.toFixed(2)}</td>
    </tr>`;
  }).join('');
}
renderTakingsList();

// Reports
document.getElementById('run-reports').addEventListener('click', ()=>{
  const from = document.getElementById('rep-from').value || null;
  const to = document.getElementById('rep-to').value || null;
  renderReports(from, to);
  // Show KPI tab by default
  setTimeout(() => showReportTab('kpi'), 100);
});
// Close Month functionality with enhanced contextual warnings
function updateCloseMonthButton() {
  const ym = document.getElementById('close-month').value;
  const btn = document.getElementById('close-month-btn');
  const btnContainer = btn.parentElement;
  
  // Clear any existing status messages
  const existingStatus = btnContainer.querySelector('.month-status');
  if (existingStatus) {
    existingStatus.remove();
  }
  
  if (!ym) {
    btn.style.display = 'none';
    return;
  }
  
  if (monthLocked(ym)) {
    btn.style.display = 'none';
    // Show status message instead
    const statusMsg = document.createElement('div');
    statusMsg.className = 'month-status chip success';
    statusMsg.innerHTML = `<span class="icon icon-check"></span>Month ${ym} is closed and locked`;
    btnContainer.appendChild(statusMsg);
  } else {
    btn.style.display = 'inline-flex';
    
    // Show warning message about what will happen
    const warningMsg = document.createElement('div');
    warningMsg.className = 'month-status chip warning';
    warningMsg.innerHTML = `<span class="icon icon-warning"></span>This will post COGS summary and permanently lock ${ym}`;
    btnContainer.appendChild(warningMsg);
  }
}

// Update button state when month changes
document.getElementById('close-month').addEventListener('change', updateCloseMonthButton);
document.getElementById('close-month').addEventListener('input', updateCloseMonthButton);

// Initialize button state
setTimeout(updateCloseMonthButton, 100);

document.getElementById('close-month-btn').addEventListener('click', ()=>{
  const ym = document.getElementById('close-month').value;
  if(!ym){ alert('Pick month'); return; }
  if(monthLocked(ym)){ alert('Month already locked'); return; }
  const cogs = closeMonthCOGS(ym);
  alert(`Posted COGS summary €${cogs.toFixed(2)} and locked ${ym}`);
  // Update button state after closing
  updateCloseMonthButton();
});

// Sync VAT settings back
document.getElementById('vat-mode').addEventListener('change', e=>{
  const s = getSettings(); s.vatMode = e.target.value; saveSettings(s);
});
document.getElementById('vat-rate').addEventListener('change', e=>{
  const s = getSettings(); s.vatRate = +e.target.value || 23; saveSettings(s);
});

// Initialize Staff Management (Unified System)
if (window.StaffManagement) {
  StaffManagement.init();
}
