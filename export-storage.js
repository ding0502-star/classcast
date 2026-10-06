/* Only this application's export cache is touched. Recording/project stores are separate. */
(function(root){
const directory='classcast-export-cache';const held=new Map();
async function folder(){return (await navigator.storage.getDirectory()).getDirectoryHandle(directory,{create:true})}
async function hold(name){if(!navigator.locks)return;let unlock;const ready=new Promise(resolve=>{navigator.locks.request('classcast-cache-'+name,async()=>{held.set(name,()=>unlock());resolve();await new Promise(r=>unlock=r)}).catch(()=>resolve())});await ready}
async function remove(name){if(!name)return;try{const dir=await folder();for(let i=0;i<5;i++){try{await dir.removeEntry(name);break}catch(e){if(e.name==='NotFoundError')break;if(i===4)throw e;await new Promise(r=>setTimeout(r,100))}}}finally{held.get(name)?.();held.delete(name)}}
async function clearUnused(){if(!navigator.locks)throw Error('此瀏覽器不支援安全的跨分頁清理。請關閉課映分頁後，從瀏覽器網站資料設定管理空間。');const dir=await folder();let removed=0,skipped=0;for await(const [name,handle]of dir.entries()){if(handle.kind!=='file'||!/^export-[a-f0-9-]+\.(mp4|webm)$/.test(name))continue;await navigator.locks.request('classcast-cache-'+name,{ifAvailable:true},async lock=>{if(!lock){skipped++;return}await dir.removeEntry(name);removed++})}return {removed,skipped}}
root.ClassCastExportStorage={folder,hold,remove,clearUnused};
})(globalThis);
