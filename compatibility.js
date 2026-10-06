'use strict';
const capabilityJobs=new ClassCastMediaJobs();let compatibility=null,diagnosticErrors=[];
window.reportDiagnostic=(context,error)=>{diagnosticErrors.push({time:new Date().toISOString(),context,type:error.name||'Error'});diagnosticErrors=diagnosticErrors.slice(-8)};
function capabilityRows(c){return [
 ['安全連線',c.secure,'請使用 HTTPS 網址或本機預覽。'],
 ['螢幕錄影',c.screen,'此環境無法分享螢幕；可匯入影片，或改用支援的桌面瀏覽器。'],
 ['攝影機與麥克風',c.camera,'請使用支援媒體擷取的瀏覽器；實際使用仍需授權。'],
 ['背景子母畫面錄影',c.composite,'可改用單一螢幕或攝影機模式。'],
 ['背景 MP4 匯出',c.mp4,'可嘗試 WebM 或相容模式。'],
 ['背景 WebM 匯出',c.webm,'可嘗試 MP4 或相容模式。'],
 ['長影片本機暫存',c.disk,'無法使用時僅允許小型記憶體匯出，避免耗盡記憶體。'],
 ['專案與錄影保存',c.database,'請檢查私人瀏覽限制或儲存空間；重要影片另下載備份。']
 ]}
window.applyCompatibility=()=>{if(!compatibility||ClassCastOperations.busy)return;const c=compatibility;for(const button of document.querySelectorAll('[data-mode]')){const supported=button.dataset.mode==='screen'?c.screen:button.dataset.mode==='camera'?c.camera:c.screen&&c.camera&&c.composite;button.disabled=!supported;button.title=supported?'':'此環境不支援此錄影模式'}
 $('recordBtn').disabled=!c.recorder||!c.database||(mode==='screen'?!c.screen:mode==='camera'?!c.camera:!c.screen||!c.camera||!c.composite);$('exportEngine').options[0].disabled=!c.mp4&&!c.webm;
 if(!c.mp4&&!c.webm&&$('exportEngine').value==='worker')$('exportEngine').value='realtime';
};
async function checkDatabase(){try{await Promise.all([dbPromise,ClassCastRecovery.list()]);return true}catch{return false}}
async function refreshCompatibility(){
 $('refreshCompatibility').disabled=true;$('compatibilitySummary').textContent='正在檢查瀏覽器功能…';
 try{const [media,database,space]=await Promise.all([capabilityJobs.run({type:'capabilities'}).catch(e=>({error:e.message})),checkDatabase(),navigator.storage?.estimate?.().catch(()=>null)]);
 compatibility={secure:window.isSecureContext,screen:!!navigator.mediaDevices?.getDisplayMedia,camera:!!navigator.mediaDevices?.getUserMedia,recorder:types.length>0,composite:!!(window.MediaStreamTrackProcessor&&window.MediaStreamTrackGenerator&&window.OffscreenCanvas&&window.VideoFrame),database,mp4:!!media.mp4,webm:!!media.webm,disk:!!media.disk,space:space?{usedMB:Math.round(space.usage/1048576),quotaMB:Math.round(space.quota/1048576)}:null,engineError:media.error||null};
 $('compatibilityList').replaceChildren();for(const [label,supported,detail]of capabilityRows(compatibility)){const row=document.createElement('div');row.className='item';row.textContent=`${supported?'✓':'—'} ${label}：${supported?'可用':detail}`;$('compatibilityList').append(row)}
 if(media.error){const row=document.createElement('p');row.textContent='背景引擎檢查未完成：'+media.error;$('compatibilityList').append(row)}
 $('storageEstimate').textContent=compatibility.space?`此網站已使用約 ${compatibility.space.usedMB} MB，瀏覽器配額約 ${compatibility.space.quotaMB} MB；實際可用空間仍受裝置限制。`:'此瀏覽器未提供儲存空間估算。';
 $('compatibilitySummary').textContent=compatibility.disk&&(compatibility.mp4||compatibility.webm)?'支援背景匯出與長影片本機暫存。': '部分功能受瀏覽器限制，請查看「環境檢查」。';applyCompatibility();
 }catch(e){$('compatibilitySummary').textContent='環境檢查未完成，請重新檢查。';reportDiagnostic('compatibility',e)}finally{$('refreshCompatibility').disabled=false}
}
$('compatibilityBtn').onclick=()=>$('compatibilityDialog').showModal();$('closeCompatibility').onclick=()=>$('compatibilityDialog').close();$('refreshCompatibility').onclick=refreshCompatibility;
$('clearExportCache').onclick=async()=>{if(busy())return notify('請先完成目前作業。');$('clearExportCache').disabled=true;try{const {removed,skipped}=await ClassCastExportStorage.clearUnused();notify(`已清理 ${removed} 個暫存，保留 ${skipped} 個正在使用的檔案。`);await refreshCompatibility()}catch(e){notify(e.message)}finally{$('clearExportCache').disabled=false}};
$('copyDiagnostics').onclick=async()=>{const report=JSON.stringify({version:'20261006-stability2',browser:navigator.userAgent,operation:ClassCastOperations.state,capabilities:compatibility,errors:diagnosticErrors},null,2);$('diagnosticText').hidden=false;$('diagnosticText').textContent=report;try{await navigator.clipboard.writeText(report);notify('已複製診斷資訊；不含影片、字幕、專案名稱或裝置識別碼。')}catch{notify('請選取下方診斷資訊並手動複製。')}};
document.querySelectorAll('[data-mode]').forEach(button=>button.addEventListener('click',()=>applyCompatibility()));
refreshCompatibility();
