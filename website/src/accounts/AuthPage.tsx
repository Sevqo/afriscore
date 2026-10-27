import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { managedClient } from './auth';
import { exitDemo } from '../demo/transport';
import { api } from '../lib/api-client';
import { Logo } from '../components/Logo';
import { Icon } from '../components/Icon';
import { PasswordInput } from './PasswordInput';
type AuthResult = { email?: string; managed?: boolean; message?: string; verified?: boolean; reset?: boolean; signin_href?: string; verification_token?: string; recovery_token?: string };
function Field({label,children}:{label:string;children:ReactNode}) {return <label className="field"><span>{label}</span>{children}</label>;}
function ErrorBox({error}:{error:string}) {return error ? <div className="alert error" role="alert">{error}</div> : null;}
export function AuthPage({ mode,kind }: { mode: string;kind?:string }) {
  const requested=kind||new URLSearchParams(location.search).get('create');
  const intent=requested&&['personal','business','developer'].includes(requested)?requested:undefined;
  const intentQuery=intent?'?create='+encodeURIComponent(intent):'';
  useEffect(()=>{if(mode==='signin'||mode==='signup') exitDemo();},[mode]);
  const [error, setError] = useState(''),
    [result, setResult] = useState<AuthResult | null>(null),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const d = Object.fromEntries(new FormData(e.currentTarget));
    if (['signup','reset'].includes(mode) && [...String(d.password || '')].length < 15) {setError('Use a password of at least 15 characters.');setBusy(false);return;}
    try {
      const client=await managedClient();
      let r:AuthResult;
      if(client) {
        const email=String(d.email||''),password=String(d.password||'');
        const callbackURL=location.origin+'/auth/callback'+intentQuery;
        const result=mode==='signup'?await client.signUp.email({name:String(d.name||email.split('@')[0]),email,password,callbackURL}):
          mode==='signin'?await client.signIn.email({email,password}):
          mode==='recover'?await client.requestPasswordReset({email,redirectTo:location.origin+'/reset'}):
          mode==='reset'?await client.resetPassword({newPassword:password,token:String(d.token)}):
          await client.emailOtp.verifyEmail({email,otp:String(d.token)});
        if(result.error) {
          if (mode==='signin' && result.error.code==='EMAIL_NOT_VERIFIED') setResult({email,managed:true,message:'Verify your email to finish signing in.'});
          throw new Error(result.error.message||'Authentication request failed');
        }
        r={email,managed:true,message:mode==='signup'?'Account created. Verify your email if requested, then continue.':mode==='recover'?'If the account exists, a recovery email was sent.':'Authentication updated.'};
        if(mode==='signup' && (await client.getSession()).data?.user) {location.href='/app/workspaces?create='+encodeURIComponent(intent||'business');return;}
        if(mode==='verify') {
          r.verified=true;
          if((await client.getSession()).data?.user){location.href='/app'+intentQuery;return;}
        }
      } else r = await api('/api/auth/' + mode, 'POST', d);
      if(mode==='reset'){r.reset=true;}
      if(mode==='verify'||mode==='reset')r.signin_href='/login'+intentQuery;
      setResult(r);
      if (mode === 'signin') window.location.href = '/app'+intentQuery;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <Logo />
      <div className="auth-panel">
        <span className="eyebrow">AFRICORE {kind||'ACCOUNT'}</span>
        <h1>
          {
            (
              {
                signin: 'Welcome back.',
                signup: 'Build your next chapter.',
                recover: 'Recover your account.',
                verify: 'Verify your email.',
                reset: 'Set a new password.',
              } as Record<string, string>
            )[mode]
          }
        </h1>
        <p>
          {mode === 'signup'
            ? `Create one identity for your ${kind||'Business'} workspace. You can add other workspaces later.`
            : 'Sign in once. Continue in your authorized workspace.'}
        </p>
        <form onSubmit={submit}>
          {mode==='signup'&&<Field label="Your name"><input name="name" required maxLength={100} autoComplete="name" /></Field>}
          {['signup', 'signin', 'recover','verify'].includes(mode) && (
            <Field label="Email address">
              <input required type="email" name="email" autoComplete="email" defaultValue={mode==='verify'?new URLSearchParams(location.search).get('email')||'':undefined}/>
            </Field>
          )}
          {['signup', 'signin', 'reset'].includes(mode) && (
            <div className="password-field"><PasswordInput current={mode === 'signin'} />{mode === 'signin' && <a className="forgot-password" href="/forgot-password">Forgot password?</a>}</div>
          )}
          {['verify', 'reset'].includes(mode) && (
            <Field label="One-time token">
              <input
                required
                name="token"
                autoComplete="one-time-code"
                defaultValue={
                  new URLSearchParams(location.search).get('token') || ''
                }
              />
            </Field>
          )}
          {mode==='verify'&&<button type="button" className="secondary-button" disabled={busy} onClick={async(e)=>{const email=String(new FormData(e.currentTarget.form!).get('email'));setBusy(true);setError('');try{const client=await managedClient();if(!client)throw new Error('Use the development token from registration.');const r=await client.emailOtp.sendVerificationOtp({email,type:'email-verification'});if(r.error)throw new Error(r.error.message||'Verification unavailable');setResult({message:'If eligible, a verification code was sent to your email.'});}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>Send verification code</button>}
          <ErrorBox error={error} />
          <button className="button" disabled={busy}>
            {busy ? (
              'Working…'
            ) : (
              <>
                {mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : mode === 'recover' ? 'Send recovery email' : 'Continue'} <Icon name="right" />
              </>
            )}
          </button>
        </form>
        {result && (
          <div className="alert" role="status">
            {(mode==='signup'||(mode==='signin'&&result.managed))&&<>{!result.managed&&<a className="button" href={'/app/workspaces?create='+encodeURIComponent(intent||'business')}>Continue to workspace setup</a>}{result.managed&&<a className="button" href={'/verify?email='+encodeURIComponent(result.email || "")+(intent?'&create='+encodeURIComponent(intent):'')}>Verify email and continue</a>}</>}
            {result.signin_href&&<a className="button" href={result.signin_href}>Sign in to continue</a>}
            <p>
              {result.verified
                ? 'Email verified.'
                : result.reset
                  ? 'Password updated.'
                  : result.message ||
                    'Account created. Development email delivery is not configured.'}
            </p>
            {result.verification_token && (
              <>
                <p>Development verification token (shown locally):</p>
                <code className="one-time">{result.verification_token}</code>
                <a href={'/verify?token=' + result.verification_token+'&email='+encodeURIComponent(result.email||'')+(intent?'&create='+encodeURIComponent(intent):'')}>
                  Verify email <Icon name="right" />
                </a>
              </>
            )}
            {result.recovery_token && (
              <>
                <p>Development recovery token:</p>
                <code className="one-time">{result.recovery_token}</code>
                <a href={'/reset?token=' + result.recovery_token}>
                  Reset password <Icon name="right" />
                </a>
              </>
            )}

          </div>
        )}
        <div className="auth-links">{mode === 'signin' ? <p>New to AfriCore? <a href="/get-started">Create an account</a></p> : <a href={'/login'+intentQuery}>Back to sign in</a>}</div><footer className="auth-footer"><a href="/">Back to AfriCore</a></footer>
      </div>
    </div>
  );
}
