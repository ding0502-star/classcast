/* A single worker lifecycle handles export, inspection and capability probing. */
(function(root){
class MediaJobs{
 constructor(){this.active=null}
 run(payload,onProgress=()=>{}){if(this.active)return Promise.reject(Error('已有影片作業進行中。'));const worker=new Worker('./export-worker.js?v=20261006-stability2',{type:'module'});return new Promise((resolve,reject)=>{const job={worker,reject,finish:null};this.active=job;let done=false;const timer=payload.type==='export'?null:setTimeout(()=>finish(Error('檢查逾時，請重試或使用相容模式。')),30000);const finish=(error,result)=>{if(done)return;done=true;clearTimeout(timer);worker.terminate();if(this.active===job)this.active=null;error?reject(error):resolve(result)};job.finish=finish;worker.onmessage=({data})=>{if(['progress','precheck','storage'].includes(data.type)){onProgress(data);return}finish(data.type==='error'?Error(data.message):null,data)};worker.onerror=e=>finish(Error(e.message||'影片引擎載入失敗，請重新整理或檢查網路。'));try{worker.postMessage(payload)}catch(e){finish(e)}})}
 cancel(){this.active?.finish(new DOMException('作業已取消。','AbortError'))}
}
root.ClassCastMediaJobs=MediaJobs;root.classCastExportJobs=new MediaJobs();
})(globalThis);
