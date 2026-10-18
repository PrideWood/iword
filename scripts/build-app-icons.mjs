import sharp from 'sharp';
import { mkdir,writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root=new URL('../',import.meta.url);
const source=fileURLToPath(new URL('public/icons/iword-master.png',root));
const destination=new URL('public/icons/',root);
await mkdir(destination,{recursive:true});
// Only mechanical resizing/format conversion here; artwork is the edited master.
for(const [name,size] of [['favicon-16',16],['favicon-32',32],['favicon-48',48],['apple-touch-icon-180',180],['iword-192',192],['iword-512',512]]){
 await sharp(source).resize(size,size).png().toFile(fileURLToPath(new URL(`${name}.png`,destination)));
}
const sizes=[16,32,48],images=await Promise.all(sizes.map(size=>sharp(source).resize(size,size).png().toBuffer()));
const header=Buffer.alloc(6+sizes.length*16);header.writeUInt16LE(1,2);header.writeUInt16LE(sizes.length,4);
let offset=header.length;
images.forEach((image,index)=>{const position=6+index*16;header[position]=sizes[index];header[position+1]=sizes[index];header.writeUInt16LE(1,position+4);header.writeUInt16LE(32,position+6);header.writeUInt32LE(image.length,position+8);header.writeUInt32LE(offset,position+12);offset+=image.length});
await writeFile(new URL('public/favicon.ico',root),Buffer.concat([header,...images]));
console.log('已生成 favicon ICO/PNG、Apple 180px 和 Web App 192/512px 图标。');
