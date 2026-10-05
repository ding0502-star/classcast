/* Always release capture tracks and audio connections, including cancellation. */
let exportCancelReason='';
function cancelExport(reason='已取消匯出，編輯內容仍保留。'){exportCancel=true;exportCancelReason=reason}
$('cancelExport').onclick=()=>cancelExport();
document.addEventListener('visibilitychange',()=>{if(document.hidden&&exporting&&!window.backgroundExport)cancelExport('切換分頁時已取消匯出，避免產生凍結畫面。請保持課映在前景後重新匯出。')});
async function waitForExportRange(end,error){
  return new Promise((resolve,reject)=>{
    let previous=video.currentTime,lastProgress=Date.now();
    const timer=setInterval(()=>{
      if(video.currentTime!==previous){previous=video.currentTime;lastProgress=Date.now()}
      if(error()){clearInterval(timer);reject(error());return}
      if(exportCancel||video.currentTime>=end-.025||video.ended){clearInterval(timer);resolve();return}
      if(Date.now()-lastProgress>15000){clearInterval(timer);reject(Error('影片播放停滯，請重新匯出。'))}
    },20);
  });
}
$('exportBtn').onclick=async()=>{
  if(!allowEdit())return;
  if(!clips.length)return notify('請至少加入一個保留片段。');
  if(document.hidden)return notify('請將課映切到前景後再開始匯出。');
  if(!types.length||!canvas.captureStream)return notify('此瀏覽器不支援影片匯出，請使用桌面版 Chrome 或 Edge。');
  stopPreview();
  exporting=true;exportCancel=false;exportCancelReason='';
  const previousTime=video.currentTime,previousMuted=video.muted,previousRate=video.playbackRate;
  let outputStream,outputRecorder,destination,stopped,error,progressTimer;
  const chunks=[];document.body.classList.add('busy');
  $('exportBtn').disabled=true;$('playBtn').disabled=true;$('seek').disabled=true;
  $('cancelExport').hidden=false;$('progress').hidden=false;$('progress').value=0;$('downloadLink').hidden=true;$('stateLabel').textContent='正在匯出';
  try{
    await ensureAudio();
    destination=exportAudioContext.createMediaStreamDestination();processedAudioNode.connect(destination);
    outputStream=canvas.captureStream(30);destination.stream.getAudioTracks().forEach(t=>outputStream.addTrack(t));
    outputRecorder=new MediaRecorder(outputStream,{mimeType:$('format').value,videoBitsPerSecond:6000000});
    stopped=new Promise((resolve,reject)=>{
      outputRecorder.onstop=resolve;
      outputRecorder.onerror=event=>{error=event.error||Error('影片編碼失敗。');reject(error)};
    });
    stopped.catch(()=>{});
    outputRecorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
    video.muted=false;video.playbackRate=1;let completed=0;
    for(let i=0;i<clips.length;i++){
      if(exportCancel)break;
      const c=clips[i];window.exportClipIndex=i;await seekTo(c.start);
      if(exportCancel)break;
      draw();updateAudioGain();
      if(outputRecorder.state==='inactive')outputRecorder.start(250);else outputRecorder.resume();
      await video.play();
      progressTimer=setInterval(()=>{const elapsed=Math.max(0,Math.min(c.end-c.start,video.currentTime-c.start));$('progress').value=(completed+elapsed)/totalDuration()*100;$('exportStatus').textContent='正在匯出 '+Math.round($('progress').value)+'% · 請保持課映在前景'},100);
      await waitForExportRange(c.end,()=>error);clearInterval(progressTimer);video.pause();
      if(outputRecorder.state==='recording')outputRecorder.pause();completed+=c.end-c.start;
    }
    if(outputRecorder.state!=='inactive'){outputRecorder.stop();await stopped}
    if(exportCancel){$('exportStatus').textContent=exportCancelReason||'已取消匯出。';return}
    if(error)throw error;
    const blob=new Blob(chunks,{type:outputRecorder.mimeType});if(!blob.size)throw Error('沒有產生可下載的影片，請重新嘗試。');
    if(exportUrl)URL.revokeObjectURL(exportUrl);exportUrl=URL.createObjectURL(blob);
    const link=$('downloadLink');link.href=exportUrl;link.download=($('exportName').value.trim()||'教學影片')+(outputRecorder.mimeType.includes('mp4')?'.mp4':'.webm');link.hidden=false;
    $('progress').value=100;$('exportStatus').textContent='匯出完成 · '+(blob.size/1048576).toFixed(2)+' MB · 點選下方按鈕保存影片。';notify('影片已匯出，請下載保存。');
  }catch(e){$('exportStatus').textContent=exportCancel?(exportCancelReason||'已取消匯出。'):'匯出未完成：'+e.message;notify($('exportStatus').textContent)}
  finally{
    clearInterval(progressTimer);video.pause();
    if(outputRecorder&&outputRecorder.state!=='inactive'){try{outputRecorder.stop();await stopped}catch{}}
    if(destination){try{processedAudioNode.disconnect(destination)}catch{}destination.stream.getTracks().forEach(t=>t.stop())}
    outputStream?.getTracks().forEach(t=>t.stop());
    video.muted=previousMuted;video.playbackRate=previousRate;window.exportClipIndex=null;
    await seekTo(previousTime).catch(()=>{});
    exporting=false;document.body.classList.remove('busy');$('exportBtn').disabled=false;$('playBtn').disabled=false;$('seek').disabled=false;$('cancelExport').hidden=true;$('stateLabel').textContent='可開始編輯';
  }
};
