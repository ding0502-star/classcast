/* Recording must never depend on the visibility or paint rate of the preview. */
window.ClassCastRecording={
  async createStream(primary,camera=null,{height=1080,onError=()=>{}}={}){
    const track=primary.getVideoTracks()[0];
    if(!track||track.readyState!=='live')throw Error('分享來源已結束，請重新選擇。');
    if(!camera)return{stream:new MediaStream([track]),close(){}};
    if(!window.MediaStreamTrackProcessor||!window.MediaStreamTrackGenerator||!window.OffscreenCanvas||!window.VideoFrame){
      throw Error('此瀏覽器不支援背景子母畫面錄影。請使用最新版桌面 Chrome／Edge，或選擇「螢幕錄影」。');
    }
    const cameraTrack=camera.getVideoTracks()[0];
    if(!cameraTrack||cameraTrack.readyState!=='live')throw Error('攝影機來源已結束，請重新開啟。');
    const screenCopy=track.clone(),cameraCopy=cameraTrack.clone();
    const output=new MediaStreamTrackGenerator({kind:'video'});
    const worker=new Worker('recording-worker.js');
    let closed=false;
    const close=()=>{if(closed)return;closed=true;worker.terminate();screenCopy.stop();cameraCopy.stop();output.stop()};
    try{
      const screenFrames=new MediaStreamTrackProcessor({track:screenCopy}).readable;
      const cameraFrames=new MediaStreamTrackProcessor({track:cameraCopy}).readable;
      await new Promise((resolve,reject)=>{
        const timeout=setTimeout(()=>{close();reject(Error('背景錄影引擎啟動逾時，請重試。'))},10000);
        worker.onmessage=({data})=>{
          if(data.type==='ready'){clearTimeout(timeout);resolve()}
          else if(data.type==='error'){clearTimeout(timeout);const error=Error(data.message);reject(error);if(!closed)onError(error)}
        };
        worker.onerror=e=>{clearTimeout(timeout);const error=Error(e.message||'背景錄影引擎發生錯誤。');reject(error);if(!closed)onError(error)};
        worker.postMessage({screenFrames,cameraFrames,output:output.writable,height},[screenFrames,cameraFrames,output.writable]);
      });
      return{stream:new MediaStream([output]),close};
    }catch(e){close();throw e}
  },
  sourceLabel(stream){const source=stream.getVideoTracks()[0]?.getSettings().displaySurface;return source==='monitor'?'整個螢幕':source==='window'?'視窗':source==='browser'?'指定分頁':'分享來源'}
};
