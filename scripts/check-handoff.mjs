/** Inspect a local handoff; never execute its checks, LLM, network or publication. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const schema=JSON.parse(fs.readFileSync(path.join(ROOT,'contracts/opportunity-v1.schema.json'),'utf8'));
export function validate(value, rule=schema, name='$') {
  const fail=()=>{throw new Error(`Invalid contract field ${name}`)};
  if ('const' in rule && value!==rule.const) fail();
  if (rule.enum && !rule.enum.includes(value)) fail();
  if (rule.type==='object') {
    if (!value || typeof value!=='object' || Array.isArray(value)) fail();
    if (rule.required.some(key=>!(key in value))) fail();
    if (Object.keys(value).some(key=>!(key in rule.properties))) fail();
    for (const [key,item] of Object.entries(value)) validate(item,rule.properties[key],`${name}.${key}`);
  } else if (rule.type==='array') {
    if (!Array.isArray(value) || value.length<rule.minItems) fail();
    value.forEach((item,i)=>validate(item,rule.items,`${name}[${i}]`));
  } else if (rule.type==='string') {
    if (typeof value!=='string' || value.trim().length<(rule.minLength ?? 0)) fail();
    if (rule.pattern && !(new RegExp(rule.pattern)).test(value)) fail();
    if (rule.format==='uri') { try {const u=new URL(value);if(u.protocol!=='https:' || u.username || u.password) fail();} catch {fail();} }
    if (rule.format==='date-time') {
      if (!/T.*(?:Z|[+-]\d\d:\d\d)$/.test(value) || !Number.isFinite(Date.parse(value))) fail();
      const date=value.slice(0,10), midnight=Date.parse(`${date}T00:00:00Z`);
      if (!Number.isFinite(midnight) || new Date(midnight).toISOString().slice(0,10)!==date) fail();
    }
  } else if (rule.type==='integer' && (!Number.isInteger(value) || value<rule.minimum || ('maximum' in rule && value>rule.maximum))) fail();
}
function sorted(value) {
  if (Array.isArray(value)) return value.map(sorted);
  if (value && typeof value==='object') return Object.fromEntries(Object.keys(value).sort().map(k=>[k,sorted(value[k])]));
  return value;
}
export function digest(value) {return createHash('sha256').update(JSON.stringify(sorted(value))).digest('hex');}
export function checkHandoff(bundle, now=Date.now()) {
  validate(bundle.contract);
  if (!['approved','building'].includes(bundle.state)) throw new Error('Handoff needs build approval');
  if (bundle.contract_digest!==digest(bundle.contract) || bundle.approval?.digest!==bundle.contract_digest || bundle.approval?.actor!=='kaionn') throw new Error('Approval digest mismatch');
  if (!bundle.contract.build.acceptance.length) throw new Error('Acceptance checks missing');
  if (JSON.stringify(bundle.contract).includes('要レビュー')) throw new Error('Draft contract');
  if (Date.parse(bundle.contract.origin.observed_at)>now) throw new Error('Future source');
  const fresh=new Set();
  for (const e of bundle.contract.evidence) {
    const age=now-Date.parse(e.checked_at);
    if (age<0) throw new Error('Future evidence');
    if (age<=30*86400000) fresh.add(e.signal);
  }
  if (!['pain','alternative','distribution'].every(x=>fresh.has(x))) throw new Error('Fresh evidence required');
  const ids=bundle.contract.build.acceptance.map(x=>x.id);
  if (new Set(ids).size!==ids.length) throw new Error('Duplicate acceptance id');
  const event=bundle.contract.kind==='tool'?'tool_use':'signup';
  if (bundle.contract.measurement.primary_event!==event) throw new Error('Tool and LP metrics differ');
  return {id:bundle.contract.id,kind:bundle.contract.kind,probe_type:bundle.contract.kind==='tool'?'A':'B',
    target:`app/p/${bundle.contract.id}/`,max_minutes:bundle.contract.build.max_minutes,
    manual_action:'Open approved BUILD.md in local Codex; tests + preview; request user review before release'};
}
if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {console.log(JSON.stringify(checkHandoff(JSON.parse(fs.readFileSync(process.argv[2],'utf8'))),null,2));}
  catch(error) {console.error(error.message);process.exitCode=1;}
}
