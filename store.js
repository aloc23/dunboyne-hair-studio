
// Very small IndexedDB wrapper
const DB_NAME = "salondb";
const DB_VER = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = (e) => {
      const db = req.result;
      db.createObjectStore("services", { keyPath: "name" });
      db.createObjectStore("takings", { keyPath: "id", autoIncrement: true });
      db.createObjectStore("expenses", { keyPath: "id", autoIncrement: true });
      db.createObjectStore("settings", { keyPath: "key" });
      db.createObjectStore("utils", { keyPath: "name" });
      db.createObjectStore("journal", { keyPath: "id", autoIncrement: true }); // simple journal
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function seedIfEmpty() {
  const db = await openDB();
  const tx = db.transaction(["services","settings","utils"], "readwrite");
  const svcStore = tx.objectStore("services");
  const setStore = tx.objectStore("settings");
  const utStore = tx.objectStore("utils");

  // Check settings
  const getReq = setStore.get("seeded");
  const seeded = await new Promise(r=>{getReq.onsuccess=()=>r(getReq.result); getReq.onerror=()=>r(null);});
  if (!seeded) {
    // seed services
    for (const row of SEED_SERVICES) {
      const [name, price, mins, supplies, utilsHr, labour, total] = row;
      svcStore.put({ name, price, mins, supplies, utilsHr, labour, total });
    }
    // seed settings
    setStore.put({ key:"vatRate", value: DEFAULT_SETTINGS.vatRate });
    setStore.put({ key:"vatMode", value: DEFAULT_SETTINGS.vatMode });
    setStore.put({ key:"utilsPerHour", value: DEFAULT_SETTINGS.utilsPerHour });
    setStore.put({ key:"seeded", value: true });
    // seed utils breakdown
    for (const [name, monthly, yearly, perHr] of SEED_UTILS) {
      utStore.put({ name, monthly, yearly, perHr });
    }
  }
  await tx.done;
  db.close();
}

function txStores(names, mode="readonly") {
  return openDB().then(db => db.transaction(names, mode));
}

const Store = {
  async listServices() {
    const tx = await txStores(["services"]);
    const st = tx.objectStore("services");
    return new Promise((resolve) => {
      const res = [];
      st.openCursor().onsuccess = (e)=>{
        const cur = e.target.result;
        if (cur) { res.push(cur.value); cur.continue(); } else { resolve(res); }
      };
    });
  },
  async upsertService(svc) {
    const tx = await txStores(["services"], "readwrite");
    tx.objectStore("services").put(svc);
    return tx.done;
  },
  async deleteService(name) {
    const tx = await txStores(["services"], "readwrite");
    tx.objectStore("services").delete(name);
    return tx.done;
  },
  async settingsGet(key) {
    const tx = await txStores(["settings"]);
    return new Promise((resolve)=>{
      const r = tx.objectStore("settings").get(key);
      r.onsuccess=()=>resolve(r.result? r.result.value : undefined);
      r.onerror=()=>resolve(undefined);
    });
  },
  async settingsSet(key, value) {
    const tx = await txStores(["settings"], "readwrite");
    tx.objectStore("settings").put({ key, value });
    return tx.done;
  },
  async listUtils() {
    const tx = await txStores(["utils"]);
    const st = tx.objectStore("utils");
    return new Promise((resolve) => {
      const res = [];
      st.openCursor().onsuccess = (e)=>{
        const cur = e.target.result;
        if (cur) { res.push(cur.value); cur.continue(); } else { resolve(res); }
      };
    });
  },
  async postExpense(exp) {
    const tx = await txStores(["expenses","journal"], "readwrite");
    tx.objectStore("expenses").add(exp);
    // journal: simple posting
    const j = tx.objectStore("journal");
    j.add({ date: exp.date, memo:`Expense ${exp.supplier}`, lines:[
      { account:"Expense", debit: exp.net },
      { account:"VAT Input", debit: exp.vat },
      { account:"Cash/Bank", credit: exp.total },
    ]});
    return tx.done;
  },
  async listExpenses() {
    const tx = await txStores(["expenses"]);
    const st = tx.objectStore("expenses");
    return new Promise((resolve) => {
      const res = [];
      st.openCursor(null, "prev").onsuccess = (e)=>{
        const cur = e.target.result;
        if (cur) { res.push(cur.value); cur.continue(); } else { resolve(res); }
      };
    });
  },
  async postTakings(t) {
    const tx = await txStores(["takings","journal"], "readwrite");
    const id = await new Promise((resolve)=>{
      const req = tx.objectStore("takings").add(t);
      req.onsuccess=()=>resolve(req.result);
    });
    // Journal lines
    const j = tx.objectStore("journal");
    // Revenue split
    const net = t.netSales;
    const vat = t.vatAmount;
    const servicesNet = t.servicesNet || 0;
    const retailNet = t.retailNet || 0;
    const cash = t.cash || 0, card = t.card || 0;
    const serviceCOGS = t.cogs || 0;
    j.add({ date: t.date, memo:"Takings", lines:[
      { account:"Cash", debit: cash },
      { account:"Bank", debit: card },
      { account:"Sales - Services", credit: servicesNet },
      { account:"Sales - Retail", credit: retailNet },
      { account:"VAT Payable", credit: vat },
    ]});
    if (serviceCOGS>0){
      j.add({ date: t.date, memo:"COGS (auto from services)", lines:[
        { account:"COGS", debit: serviceCOGS },
        { account:"Inventory/Materials", credit: serviceCOGS },
      ]});
    }
    return tx.done;
  },
  async runReports(from, to) {
    const tx = await txStores(["journal"]);
    const st = tx.objectStore("journal");
    const out = [];
    return new Promise((resolve)=>{
      st.openCursor().onsuccess = (e)=>{
        const cur = e.target.result;
        if (cur) {
          const row = cur.value;
          if (!from || !to || (row.date >= from && row.date <= to)) out.push(row);
          cur.continue();
        } else {
          // Aggregate balances
          const pl = new Map(), bs = new Map(), vat = new Map();
          function add(map, k, v){ map.set(k, (map.get(k)||0)+v); }
          for (const j of out){
            for (const l of j.lines){
              // naive mapping: income/expense vs balance accounts
              if (l.debit){
                if (l.account==="Expense" || l.account==="COGS") add(pl, l.account, l.debit);
                else add(bs, l.account, l.debit);
              }
              if (l.credit){
                if (l.account.startsWith("Sales")) add(pl, l.account, -l.credit);
                else add(bs, l.account, -l.credit);
              }
              if (l.account==="VAT Payable") add(vat, "Output VAT", l.credit||0);
              if (l.account==="VAT Input") add(vat, "Input VAT", l.debit||0);
            }
          }
          // Compute P&L totals
          let revenue=0, cogs=0, expenses=0;
          for (const [k,v] of pl){
            if (k.startsWith("Sales")) revenue += -v;
            else if (k==="COGS") cogs += v;
            else expenses += v;
          }
          const gross = revenue - cogs;
          const op = gross - expenses;
          resolve({ journal: out, pl, bs, vat, totals:{ revenue, cogs, gross, expenses, op } });
        }
      };
    });
  }
};
