class ClassCastCapture extends AudioWorkletProcessor {
  constructor(){super();this.buffer=new Float32Array(8192);this.offset=0;this.port.onmessage=({data})=>{if(data==='flush'){if(this.offset)this.port.postMessage(this.buffer.slice(0,this.offset));this.offset=0;this.port.postMessage('flushed')}}}
  process(inputs){const channels=inputs[0];if(channels?.length&&channels[0]?.length){for(let i=0;i<channels[0].length;i++){let sample=0;for(const channel of channels)sample+=channel[i]||0;this.buffer[this.offset++]=sample/channels.length;if(this.offset===this.buffer.length){this.port.postMessage(this.buffer.slice());this.offset=0}}}return true}
}registerProcessor('classcast-capture',ClassCastCapture);
