import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const css=await readFile('app/theme.css','utf8');
const value=(name:string)=>{const match=css.match(new RegExp(`--${name}:(#[a-f0-9]{6})`));assert.ok(match,name);return match[1]};
function luminance(hex:string){const values=hex.slice(1).match(/../g)!.map(x=>{const s=parseInt(x,16)/255;return s<=.04045?s/12.92:((s+.055)/1.055)**2.4});return values[0]*.2126+values[1]*.7152+values[2]*.0722}
function contrast(a:string,b:string){const values=[luminance(a),luminance(b)].sort((a,b)=>b-a);return (values[0]+.05)/(values[1]+.05)}
for(const [text,background] of [['ink','bg'],['ink','paper'],['muted','paper'],['green','paper'],['night-button-ink','green']])assert.ok(contrast(value(text),value(background))>=4.5,`${text}/${background} must pass normal text contrast`);
for(const [text,background] of [['#ffc0b6','#542e30'],['#e8d29b','#3e3827'],['#edcd9f','#403426']])assert.ok(contrast(text,background)>=4.5);
console.log('通过：夜间主文字、辅助文字、绿色操作、主按钮及错误/模糊反馈对比度均 >=4.5:1。');
