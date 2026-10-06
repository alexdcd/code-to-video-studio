#!/usr/bin/env node
// Probe declared views/actions/expressions against an actual browser runtime.
// The page hook must return metadata containing `resolved` with action/view/expression.
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
let chromium;
try { ({ chromium } = await import('playwright')); } catch { console.error('Playwright is optional. Install with: pnpm install --prefix browser-tools'); process.exit(2); }
const args=Object.fromEntries(process.argv.slice(2).map(x=>{const [k,...rest]=x.replace(/^--/,'').split('=');return [k,rest.join('=')||true]}));
if(!args.url||!args.manifest||!args.out){console.error('usage: probe_browser_runtime.mjs --url=<url> --manifest=character.json --out=qa/runtime-probe.json [--hook=__characterQA.renderAt]');process.exit(2);}
const m=JSON.parse(fs.readFileSync(args.manifest,'utf8'));const hook=args.hook||'__characterQA.renderAt';const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1024,height:1024}});await page.goto(args.url,{waitUntil:'load'});
async function call(t,state){return await page.evaluate(async({t,state,hook})=>{let fn=window;for(const part of hook.split('.'))fn=fn?.[part];if(typeof fn!=='function')throw new Error(`QA hook not found: ${hook}`);return await fn(t,state);},{t,state,hook});}
const base={action:(m.actions||[])[0]||'idle',view:(m.requiredViews||m.views||[])[0]||'front',expression:(m.expressions||[])[0]||'neutral',actionTime:0};const probes=[];
async function probe(kind,value,state){let ok=false,res=null,error=null;try{res=await call(0,state);const r=res?.resolved||res;ok=!!r&&r[kind]===value;if(!ok)error=`resolved ${kind}=${r?.[kind]??'missing'}`;}catch(e){error=e.message;}probes.push({kind,value,state,ok,error,resolved:res?.resolved||res||null});}
for(const v of m.requiredViews||m.views||[])await probe('view',v,{...base,view:v});for(const a of m.actions||[])await probe('action',a,{...base,action:a,actionTime:0});for(const e of m.expressions||[])await probe('expression',e,{...base,expression:e});
await browser.close();const observed={views:probes.filter(x=>x.kind==='view'&&x.ok).map(x=>x.value),actions:probes.filter(x=>x.kind==='action'&&x.ok).map(x=>x.value),expressions:probes.filter(x=>x.kind==='expression'&&x.ok).map(x=>x.value)};const result={schemaVersion:1,source:'browser-probe',url:args.url,manifestSha256:crypto.createHash('sha256').update(fs.readFileSync(args.manifest)).digest('hex'),ok:probes.every(x=>x.ok),observed,probes};fs.mkdirSync(path.dirname(path.resolve(args.out)),{recursive:true});fs.writeFileSync(args.out,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));if(!result.ok)process.exit(1);
