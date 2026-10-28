// Local-only screening. Never send passwords or password-derived values away.
// Applies only to new passwords, never to an existing sign-in credential.
const weakRoots=new Set(('password passw0rd qwerty qwertyui qwertyuiop abcdefgh abcdefghij abc123 letmein welcome admin administrator changeme iloveyou sunshine monkey dragon football baseball princess michael jennifer superman trustno1 whatever login secret test guest default computer internet master access freedom hello hello123 passwordpassword africore afriscore correcthorsebatterystaple').split(' '));
export function passwordIssue(value:string):string|undefined {
  const length=[...value].length;
  if(length<8||length>200)return 'Use a password between 8 and 200 characters.';
  const lower=value.toLowerCase(),letters=lower.replace(/[^a-z0-9]/g,'');
  const root=letters.replace(/\d+$/,'');
  if(weakRoots.has(letters)||weakRoots.has(root)||/^(.)\1+$/u.test(value)||/^(.{1,4})\1{2,}$/u.test(lower)||/^(?:0123456789|1234567890|0987654321|9876543210)+$/.test(letters)||/^\d{8,}$/.test(value))
    return 'This password is too common or predictable. Choose a unique password.';
}
