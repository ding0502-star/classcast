import {Input,ALL_FORMATS,BlobSource,CanvasSink,AudioSampleSink,AudioSample,Output,BufferTarget,Mp4OutputFormat,WebMOutputFormat,CanvasSource,AudioSampleSource,canEncodeVideo,canEncodeAudio} from './vendor/mediabunny-1.61.3.mjs';
import './renderer.js';
import './core.js';
let input,output;
async function inspect(blob,state){
 input=new Input({source:new BlobSource(blob),formats:ALL_FORMATS});
 const vt=await input.getPrimaryVideoTrack(),at=await input.getPrimaryAudioTrack();if(!vt||!await vt.canDecode())throw Error('此影片無法使用背景解碼，請改用相容模式。');
 let peak=0,count=0;if(at){if(!await at.canDecode())throw Error('此影片音訊無法背景解碼，請使用相容模式，避免遺失聲音。');const sink=new AudioSampleSink(at);const starts=[...new Set(state.clips.slice(0,3).map(c=>c.start))];for(const start of starts){for await(const sample of sink.samples(start,Math.min(state.duration,start+1))){try{const data=new Float32Array(sample.numberOfFrames);sample.copyTo(data,{format:'f32-planar',planeIndex:0});for(const x of data)peak=Math.max(peak,Math.abs(x));count+=data.length}finally{sample.close()}}}}
 return {vt,at,audio:{present:!!at,peak,sampled:count>0}};
}
self.onmessage=async({data})=>{try{
 const {blob,state,width,height,format}=data;const {vt,at,audio}=await inspect(blob,state);
 if(data.type==='inspect'){self.postMessage({type:'inspection',audio});return}
 self.postMessage({type:'precheck',audio});
 const mp4=format==='mp4',vcodec=mp4?'avc':'vp8',acodec=mp4?'aac':'opus';
 if(!await canEncodeVideo(vcodec,{width,height,bitrate:6000000}))throw Error('此裝置無法背景編碼所選格式，請切換 MP4／WebM 或使用相容模式。');
 const channels=at?await at.getNumberOfChannels():0,rate=at?await at.getSampleRate():48000;
 if(at&&!await canEncodeAudio(acodec,{numberOfChannels:channels,sampleRate:rate,bitrate:128000}))throw Error('此裝置無法編碼所選音訊，請切換格式或使用相容模式。');
 const target=new BufferTarget();output=new Output({target,format:mp4?new Mp4OutputFormat({fastStart:'in-memory'}):new WebMOutputFormat()});
 const canvas=new OffscreenCanvas(width,height),renderer=ClassCastRenderer(canvas,state),vs=new CanvasSource(canvas,{codec:vcodec,bitrate:6000000,keyFrameInterval:2});
 output.addVideoTrack(vs,{frameRate:30});const as=at?new AudioSampleSource({codec:acodec,bitrate:128000}):null;if(as)output.addAudioTrack(as);
 await output.start();const sink=new CanvasSink(vt,{width,height,fit:'contain',poolSize:1}),audioSink=at?new AudioSampleSink(at):null,total=state.clips.reduce((n,c)=>n+c.end-c.start,0);let offset=0,lastReport=0;
 for(const clip of state.clips){const base=offset,length=clip.end-clip.start;
   const videoTask=async()=>{let frame=0;const times=(function*(){for(let t=clip.start;t<clip.end-1e-7;t+=1/30)yield t})();for await(const image of sink.canvasesAtTimestamps(times)){const t=clip.start+frame/30;if(!image)throw Error('影片片段缺少可解碼畫面。');renderer.render(image.canvas,t);await vs.add(base+frame/30,Math.min(1/30,clip.end-t));frame++;if(performance.now()-lastReport>200){lastReport=performance.now();self.postMessage({type:'progress',value:Math.min(99,(base+frame/30)/total*100)})}}};
   const audioTask=async()=>{if(!audioSink)return;const previousX=new Float32Array(channels),previousY=new Float32Array(channels);for await(const sample of audioSink.samples(clip.start,clip.end)){try{const first=Math.max(0,Math.ceil((clip.start-sample.timestamp)*sample.sampleRate)),end=Math.min(sample.numberOfFrames,Math.ceil((clip.end-sample.timestamp)*sample.sampleRate)),n=end-first;if(n<=0)continue;const floats=new Float32Array(n*channels),time=base+sample.timestamp+first/sample.sampleRate-clip.start,alpha=1/(1+2*Math.PI*100/sample.sampleRate);for(let ch=0;ch<channels;ch++){const plane=floats.subarray(ch*n,(ch+1)*n);sample.copyTo(plane,{format:'f32-planar',planeIndex:ch,frameOffset:first,frameCount:n});for(let i=0;i<n;i++){let x=plane[i];if(state.settings.voiceFilter){const y=alpha*(previousY[ch]+x-previousX[ch]);previousX[ch]=x;previousY[ch]=y;x=y}const gain=ClassCastCore.gainAt(time+i/sample.sampleRate,total,Number(state.settings.volume)/100,Number(state.settings.fadeIn),Number(state.settings.fadeOut));plane[i]=Math.max(-1,Math.min(1,x*gain))}}const encoded=new AudioSample({data:floats,format:'f32-planar',numberOfChannels:channels,sampleRate:sample.sampleRate,timestamp:Math.max(0,time)});try{await as.add(encoded)}finally{encoded.close()}}finally{sample.close()}}};
   await Promise.all([videoTask(),audioTask()]);offset+=length;
 }
 vs.close();as?.close();await output.finalize();self.postMessage({type:'complete',buffer:target.buffer,mime:mp4?'video/mp4':'video/webm',audio},[target.buffer]);
}catch(e){try{await output?.cancel()}catch{}self.postMessage({type:'error',message:e.message||String(e)})}finally{input?.dispose()}};
