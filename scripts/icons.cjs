// Reproducible local PNG icons; only Node standard library, no external asset.
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
function crc32(bytes){let c=0xffffffff;for(const byte of bytes){c^=byte;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
function chunk(type,data){const t=Buffer.from(type),n=Buffer.alloc(4),crc=Buffer.alloc(4);n.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([t,data])));return Buffer.concat([n,t,data,crc]);}
const dir=path.join(__dirname,'..','extension','icons');fs.mkdirSync(dir,{recursive:true});
for(const size of [16,32,48,128]){
 const raw=Buffer.alloc(size*(size*4+1));
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const px=x/size,py=y/size,at=y*(size*4+1)+1+x*4;
  let color=[0,0,0,0];
  if(px>.08&&px<.82&&py>.23&&py<.89) color=[158,23,44,255];
  if(px>.20&&px<.94&&py>.10&&py<.76) color=[220,35,60,255];
  if(px>.20&&px<.94&&py>.10&&py<.21) color=[244,98,110,255];
  if(px>.46&&px<.72&&Math.abs(py-.47)<(.72-px)*.72) color=[255,255,255,255];
  raw.set(color,at);
 }
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(size,0);ihdr.writeUInt32BE(size,4);ihdr[8]=8;ihdr[9]=6;
 fs.writeFileSync(path.join(dir,`${size}.png`),Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]));
}
console.log('Generated four local icons.');
