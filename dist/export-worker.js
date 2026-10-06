import {Input,ALL_FORMATS,BlobSource,CanvasSink,AudioSampleSink,AudioSample,Output,BufferTarget,StreamTarget,Mp4OutputFormat,WebMOutputFormat,CanvasSource,AudioSampleSource,canEncodeVideo,canEncodeAudio} from './vendor/mediabunny-1.61.3.mjs';
import './renderer.js?v=20261006-stability2';
import './core.js?v=20261006-stability2';
let input,output;
const MEMORY_LIMIT=96*1048576;
async function probeStorage(){let dir,name;try{dir=await(await navigator.storage.getDirectory()).getDirectoryHandle('classcast-export-cache',{create:true});name='probe-'+crypto.randomUUID();const h=await dir.getFileHandle(name,{create:true}),w=await h.createWritable();await w.write(new Uint8Array([67,67]));await w.close();return true}catch{return false}finally{if(dir&&name)await dir.removeEntry(name).catch(()=>{})}}
async function capabilities(){const video=typeof VideoEncoder!=='undefined'&&typeof VideoDecoder!=='undefined'&&typeof OffscreenCanvas!=='undefined';const audio=typeof AudioEncoder!=='undefined'&&typeof AudioDecoder!=='undefined';const supports=async(codec,kind)=>{try{return kind==='video'?await canEncodeVideo(codec,{width:1920,height:1080,bitrate:6000000}):await canEncodeAudio(codec,{numberOfChannels:2,sampleRate:48000,bitrate:128000})}catch{return false}};return {video,audio,mp4:video&&audio&&await supports('avc','video')&&await supports('aac','audio'),webm:video&&audio&&await supports('vp8','video')&&await supports('opus','audio'),disk:await probeStorage()}}
function* segments(clips){for(const c of clips)for(let start=c.start;start<c.end-1e-7;start+=2)yield {start,end:Math.min(c.end,start+2),resetAudio:start===c.start}}
async function createTarget(data,total){
 let fileHandle=null,writable=null;
 if(navigator.storage?.getDirectory&&/^export-[a-f0-9-]+\.(mp4|webm)$/.test(data.temporaryName||'')){
  const space=await navigator.storage.estimate().catch(()=>({}));const estimate=total*6128000/8*1.15+16*1048576;
  if(Number.isFinite(space.quota)&&space.quota-space.usage<estimate)throw new DOMException('本機暫存空間可能不足，請先清理舊匯出暫存或縮短片段。','QuotaExceededError');
  try{const dir=await(await navigator.storage.getDirectory()).getDirectoryHandle('classcast-export-cache',{create:true});fileHandle=await dir.getFileHandle(data.temporaryName,{create:true});writable=await fileHandle.createWritable()}catch(e){if(e.name==='QuotaExceededError')throw e;fileHandle=null}
 }
 if(writable)return {target:new StreamTarget(writable,{chunked:true,chunkSize:1048576}),fileHandle,storage:'disk'};
 if(total*6128000/8>MEMORY_LIMIT)throw Error('此環境無法使用本機暫存，成片預估超過記憶體安全範圍。請使用桌面 Chrome／Edge 的一般視窗，或分段匯出。');
 const target=new BufferTarget();target.on('write',({end})=>{if(end>MEMORY_LIMIT)throw Error('記憶體匯出已達安全上限，請縮短片段或改用支援本機暫存的瀏覽器。')});return {target,fileHandle:null,storage:'memory'};
}
async function inspect(blob,state){
 input=new Input({source:new BlobSource(blob),formats:ALL_FORMATS});
 const vt=await input.getPrimaryVideoTrack(),at=await input.getPrimaryAudioTrack();if(!vt||!await vt.canDecode())throw Error('此影片無法使用背景解碼，請改用相容模式。');
 let peak=0,count=0;if(at){if(!await at.canDecode())throw Error('此影片音訊無法背景解碼，請使用相容模式，避免遺失聲音。');const sink=new AudioSampleSink(at);const starts=[...new Set(state.clips.slice(0,3).map(c=>c.start))];for(const start of starts){for await(const sample of sink.samples(start,Math.min(state.duration,start+1))){try{const data=new Float32Array(sample.numberOfFrames);sample.copyTo(data,{format:'f32-planar',planeIndex:0});for(const x of data)peak=Math.max(peak,Math.abs(x));count+=data.length}finally{sample.close()}}}}
 return {vt,at,audio:{present:!!at,peak,sampled:count>0}};
}
self.onmessage=async({data})=>{try{
 if(data.type==='capabilities'){self.postMessage({type:'capabilities',...(await capabilities())});return}
 const {blob,state,width,height,format}=data;const {vt,at,audio}=await inspect(blob,state);
 if(data.type==='inspect'){self.postMessage({type:'inspection',audio});return}
 self.postMessage({type:'precheck',audio});
 const mp4=format==='mp4',vcodec=mp4?'avc':'vp8',acodec=mp4?'aac':'opus';
 if(!await canEncodeVideo(vcodec,{width,height,bitrate:6000000}))throw Error('此裝置無法背景編碼所選格式，請切換 MP4／WebM 或使用相容模式。');
 const channels=at?await at.getNumberOfChannels():0,rate=at?await at.getSampleRate():48000;
 if(at&&!await canEncodeAudio(acodec,{numberOfChannels:channels,sampleRate:rate,bitrate:128000}))throw Error('此裝置無法編碼所選音訊，請切換格式或使用相容模式。');
 const total=state.clips.reduce((n,c)=>n+c.end-c.start,0);const {target,fileHandle,storage}=await createTarget(data,total);let writtenBytes=0;target.on('write',({end})=>{writtenBytes=Math.max(writtenBytes,end)});self.postMessage({type:'storage',mode:storage});output=new Output({target,format:mp4?new Mp4OutputFormat({fastStart:'fragmented',minimumFragmentDuration:2}):new WebMOutputFormat()});
 const canvas=new OffscreenCanvas(width,height),renderer=ClassCastRenderer(canvas,state),vs=new CanvasSource(canvas,{codec:vcodec,bitrate:6000000,keyFrameInterval:2});
 output.addVideoTrack(vs,{frameRate:30});const as=at?new AudioSampleSource({codec:acodec,bitrate:128000}):null;if(as)output.addAudioTrack(as);
 await output.start();const sink=new CanvasSink(vt,{width,height,fit:'contain',poolSize:1}),audioSink=at?new AudioSampleSink(at):null,firstVideoTimestamp=await vt.getFirstTimestamp();let offset=0,lastReport=0;const previousX=new Float32Array(channels),previousY=new Float32Array(channels);
 for(const clip of segments(state.clips)){if(clip.resetAudio){previousX.fill(0);previousY.fill(0)}const base=offset,length=clip.end-clip.start;
   const videoTask=async()=>{let frame=0;const times=(function*(){for(let t=clip.start;t<clip.end-1e-7;t+=1/30)yield Math.max(t,firstVideoTimestamp)})();for await(const image of sink.canvasesAtTimestamps(times)){const t=clip.start+frame/30;if(!image)throw Error('影片片段缺少可解碼畫面。');renderer.render(image.canvas,t);await vs.add(base+frame/30,Math.min(1/30,clip.end-t));frame++;if(performance.now()-lastReport>200){lastReport=performance.now();self.postMessage({type:'progress',value:Math.min(99,(base+frame/30)/total*100),bytes:writtenBytes})}}};
   const audioTask=async()=>{if(!audioSink)return;for await(const sample of audioSink.samples(clip.start,clip.end)){try{const first=Math.max(0,Math.ceil((clip.start-sample.timestamp)*sample.sampleRate)),end=Math.min(sample.numberOfFrames,Math.ceil((clip.end-sample.timestamp)*sample.sampleRate)),n=end-first;if(n<=0)continue;const floats=new Float32Array(n*channels),time=base+sample.timestamp+first/sample.sampleRate-clip.start,alpha=1/(1+2*Math.PI*100/sample.sampleRate);for(let ch=0;ch<channels;ch++){const plane=floats.subarray(ch*n,(ch+1)*n);sample.copyTo(plane,{format:'f32-planar',planeIndex:ch,frameOffset:first,frameCount:n});for(let i=0;i<n;i++){let x=plane[i];if(state.settings.voiceFilter){const y=alpha*(previousY[ch]+x-previousX[ch]);previousX[ch]=x;previousY[ch]=y;x=y}const gain=ClassCastCore.gainAt(time+i/sample.sampleRate,total,Number(state.settings.volume)/100,Number(state.settings.fadeIn),Number(state.settings.fadeOut));plane[i]=Math.max(-1,Math.min(1,x*gain))}}const encoded=new AudioSample({data:floats,format:'f32-planar',numberOfChannels:channels,sampleRate:sample.sampleRate,timestamp:Math.max(0,time)});try{await as.add(encoded)}finally{encoded.close()}}finally{sample.close()}}};
   await Promise.all([videoTask(),audioTask()]);offset+=length;
 }
 vs.close();as?.close();await output.finalize();const mime=mp4?'video/mp4':'video/webm';if(fileHandle)self.postMessage({type:'complete',file:await fileHandle.getFile(),mime,audio,storage,bytes:writtenBytes});else self.postMessage({type:'complete',buffer:target.buffer,mime,audio,storage,bytes:writtenBytes},[target.buffer]);
}catch(e){try{await output?.cancel()}catch{}self.postMessage({type:'error',message:e.message||String(e)})}finally{input?.dispose()}};
