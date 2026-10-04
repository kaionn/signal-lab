import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {judge} from '../scripts/verdict.mjs';
import {checkHandoff,digest,validate} from '../scripts/check-handoff.mjs';
const now=Date.parse('2026-10-04T12:00:00Z');
const rules={graduate:{probe_b_signups:10,probe_a_weekly_tool_use:20,probe_a_returning_users:5},kill:{min_age_days:21,max_signals:2,requires_distribution:true}};
const meta={slug:'fixture',created:'2026-07-05',probe_type:'A',distribution:[{date:'2026-08-01',channel:'fixture'}]};
test('unknown measurement and no exposure cannot kill',()=>{
  for (const [events,available] of [[null,false],[{tool_use:0,pageview:0},true]]) {
    assert.equal(judge(meta,rules,0,events,null,available,now).verdict,'WATCH');
  }
  assert.equal(judge(meta,rules,0,null,null,false,now).signals,null);
});
test('distribution starts clock; sufficient measured exposure needed',()=>{
  assert.equal(judge(meta,rules,0,{tool_use:0,pageview:30},0,true,now).verdict,'KILL');
  assert.equal(judge({...meta,distribution:[]},rules,0,{tool_use:0,pageview:30},0,true,now).verdict,'WATCH');
  assert.equal(judge({...meta,distribution:[{date:'2026-10-03'}]},rules,0,{tool_use:0,pageview:30},0,true,now).verdict,'WATCH');
});
test('tool and LP use their own signals',()=>{
  assert.equal(judge(meta,rules,100,{tool_use:0,pageview:30},0,true,now).verdict,'KILL');
  assert.equal(judge(meta,rules,0,{tool_use:20,pageview:30},0,true,now).verdict,'GRADUATE');
  assert.equal(judge({...meta,probe_type:'B'},rules,10,null,null,false,now).verdict,'GRADUATE');
  assert.equal(judge({...meta,probe_type:'B'},rules,null,{tool_use:50,pageview:30},5,true,now).verdict,'WATCH');
});
test('invalid and future distribution dates cannot count as observed',()=>{
  for (const date of ['bad','2026-02-30','2027-01-01']) {
    assert.equal(judge({...meta,distribution:[{date}]},rules,0,{tool_use:0,pageview:30},0,true,now).verdict,'WATCH');
  }
});
function fixture(){
  const schema=JSON.parse(fs.readFileSync(new URL('../contracts/opportunity-v1.schema.json',import.meta.url)));
  function build(rule){
    if ('const' in rule)return rule.const;
    if (rule.enum)return rule.enum[0];
    if (rule.type==='object')return Object.fromEntries(Object.entries(rule.properties).map(([k,v])=>[k,build(v)]));
    if (rule.type==='array')return Array.from({length:rule.minItems},()=>build(rule.items));
    if (rule.type==='integer')return rule.minimum;
    if (rule.format==='uri')return 'https://example.com/source';
    if (rule.format==='date-time')return '2026-10-04T00:00:00Z';
    return 'fixture';
  }
  const c=build(schema);c.build.acceptance=[{id:'AC1',check:'fixture only',expected:'pass'}];c.measurement.primary_event='tool_use';
  c.evidence=['pain','alternative','distribution'].map(signal=>({url:'https://example.com/'+signal,checked_at:'2026-10-04T00:00:00Z',summary:'fixture',signal}));
  const hash=digest(c);return {contract:c,contract_digest:hash,state:'approved',approval:{actor:'kaionn',digest:hash}};
}
test('tool handoff passes; no implicit LP conversion',()=>{
  const b=fixture();assert.equal(checkHandoff(b,now).probe_type,'A');
  b.contract.kind='landing_page';b.contract.measurement.primary_event='signup';b.contract_digest=digest(b.contract);b.approval.digest=b.contract_digest;
  assert.equal(checkHandoff(b,now).probe_type,'B');
});
test('unapproved, tampered, unknown field and version fail closed',()=>{
  const b=fixture();b.state='shortlisted';assert.throws(()=>checkHandoff(b,now));
  b.state='approved';b.contract.solution='tampered';assert.throws(()=>checkHandoff(b,now));
  assert.throws(()=>validate({...fixture().contract,schema_version:2}));
  assert.throws(()=>validate({...fixture().contract,shell:'echo untrusted'}));
  const c=fixture().contract;c.origin.url='https://secret:password@example.com';assert.throws(()=>validate(c));
});

test('RFC3339 boundary matches Python validator',()=>{
  for (const value of ['2026-10-02 09:31:00+09:00','2026-10-02T09:31:00','2026-02-30T09:31:00Z']) {
    const c=fixture().contract;c.origin.observed_at=value;assert.throws(()=>validate(c));
  }
  for (const value of ['2026-10-02T09:31:00+09:00','2026-10-02T00:31:00Z','2026-10-02T00:31:00.123456Z']) {
    const c=fixture().contract;c.origin.observed_at=value;validate(c);
  }
});
