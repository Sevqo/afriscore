const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const root=path.resolve('website/src'),graph=new Map();
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):/\.tsx?$/.test(e.name)?[path.join(dir,e.name)]:[]);}
for(const file of files(root)){
  const parsed=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true),deps=[];
  for(const statement of parsed.statements){
    if(!ts.isImportDeclaration(statement)||statement.importClause?.isTypeOnly)continue;
    const spec=statement.moduleSpecifier.text;
    if(!spec.startsWith('.'))continue;
    const candidate=path.resolve(path.dirname(file),spec);
    const resolved=[candidate,candidate+'.ts',candidate+'.tsx',path.join(candidate,'index.ts')].find(p=>fs.existsSync(p)&&fs.statSync(p).isFile()&&/\.tsx?$/.test(p));
    if(resolved)deps.push(resolved);
  }
  graph.set(file,deps);
}
const done=new Set(),active=[];
function visit(file){if(active.includes(file))throw new Error('Frontend dependency cycle: '+[...active.slice(active.indexOf(file)),file].map(p=>path.relative(root,p)).join(' -> '));if(done.has(file))return;active.push(file);for(const dep of graph.get(file)||[])visit(dep);active.pop();done.add(file);}
for(const file of graph.keys())visit(file);
for(const name of ['src/stage2','src/stage3','website/src/stage2','website/src/stage3'])if(fs.existsSync(name))throw new Error('Use a semantic domain directory: '+name);
console.log('Architecture checked: '+graph.size+' frontend modules, no static import cycles; semantic domain folders.');
