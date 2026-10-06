'use strict';
let downloadedExportName=null;
async function releaseExportFile(){const name=downloadedExportName;downloadedExportName=null;if(name)await ClassCastExportStorage.remove(name).catch(()=>{})}
async function mediaWorker(type,state,temporaryName){
 return classCastExportJobs.run({type,blob:sourceBlob,state,temporaryName,width:canvas.width,height:canvas.height,format:$('format').value.includes('mp4')?'mp4':'webm'},data=>{
  if(data.type==='precheck'){if(!data.audio.present)$('exportChecks').textContent+='\n提醒：來源影片沒有音軌。';else if(data.audio.sampled&&data.audio.peak<.0001)$('exportChecks').textContent+='\n提醒：抽查片段未偵測到聲音。'}
  if(data.type==='storage')$('exportStorageHint').textContent=data.mode==='disk'?'正在分段寫入本機暫存，不會在記憶體累積整部成片。':'此環境無法使用本機檔案暫存；短片使用受限的記憶體模式。';
  if(data.type==='progress'){$('progress').value=data.value;$('exportStatus').textContent=`背景匯出 ${Math.round(data.value)}% · 已寫入 ${(data.bytes/1048576).toFixed(1)} MB · 可切換分頁`;}
 });
}
async function inspectExport(){
 const check=teaching.checkProject(snapshot());
 if(!check.errors.length){try{const {audio}=await mediaWorker('inspect',snapshot());if(!audio.present)check.warnings.push('來源影片沒有音軌。');else if(audio.sampled&&audio.peak<.0001)check.warnings.push('抽查片段未偵測到聲音，請確認收音。');else check.warnings.push('已抽查聲音，仍請試聽完整成片。')}catch(e){check.warnings.push('音訊檢查未完成：'+e.message)}}
 $('exportChecks').textContent=[...check.errors.map(s=>'需修正：'+s),...check.warnings.map(s=>'提醒：'+s),check.errors.length?'請修正後再匯出。':'片段與字幕範圍檢查通過。'].join('\n');return check;
}
$('checkExport').onclick=async()=>{if(!allowEdit())return;const op=ClassCastOperations.begin('inspecting');exportCancel=false;$('cancelExport').hidden=false;try{await inspectExport()}finally{$('cancelExport').hidden=true;op.end()}};
async function exportProject(){
 if(!allowEdit())return;const state=snapshot(),check=teaching.checkProject(state);$('exportChecks').textContent=[...check.errors,...check.warnings].join('\n');if(check.errors.length)return notify(check.errors.join(' '));
 if($('exportEngine').value==='realtime'){const previousUrl=exportUrl;await exportRealtime();if(exportUrl!==previousUrl)await releaseExportFile();return}
 if(!window.VideoEncoder||!window.Worker||!window.OffscreenCanvas)return notify('此瀏覽器不支援背景匯出，請選擇相容模式。');
 const operation=ClassCastOperations.begin('export-background');stopPreview();exporting=true;exportCancel=false;window.backgroundExport=true;
 $('cancelExport').hidden=false;$('progress').hidden=false;$('progress').value=0;$('downloadLink').hidden=true;$('stateLabel').textContent='背景匯出中';$('exportStatus').textContent='正在檢查影片與本機儲存空間…';
 const name='export-'+crypto.randomUUID()+($('format').value.includes('mp4')?'.mp4':'.webm');let retained=false;
 try{
  await ClassCastExportStorage.hold(name);if(exportCancel)return;
  const result=await mediaWorker('export',state,name);if(exportCancel)return;
  const blob=result.file?result.file.slice(0,result.file.size,result.mime):new Blob([result.buffer],{type:result.mime});
  if(exportUrl)URL.revokeObjectURL(exportUrl);await releaseExportFile();exportUrl=URL.createObjectURL(blob);
  if(result.storage==='disk'){downloadedExportName=name;retained=true}
  $('downloadLink').href=exportUrl;$('downloadLink').download=state.name+(result.mime.includes('mp4')?'.mp4':'.webm');$('downloadLink').hidden=false;$('progress').value=100;$('exportStatus').textContent=`匯出完成 · ${(blob.size/1048576).toFixed(2)} MB · 請下載保存`;notify('影片已完成背景匯出。');
 }catch(e){$('exportStatus').textContent=exportCancel?'已取消匯出，編輯仍保留。':'匯出未完成：'+e.message;notify($('exportStatus').textContent);if(!exportCancel)window.reportDiagnostic?.('background-export',e)}
 finally{if(exportCancel)$('exportStatus').textContent='已取消匯出，編輯仍保留。';classCastExportJobs.cancel();if(!retained)await ClassCastExportStorage.remove(name).catch(()=>{});exporting=false;window.backgroundExport=false;$('cancelExport').hidden=true;$('stateLabel').textContent='可開始編輯';operation.end()}
}
$('exportBtn').onclick=exportProject;
window.addEventListener('pagehide',()=>{classCastExportJobs.cancel();releaseExportFile()});

// Explicit operation events replace observers of unrelated CSS changes.
let lockedControls=[];
ClassCastOperations.subscribe(({state})=>{
 for(const [element,disabled]of lockedControls)element.disabled=disabled;lockedControls=[];
 const lockAll=['export-background','export-realtime','inspecting','loading','record-finalizing','transcribing'].includes(state);
 if(lockAll){const allowed=state==='transcribing'?['cancelAsr']:['cancelExport'];lockedControls=[...document.querySelectorAll('button,input,select,textarea')].filter(el=>!allowed.includes(el.id)).map(el=>[el,el.disabled]);for(const [el]of lockedControls)el.disabled=true}
 document.body.classList.toggle('busy',state!=='idle');
 if(state==='idle'){$('exportBtn').disabled=false;$('playBtn').disabled=!loaded;$('seek').disabled=!loaded;$('muteBtn').disabled=!loaded;window.applyCompatibility?.()}
 historyButtons();
});
