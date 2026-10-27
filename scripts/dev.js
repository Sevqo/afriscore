const {spawn}=require('node:child_process');
const fs=require('node:fs'),net=require('node:net'),os=require('node:os');
const {developmentConfig,developmentEnvironmentFile}=require('./development-config.cjs');
const children=new Set();let stopping=false;
function stop(code){if(stopping)return;stopping=true;process.exitCode=code;for(const child of children)child.kill();}
function start(name,args,env){const child=spawn(process.execPath,args,{cwd:process.cwd(),env,stdio:'inherit'});children.add(child);child.once('error',()=>{console.error(name+' could not start.');stop(1);});child.once('exit',code=>{children.delete(child);if(!stopping){console.error(name+' stopped ('+code+').');stop(code||1);}});}
function available(port,host){return new Promise((resolve,reject)=>{const server=net.createServer();server.once('error',()=>reject(new Error('Port '+port+' is occupied. Choose DEV_PORT / DEV_API_PORT explicitly; existing processes are never reused or stopped.')));server.listen(port,host,()=>server.close(resolve));});}
async function main(){
  const envFile=developmentEnvironmentFile(process.env,fs);
  if(fs.existsSync(envFile))process.loadEnvFile(envFile);else if(envFile!=='.env')throw new Error('The selected private development environment file does not exist.');
  if(process.env.NODE_ENV==='production')throw new Error('Use the deployment command for production.');
  const addresses=Object.values(os.networkInterfaces()).flat().filter(a=>a&&!a.internal&&a.family==='IPv4').map(a=>a.address);
  const config=developmentConfig(process.env,addresses);
  await available(config.port,config.host);await available(config.apiPort,'127.0.0.1');
  const env={...process.env,NODE_ENV:'development',PORT:String(config.apiPort),API_BIND_HOST:'127.0.0.1',DEV_API_PORT:String(config.apiPort),AFRICORE_PUBLIC_ORIGIN:config.publicOrigin,AFRICORE_DEV_ORIGINS:config.origins.join(','),DEV_PORT:String(config.port)};
  console.log('AfriCore development: '+config.publicOrigin+'/');console.log('Local: '+config.scheme+'://localhost:'+config.port+'/');
  for(const address of addresses)console.log('LAN: '+config.scheme+'://'+address+':'+config.port+'/');
  console.log('Authentication: '+(env.NEON_AUTH_BASE_URL?'managed provider from private environment':'local account store')+'. API stays on loopback.');
  if(env.NEON_AUTH_BASE_URL)console.log('Phone sign-in requires trusted HTTPS and the exact origin registered in Neon. See docs/LOCAL_NETWORK_DEVELOPMENT.md.');
  start('API',['node_modules/ts-node/dist/bin.js','src/index.ts'],env);
  let ready=false;const deadline=Date.now()+config.readyTimeoutMs;
  for(;Date.now()<deadline&&!stopping;){try{const response=await fetch('http://127.0.0.1:'+config.apiPort+'/v1/readiness',{signal:AbortSignal.timeout(1500)});if(response.ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,500));}
  if(!ready)throw new Error('API readiness failed. Check the selected private environment and database connection.');
  start('Website',['website/node_modules/vite/bin/vite.js','--config','website/vite.config.ts','--configLoader','runner','website'],env);
}
process.on('SIGINT',()=>stop(0));process.on('SIGTERM',()=>stop(0));main().catch(error=>{console.error(error.message);stop(1);});
