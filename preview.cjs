const http=require('http'),fs=require('fs'),path=require('path');
const root=path.join(__dirname,'dist');
http.createServer((req,res)=>{
  let name;try{name=decodeURIComponent(req.url.split('?')[0])}catch{res.writeHead(400);return res.end()}
  const tests={'/local-tests':'tests/browser.html','/local-speech.wav':'tests/speech.wav','/local-recording-tests':'tests/recording.html'};
  const file=tests[name]?path.join(__dirname,tests[name]):path.resolve(root,'.'+(name==='/'?'/index.html':name));
  if(!tests[name]&&!file.startsWith(root+path.sep)){res.writeHead(403);return res.end()}
  fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);return res.end('Not found')}res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':file.endsWith('.wav')?'audio/wav':'text/javascript; charset=utf-8');res.end(data)})
}).listen(4173,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:4173'));
