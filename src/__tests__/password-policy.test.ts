import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newPassword,passwordIssue} from '../platform/password-policy';
test('new password policy accepts long phrases and Unicode without composition rules',()=>{
  assert.equal(passwordIssue('a unique river underneath trees'),undefined);
  assert.equal(newPassword.safeParse('🌿'.repeat(14)).success,false);
  assert.equal(newPassword.safeParse('river '.repeat(30)).success,true);
  for(const value of ['short','passwordpassword','123456789012345','x'.repeat(20)]) assert.equal(newPassword.safeParse(value).success,false);
});
