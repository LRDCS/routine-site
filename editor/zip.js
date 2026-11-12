/* Dependency-free ZIP writer: stored entries preserve original binary files. */
window.makePortfolioZip = async function makePortfolioZip(files) {
  const encoder = new TextEncoder();
  const table = Array.from({length:256},(_,i) => {let c=i;for(let k=0;k<8;k++) c=c&1 ? 0xedb88320^(c>>>1) : c>>>1;return c>>>0;});
  const crc32 = bytes => {let c=0xffffffff;for(const b of bytes)c=table[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;};
  const chunks=[],central=[]; let offset=0,centralSize=0;
  for(const [name,file] of files) {
    const bytes = typeof file === 'string' ? encoder.encode(file) : new Uint8Array(await file.arrayBuffer());
    const filename=encoder.encode(name),crc=crc32(bytes);
    if(bytes.length > 0xffffffff || offset > 0xffffffff) throw Error('A file is too large for this exporter.');
    const local=new Uint8Array(30+filename.length),lv=new DataView(local.buffer);
    lv.setUint32(0,0x04034b50,true);lv.setUint16(4,20,true);lv.setUint16(6,0x800,true);lv.setUint16(12,33,true);lv.setUint32(14,crc,true);lv.setUint32(18,bytes.length,true);lv.setUint32(22,bytes.length,true);lv.setUint16(26,filename.length,true);local.set(filename,30);
    const entry=new Uint8Array(46+filename.length),ev=new DataView(entry.buffer);
    ev.setUint32(0,0x02014b50,true);ev.setUint16(4,20,true);ev.setUint16(6,20,true);ev.setUint16(8,0x800,true);ev.setUint16(14,33,true);ev.setUint32(16,crc,true);ev.setUint32(20,bytes.length,true);ev.setUint32(24,bytes.length,true);ev.setUint16(28,filename.length,true);ev.setUint32(42,offset,true);entry.set(filename,46);
    chunks.push(local,bytes);central.push(entry);offset+=local.length+bytes.length;centralSize+=entry.length;
  }
  if(files.size>65535)throw Error('Too many files for this exporter.');
  const end=new Uint8Array(22),v=new DataView(end.buffer);v.setUint32(0,0x06054b50,true);v.setUint16(8,files.size,true);v.setUint16(10,files.size,true);v.setUint32(12,centralSize,true);v.setUint32(16,offset,true);
  return new Blob([...chunks,...central,end],{type:'application/zip'});
};
