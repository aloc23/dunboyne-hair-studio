// Simple IndexedDB wrapper
const DB_NAME = 'salon-db-v1';
const DB_VERSION = 1;

function openDB(){
  return new Promise((resolve,reject)=>{
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e)=>{
      const db = req.result;
      db.createObjectStore('settings', {keyPath:'key'});
      db.createObjectStore('services', {keyPath:'id', autoIncrement:true});
      db.createObjectStore('takings', {keyPath:'id', autoIncrement:true});
      db.createObjectStore('journal', {keyPath:'id', autoIncrement:true});
    };
    req.onsuccess = ()=> resolve(req.result);
    req.onerror = ()=> reject(req.error);
  });
}

async function tx(store, mode='readonly'){
  const db = await openDB();
  return db.transaction(store, mode).objectStore(store);
}

async function getAll(store){
  const s = await tx(store);
  return new Promise((resolve,reject)=>{
    const out=[]; const req = s.openCursor();
    req.onsuccess = (e)=>{ const cur = e.target.result; if(cur){ out.push(cur.value); cur.continue(); } else resolve(out); };
    req.onerror = ()=> reject(req.error);
  });
}
async function put(store, value){
  const s = await tx(store, 'readwrite');
  return new Promise((resolve,reject)=>{
    const req = s.put(value);
    req.onsuccess = ()=> resolve(req.result);
    req.onerror = ()=> reject(req.error);
  });
}
async function del(store, key){
  const s = await tx(store, 'readwrite');
  return new Promise((resolve,reject)=>{
    const req = s.delete(key);
    req.onsuccess = ()=> resolve();
    req.onerror = ()=> reject(req.error);
  });
}
async function clear(store){
  const s = await tx(store, 'readwrite');
  return new Promise((resolve,reject)=>{
    const req = s.clear();
    req.onsuccess = ()=> resolve();
    req.onerror = ()=> reject(req.error);
  });
}
