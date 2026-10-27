/** Share initialization across concurrent callers and permit a clean retry on failure. */
export function singleFlight<T>(initialize:()=>Promise<T>) {
  let pending:Promise<T>|undefined;
  return () => pending ||= initialize().catch(error=>{pending=undefined;throw error;});
}
