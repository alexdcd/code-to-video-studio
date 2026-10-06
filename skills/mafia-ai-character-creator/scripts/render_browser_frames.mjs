#!/usr/bin/env node
// Browser QA renderer. The page may expose:
//   window.__characterQA.renderAt(t, state) -> metadata (PNG data URL also accepted for compatibility)
// The helper can screenshot a DOM selector after applying state, which works for sprite/DOM runtimes.
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
let chromium;
try { ({ chromium } = await import('playwright')); } catch { console.error('Playwright is optional. Install with: pnpm install --prefix browser-tools'); process.exit(2); }
const args=Object.fromEntries(process.argv.slice(2).map(x=>{const [k,...rest]=x.replace(/^--/,'').split('=');return [k,rest.join('=')||true]}));
if(!args.url||!args.times||!args.out){console.error('usage: render_browser_frames.mjs --url=<url> --times=0,0.5,1 --out=<dir> [--mode=forward|reverse|fresh] [--hook=__characterQA.renderAt] [--selector=#qa-stage] [--state={...}] [--evidence-out=report.json]');process.exit(2);}
const times=String(args.times).split(',').map(Number);const mode=args.mode||'forward';const ordered=mode==='reverse'?[...times].reverse():times;const state=args.state?JSON.parse(args.state):{};const hook=args.hook||'__characterQA.renderAt';const selector=args.selector||'#qa-stage';fs.mkdirSync(args.out,{recursive:true});
const browser=await chromium.launch({headless:true});
async function newPage(){const p=await browser.newPage({viewport:{width:1920,height:1080}});await p.goto(args.url,{waitUntil:'load'});return p;}
async function apply(p,t){return await p.evaluate(async({t,state,hook})=>{let fn=window;for(const part of hook.split('.'))fn=fn?.[part];if(typeof fn!=='function')throw new Error(`QA hook not found: ${hook}`);return await fn(t,state);},{t,state,hook});}
const evidence=[];
async function render(p,t){const meta=await apply(p,t);const key=times.indexOf(t);const file=`${String(key).padStart(3,'0')}-${t.toFixed(4)}.png`;const dest=path.join(args.out,file);
  if(typeof meta==='string'&&meta.startsWith('data:image/png;base64,')){fs.writeFileSync(dest,Buffer.from(meta.slice(meta.indexOf(',')+1),'base64'));}
  else {const el=p.locator(selector);if(await el.count()!==1)throw new Error(`selector must resolve exactly one element: ${selector}`);await el.screenshot({path:dest,animations:'disabled'});}
  const buf=fs.readFileSync(dest);evidence.push({time:t,file,sha256:crypto.createHash('sha256').update(buf).digest('hex'),meta:meta??null});}
if(mode==='fresh'){for(const t of ordered){const p=await newPage();await render(p,t);await p.close();}}else{const p=await newPage();for(const t of ordered)await render(p,t);await p.close();}
await browser.close();if(args['evidence-out'])fs.writeFileSync(args['evidence-out'],JSON.stringify({schemaVersion:1,mode,url:args.url,hook,selector,state,times,evidence},null,2)+'\n');
