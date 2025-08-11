
/*! Tiny IndexedDB helper */
export function openDB(name, version, upgrade){
  return new Promise((resolve, reject)=>{
    const req = indexedDB.open(name, version);
    req.onerror = ()=>reject(req.error);
    req.onupgradeneeded = (e)=>upgrade && upgrade(req.result, e.oldVersion, e.newVersion);
    req.onsuccess = ()=>resolve(req.result);
  });
}
export function tx(db, stores, mode='readonly'){
  const t = db.transaction(stores, mode);
  return t;
}
export function put(t, store, value, key){ return new Promise((res,rej)=>{ const r=t.objectStore(store).put(value, key); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }); }
export function add(t, store, value){ return new Promise((res,rej)=>{ const r=t.objectStore(store).add(value); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }); }
export function getAll(t, store){ return new Promise((res,rej)=>{ const r=t.objectStore(store).getAll(); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }); }
export function getIndexAll(t, store, indexName, query){ return new Promise((res,rej)=>{ const r=t.objectStore(store).index(indexName).getAll(query); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }); }
export function del(t, store, key){ return new Promise((res,rej)=>{ const r=t.objectStore(store).delete(key); r.onsuccess=()=>res(); r.onerror=()=>rej(r.error); }); }
