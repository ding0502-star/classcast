/* Append-only recording journal. A session is removed only by explicit user action. */
(function(root){
const opened=new Promise((resolve,reject)=>{const r=indexedDB.open('classcast-recording-recovery',1);r.onupgradeneeded=()=>{r.result.createObjectStore('sessions',{keyPath:'id'});r.result.createObjectStore('chunks',{keyPath:['id','index']}).createIndex('session','id')};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onblocked=()=>reject(Error('請關閉其他課映分頁後重試。'))});opened.catch(()=>{});
async function transaction(stores,mode,action){const db=await opened;return new Promise((resolve,reject)=>{const tx=db.transaction(stores,mode);let value;try{value=action(tx)}catch(e){tx.abort();reject(e);return}tx.oncomplete=()=>resolve(typeof value==='function'?value():value);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('儲存中斷'))})}
const api={
async begin(mime){const row={id:crypto.randomUUID(),name:'錄影 '+new Date().toLocaleString('zh-TW'),mime,created:Date.now(),seconds:0,count:0,bytes:0,complete:false,marks:[]};await transaction(['sessions'],'readwrite',tx=>tx.objectStore('sessions').put(row));return row},
async append(row,blob,seconds,marks){const updated={...row,count:row.count+1,bytes:row.bytes+blob.size,seconds,marks};await transaction(['sessions','chunks'],'readwrite',tx=>{tx.objectStore('chunks').put({id:row.id,index:row.count,blob});tx.objectStore('sessions').put(updated)});Object.assign(row,updated)},
async finish(row){await transaction(['sessions'],'readwrite',tx=>tx.objectStore('sessions').put({...row,complete:true}))},
async list(){return transaction(['sessions'],'readonly',tx=>{const req=tx.objectStore('sessions').getAll();return ()=>req.result.sort((a,b)=>b.created-a.created)})},
async blob(row){return transaction(['chunks'],'readonly',tx=>{const r=tx.objectStore('chunks').index('session').getAll(row.id);return ()=>new Blob(r.result.sort((a,b)=>a.index-b.index).map(x=>x.blob),{type:row.mime})})},
async remove(id){await transaction(['sessions','chunks'],'readwrite',tx=>{tx.objectStore('sessions').delete(id);const req=tx.objectStore('chunks').index('session').openCursor(IDBKeyRange.only(id));req.onsuccess=()=>{const c=req.result;if(c){c.delete();c.continue()}}})}
};root.ClassCastRecovery=api;
})(globalThis);
