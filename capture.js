'use strict';
let preparingCancelled=false,captureDecision=null;
function cancelCapture(){preparingCancelled=true;captureDecision?.(false);captureDecision=null;$('preflight').close()}
$('cancelCapture').onclick=cancelCapture;$('preflight').addEventListener('cancel',e=>{e.preventDefault();cancelCapture()});
async function captureCheck(screen,cam,mic,mix){
  const stream=screen||cam;$('capturePreview').srcObject=stream;
  $('captureSource').textContent='分享來源：'+(screen?ClassCastRecording.sourceLabel(screen):'攝影機')+'。請確認上方畫面是要錄製的教材。';
  const hasSystem=!!screen?.getAudioTracks().length,hasMic=!!mic?.getAudioTracks().length;
  $('captureAudio').textContent=`麥克風：${hasMic?'已連接':'未錄製'}；系統聲音：${hasSystem?'已連接':'未錄製'}。${mix.tracks.length?'請說話並確認音量表有反應。':'這次將錄製無聲影片。'}`;
  $('countdownStatus').textContent='尚未開始錄影。';$('confirmCapture').disabled=false;$('preflight').showModal();
  let analyser,node,timer;if(mix.audio&&mix.tracks.length){analyser=mix.audio.createAnalyser();analyser.fftSize=256;node=mix.audio.createMediaStreamSource(new MediaStream(mix.tracks));node.connect(analyser);const data=new Float32Array(256);timer=setInterval(()=>{analyser.getFloatTimeDomainData(data);$('micLevel').value=Math.min(1,Math.sqrt(data.reduce((n,x)=>n+x*x,0)/data.length)*5)},80)}
  try{const accepted=await new Promise(resolve=>{captureDecision=resolve;$('confirmCapture').onclick=()=>{captureDecision=null;resolve(true)}});if(!accepted)return false;$('confirmCapture').disabled=true;for(let n=Number($('captureCountdown').value);n>0;n--){if(preparingCancelled)return false;$('countdownStatus').textContent=`${n} 秒後開始錄影…`;await new Promise(r=>setTimeout(r,1000))}return !preparingCancelled&&stream.getVideoTracks()[0].readyState==='live'}finally{clearInterval(timer);node?.disconnect();$('micLevel').value=0;$('capturePreview').srcObject=null;$('preflight').close();captureDecision=null}
}
$('recordBtn').onclick=async()=>{
  if(busy())return;if(!navigator.mediaDevices||!window.MediaRecorder)return notify('請使用支援錄影的桌面版 Chrome 或 Edge。');
  const operation=ClassCastOperations.begin('record-preparing');
  stopPreview();recordPreparing=true;preparingCancelled=false;$('recordBtn').disabled=true;let screen,cam,mic,row;const previousCanvas={width:canvas.width,height:canvas.height};
  try{
    const height=Number($('quality').value);
    if(mode!=='camera'){screen=await navigator.mediaDevices.getDisplayMedia({selfBrowserSurface:'exclude',preferCurrentTab:false,video:{height,frameRate:30,displaySurface:'monitor'},audio:$('systemAudio').checked});recordStreams.push(screen)}
    if(mode!=='screen'){cam=await navigator.mediaDevices.getUserMedia({video:{width:1280,height:720},audio:false});recordStreams.push(cam)}
    if($('mic').checked){mic=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true},video:false});recordStreams.push(mic)}
    const main=screen||cam;main.getVideoTracks()[0].onended=()=>{if(recordPreparing)cancelCapture();else if(recorder&&recorder.state!=='inactive')recorder.stop()};
    const mix=mixedAudio(recordStreams);recordAudio=mix.audio;recordStreams.push(new MediaStream(mix.tracks));
    if(!await captureCheck(screen,cam,mic,mix)){recordCleanup();return}
    if(loaded&&window.unsavedProject&&!await saveProject(false))throw Error('目前專案尚未成功儲存，請先下載備份後再錄影。');
    const mime=types.find(t=>t.startsWith('video/webm'))||types[0];if(!mime)throw Error('此瀏覽器没有支援的錄影格式。');
    row=await ClassCastRecovery.begin(mime);
    const makeVideo=async stream=>{const v=document.createElement('video');v.srcObject=stream;v.muted=true;v.playsInline=true;await v.play();return v};
    const sv=screen?await makeVideo(screen):null,cv=cam?await makeVideo(cam):null,primary=sv||cv;
    canvas.width=Math.round(height*primary.videoWidth/primary.videoHeight/2)*2;canvas.height=height;$('stage').style.aspectRatio=`${canvas.width}/${canvas.height}`;$('empty').hidden=true;canvas.hidden=false;
    beginLiveAnnotations();const render=()=>{drawFrame(ctx,primary,canvas.width,canvas.height);if(sv&&cv){const w=canvas.width*.23,h=w*cv.videoHeight/cv.videoWidth,x=canvas.width-w-28,y=canvas.height-h-28;ctx.fillStyle='white';ctx.fillRect(x-4,y-4,w+8,h+8);ctx.drawImage(cv,x,y,w,h)}renderAnnotations(true);recordFrame=requestAnimationFrame(render)};render();
    recordingPipeline=await ClassCastRecording.createStream(main,screen&&cam?cam:null,{height,onError:e=>{notify(e.message);if(recorder&&recorder.state!=='inactive')recorder.stop()}});
    const stream=recordingPipeline.stream;mix.tracks.forEach(t=>stream.addTrack(t));recordStreams.push(stream);
    recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:6000000});const active=recorder;let writes=Promise.resolve(),storageError=null,tail=[],pendingBytes=0;
    const elapsed=()=>Math.max(0,((pausedAt||Date.now())-recordStart-pauseTotal)/1000);
    active.ondataavailable=e=>{if(!e.data.size)return;pendingBytes+=e.data.size;if(pendingBytes>32*1048576&&active.state!=='inactive'){notify('儲存速度不足，已停止錄影並保留資料。');active.stop()}const seconds=elapsed(),annotations=finishLiveAnnotations(seconds);writes=writes.then(async()=>{if(storageError){tail.push(e.data);pendingBytes-=e.data.size;return}try{await ClassCastRecovery.append(row,e.data,seconds,annotations);$('recoveryStatus').textContent=`已保護至 ${clock(seconds)} · ${(row.bytes/1048576).toFixed(1)} MB`}catch(error){storageError=error;tail.push(e.data);$('recoveryStatus').textContent='本機空間不足或儲存失敗，已停止錄影；請立即下載影片。';notify($('recoveryStatus').textContent);if(active.state!=='inactive')active.stop()}finally{pendingBytes-=e.data.size}})};
    active.onerror=()=>{notify('錄影中斷，正在保存可用內容。');if(active.state!=='inactive')active.stop()};
    active.onstop=async()=>{const length=elapsed(),annotations=finishLiveAnnotations(length);recorder=null;recordCleanup();operation.set('record-finalizing');window.projectBusy=true;$('stateLabel').textContent='正在整理錄影…';try{await writes;const saved=await ClassCastRecovery.blob(row);const blob=tail.length?new Blob([saved,...tail],{type:mime}):saved;if(!storageError)await ClassCastRecovery.finish(row);window.projectBusy=false;operation.end();if(blob.size&&length>.1){if(await loadVideo(blob,'教學錄影 '+new Date().toLocaleTimeString('zh-TW'),length)){restoreLiveAnnotations(annotations);resetHistory();if(!await saveProject(false))notify('專案儲存失敗，請立即下載專案備份；已保存的录影仍在錄影救援。')}}else notify('錄影時間太短，請重新錄製。')}catch(e){notify('整理失敗，可從錄影救援取回：'+e.message)}finally{window.projectBusy=false;operation.end();$('stateLabel').textContent=loaded?'可開始編輯':'準備就緒'}};
    pauseTotal=0;pausedAt=0;recordStart=Date.now();active.start(1000);recordPreparing=false;operation.set('recording');$('recordBtn').hidden=true;$('recordControls').hidden=false;$('liveBadge').hidden=false;$('stateLabel').textContent='正在錄影 · '+(screen?ClassCastRecording.sourceLabel(screen):'攝影機');$('recoveryStatus').textContent='正在錄影，等待第一筆本機備份…';document.body.classList.add('busy');recordTimer=setInterval(()=>{$('recordTime').textContent=clock(elapsed())},250);
  }catch(e){recorder=null;recordCleanup();canvas.width=previousCanvas.width;canvas.height=previousCanvas.height;$('stage').style.aspectRatio=canvas.width+'/'+canvas.height;$('empty').hidden=loaded;canvas.hidden=!loaded;if(loaded)draw();notify(e.name==='NotAllowedError'?'已取消或未允許錄影權限。':e.message)}finally{recordPreparing=false;if(!recorder)operation.end();$('recordBtn').disabled=false;historyButtons()}
};
