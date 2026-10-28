/** Never let URL capability encodings, case or invalid token lengths leak. */
export function safeLogPath(path:string){
 const clean=path.split('?')[0];
 return clean.replace(/((?:checkout|buyer|share|presentations)\/)[^/]+/gi,'$1[redacted]');
}
