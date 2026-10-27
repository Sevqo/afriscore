type Transport = (path:string, options?:RequestInit)=>Promise<Response>;
export function createAuthenticatedTransport(send:Transport, identity:()=>Promise<Record<string,string>>, demo:()=>boolean) {
  const publicAuth = new Set(['/api/auth/signup','/api/auth/signin','/api/auth/recover','/api/auth/reset','/api/auth/verify']);
  return async (path:string,options:RequestInit={}) => {
    if (!path.startsWith('/api/') || path.includes('://')) throw new Error('Only same-origin API requests are supported.');
    const headers=new Headers(options.headers);
    if(!demo()&&!publicAuth.has(path)&&!headers.has('Authorization'))for(const [key,value] of Object.entries(await identity()))headers.set(key,value);
    return send(path,{...options,credentials:'same-origin',headers});
  };
}
