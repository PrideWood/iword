import assert from 'node:assert/strict';
import { generateRegistrationCode } from '../lib/registration-code-server';
import { isRegistrationCode,normalizeRegistrationCode } from '../lib/registration-code';
for(let i=0;i<1000;i++){const code=generateRegistrationCode();assert.match(code,/^[2-9A-HJ-NP-Z]{6}$/);assert.match(code,/[A-Z]/);assert.match(code,/[0-9]/);assert.equal(isRegistrationCode(code),true)}
assert.equal(normalizeRegistrationCode(' a2b3c4 '),'A2B3C4');
assert.equal(normalizeRegistrationCode('ABCDEF123456ABCDEF123456'),'abcdef123456abcdef123456');
for(const value of ['A2B3C4','a2b3c4','abcdef123456abcdef123456','ABCDEF123456ABCDEF123456'])assert.ok(isRegistrationCode(value));
for(const value of ['12345','A2B3C4D','ABC-12','AB 123','词间1234','<svg/>','a'.repeat(25),''])assert.equal(isRegistrationCode(value),false);
console.log('通过：六位数字/字母组合、安全随机生成、避开易混字符、大小写及空白归一化、旧长码兼容、非法输入拒绝。');
