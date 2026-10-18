import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import manifest from '../app/manifest';

const icons=[['favicon-16',16],['favicon-32',32],['favicon-48',48],['apple-touch-icon-180',180],['iword-192',192],['iword-512',512]] as const;
for(const [name,size] of icons){
 const bytes=await readFile(`public/icons/${name}.png`),image=sharp(bytes),meta=await image.metadata();
 assert.equal(meta.width,size);assert.equal(meta.height,size);
 const {data,info}=await image.removeAlpha().raw().toBuffer({resolveWithObject:true});
 for(const [x,y] of [[0,0],[size-1,0],[0,size-1],[size-1,size-1]]){
  const offset=(y*size+x)*info.channels;
  assert.ok(data[offset]<240||data[offset+1]<240||data[offset+2]<240,`${name} must have colored, not white, outer corners`);
 }
}
const ico=await readFile('public/favicon.ico');assert.equal(ico.readUInt16LE(2),1);assert.equal(ico.readUInt16LE(4),3);
for(let index=0;index<3;index++){
 const entry=6+index*16,offset=ico.readUInt32LE(entry+12),length=ico.readUInt32LE(entry+8);
 assert.ok(offset+length<=ico.length);const meta=await sharp(ico.subarray(offset,offset+length)).metadata();assert.equal(meta.width,[16,32,48][index]);
}
const webapp=manifest();assert.equal(webapp.display,'standalone');assert.equal(webapp.start_url,'/');
for(const icon of webapp.icons||[])await readFile(`public${icon.src}`);
console.log('通过：6种图标尺寸、四角无白边、ICO三尺寸及 standalone manifest 图标路径。');
