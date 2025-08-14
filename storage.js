
const DB_KEY = 'salon.db.v1';
const nowISO = () => new Date().toISOString();

function loadDB(){
  const raw = localStorage.getItem(DB_KEY);
  if(raw){
    try { return JSON.parse(raw); } catch{}
  }
  // seed database
  const catalog = PRELOADED_SERVICES.map(s => ({
    id: crypto.randomUUID(), ...s, totalCost: +(s.products + s.utilities + s.labour).toFixed(2)
  }));
  const db = {
    catalog,
    takings: [], // {id,date,mode,vatMode,vatRate,lines:[{serviceId,qty,unitPrice,discount,voucher}], retailGross,cash,card, postedAt}
    expenses: [], // {id,date,category,supplier,net,vatRate,vat,total, postedAt}
    journals: [], // summary post entries for COGS month-close etc.
    wagesData: [], // staff wages comparison data
    settings: {
      vatMode: 'include',
      vatRate: 23,
      categories: DEFAULT_EXPENSE_CATEGORIES.slice(),
      utilities: DEFAULT_UTILITIES.slice(),
      lockedMonths: [], // ['2025-07']
      balanceSheet: {
        cashInBank: 0,
        capital: 0
      }
    }
  };
  saveDB(db);
  return db;
}

function saveDB(db){ localStorage.setItem(DB_KEY, JSON.stringify(db)); }

function getCatalog(){ return loadDB().catalog; }
function upsertService(svc){
  const db = loadDB();
  const i = db.catalog.findIndex(x => x.id === svc.id);
  if(i>=0) db.catalog[i] = {...svc, totalCost: +(svc.products + svc.utilities + svc.labour).toFixed(2)};
  else db.catalog.push({...svc, id: crypto.randomUUID(), totalCost: +(svc.products + svc.utilities + svc.labour).toFixed(2)});
  saveDB(db);
}
function deleteService(id){
  const db = loadDB();
  db.catalog = db.catalog.filter(s => s.id !== id);
  saveDB(db);
}

function postTakings(entry){
  const db = loadDB();
  entry.id = crypto.randomUUID();
  entry.postedAt = nowISO();
  db.takings.push(entry);
  saveDB(db);
}

function postExpense(exp){
  const db = loadDB();
  exp.id = crypto.randomUUID();
  exp.postedAt = nowISO();
  exp.vat = +(exp.net * (exp.vatRate/100)).toFixed(2);
  exp.total = +(exp.net + exp.vat).toFixed(2);
  db.expenses.push(exp);
  saveDB(db);
}

function clearAllExpenses(){
  const db = loadDB();
  db.expenses = [];
  saveDB(db);
}

function getSettings(){ return loadDB().settings; }
function saveSettings(s){ const db = loadDB(); db.settings = s; saveDB(db); }

function getWagesData(){
  const db = loadDB();
  return db.wagesData || [];
}
function saveWagesData(wagesData){
  const db = loadDB();
  db.wagesData = wagesData;
  saveDB(db);
}

function addJournal(j){
  const db = loadDB();
  j.id = crypto.randomUUID();
  j.postedAt = nowISO();
  db.journals.push(j);
  saveDB(db);
}

function monthLocked(ym){
  const s = getSettings();
  return s.lockedMonths.includes(ym);
}
function lockMonth(ym){
  const s = getSettings();
  if(!s.lockedMonths.includes(ym)) s.lockedMonths.push(ym);
  saveSettings(s);
}

function getBalanceSheetData(){
  const s = getSettings();
  return s.balanceSheet || { cashInBank: 0, capital: 0 };
}

function updateBalanceSheetData(cashInBank, capital){
  const s = getSettings();
  if(!s.balanceSheet) s.balanceSheet = {};
  s.balanceSheet.cashInBank = parseFloat(cashInBank) || 0;
  s.balanceSheet.capital = parseFloat(capital) || 0;
  saveSettings(s);
}
