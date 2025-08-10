
// Simple IndexedDB wrapper with versioned stores and seed data
const DB_NAME = 'salonAcctDB';
const DB_VERSION = 1;

const STORES = [
  'meta','accounts','journal_entries','takings','expenses',
  'services','materials','service_materials','stylists','operations','settings','analyses'
];

export function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = req.result;
      STORES.forEach(s => { if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id', autoIncrement: true }); });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function tx(store, mode='readonly') {
  const db = await openDB();
  return db.transaction(store, mode).objectStore(store);
}

export async function put(store, obj) {
  const s = await tx(store, 'readwrite');
  return new Promise((resolve, reject) => {
    const req = s.put(obj);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function add(store, obj) {
  const s = await tx(store, 'readwrite');
  return new Promise((resolve, reject) => {
    const req = s.add(obj);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getAll(store) {
  const s = await tx(store, 'readonly');
  return new Promise((resolve, reject) => {
    const req = s.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function getByIndex(store, predicate) {
  const all = await getAll(store);
  return all.filter(predicate);
}

export async function removeAll(store) {
  const s = await tx(store, 'readwrite');
  return new Promise((resolve, reject) => {
    const req = s.clear();
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

export async function seedIfEmpty() {
  const accounts = await getAll('accounts');
  if (accounts.length) return;
  const chart = [
    { code:'1000', name:'Cash', type:'asset' },
    { code:'1010', name:'Bank', type:'asset' },
    { code:'1200', name:'Inventory', type:'asset' },
    { code:'2000', name:'Accounts Payable', type:'liability' },
    { code:'2100', name:'VAT Payable', type:'liability' },
    { code:'2200', name:'Unearned Revenue (Vouchers)', type:'liability' },
    { code:'3000', name:'Owner Equity', type:'equity' },
    { code:'4000', name:'Sales - Services', type:'income' },
    { code:'4010', name:'Sales - Retail', type:'income' },
    { code:'5000', name:'COGS - Materials', type:'expense' },
    { code:'5100', name:'Wages Expense', type:'expense' },
    { code:'5200', name:'Rent & Utilities', type:'expense' },
    { code:'5300', name:'Commission Expense', type:'expense' },
    { code:'5900', name:'Other Expenses', type:'expense' },
    { code:'2150', name:'VAT Input', type:'asset' } // Input VAT as asset receivable
  ];
  for (const acc of chart) await add('accounts', acc);
  // default settings
  await add('settings', { id: 1, defaultVatRate: 23, vatMode: 'include' });
  // seed stylist
  await add('stylists', { name:'Default Stylist', commissionRate:0 });
  // seed service + material example
  const svcId = await add('services', { name:'Haircut', price:40, defaultVatRate:23, targetMargin:60 });
  const matId = await add('materials', { name:'Shampoo', unit:'ml', costPerUnit:0.02 });
  await add('service_materials', { serviceId: svcId, materialId: matId, unitsPerService: 20 });
}
