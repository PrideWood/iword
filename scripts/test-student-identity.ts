import assert from 'node:assert/strict';
import { generatedStudentLogin,isGeneratedStudentLogin,optionalStudentNumber,studentLoginAlias,studentPassword } from '../lib/student-identity';
assert.equal(studentLoginAlias.parse('  STUDENT@EXAMPLE.COM '),'student@example.com');
assert.equal(studentLoginAlias.parse(''),'');assert.equal(optionalStudentNumber.parse(undefined),'');assert.equal(optionalStudentNumber.parse(' '),'');
assert.equal(studentPassword.safeParse('123456').success,true);assert.equal(studentPassword.safeParse('12345').success,false);
assert.equal(studentLoginAlias.safeParse('含有中文').success,false);assert.equal(studentLoginAlias.safeParse('two words').success,false);
assert.equal(isGeneratedStudentLogin(generatedStudentLogin('uuid')),true);assert.equal(studentLoginAlias.safeParse(generatedStudentLogin('uuid')).success,false);
console.log('通过：学生六位密码、可选学号与账号、邮箱式账号、内部身份保留前缀、非法账号拒绝。');
