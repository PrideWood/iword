import assert from 'node:assert/strict';
import { cardFontSize,cardTypography } from '../lib/card-typography';
assert.equal(cardFontSize(null),32);assert.equal(cardFontSize(''),32);assert.equal(cardFontSize('broken'),32);assert.equal(cardFontSize(Infinity),32);
assert.equal(cardFontSize(2),24);assert.equal(cardFontSize(100),44);assert.equal(cardFontSize('36'),36);assert.equal(cardFontSize(33),34);
for(const size of [24,28,32,36,40,44]){const result=cardTypography(size);assert.equal(result.word-result.example,4);assert.equal(result.meaning,result.example);assert.ok(result.phonetic>=15)}
console.log('通过：字号范围/步长、异常存储回退、例句始终比单词小一级（4px）、释义音标联动。');
