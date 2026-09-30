import seed from './seed.json';
export type Client = typeof seed.client;
export type Account = typeof seed.accounts[number];
export type Signal = typeof seed.signals[number];
export type Query = typeof seed.queries[number];
export type Result = {
 id:string; account:string; family:string; objective:string; query:string;
 title:string; url:string; description:string; published:string;
 relevance:string; trigger:string; strength:number|null; buyerRole:string; reason:string;
 offering:string; targetCustomer:string; dealSize:string; revenueMotion:string;
 maturityStage:string; bottlenecks:string; commercialScore:number|null;
 commercialReason:string; qbc:string; qbcReason:string; qbcAngle:string;
 reviewedManually:boolean; criteriaRevision?:number;
 importedAssessment:{relevance:string;trigger:string;strength:number|null;buyerRole:string;reason:string;commercialScore:number|null;commercialReason:string;qbc:string};
};
export type Criteria = typeof seed.criteria;
export type WorkspaceState = { client: Client; accounts: Account[]; signals: Signal[]; results: Result[]; criteria: Criteria; revision: number };
export type View = 'context'|'accounts'|'signals'|'queries'|'inbox'|'conversations';
export const initial: WorkspaceState = { client: seed.client, accounts: seed.accounts, signals: seed.signals, results: seed.results, criteria: seed.criteria, revision: 0 };
export const queries: Query[] = seed.queries;
export const relevanceValues = ['RELEVANT','PARTIALLY_RELEVANT','NOT_RELEVANT','INSUFFICIENT_INFORMATION'];
export const qbcValues = ['YES','POSSIBLE','NO','INSUFFICIENT_INFORMATION'];
export const triggers = ['PROCUREMENT','HIRING','EXPANSION','FUNDING','PARTNERSHIP','LAUNCH','TECH_SHIFT','LEADERSHIP','COMPLIANCE_RISK','REVENUE_PRESSURE','VENDOR_SWITCH','M_AND_A','PROJECT_MILESTONE','OTHER'];
export const pretty = (s: string) => s ? s.toLowerCase().replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()) : 'Not assessed';
export function reviewIssues(r: Result, revision = 0): string[] {
  const issues: string[] = [];
  if (r.relevance && (r.criteriaRevision ?? 0) !== revision) issues.push('The client context or qualification criteria changed after this assessment. Review it against the current criteria.');
  if (r.relevance === 'RELEVANT' && ![4,5].includes(r.strength ?? 0)) issues.push('Relevant results require evidence strength 4 or 5. The imported assessment has strength '+(r.strength ?? 'unknown')+'.');
  if (r.relevance === 'PARTIALLY_RELEVANT' && ![2,3].includes(r.strength ?? 0)) issues.push('Partially relevant results require evidence strength 2 or 3.');
  if (['NOT_RELEVANT','INSUFFICIENT_INFORMATION'].includes(r.relevance) && r.strength !== 1) issues.push('Excluded or insufficient-information results require evidence strength 1.');
  if (['YES','POSSIBLE'].includes(r.qbc) && !['RELEVANT','PARTIALLY_RELEVANT'].includes(r.relevance)) issues.push('A conversation needs a valid relevance assessment first.');
  if (r.qbc && !r.qbcReason) issues.push('The QBC rationale is missing from the imported workbook. Commercial fit alone does not establish a conversation opportunity.');
  if (['YES','POSSIBLE'].includes(r.qbc) && !r.qbcAngle) issues.push('Add an evidence-based exploratory question before moving this result to the conversation queue.');
  return issues;
}
export function resultStatus(r: Result, revision = 0) {
  if (reviewIssues(r,revision).length) return 'Needs review';
  if (!r.relevance) return 'Unassessed';
  return ({RELEVANT:'Relevant',PARTIALLY_RELEVANT:'Partial',NOT_RELEVANT:'Excluded',INSUFFICIENT_INFORMATION:'Insufficient info'} as Record<string,string>)[r.relevance] ?? 'Needs review';
}
export function canConverse(r: Result, revision=0) { return ['YES','POSSIBLE'].includes(r.qbc) && reviewIssues(r,revision).length === 0; }
export function validateReview(r: Result) {
  if (!relevanceValues.includes(r.relevance)) return 'Choose a relevance decision.';
  if (!triggers.includes(r.trigger)) return 'Choose a valid observed trigger.';
  if (!['ECONOMIC','INFLUENCER','OPERATOR','UNKNOWN'].includes(r.buyerRole)) return 'Choose a valid buyer role.';
  if (r.qbc && !qbcValues.includes(r.qbc)) return 'Choose a valid QBC decision.';
  if (r.commercialScore !== null && ![1,2,3,4,5].includes(r.commercialScore)) return 'Commercial fit must be 1–5 or Unknown.';
  if (r.commercialReason.length>320) return 'Keep the commercial fit reason within 320 characters.';
  if (!r.reason.trim()) return 'Explain the relevance decision using the supplied evidence.';
  if (r.reason.length>400) return 'Keep the relevance reason within 400 characters.';
  if (r.qbcReason.length>600 || r.qbcAngle.length>260) return 'Keep the QBC rationale within 600 characters and question within 260 characters.';
  if (r.qbc === 'POSSIBLE' || r.qbc === 'YES') {
    if (!r.qbcReason.trim() || !r.qbcAngle.trim()) return 'Add a QBC rationale and an exploratory question.';
  }
  if (r.qbc && !r.qbcReason.trim()) return 'Explain the conversation decision.';
  if (r.relevance === 'NOT_RELEVANT' && r.qbc && r.qbc !== 'NO') return 'An excluded result must have QBC = No, or remain unassessed.';
  if (r.relevance === 'INSUFFICIENT_INFORMATION' && ['YES','POSSIBLE'].includes(r.qbc)) return 'Resolve the missing relevance evidence before approving a conversation.';
  return reviewIssues(r,r.criteriaRevision ?? 0)[0] ?? '';
}
export function safeUrl(s: string) { try { const u=new URL(s); return ['http:','https:'].includes(u.protocol) ? u.href : ''; } catch { return ''; } }
export function domain(s:string) { try{return new URL(s).hostname.replace(/^www\./,'');}catch{return 'Source';} }
export function download(name:string,content:string,type='application/json') {
  const url=URL.createObjectURL(new Blob([content],{type})); const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function csv(rows:Record<string,unknown>[]) {
  if (!rows.length) return '';
  const keys=Object.keys(rows[0]);
  const cell=(v:unknown)=>{let s=Array.isArray(v)?v.join(' | '):v==null?'':String(v);if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
  return '\uFEFF'+[keys.map(cell).join(','),...rows.map(r=>keys.map(k=>cell(r[k])).join(','))].join('\r\n');
}
export function parseCsv(text:string):string[][] {
  const rows:string[][]=[];let row:string[]=[];let cell='';let quoted=false;
  for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell='';}else cell+=c;}
  if(quoted)throw Error('The CSV has an unclosed quote.');row.push(cell);if(row.some(x=>x.trim()))rows.push(row);return rows;
}
export function blankAccount(name:string,website:string,linkedin=''):Account { return {id:'a-'+crypto.randomUUID(),name,website,linkedin,description:'',services:[],serviceDetails:[],problems:[],engagements:[],buyingSituations:[],locations:[],parent:'Unknown',subsidiaries:[],aliases:[]}; }
