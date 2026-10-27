const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),target=path.join(root,'dist');
if(path.relative(root,target)!=='dist')throw new Error('Invalid build output path');
fs.rmSync(target,{recursive:true,force:true});
