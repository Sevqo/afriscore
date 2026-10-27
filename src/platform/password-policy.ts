import { z } from 'zod';
// Only new secrets use this policy. Never normalize or reject old login credentials.
const common = new Set(['password','12345678','qwertyui','qwerty123','africore','password1','passwordpassword','password123456789','123456789012345','qwertyuiopasdfgh','letmeinletmein123','africoreafricore','correct horse battery staple']);
export function passwordIssue(value: string): string | undefined {
  const length = [...value].length;
  if (length < 8 || length > 200) return 'Use a password between 8 and 200 characters.';
  if (common.has(value.toLowerCase()) || /^(.)\1+$/u.test(value)) return 'This password is too common. Choose a unique passphrase.';
}
export const newPassword = z.string().max(400).refine(value => !passwordIssue(value), {message:'Use a unique password of 8–200 characters.'});
