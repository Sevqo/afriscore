import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {learningPaths,knowledgeChecks,parseLearningProgress} from '../src/education/learningPaths.ts';
import {serviceEducation} from '../src/education/serviceEducation.ts';
import ts from 'typescript';
const catalogSource=fs.readFileSync('../src/marketplace/catalog.ts','utf8');
const catalogJs=ts.transpileModule(catalogSource,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {serviceCatalog}=await import('data:text/javascript;base64,'+Buffer.from(catalogJs).toString('base64'));
test('every catalog service resolves to a real education destination with accurate catalog metadata',()=>{
 for(const service of serviceCatalog){
  const route=serviceEducation[service.id]?.route||service.documentation;
  assert.ok(fs.existsSync('dist'+route+'/index.html'),service.id+' '+route);
  for(const id of service.dependencies)assert.ok(serviceCatalog.some(s=>s.id===id),id);
  if(serviceEducation[service.id]){
   const html=fs.readFileSync('dist'+route+'/index.html','utf8');
   assert.ok(html.includes(service.name.replaceAll('&','&amp;')),service.id);
   assert.ok(html.includes(service.unit),service.id);
   assert.match(html,/service=/);
  }
 }
});
test('learning paths reference rendered lessons and have distinct task sequences',()=>{
 const sequences=new Set();
 for(const [id,p] of Object.entries(learningPaths)){
  assert.ok(fs.existsSync('dist/learn/'+id+'/index.html'),id);
  for(const slug of p.lessons)assert.ok(fs.existsSync('dist/learn/'+slug+'/index.html'),slug);
  sequences.add(p.lessons.join(','));
 }
 assert.equal(sequences.size,Object.keys(learningPaths).length);
});
test('learning storage tolerates denied, corrupt and incompatible state and bounds history',()=>{
 for(const raw of [null,'broken','{}','{"version":2,"completed":["receivables"]}'])assert.deepEqual(parseLearningProgress(raw),[]);
 assert.deepEqual(parseLearningProgress(JSON.stringify({version:1,completed:['receivables',4,'receivables']})),['receivables']);
 assert.equal(parseLearningProgress(JSON.stringify({version:1,completed:Array.from({length:200},(_,i)=>String(i))})).length,100);
});
test('knowledge checks offer a valid answer and teach financial and disclosure limits',()=>{
 for(const c of Object.values(knowledgeChecks)){assert.ok(c.choices[c.answer]);assert.ok(c.explanation.length>35);}
 assert.match(knowledgeChecks.receivables.explanation,/20,000/);
 assert.equal(knowledgeChecks['private-sharing'].choices[knowledgeChecks['private-sharing'].answer],'No');
});
