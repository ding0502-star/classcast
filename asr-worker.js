/* Audio stays in this dedicated worker. Only model assets are downloaded. */
let recognizer=null,currentModel=null;
self.onmessage=async({data})=>{if(data.type!=='transcribe')return;try{
  self.postMessage({type:'status',text:'載入語音辨識引擎…'});
  const {pipeline,env}=await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js');
  env.allowLocalModels=false;env.backends.onnx.wasm.numThreads=1;
  if(currentModel!==data.model){if(recognizer)await recognizer.dispose();recognizer=null;currentModel=null;recognizer=await pipeline('automatic-speech-recognition',data.model,{device:'wasm',dtype:'q8',progress_callback:p=>{if(p.status==='progress')self.postMessage({type:'download',file:p.file,progress:p.progress});else if(p.status==='initiate')self.postMessage({type:'status',text:'準備下載模型：'+p.file})}});currentModel=data.model}
  const audio=new Float32Array(data.audio),options={return_timestamps:true,chunk_length_s:30,stride_length_s:5,task:'transcribe'};if(data.language!=='auto')options.language=data.language;
  let completed=0;options.chunk_callback=()=>{completed++;self.postMessage({type:'status',text:`正在辨識，第 ${completed} 段已處理…`})};
  self.postMessage({type:'status',text:'模型已就緒，正在辨識音訊…'});
  const result=await recognizer(audio,options);
  let convert=s=>s;if(data.language!=='english'){self.postMessage({type:'status',text:'正在轉換繁體中文…'});const OpenCC=await import('https://cdn.jsdelivr.net/npm/opencc-js@1.0.5/dist/esm/cn2t.js');convert=OpenCC.Converter({from:'cn',to:'tw'})}
  const length=audio.length/16000,chunks=(result.chunks||[]).map(c=>({start:Math.max(0,c.timestamp[0]??0),end:Math.min(length,c.timestamp[1]??length),text:convert(c.text.trim())})).filter(c=>c.end>c.start&&c.text);
  if(!chunks.length&&result.text?.trim())chunks.push({start:0,end:length,text:convert(result.text.trim())});
  // Long sentences are split to fit the editor; timing is proportionally distributed.
  const segments=[];for(const c of chunks){const chars=Array.from(c.text),size=40;for(let i=0;i<chars.length;i+=size)segments.push({start:c.start+(c.end-c.start)*i/chars.length,end:c.start+(c.end-c.start)*Math.min(i+size,chars.length)/chars.length,text:chars.slice(i,i+size).join('')})}
  self.postMessage({type:'result',segments});
}catch(e){self.postMessage({type:'error',message:e.message||String(e)})}};
