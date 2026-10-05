const auditButton=document.createElement('button');auditButton.textContent='執行例外操作驗證';document.body.prepend(auditButton);
auditButton.onclick=async()=>{results.textContent='AUDIT RUNNING';try{
const w=frame.contentWindow,d=w.document,v=d.getElementById('video');
if(d.getElementById('projects').open)d.getElementById('projects').close();
assert(await w.loadVideo(await fixture(),'例外操作測試.webm',3.2),'valid fixture accepted');
w.addSubtitle(.2,2,'應保留的字幕');await w.saveProject(false);
const before=JSON.stringify(w.snapshot()),src=v.src;
assert(await w.loadVideo(new Blob(['invalid'],{type:'video/webm'}),'損毀.webm')===false,'invalid media rejected');
assert(JSON.stringify(w.snapshot())===before&&v.src===src,'failed import preserves media, edits and settings');
assert(Number.isNaN(w.parseTime('00:70:00,000')),'invalid subtitle timestamp rejected');
assert(!w.validRange(3.21,3.24),'out-of-media range rejected');
w.tab('export');
for(let i=0;i<2;i++){const exporting=d.getElementById('exportBtn').onclick();d.getElementById('cancelExport').click();await exporting;assert(d.getElementById('cancelExport').hidden&&!d.getElementById('exportBtn').disabled&&d.getElementById('downloadLink').hidden,'early cancellation releases controls '+(i+1));}
await d.getElementById('exportBtn').onclick();assert(!d.getElementById('downloadLink').hidden,'successful export after repeated cancellations');
const preview=d.getElementById('previewEdit').onclick();w.stopPreview();await preview;await pause(150);assert(v.paused,'cancelled pending preview cannot restart');
d.getElementById('cursorEnabled').checked=true;await v.play();w.recordCursor({x:.2,y:.3});d.getElementById('clearMarks').click();v.pause();w.finishCursor();assert(w.snapshot().marks.length===0,'cleared cursor trail cannot reappear');
await w.saveProject(false);const id=w.localStorage.getItem('classcast-last-project');await w.restoreProject(id);assert(w.snapshot().subs[0].text==='應保留的字幕','project remains restorable after failed import and cancellations');
results.textContent+='\nALL AUDIT CHECKS PASSED';
}catch(e){results.textContent+='\nFAIL '+e.stack}};
