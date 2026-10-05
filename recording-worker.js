/* A frame-driven compositor: no window timers or requestAnimationFrame. */
self.onmessage=async({data})=>{
  const reader=data.screenFrames.getReader(),cameraReader=data.cameraFrames.getReader(),writer=data.output.getWriter();
  const surface=new OffscreenCanvas(2,2),context=surface.getContext('2d',{alpha:false});
  let cameraFrame=null,finished=false;
  const pumpCamera=(async()=>{try{while(!finished){const next=await cameraReader.read();if(next.done)break;cameraFrame?.close();cameraFrame=next.value}}catch(e){if(!finished)self.postMessage({type:'error',message:'攝影機影像處理失敗：'+e.message})}})();
  self.postMessage({type:'ready'});
  try{
    while(!finished){
      const {value:frame,done}=await reader.read();if(done)break;
      let composed;
      try{
        const ratio=frame.displayWidth/frame.displayHeight;
        const height=Math.max(2,Math.round(Math.min(data.height||1080,frame.displayHeight)/2)*2);
        const width=Math.max(2,Math.round(height*ratio/2)*2);
        if(surface.width!==width||surface.height!==height){surface.width=width;surface.height=height}
        context.drawImage(frame,0,0,width,height);
        if(cameraFrame){const w=width*.23,h=w*cameraFrame.displayHeight/cameraFrame.displayWidth,pad=width*.02,x=width-w-pad,y=height-h-pad;context.fillStyle='white';context.fillRect(x-3,y-3,w+6,h+6);context.drawImage(cameraFrame,x,y,w,h)}
        composed=new VideoFrame(surface,{timestamp:frame.timestamp,duration:frame.duration??undefined});
        await writer.write(composed);
      }finally{composed?.close();frame.close()}
    }
  }catch(e){self.postMessage({type:'error',message:'背景錄影處理失敗：'+e.message})}
  finally{finished=true;cameraFrame?.close();cameraFrame=null;await Promise.allSettled([reader.cancel(),cameraReader.cancel(),writer.close(),pumpCamera])}
};
