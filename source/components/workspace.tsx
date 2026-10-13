'use client';
import { useState, useEffect, useRef, useMemo, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { ArrowUpRight, ArrowRight, ArrowLeft, Check, ChevronRight, ChevronDown, CircleHelp, Building2, Radar, Search, SlidersHorizontal, Download, Plus, Upload, Layers3, MessageSquareText, FileText, Link2, Globe2, Target, X, Activity, ShieldCheck, CircleAlert, Clock3, Copy, CheckCheck, PanelLeft, Zap, Filter, ListChecks , Settings} from 'lucide-react';
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationNext } from '@/components/ui/pagination';
import { Progress } from '@/components/ui/progress';
import { Toaster } from '@/components/ui/sonner';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { initial, queries, type WorkspaceState, type View, type Result, type Account, type Signal, type Client, type Criteria, pretty, resultStatus, reviewIssues, canConverse, validateReview, safeUrl, domain, download, csv, parseCsv, blankAccount, relevanceValues, qbcValues, triggers } from '@/lib/workspace';


type SearchQueryProgress = {
  status: string;
  completed: number;
  total: number;
  current_account?: string | null;
  current_signal?: string | null;
  error?: string | null;
};


const nav = [
 {label:'SELECT',items:[{id:'context',label:'Client context',icon:FileText},{id:'accounts',label:'Named accounts',icon:Building2}]},
 {label:'SENSE',items:[{id:'signals',label:'Signal library',icon:Radar},{id:'queries',label:'Search planning',icon:Search},{id:'inbox',label:'Signal inbox',icon:Layers3}]},
 {label:'STRIKE',items:[{id:'conversations',label:'Conversations',icon:MessageSquareText}]},
] as const;
const titles:Record<View,string>={context:'Client context',accounts:'Named accounts',signals:'Signal library',queries:'Search planning',inbox:'Signal inbox',conversations:'Conversation queue'};
type Detail={type:'result';id:string}|{type:'account';id:string}|{type:'signal';id:string}|null;
const STORAGE='vsx-account-intelligence-v1';

function Choice({value,onChange,options,label,className=''}:{value:string;onChange:(v:string)=>void;options:{value:string;label:string}[];label:string;className?:string}){
 return <Select value={value} onValueChange={onChange}><SelectTrigger className={className} aria-label={label}><SelectValue placeholder={label}/></SelectTrigger><SelectContent>{options.map(o=><SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select>;
}
function Field({label,children,hint}:{label:string;children:ReactNode;hint?:string}){return <div className="field"><Label>{label}</Label>{children}{hint&&<p className="field-hint">{hint}</p>}</div>;}
function Status({text}:{text:string}){const tone=/^Relevant$|^Ready$|^Yes$|^Complete$|^Intelligence Created$/.test(text)?'green':/review|hold|Partial|Possible|Pending|Insufficient/i.test(text)?'amber':/Excluded|^No$/.test(text)?'gray':'blue';return <span className={'status '+tone}>{text}</span>;}
function Avatar({name,index=0}:{name:string;index?:number}){return <span className={'company-avatar color-'+index%5}>{name.split(/\s/).filter(Boolean).map(x=>x[0]).slice(0,2).join('').toUpperCase()}</span>;}
function Empty({title,description}:{title:string;description:string}){return <div className="empty-state"><div className="empty-icon"><Search size={24}/></div><h3>{title}</h3><p>{description}</p></div>;}
function SearchBox({value,setValue,placeholder}:{value:string;setValue:(v:string)=>void;placeholder:string}){return <div className="search-box"><Search size={17}/><Input aria-label={placeholder} value={value} onChange={e=>setValue(e.target.value)} placeholder={placeholder}/>{value&&<button aria-label="Clear search" onClick={()=>setValue('')}><X size={15}/></button>}</div>;}
function Pages({page,total,setPage}:{page:number;total:number;setPage:(v:number)=>void}){const pages=Math.max(1,Math.ceil(total/10));return <div className="table-footer"><span>{total?`${(page-1)*10+1}–${Math.min(page*10,total)} of ${total}`:'0 results'}</span><Pagination className="pagination"><PaginationContent><PaginationItem><PaginationPrevious href="#" aria-disabled={page===1} onClick={e=>{e.preventDefault();if(page>1)setPage(page-1);}}/></PaginationItem><PaginationItem><span className="page-number">{page} / {pages}</span></PaginationItem><PaginationItem><PaginationNext href="#" aria-disabled={page>=pages} onClick={e=>{e.preventDefault();if(page<pages)setPage(page+1);}}/></PaginationItem></PaginationContent></Pagination></div>;}
async function copy(value:string){try{await navigator.clipboard.writeText(value);toast.success('Copied to clipboard');}catch{toast.error('Clipboard access is unavailable. Select and copy the text.');}}
function ExportButton({label='Export',onClick}:{label?:string;onClick:()=>void}){return <Button variant="outline" onClick={onClick}><Download size={16}/>{label}</Button>;}
function mapBackendSignal(s:any):Signal{
 return {
  id:String(s.id ?? s.signal_number ?? ''),
  category:String(s.category_name ?? s.category ?? ''),
  family:String(s.signal_family ?? s.family ?? ''),
  event:String(s.observable_event ?? s.event ?? ''),
  archetype:String(s.company_archetype_revealed ?? s.archetype ?? ''),
  condition:String(s.underlying_buying_condition ?? s.condition ?? ''),
  why:String(s.why_it_matters ?? s.why ?? ''),
  buyers:Array.isArray(s.likely_buyer_persona)
    ? s.likely_buyer_persona.map(String)
    : s.likely_buyer_persona
      ? [String(s.likely_buyer_persona)]
      : [],
  window:String(s.likely_buying_window ?? s.window ?? ''),
  strength:String(s.signal_strength ?? s.strength ?? ''),
  query:String(s.illustrative_discovery_query ?? s.query ?? ''),
  enabled:Boolean(s.enabled ?? true),
 };
}

function SideNav({
  view,
  navigate,
  state,
  clients,
  activeClientId,
  switchClient,
  setDialog,
  setSettingsOpen,
}: {
  view: View;
  navigate: (v: View) => void;
  state: WorkspaceState;
  clients: Array<{
    id: number;
    company_name: string;
    website: string | null;
    linkedin_url: string | null;
    bu_in_focus: string | null;
  }>;
  activeClientId: number;
  switchClient: (id: number) => void;
  setDialog: (v: 'client' | 'account' | 'criteria' | 'run' | null) => void;
  setSettingsOpen:(v:boolean)=>void;
}) {
  const { setOpenMobile } = useSidebar();

  const visibleClients = clients.slice(0, 3);
  const moreClients = clients.slice(3);

  return (
    <Sidebar className="vsx-sidebar" collapsible="offcanvas">
      <SidebarHeader className="brand-header">
        <a
          href="#inbox"
          onClick={e => {
            e.preventDefault();
            navigate('inbox');
          }}
          className="brand"
        >
          <img src="/favicon.svg" width="34" height="34" alt="" />
          <span>
            VisionScale<span className="brand-x">X</span>
          </span>
        </a>
        <span className="brand-caption">REVENUE INTELLIGENCE</span>
      </SidebarHeader>

      <SidebarContent>
        <div className="px-4 py-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Client workspace
            </span>

            <button
              type="button"
              aria-label="Add client"
              title="Add client"
              onClick={() => setDialog('client')}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-border/60 text-[18px] leading-none text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              +
            </button>
          </div>

          <div className="space-y-1">
            {visibleClients.map(client => {
              const isActive = client.id === activeClientId;

              return (
                <button
                  key={client.id}
                  type="button"
                  onClick={() => switchClient(client.id)}
                  className={[
                    'flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors',
                    isActive ? 'bg-muted font-medium' : 'hover:bg-muted/60',
                  ].join(' ')}
                >
                  <span
                    className="flex shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground"
                    style={{ width: 28, height: 28 }}
                  >
                    {client.company_name
                      .split(/\s/)
                      .filter(Boolean)
                      .map(x => x[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()}
                  </span>

                  <span className="min-w-0 flex-1 truncate text-sm">
                    {client.company_name}
                  </span>
                </button>
              );
            })}
          </div>

          {moreClients.length > 0 && (
            <div className="mt-1">
              <Select
                value=""
                onValueChange={value => switchClient(Number(value))}
              >
                <SelectTrigger className="h-9 w-full border-0 bg-transparent px-2 text-sm font-normal shadow-none hover:bg-muted/60 focus:ring-0">
                  <SelectValue placeholder="More clients" />
                </SelectTrigger>

                <SelectContent>
                  {moreClients.map(client => (
                    <SelectItem
                      key={client.id}
                      value={String(client.id)}
                    >
                      {client.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {nav.map(group => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="nav-group-label">
              {group.label}
              <span className="group-line" />
            </SidebarGroupLabel>

            <SidebarMenu>
              {group.items.map(item => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    className="nav-item"
                    isActive={view === item.id}
                    onClick={() => {
                      navigate(item.id);
                      setOpenMobile(false);
                    }}
                  >
                    <item.icon size={18} />
                    <span>{item.label}</span>

                    {item.id === 'inbox' && (
                      <span className="nav-count">
                        {state.results.length}
                      </span>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
    
        <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
        >
            <Settings size={18} />
            <span>Settings</span>
        </button>
  
        <div className="user-profile">
          <div className="user-avatar">AV</div>
          <div>
            <strong>Avanish Vasudevan</strong>
            <span>VisionScaleX workspace</span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
export default function Workspace(){
const [state,setState]=useState<WorkspaceState>(initial);const [loaded,setLoaded]=useState(false);const [runningAll,setRunningAll]=useState(false);const [runningClientIntelligence,setRunningClientIntelligence]=useState(false);const [generatingSignals,setGeneratingSignals]=useState(false);const [generatingSearchQueries,setGeneratingSearchQueries]=useState(false);const [regionInFocus, setRegionInFocus] = useState('');
const [regionDialogOpen, setRegionDialogOpen] = useState(false);
const [searchQueryProgress, setSearchQueryProgress] = useState<{
  status: string;
  completed: number;
  total: number;
  current_account?: string | null;
  current_signal?: string | null;
  error?: string | null;
}>({
  status: 'idle',
  completed: 0,
  total: 0,
  current_account: null,
  current_signal: null,
  error: null,
});
const [intelligenceCreated,setIntelligenceCreated]=useState<Set<string>>(new Set());const [view,setView]=useState<View>('inbox');const [detail,setDetail]=useState<Detail>(null);const [dialog,setDialog]=useState<'account'|'criteria'|'run'|'client'|null>(null);const [settingsOpen,setSettingsOpen]=useState(false);
const [deletingClientId,setDeletingClientId]=useState<number|null>(null);const [deletingAllAccounts, setDeletingAllAccounts] = useState(false);
const [deleteProgress, setDeleteProgress] = useState({ done: 0, total: 0 });const [inboxTab,setInboxTab]=useState('all');const [clients,setClients]=useState<Array<{id:number;company_name:string;website:string|null;linkedin_url:string|null;bu_in_focus:string|null}>>([]);const [activeClientId,setActiveClientId]=useState(1);
const [intelligenceProgress, setIntelligenceProgress] = useState({done: 0,total: 0,});
const [intelligenceFailures, setIntelligenceFailures] = useState<Array<{ name: string; error: string }>>([]);
 async function loadClientWorkspace(clientId:number, markLoaded=true){
  try{
    const client=await api.getClient(clientId);

    let context:Awaited<ReturnType<typeof api.getClientContext>>|null=null;
    let accounts:Awaited<ReturnType<typeof api.getAccounts>>=[];
    let backendSignals:any[]=[];

    try{context=await api.getClientContext(clientId);}catch{}
    try{accounts=await api.getAccounts(clientId);}catch{}
    const created=new Set<string>();
    await Promise.all(accounts.map(async account=>{
      try{
        await api.getAccountIntelligence(clientId,Number(account.id));
        created.add(String(account.id));
      }catch{}
    }));
    setIntelligenceCreated(created);
    try{backendSignals=(await api.getSignals(clientId)) as any[];}catch{}

    setActiveClientId(clientId);
try {
  localStorage.setItem('vsx-selected-client-id', String(clientId));
} catch {
  // Keep the current session working if browser storage is unavailable.
}

    setState(current=>({
      ...current,
      client:{
        ...current.client,
        id:String(client.id),
        name:client.company_name,
        website:api.cleanUrl(client.website),
        linkedin:api.cleanUrl(client.linkedin_url),
        businessUnit:client.bu_in_focus??'',
        description:context?.cc_description??'',
        services:context?.cc_services_being_sold??[],
        serviceDetails:context?.cc_service_description??[],
        problems:context?.cc_typical_promblems_we_solve??[],
        engagements:context?.cc_typical_engagements??[],
        buyingSituations:context?.cc_ideal_buying_situations??[],
        locations:context?.cc_location??[],
        parent:context?.cc_parent_company??'Unknown',
        subsidiaries:(context?.cc_known_affairs_subsidiaries??[]) as string[],
        aliases:(context?.cc_alternate_names_abbreviations??[]) as string[],
      },
      accounts:accounts.map(account=>({
        id:String(account.id),
        name:account.account_name,
        website:api.cleanUrl(account.website),
        linkedin:api.cleanUrl(account.linkedin_url),
        description:'',
        services:[],
        serviceDetails:[],
        problems:[],
        engagements:[],
        buyingSituations:[],
        locations:[],
        parent:'Unknown',
        subsidiaries:[],
        aliases:[],
      } as Account)),
      signals:backendSignals.map(mapBackendSignal),
      results:clientId===1 ? current.results : [],
    }));
  }catch(error){
    console.error('CLIENT WORKSPACE LOAD FAILED:',error);
    toast.error('Could not load that client workspace.');
  }finally{
    if(markLoaded)setLoaded(true);
  }
 }

 async function switchClient(clientId:number){
   await loadClientWorkspace(clientId);
   setDetail(null);
 }
 async function deleteClient(clientId:number){
  const client=clients.find(c=>c.id===clientId);
  if(!client)return;

  const confirmed=window.confirm(
    `Delete ${client.company_name}? This will archive the client and remove it from active clients.`
  );
  if(!confirmed)return;

  setDeletingClientId(clientId);

  try{
    await api.deleteClient(clientId);

    const updatedClients=await api.getClients();
    setClients(updatedClients);
    setSettingsOpen(false);

    if(clientId===activeClientId && updatedClients.length>0){
      await switchClient(updatedClients[0].id);
    }

    toast.success(`${client.company_name} deleted and archived`);
  }catch(error){
    console.error('CLIENT DELETE FAILED:',error);
    toast.error('Could not delete client.');
  }finally{
    setDeletingClientId(null);
  }
}

/* ADD THIS NEW FUNCTION BELOW deleteClient */

async function deleteAccount(account: Account) {
  const accountId = account.id;

  try {
    await api.deleteAccount(activeClientId, Number(accountId));

    setState(s => ({
      ...s,
      accounts: s.accounts.filter(a => a.id !== accountId),
      revision: s.revision + 1,
    }));

    setIntelligenceCreated(prev => {
      const next = new Set(prev);
      next.delete(accountId);
      return next;
    });

    if (detail?.type === 'account' && detail.id === accountId) {
      setDetail(null);
    }

    toast.success(`${account.name} deleted and archived.`);
  } catch (error) {
    console.error('ACCOUNT DELETE FAILED:', account.name, error);
    toast.error(`Could not delete ${account.name}.`);
  }
}

async function deleteAllAccounts() {
  // Always start with the latest account list from the backend.
  let accountsToDelete: Awaited<ReturnType<typeof api.getAccounts>>;

  try {
    accountsToDelete = await api.getAccounts(activeClientId);
  } catch (error) {
    console.error('FAILED TO REFRESH ACCOUNTS BEFORE DELETION:', error);
    toast.error('Could not refresh accounts. Nothing was deleted.');
    return;
  }

  if (accountsToDelete.length === 0) {
    setState(s => ({ ...s, accounts: [] }));
    toast.info('There are no named accounts to delete.');
    return;
  }

  const confirmed = window.confirm(
    `Delete all ${accountsToDelete.length} named accounts for ${state.client.name}? Each account will be archived before removal.`
  );

  if (!confirmed) return;

  const failedNames: string[] = [];

  for (const account of accountsToDelete) {
    try {
      await api.deleteAccount(activeClientId, Number(account.id));
    } catch (error) {
      console.error('ACCOUNT DELETE FAILED:', {
        clientId: activeClientId,
        accountName: account.account_name,
        accountId: account.id,
        error,
      });

      failedNames.push(account.account_name);
    }
  }

  // Verify the actual backend state after all deletion attempts.
  try {
    const remainingAccounts = await api.getAccounts(activeClientId);

    const remainingIds = new Set(
      remainingAccounts.map(account => String(account.id))
    );

    setState(s => ({
      ...s,
      accounts: remainingAccounts.map(account => ({
        id: String(account.id),
        name: account.account_name,
        website: api.cleanUrl(account.website),
        linkedin: api.cleanUrl(account.linkedin_url),
        description: '',
        services: [],
        serviceDetails: [],
        problems: [],
        engagements: [],
        buyingSituations: [],
        locations: [],
        parent: 'Unknown',
        subsidiaries: [],
        aliases: [],
      } as Account)),
      revision: s.revision + 1,
    }));

    setIntelligenceCreated(prev => {
      const next = new Set(prev);

      for (const id of next) {
        if (!remainingIds.has(id)) next.delete(id);
      }

      return next;
    });

    setDetail(null);

    if (remainingAccounts.length > 0) {
      toast.error(
        `Deletion finished: ${remainingAccounts.length} accounts remain. ${failedNames.length} deletion requests failed.`
      );
    } else {
      toast.success(
        `All ${accountsToDelete.length} accounts were removed and the account list is now empty.`
      );
    }
  } catch (error) {
    console.error('FAILED TO VERIFY ACCOUNTS AFTER DELETION:', error);
    toast.error(
      `Deletion attempts finished, but the final account list could not be verified. ${failedNames.length} requests failed.`
    );
  }
}

useEffect(()=>{
  let cancelled=false;

  (async()=>{
    try{
      const raw=await api.getClients();

      const rows=Array.isArray(raw)
        ? raw
        : Array.isArray((raw as any)?.value)
          ? (raw as any).value
          : [];

      if(cancelled)return;

      setClients(rows);

      let savedClientId: number | null = null;

try {
  const saved = localStorage.getItem('vsx-selected-client-id');
  if (saved !== null) {
    const parsed = Number(saved);
    if (Number.isInteger(parsed) && parsed > 0) {
      savedClientId = parsed;
    }
  }
} catch {
  // Fall back to the default client if browser storage is unavailable.
}

const preferred =
  rows.find((c: any) => Number(c.id) === savedClientId) ??
  rows.find((c: any) => Number(c.id) === 1) ??
  rows[0];

if (preferred) {
  await loadClientWorkspace(Number(preferred.id));
} else {
  setLoaded(true);
}
    }catch(error){
      console.error('CLIENT LIST LOAD FAILED:',error);
      if(!cancelled)setLoaded(true);
    }
  })();

  return()=>{cancelled=true;};
 },[]);

 useEffect(()=>{
  let cancelled=false;
  (async()=>{
    try{
      const clientId=Number((state.client as any).id ?? 1);
      const backendSignals=await api.getSignals(clientId);
      if(!cancelled && Array.isArray(backendSignals) && backendSignals.length){
        setState(prev=>({...prev,signals:backendSignals.map(mapBackendSignal)}));
      }
    }catch(error){
      console.warn('Live signal library could not be loaded.',error);
    }
  })();
  return ()=>{cancelled=true;};
 },[state.client]);
 useEffect(()=>{try{const raw=localStorage.getItem(STORAGE);if(raw){const s=JSON.parse(raw);if(s.client&&Array.isArray(s.accounts)&&Array.isArray(s.signals)&&Array.isArray(s.results)&&s.criteria&&typeof s.revision==='number')setState(current => ({ ...s, accounts: current.accounts }));}}catch{toast.error('The saved preview could not be loaded. Original data is shown.');}setLoaded(true);const hash=window.location.hash.slice(1);if(hash in titles)setView(hash as View);},[]);
 useEffect(()=>{if(loaded){try{localStorage.setItem(STORAGE,JSON.stringify(state));}catch{toast.error('Browser storage is full or unavailable. Export your work before leaving.');}}},[state,loaded]);
 const navigate=(v:View)=>{setView(v);window.history.replaceState(null,'','#'+v);setDetail(null);};
 const stateRef=useRef(state);stateRef.current=state;
 useEffect(()=>{
  const context=(document as unknown as {modelContext?:{registerTool:(tool:unknown,options:unknown)=>unknown}}).modelContext;
  if(!context?.registerTool)return;const lifecycle=new AbortController();
  const registrations=[{name:'read_workspace_summary',title:'Read intelligence workspace',description:'Read counts and review readiness from this local front-end preview. Does not run live searches.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:(input:unknown)=>{if(!input||typeof input!=='object'||Object.keys(input).length)throw Error('Expected an empty object.');const s=stateRef.current;return {client:s.client.name,accounts:s.accounts.length,signalDefinitions:s.signals.length,results:s.results.length,needsReview:s.results.filter(r=>reviewIssues(r,s.revision).length).length,readyConversations:s.results.filter(r=>canConverse(r,s.revision)).length,liveBackendConnected:false};}},{name:'open_signal_result',title:'Open a signal result',description:'Open an existing result in the visible evidence panel. Does not approve or modify assessments.',inputSchema:{type:'object',properties:{resultId:{type:'string'}},required:['resultId'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},execute:(input:unknown)=>{const p=input as {resultId?:unknown};if(!p||Object.keys(p).some(k=>k!=='resultId')||typeof p.resultId!=='string')throw Error('A resultId string is required.');const r=stateRef.current.results.find(x=>x.id===p.resultId);if(!r)throw Error('No result has that identifier.');flushSync(()=>{setView('inbox');setDetail({type:'result',id:r.id});});return {opened:r.id,title:r.title};}}];
  for(const t of registrations){try{Promise.resolve(context.registerTool(t,{signal:lifecycle.signal})).catch(()=>{});}catch{}}
  return ()=>lifecycle.abort();
 },[]);
 const assessed=state.results.filter(r=>r.relevance).length;const needsReview=state.results.filter(r=>reviewIssues(r,state.revision).length).length;const ready=state.results.filter(r=>canConverse(r,state.revision)).length;
 const goReview=()=>{setInboxTab('review');navigate('inbox');};
 
const runAllIntelligence = async (pendingOnly = false) => {
  if (runningAll) return;

  const accountsToProcess = pendingOnly
    ? state.accounts.filter(
        account => !intelligenceCreated.has(String(account.id))
      )
    : [...state.accounts];

  if (accountsToProcess.length === 0) {
    toast.success("All accounts already have intelligence.");
    return;
  }

  setRunningAll(true);
  setIntelligenceProgress({
    done: 0,
    total: accountsToProcess.length,
  });
  setIntelligenceFailures([]);

  const failures: Array<{ name: string; error: string }> = [];
  let completed = 0;
  const batchSize = 10;

  try {
    for (
      let start = 0;
      start < accountsToProcess.length;
      start += batchSize
    ) {
      const batch = accountsToProcess.slice(
        start,
        start + batchSize
      );

      for (const account of batch) {
        try {
          await api.generateAccountIntelligence(
            activeClientId,
            Number(account.id)
          );

          setIntelligenceCreated(prev => {
            const next = new Set(prev);
            next.add(String(account.id));
            return next;
          });
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : String(error);

          console.error(
            `INTELLIGENCE FAILED — ${account.name} (${account.id}):`,
            error
          );

          failures.push({
            name: account.name,
            error: message,
          });

          setIntelligenceFailures([...failures]);
        } finally {
          completed += 1;
          setIntelligenceProgress({
            done: completed,
            total: accountsToProcess.length,
          });
        }
      }
    }

    if (failures.length === 0) {
      toast.success(
        `Intelligence generated for ${completed} accounts.`
      );
    } else {
      toast.error(
        `${completed - failures.length} succeeded; ${failures.length} failed. Run Pending Intelligence to retry.`
      );
    }
  } finally {
    setRunningAll(false);
  }
};
 const runClientIntelligence=async()=>{
  setRunningClientIntelligence(true);
  try{
    const generated=await api.generateClientContext(activeClientId);
    setState(s=>({
      ...s,
      client:{
        ...s.client,
        description:generated.cc_description??'',
        services:generated.cc_services_being_sold??[],
        serviceDetails:generated.cc_service_description??[],
        problems:generated.cc_typical_promblems_we_solve??[],
        engagements:generated.cc_typical_engagements??[],
        buyingSituations:generated.cc_ideal_buying_situations??[],
        locations:generated.cc_location??[],
        parent:generated.cc_parent_company??'Unknown',
        subsidiaries:generated.cc_known_affairs_subsidiaries??[],
        aliases:generated.cc_alternate_names_abbreviations??[],
      },
      revision:s.revision+1,
    }));
    toast.success('Client intelligence generated');
  }catch(error){
    console.error('CLIENT INTELLIGENCE FAILED:',error);
    toast.error('Could not generate client intelligence.');
  }finally{
    setRunningClientIntelligence(false);
  }
};
 const generateSignals=async()=>{
  setGeneratingSignals(true);
  try{
    const generated=await api.generateSignals(activeClientId);

    setState(s=>({
      ...s,
      signals:(generated as any[]).map(mapBackendSignal),
      revision:s.revision+1,
    }));

    toast.success('Signals generated');
  }catch(error){
    console.error('SIGNAL GENERATION FAILED:',error);
    toast.error('Could not generate signals.');
  }finally{
    setGeneratingSignals(false);
  }
};
const generateSearchQueries = async () => {
  setGeneratingSearchQueries(true);

  setSearchQueryProgress({
    status: 'running',
    completed: 0,
    total: 0,
    current_account: null,
    current_signal: null,
    error: null,
  });

  let stopPolling = false;

  const pollProgress = async () => {
    while (!stopPolling) {
      try {
        const progress =
          (await api.getAccountSignalQueryProgress(activeClientId))as SearchQueryProgress;

        setSearchQueryProgress(progress);

        if (
          progress.status === 'completed' ||
          progress.status === 'failed'
        ) {
          return;
        }
      } catch (error) {
        console.error('SEARCH QUERY PROGRESS FETCH FAILED:', error);
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  };

  const progressTask = pollProgress();

  try {
    await api.generateAllAccountSignalQueries(activeClientId,
  regionInFocus.trim());

    // Fetch the final backend progress before stopping polling.
    const finalProgress = (await api.getAccountSignalQueryProgress(activeClientId
    )) as SearchQueryProgress;

    setSearchQueryProgress(finalProgress);

    toast.success('Search queries generated');
  } catch (error) {
    console.error('SEARCH QUERY GENERATION FAILED:', error);

    toast.error('Could not generate search queries.');
  } finally {
    stopPolling = true;
    await progressTask;
    setGeneratingSearchQueries(false);
  }
};
;const toggleSignal=async(signalId:string)=>{
  try{
    const updated=await api.toggleSignal(
      activeClientId,
      Number(signalId)
    );

    setState(s=>({
      ...s,
      signals:s.signals.map(x=>
        x.id===signalId
          ? {...x,enabled:updated.enabled}
          : x
      ),
    }));
  }catch(error){
    console.error('SIGNAL TOGGLE FAILED:',error);
    toast.error('Could not update signal.');
  }
};const setResult=(r:Result)=>setState(s=>({...s,results:s.results.map(x=>x.id===r.id?r:x)}));
 const exportResults=(rows:Result[])=>{download('VisionScaleX-results.csv',csv(rows.map(r=>({Account:r.account,Title:r.title,URL:r.url,Description:r.description,'Published date':r.published,'Signal family':r.family,Status:resultStatus(r,state.revision),Relevance:r.relevance,Strength:r.strength,Trigger:r.trigger,'Buyer role':r.buyerRole,Reason:r.reason,'Commercial fit score':r.commercialScore,'Commercial fit reason':r.commercialReason,QBC:r.qbc,'QBC reason':r.qbcReason,'QBC angle':r.qbcAngle,'Review issues':reviewIssues(r,state.revision),'Assessment origin':r.reviewedManually?'Manual review':'Imported workbook'}))),'text/csv;charset=utf-8');};
 return <TooltipProvider><SidebarProvider style={{'--sidebar-width':'15.5rem'} as React.CSSProperties}><SideNav state={state} view={view} navigate={navigate} clients={clients} activeClientId={activeClientId} switchClient={switchClient} setDialog={setDialog} setSettingsOpen={setSettingsOpen}/><main className="app-main"><header className="topbar"><div className="breadcrumb"><SidebarTrigger className="sidebar-toggle"/><span>Workspace</span><ChevronRight size={14}/><strong>{state.client.name}</strong></div><div className="topbar-right"><span className="source-label">Source: input_sheet.xlsx</span><Tooltip><TooltipTrigger asChild><span tabIndex={0} className="preview-badge">Preview <CircleHelp size={13}/></span></TooltipTrigger><TooltipContent>Changes save on this device. No live search or AI calls are made.</TooltipContent></Tooltip><span className="mini-avatar">AV</span></div></header><div className="page-wrap"><div className="page-heading"><div><div className="eyebrow">{view==='context'||view==='accounts'?'SELECT':view==='conversations'?'STRIKE':'SENSE'} <span>/</span> ACCOUNT INTELLIGENCE</div><h1>{titles[view]}</h1><p>{({inbox:'See what changed. Decide what deserves a conversation.',context:'Define the commercial lens for every account and signal.',accounts:'Your universe of accounts, with the context behind each company.',signals:'The changes that could make an account commercially relevant.',queries:'Translate each account and signal into a focused search.',conversations:'Turn relevant evidence into a reason to engage.'})[view]}</p></div><div className="heading-actions">{view==='inbox'?<><ExportButton onClick={()=>exportResults(state.results)}/><Button onClick={()=>setDialog('run')}><Radar size={17}/>Prepare a run</Button></>:view==='accounts'?<>
  <Button
    variant="outline"
    onClick={() => runAllIntelligence(false)}
    disabled={runningAll||state.accounts.length===0}
  >
    {runningAll?'Running intelligence...':'Run Intelligence for All'}
  </Button>
  
{intelligenceProgress.total > 0 && (
  <div role="status" aria-live="polite">
    <p>
      Intelligence progress: {intelligenceProgress.done} /{" "}
      {intelligenceProgress.total}
    </p>
    {intelligenceFailures.length > 0 && (
      <p>
        Failed accounts: {intelligenceFailures.length}. These can be retried.
      </p>
    )}
  </div>
)}

<Button
  variant="outline"
  onClick={() => runAllIntelligence(true)}
  disabled={
    runningAll ||
    state.accounts.every(account =>
      intelligenceCreated.has(String(account.id))
    )
  }
>
  Run Pending Intelligence
</Button>


   <Button onClick={()=>setDialog('account')}>
     <Plus size={17}/>
     Add accounts
   </Button>
  </>
:view==='queries'?<>
  <Button variant="outline">
    Import Search Queries
  </Button>

  <Button
  onClick={() => setRegionDialogOpen(true)}
  disabled={generatingSearchQueries}
>
  {generatingSearchQueries
    ? 'Generating Search Queries...'
    : 'Generate Search Queries'}
</Button>

{generatingSearchQueries && (
  <div className="mt-3 space-y-2">
    <div className="flex justify-between text-sm">
      <span>Generating Search Queries</span>
      <span>
        {searchQueryProgress.completed.toLocaleString()} /{' '}
        {searchQueryProgress.total.toLocaleString()}
      </span>
    </div>

    <Progress
      value={
        searchQueryProgress.total > 0
          ? (searchQueryProgress.completed /
              searchQueryProgress.total) * 100
          : 0
      }
    />

    {searchQueryProgress.current_account && (
      <p className="text-sm text-muted-foreground">
        Account: {searchQueryProgress.current_account}
      </p>
    )}

    {searchQueryProgress.current_signal && (
      <p className="text-sm text-muted-foreground">
        Signal: {searchQueryProgress.current_signal}
      </p>
    )}
  </div>
)}

<Dialog
  open={regionDialogOpen}
  onOpenChange={setRegionDialogOpen}
>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Region in Focus</DialogTitle>
      <DialogDescription>
        Enter the region to include in every generated search query.
      </DialogDescription>
    </DialogHeader>

    <div className="space-y-2">
      <Label htmlFor="region-in-focus">
        Region in Focus
      </Label>
      <Input
        id="region-in-focus"
        placeholder="e.g. India, United States, UAE"
        value={regionInFocus}
        onChange={(e) => setRegionInFocus(e.target.value)}
      />
    </div>

    <Button
      disabled={!regionInFocus.trim() || generatingSearchQueries}
      onClick={() => {
        setRegionDialogOpen(false);
        void generateSearchQueries();
      }}
    >
      Generate Queries
    </Button>
  </DialogContent>
</Dialog>


</>:view==='conversations'?<ExportButton label="Export queue" onClick={()=>exportResults(state.results.filter(r=>canConverse(r,state.revision)))}/>:null}</div></div>
 {view==='inbox'&&<><div className="metrics-grid"><Metric label="Named accounts" value={state.accounts.length} note="Your selected account universe" icon={<Building2 size={18}/>} onClick={()=>navigate('accounts')}/><Metric label="Signals to watch" value={state.signals.filter(s=>s.enabled).length} note="Active signal definitions" icon={<Radar size={18}/>} onClick={()=>navigate('signals')}/><Metric label="Search results" value={state.results.length} note={`${assessed} assessed Â· ${state.results.length-assessed} unassessed`} icon={<Layers3 size={18}/>} onClick={()=>setInboxTab('all')}/><Metric label="Conversation ready" value={ready} note={needsReview?`${needsReview} imported assessment needs review`:'Evidence-led opportunities'} icon={<MessageSquareText size={18}/>} onClick={()=>navigate('conversations')}/></div><div className="workspace-strip"><span className="strip-icon"><Target size={20}/></span><div><strong>{state.client.businessUnit}</strong><span>Commercial focus Â· {state.client.name}</span></div><div className="strip-stages"><span>Select <Check size={13}/></span><i/><span className="current">Sense <Activity size={14}/></span><i/><span>Strike</span></div><Button variant="ghost" onClick={()=>setDialog('criteria')}><SlidersHorizontal size={16}/>Qualification criteria</Button></div>{needsReview>0&&<div className="attention-banner"><CircleAlert size={17}/><span><strong>{needsReview} assessment{needsReview>1?'s':''} need{needsReview===1?'s':''} a closer look.</strong> Resolve the evidence gaps before moving to a conversation.</span><button onClick={goReview}>Review <ArrowRight size={16}/></button></div>}<Inbox state={state} tab={inboxTab} setTab={setInboxTab} open={r=>setDetail({type:'result',id:r.id})} exportRows={exportResults}/></>}
 {view==='context'&&<Context state={state} save={async client=>{try{await api.updateClientContext(activeClientId,{cc_location:client.locations,cc_description:client.description,cc_services_being_sold:client.services,cc_service_description:client.serviceDetails,cc_typical_promblems_we_solve:client.problems,cc_typical_engagements:client.engagements,cc_ideal_buying_situations:client.buyingSituations,cc_known_affairs_subsidiaries:client.subsidiaries,cc_parent_company:client.parent,cc_alternate_names_abbreviations:client.aliases});setState(s=>({...s,client,revision:s.revision+1}));toast.success('Client context saved');}catch(error){console.error('CLIENT CONTEXT SAVE FAILED:',error);toast.error('Could not save client context.');}}} runClientIntelligence={runClientIntelligence}runningClientIntelligence={runningClientIntelligence} openCriteria={()=>setDialog('criteria')}/>}
 {view==='accounts'&&<Accounts
  accounts={state.accounts}
  open={a=>setDetail({type:'account',id:a.id})}
  add={()=>setDialog('account')}
  intelligenceCreated={intelligenceCreated}
  deleteAccount={deleteAccount}
  deleteAllAccounts={deleteAllAccounts}
  />}
 {view==='signals'&&<Signals signals={state.signals} open={s=>setDetail({type:'signal',id:s.id})} toggle={toggleSignal}onGenerate={generateSignals} generating={generatingSignals}/>}
 {view==='queries'&&<Queries state={state}/>}
 {view==='conversations'&&<Conversations state={state} open={r=>setDetail({type:'result',id:r.id})} review={goReview}/>}
 <footer className="page-footer"><span>SELECT <b></b> SENSE <b></b> STRIKE</span><span>Imported workbook. Changes saved on this device</span></footer></div></main>
 <Sheet open={!!detail} onOpenChange={o=>{if(!o)setDetail(null);}}><Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
  <SheetContent className="detail-sheet">
    <SheetHeader className="detail-header">
      <span className="eyebrow">SETTINGS</span>
      <SheetTitle>Settings</SheetTitle>
      <SheetDescription>Manage workspace clients.</SheetDescription>
    </SheetHeader>

    <div className="detail-body">
      <section className="detail-section">
        <h3>Client Management</h3>

        <div className="space-y-3">
          {clients.map(client => (
            <div
              key={client.id}
              className="flex items-center justify-between gap-4 rounded-lg border p-3"
            >
              <div className="min-w-0">
                <strong className="block truncate">
                  {client.company_name}
                </strong>
                <span className="text-sm text-muted-foreground">
                  Client #{client.id}
                </span>
              </div>

              <Button
                variant="outline"
                disabled={deletingClientId === client.id}
                onClick={() => deleteClient(client.id)}
              >
                {deletingClientId === client.id ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          ))}
        </div>
      </section>
    </div>
  </SheetContent>
</Sheet><SheetContent className="detail-sheet">{detail?.type==='result'&&(()=>{const r=state.results.find(x=>x.id===detail.id);return r?<ResultDetail key={r.id} result={r} revision={state.revision} save={setResult}/>:null;})()}{detail?.type==='account'&&(()=>{const a=state.accounts.find(x=>x.id===detail.id);return a?<AccountDetail account={a} clientId={activeClientId} onIntelligenceCreated={()=>setIntelligenceCreated(prev=>new Set(prev).add(a.id))}/>:null;})()}{detail?.type==='signal'&&(()=>{const s=state.signals.find(x=>x.id===detail.id);return s?<SignalDetail signal={s}/>:null;})()}</SheetContent></Sheet>
 <Dialog open={dialog==='client'} onOpenChange={o=>{if(!o)setDialog(null);}}><DialogContent>
    <DialogHeader>
      <DialogTitle>Add client</DialogTitle>
      <DialogDescription>
        Add a client workspace to monitor.
      </DialogDescription>
    </DialogHeader>

    <AddClient
      add={async client=>{
        try{
          const created=await api.createClient({
            company_name:client.company_name,
            website:client.website||undefined,
            linkedin_url:client.linkedin_url||undefined,
            bu_in_focus:client.bu_in_focus||undefined,
          });

          const updatedClients=await api.getClients();
          setClients(updatedClients);
          setDialog(null);

          await switchClient(created.id);

          toast.success(`${created.company_name} added`);
        }catch(error){
          console.error('CLIENT SAVE FAILED:',error);
          toast.error('Could not add client.');
        }
      }}
    />
  </DialogContent>
</Dialog>
<Dialog open={dialog==='account'} onOpenChange={o=>{if(!o)setDialog(null);}}><DialogContent className="account-dialog"><AddAccounts existing={state.accounts} add={async accounts=>{
  try{
    for(const account of accounts){
      await api.createAccount(activeClientId,{
        account_name:account.name,
        website:account.website,
        linkedin_url:account.linkedin||undefined,
      });
    }

    const savedAccounts=await api.getAccounts(activeClientId);

    const mappedAccounts=savedAccounts.map(account=>({
      id:String(account.id),
      name:account.account_name,
      website:api.cleanUrl(account.website),
      linkedin:api.cleanUrl(account.linkedin_url),
      description:'',
      services:[],
      serviceDetails:[],
      problems:[],
      engagements:[],
      buyingSituations:[],
      locations:[],
      parent:'Unknown',
      subsidiaries:[],
      aliases:[],
    } as Account));

    setState(s=>({...s,accounts:mappedAccounts}));
    setDialog(null);
    toast.success(`${accounts.length} account${accounts.length===1?'':'s'} saved`);
  }catch(error){
    console.error('ACCOUNT SAVE FAILED:',error);
    toast.error('Could not save account(s).');
  }
}}/></DialogContent></Dialog><Dialog open={dialog==='criteria'} onOpenChange={o=>{if(!o)setDialog(null);}}><DialogContent className="criteria-dialog"><CriteriaEditor criteria={state.criteria} save={criteria=>{setState(s=>({...s,criteria,revision:s.revision+1}));setDialog(null);toast.success('Criteria saved. Existing assessments now require review.');}}/></DialogContent></Dialog><Dialog open={dialog==='run'} onOpenChange={o=>{if(!o)setDialog(null);}}><DialogContent className="run-dialog"><RunPlanner state={state}/></DialogContent></Dialog><Toaster position="bottom-right" richColors/></SidebarProvider></TooltipProvider>;
}
function Metric({label,value,note,icon,onClick}:{label:string;value:number;note:string;icon:ReactNode;onClick:()=>void}){return <button className="metric" onClick={onClick}><div className="metric-top"><span>{label}</span><span className="metric-icon">{icon}</span></div><strong>{value.toLocaleString()}</strong><span className="metric-note">{note}</span></button>;}

function Inbox({state,tab,setTab,open,exportRows}:{state:WorkspaceState;tab:string;setTab:(v:string)=>void;open:(r:Result)=>void;exportRows:(r:Result[])=>void}){
 const [search,setSearch]=useState('');const [account,setAccount]=useState('all');const [family,setFamily]=useState('all');const [page,setPage]=useState(1);
 const rows=useMemo(()=>state.results.filter(r=>(!search||`${r.title} ${r.description} ${r.account}`.toLowerCase().includes(search.toLowerCase()))&&(account==='all'||r.account===account)&&(family==='all'||r.family===family)&&(tab==='all'||(tab==='review'&&reviewIssues(r,state.revision).length>0)||(tab==='unassessed'&&!r.relevance)||(tab==='relevant'&&['Relevant','Partial'].includes(resultStatus(r,state.revision)))||(tab==='excluded'&&resultStatus(r,state.revision)==='Excluded'))).sort((a,b)=>Number(!!reviewIssues(b,state.revision).length)-Number(!!reviewIssues(a,state.revision).length)),[state,search,account,family,tab]);
 useEffect(()=>setPage(1),[search,account,family,tab]);useEffect(()=>{if(page>Math.max(1,Math.ceil(rows.length/10)))setPage(1);},[rows.length,page]);
 const count=(t:string)=>state.results.filter(r=>t==='all'||t==='review'&&reviewIssues(r,state.revision).length||t==='unassessed'&&!r.relevance||t==='relevant'&&['Relevant','Partial'].includes(resultStatus(r,state.revision))||t==='excluded'&&resultStatus(r,state.revision)==='Excluded').length;
 return <section className="panel inbox-panel"><div className="panel-top"><div><h2>Account signals <span className="count-pill">{state.results.length}</span></h2><p>Evidence from your imported search results</p></div><button className="text-action" onClick={()=>exportRows(rows)}><Download size={15}/>Export view</button></div><Tabs value={tab} onValueChange={setTab} className="filter-tabs"><TabsList>{[['all','All results'],['unassessed','Unassessed'],['review','Needs review'],['relevant','Relevant'],['excluded','Excluded']].map(([key,label])=><TabsTrigger key={key} value={key}>{label}<span>{count(key)}</span></TabsTrigger>)}</TabsList></Tabs><div className="table-tools"><SearchBox value={search} setValue={setSearch} placeholder="Search signals, companies or keywords"/><Choice label="Filter by account" value={account} onChange={setAccount} options={[{value:'all',label:'All accounts'},...state.accounts.map(a=>({value:a.name,label:a.name}))]}/><Choice label="Filter by signal family" value={family} onChange={setFamily} options={[{value:'all',label:'All signal families'},...state.signals.map(s=>({value:s.family,label:s.family}))]}/></div>{rows.length?<Table><TableHeader><TableRow><TableHead>Account & signal</TableHead><TableHead>Signal family</TableHead><TableHead>Published date</TableHead><TableHead>Assessment</TableHead><TableHead><span className="sr-only">Open result</span></TableHead></TableRow></TableHeader><TableBody>{rows.slice((page-1)*10,page*10).map(r=><TableRow key={r.id} className="signal-row"><TableCell><div className="result-primary"><Avatar name={r.account}/><div><span className="account-small">{r.account}</span><button className="result-title" onClick={()=>open(r)}>{r.title}</button><span className="result-domain">{domain(r.url)}</span></div></div></TableCell><TableCell><span className="family-label">{r.family}</span></TableCell><TableCell><span className="date-cell">{r.published||'Not supplied'}</span></TableCell><TableCell><Status text={resultStatus(r,state.revision)}/></TableCell><TableCell><button className="icon-button" aria-label={'View '+r.title} onClick={()=>open(r)}><ChevronRight size={18}/></button></TableCell></TableRow>)}</TableBody></Table>:<Empty title="No results in this view" description="Try another account, signal family or keyword."/>}<Pages page={page} total={rows.length} setPage={setPage}/></section>;
}

function Context({state,save,runClientIntelligence,runningClientIntelligence,openCriteria}:{state:WorkspaceState;save:(c:Client)=>void;runClientIntelligence:()=>void;runningClientIntelligence: boolean;openCriteria:()=>void}){
 const [draft,setDraft]=useState(state.client);
 useEffect(()=>{setDraft(state.client);},[state.client]);
 const update=(key:keyof Client,v:unknown)=>setDraft(s=>({...s,[key]:v}));
 return <div className="context-layout"><section className="panel padded"><div className="section-heading"><div><h2>The business you're selling for</h2><p>This context defines which opportunities matter.</p></div><span className="step-label">01 / SELECT</span></div><form onSubmit={e=>{e.preventDefault();if(!safeUrl(draft.website)){toast.error('Enter a valid http or https website.');return;}save(draft);}}><div className="form-grid"><Field label="Client company"><Input aria-label="Client company" value={draft.name} required onChange={e=>update('name',e.target.value)}/></Field><Field label="Business unit in focus"><Input aria-label="Business unit in focus" value={draft.businessUnit} required onChange={e=>update('businessUnit',e.target.value)}/></Field><Field label="Website"><Input aria-label="Client website" type="url" value={draft.website} required onChange={e=>update('website',e.target.value)}/></Field><Field label="Company LinkedIn"><Input aria-label="Company LinkedIn" type="url" value={draft.linkedin} onChange={e=>update('linkedin',e.target.value)}/></Field></div><Field label="Company description"><Textarea aria-label="Company description" value={draft.description} rows={6} onChange={e=>update('description',e.target.value)}/></Field><Field label="Services sold" hint="One service per line. Keep the selected business unit as the commercial focus."><Textarea aria-label="Services sold" rows={6} value={draft.services.join('\n')} onChange={e=>update('services',e.target.value.split('\n'))}/></Field><Field label="Typical problems solved"><Textarea aria-label="Typical problems solved" rows={5} value={draft.problems.join('\n')} onChange={e=>update('problems',e.target.value.split('\n'))}/></Field><Field label="Typical engagements"><Textarea aria-label="Typical engagements" rows={5} value={draft.engagements.join('\n')} onChange={e=>update('engagements',e.target.value.split('\n'))}/></Field><Field label="Ideal buying situations"><Textarea aria-label="Ideal buying situations" rows={5} value={draft.buyingSituations.join('\n')} onChange={e=>update('buyingSituations',e.target.value.split('\n'))}/></Field><div className="form-footer">
  <span>Changes mark existing assessments for review.</span>
  <div className="flex gap-2">
    <Button
      type="button"
      variant="outline"
      onClick={runClientIntelligence}
    >
      {runningClientIntelligence
    ? 'Running client intelligence...'
    : 'Run Client Intelligence'}
    </Button>
    <Button type="submit">Save client context</Button>
  </div>
</div></form></section><aside className="context-aside"><section className="focus-card"><Target size={24}/><span>YOUR COMMERCIAL LENS</span><h3>{state.client.businessUnit}</h3><p>Every signal and conversation should connect to this specific business unit.</p><Button variant="secondary" onClick={openCriteria}><SlidersHorizontal size={16}/>Edit qualification criteria</Button></section><section className="panel padded"><h3>How context travels</h3><ol className="context-steps"><li><span>1</span><div><strong>Understand the offering</strong><p>Services, problems and buying situations.</p></div></li><li><span>2</span><div><strong>Define what to watch</strong><p>Observable events connected to the business unit.</p></div></li><li><span>3</span><div><strong>Qualify the evidence</strong><p>Relevance first. Conversation potential second.</p></div></li></ol></section><p className="subtle-note">Imported research belongs to the original Aranca dataset. Editing context does not rerun extraction, regenerate signals or replace search evidence.</p></aside></div>;
}

function Accounts({
  accounts,
  open,
  add,
  intelligenceCreated,
  deleteAccount,
  deleteAllAccounts,
}:{
  accounts:Account[];
  open:(a:Account)=>void;
  add:()=>void;
  intelligenceCreated:Set<string>;
  deleteAccount:(account:Account)=>Promise<void>;
  deleteAllAccounts:()=>Promise<void>;
}){
 const [search,setSearch]=useState('');const [filter,setFilter]=useState('all');const [page,setPage]=useState(1);
 const rows=accounts.filter(a=>a.name.toLowerCase().includes(search.toLowerCase())&&(filter==='all'||filter==='created'&&intelligenceCreated.has(a.id)||filter==='pending'&&!intelligenceCreated.has(a.id)));useEffect(()=>setPage(1),[search,filter]);
 return <><div className="compact-summary"><span><strong>{accounts.length}</strong> named accounts</span><span><strong>{accounts.filter(a=>intelligenceCreated.has(a.id)).length}</strong> with intelligence</span><span><strong>{accounts.filter(a=>!intelligenceCreated.has(a.id)).length}</strong> pending intelligence</span></div><section className="panel"><div className="table-tools"><SearchBox value={search} setValue={setSearch} placeholder="Search named accounts"/><Choice label="Intelligence status" value={filter} onChange={setFilter} options={[{value:'all',label:'All accounts'},{value:'created',label:'Intelligence Created'},{value:'pending',label:'Pending Intelligence'}]}/><ExportButton onClick={()=>download('VisionScaleX-accounts.csv',csv(rows.map(a=>({ca_name:a.name,ca_website:a.website,ca_linkedin_url:a.linkedin,ca_company_description:a.description,ca_services_being_sold:a.services}))),'text/csv;charset=utf-8')}/>
<Button
  variant="outline"
  disabled={accounts.length === 0}
  onClick={deleteAllAccounts}
>
  Delete All Named Accounts
</Button>
</div>{rows.length?<Table><TableHeader><TableRow><TableHead>Company</TableHead><TableHead>Website</TableHead><TableHead>Intelligence</TableHead><TableHead>Queries prepared</TableHead><TableHead/></TableRow></TableHeader><TableBody>{rows.slice((page-1)*10,page*10).map((a,i)=><TableRow key={a.id}><TableCell><button className="account-link" onClick={()=>open(a)}><Avatar name={a.name} index={i}/><strong>{a.name}</strong></button></TableCell><TableCell>{safeUrl(a.website)?<a className="external-link" href={safeUrl(a.website)} target="_blank" rel="noreferrer">{domain(a.website)}<ArrowUpRight size={13}/></a>:'Not supplied'}</TableCell><TableCell><Status text={intelligenceCreated.has(a.id)?'Intelligence Created':'Pending Intelligence'}/></TableCell><TableCell><span className="query-count">{queries.filter(q=>q.account===a.name&&q.query).length}<span> / {queries.filter(q=>q.account===a.name).length}</span></span></TableCell><TableCell>
  <div className="flex items-center gap-2">
    <button aria-label={'View '+a.name} className="icon-button" onClick={()=>open(a)}>
      <ChevronRight size={18}/>
    </button>
    <Button
      variant="outline"
      onClick={()=>deleteAccount(a)}
    >
      Delete
    </Button>
  </div>
</TableCell></TableRow>)}</TableBody></Table>:<Empty title="No matching accounts" description="Add a named account or try another search."/>}<Pages page={page} total={rows.length} setPage={setPage}/></section></>;
}

function Signals({signals,open,toggle,onGenerate,generating}:{signals:Signal[];open:(s:Signal)=>void;toggle:(id:string)=>void;onGenerate:()=>void;generating:boolean}){
 const [search,setSearch]=useState('');const rows=signals.filter(s=>`${s.family} ${s.event} ${s.category}`.toLowerCase().includes(search.toLowerCase()));
 return <><div className="signal-explainer"><Radar size={20}/><p><strong>{signals.filter(s=>s.enabled).length} signals selected for monitoring.</strong> These are events to look for, not claims that an event has occurred.</p></div><div className="signal-toolbar"><SearchBox value={search} setValue={setSearch} placeholder="Find a signal family"/><Button onClick={onGenerate} disabled={generating}>
  {generating ? 'Generating Signals...' : 'Generate Signals'}
</Button><ExportButton label="Export signal library" onClick={()=>download('VisionScaleX-signal-library.csv',csv(signals.map(s=>({signal_number:Number(s.id),category_name:s.category,signal_family:s.family,observable_event:s.event,company_archetype_revealed:s.archetype,underlying_buying_condition:s.condition,why_it_matters:s.why,likely_buyer_persona:s.buyers,likely_buying_window:s.window,signal_strength:s.strength,illustrative_discovery_query:s.query}))),'text/csv;charset=utf-8')}/></div><div className="signal-grid">{rows.map(s=><article className={'signal-card '+(!s.enabled?'muted-card':'')} key={s.id}><div className="signal-card-top"><span className="signal-index">{String(s.id).padStart(2,'0')}</span><span>{s.category}</span><Switch checked={s.enabled} aria-label={'Monitor '+s.family} onCheckedChange={()=>toggle(s.id)}/></div><button className="signal-card-title" onClick={()=>open(s)}>{s.family}<ArrowUpRight size={17}/></button><p>{s.event}</p><div className="signal-card-footer"><span className={'strength-tag '+(s.strength==='Very High'?'strong':'')}>{s.strength} potential</span><span><Clock3 size={13}/>{s.window}</span></div></article>)}</div>{!rows.length&&<Empty title="No matching signal definitions" description="Try another keyword."/>}</>;
}
function Queries({state}:{state:WorkspaceState}){
 const [account,setAccount]=useState('all');
 const [filter,setFilter]=useState('all');
 const [search,setSearch]=useState('');
 const [page,setPage]=useState(1);
 const [rows,setRows]=useState<any[]>([]);

 useEffect(()=>{
   let cancelled=false;

   (async()=>{
     try{
        console.log('QUERIES ID CHECK', {
          clientId: (state.client as any).id,
          clientIdNumber: Number((state.client as any).id),
          invalidAccounts: state.accounts
            .map(a => ({
              name: a.name,
              id: a.id,
              numericId: Number(a.id),
            }))
            .filter(a => !Number.isFinite(a.numericId)),
         });
        
        const clientId = Number((state.client as any).id);
        const validAccounts = state.accounts.filter(account =>
         Number.isInteger(Number(account.id)) &&
         Number(account.id) > 0
        );
        const invalidAccounts = state.accounts.filter(account =>
         !Number.isInteger(Number(account.id)) ||
         Number(account.id) <= 0
        );
        if (invalidAccounts.length > 0) {
         console.warn(
          'Skipping accounts with invalid IDs:',
          invalidAccounts.map(account => ({
           name: account.name,
           id: account.id,
          }))
         );
        }

        const results=await Promise.all(
         validAccounts.map(account =>
           api.getAccountSignals(
             clientId,
             Number(account.id)
           )
         )
        );

       if(!cancelled){
         setRows(
           results
             .flat()
             .map((q:any)=>({
               id:String(q.id),
               account:state.accounts.find(
                 a=>Number(a.id)===Number(q.account_id)
               )?.name||'Unknown',
               family:q.signal_family||'',
               objective:q.observable_event||'',
               query:q.search_query||'',
             }))
         );
       }
     }catch(error){
       console.error('SEARCH QUERY LOAD FAILED:',error);
     }
   })();

   return()=>{cancelled=true;};
 },[(state.client as any).id,state.accounts,state.revision]);

 const filteredRows=rows.filter(q=>
   (account==='all'||q.account===account)&&
   (
     filter==='all'||
     (filter==='ready'&&q.query)||
     (filter==='pending'&&!q.query)
   )&&
   `${q.account} ${q.family} ${q.query}`
     .toLowerCase()
     .includes(search.toLowerCase())
 );

 const ready=rows.filter(q=>q.query).length;

 useEffect(()=>setPage(1),[account,filter,search]);

 return <><div className="query-summary panel"><div><span className="eyebrow">QUERY COVERAGE</span><h2>{ready}<span> / {rows.length} prepared</span></h2><p>One query per account, signal family and objective.</p></div><div className="coverage-progress"><div><span>{rows.length?Math.round(ready/rows.length*100):0}% complete</span><strong>{rows.length-ready} awaiting generation</strong></div><Progress value={rows.length?ready/rows.length*100:0}/></div></div><section className="panel"><div className="table-tools"><SearchBox value={search} setValue={setSearch} placeholder="Search accounts, signals or queries…"/><Choice label="Query account" value={account} onChange={setAccount} options={[{value:'all',label:'All accounts'},...state.accounts.map(a=>({value:a.name,label:a.name}))]}/><Choice label="Query status" value={filter} onChange={setFilter} options={[{value:'all',label:'All query rows'},{value:'ready',label:'Prepared queries'},{value:'pending',label:'Awaiting generation'}]}/><ExportButton onClick={()=>download('VisionScaleX-search-queries.csv',csv(filteredRows.map(q=>({ca_name:q.account,'Signal family':q.family,objective:q.objective,search_queries:q.query}))),'text/csv;charset=utf-8')}/></div><div className="query-list">{filteredRows.slice((page-1)*10,page*10).map(q=><article className="query-item" key={q.id}><div className="query-item-heading"><span className="account-small">{q.account}</span><ChevronRight size={12}/><strong>{q.family}</strong><Status text={q.query?'Prepared':'Pending generation'}/></div><p>{q.objective}</p>{q.query?<div className="query-code"><code>{q.query}</code><button aria-label={'Copy query for '+q.account+' '+q.family} className="icon-button" onClick={()=>copy(q.query)}><Copy size={16}/></button></div>:<span className="pending-query">No generated query yet.</span>}</article>)}</div>{!filteredRows.length&&<Empty title="No matching queries" description="Generate search queries or change the filters."/>}<Pages page={page} total={filteredRows.length} setPage={setPage}/></section></>;
}
function Conversations({state,open,review}:{state:WorkspaceState;open:(r:Result)=>void;review:()=>void}){
 const [tab,setTab]=useState('ready');const ready=state.results.filter(r=>canConverse(r,state.revision)&&r.qbc==='YES');const possible=state.results.filter(r=>canConverse(r,state.revision)&&r.qbc==='POSSIBLE');const hold=state.results.filter(r=>['YES','POSSIBLE'].includes(r.qbc)&&!canConverse(r,state.revision));const rows=tab==='ready'?ready:tab==='possible'?possible:hold;
 return <><div className="conversation-banner"><MessageSquareText size={25}/><div><h2>A specific reason to talk.</h2><p>Each conversation connects an observed event, a plausible need and your contribution. Commercial fit is assessed separately.</p></div></div><section className="panel"><Tabs className="filter-tabs" value={tab} onValueChange={setTab}><TabsList>{[['ready','Ready to engage',ready.length],['possible','Validate the angle',possible.length],['hold','On hold',hold.length]].map(([key,label,count])=><TabsTrigger value={String(key)} key={key}>{label}<span>{count}</span></TabsTrigger>)}</TabsList></Tabs>{rows.length?<div className="conversation-list">{rows.map(r=><article key={r.id}><div className="conversation-top"><Avatar name={r.account}/><div><span className="account-small">{r.account}</span><h3>{r.title}</h3></div><Status text={tab==='hold'?'On hold':pretty(r.qbc)}/></div><p>{r.qbcReason||'The imported QBC decision has no supporting rationale. Review the evidence before treating this as an opportunity.'}</p>{r.qbcAngle&&<blockquote>{r.qbcAngle}</blockquote>}<div className="conversation-actions"><span>Commercial fit: {r.commercialScore??'Unknown'}{r.commercialScore?' / 5':''}</span>{r.qbcAngle&&<Button variant="outline" onClick={()=>copy(r.qbcAngle)}><Copy size={14}/>Copy question</Button>}<Button variant="outline" onClick={()=>open(r)}>Review evidence<ArrowUpRight size={14}/></Button></div></article>)}</div>:<Empty title={tab==='ready'?'No conversations ready yet':tab==='possible'?'No conversation hypotheses to validate':'No conversations on hold'} description={tab==='ready'?'Complete the evidence and QBC assessment to bring a defensible opportunity into this queue.':'Qualified results appear here after a supported assessment.'}/>}<div className="queue-footer"><Button variant="outline" onClick={review}>Review signal assessments<ArrowRight size={15}/></Button><span>QBC = Qualified Business Conversation</span></div></section></>;
}

function ResultDetail({result:r,revision,save}:{result:Result;revision:number;save:(r:Result)=>void}){
 const [tab,setTab]=useState('evidence');const [draft,setDraft]=useState<Result>({...r,trigger:r.trigger||'OTHER',strength:r.strength??1});const [error,setError]=useState('');const issues=reviewIssues(r,revision);const set=(key:keyof Result,value:unknown)=>setDraft(s=>({...s,[key]:value}));
 const submit=(e:React.FormEvent)=>{e.preventDefault();const next={...draft,reason:draft.reason.trim(),qbcReason:draft.qbcReason.trim(),qbcAngle:['YES','POSSIBLE'].includes(draft.qbc)?draft.qbcAngle.trim():'',reviewedManually:true,criteriaRevision:revision};const error=validateReview(next);if(error){setError(error);return;}save(next);setError('');setTab('evidence');toast.success('Assessment saved on this device');};
 return <><SheetHeader className="detail-header"><span className="eyebrow">ACCOUNT SIGNAL Â· {r.id.toUpperCase()}</span><SheetTitle>{r.title}</SheetTitle><SheetDescription>{r.account} Â· {r.family}</SheetDescription><div className="detail-status"><Status text={resultStatus(r,revision)}/><span>{r.reviewedManually?'Manually reviewed':'Imported workbook'}</span></div></SheetHeader><Tabs value={tab} onValueChange={setTab} className="detail-tabs"><TabsList><TabsTrigger value="evidence">Source & evidence</TabsTrigger><TabsTrigger value="assessment">Review assessment</TabsTrigger></TabsList></Tabs><div className="detail-body">{tab==='evidence'?<>{issues.length>0&&<div className="review-warning"><CircleAlert size={18}/><div><strong>Resolve before outreach</strong><ul>{issues.map(x=><li key={x}>{x}</li>)}</ul><button onClick={()=>setTab('assessment')}>Review this assessment <ArrowRight size={14}/></button></div></div>}<div className="evidence-source"><span className="source-icon"><Globe2 size={18}/></span><div><strong>{domain(r.url)}</strong><span>Published: {r.published||'Not supplied'}</span></div>{safeUrl(r.url)&&<a href={safeUrl(r.url)} target="_blank" rel="noreferrer" aria-label="Open original source"><ArrowUpRight size={20}/></a>}</div><section className="detail-section"><h3>Observed source snippet</h3><blockquote>{r.description||'No source description supplied.'}</blockquote><p className="subtle-note">Imported search evidence. Publication dates may differ from event dates. The linked page has not been rechecked.</p></section><section className="detail-section"><h3>What we were looking for</h3><p>{r.objective}</p><code className="query-block">{r.query}</code></section><section className="detail-section"><div className="section-title-row"><h3>Relevance assessment</h3><span>{r.strength??'â€”'} / 5 evidence</span></div><div className="metadata-grid"><div><span>Decision</span><strong>{pretty(r.relevance)}</strong></div><div><span>Observed trigger</span><strong>{pretty(r.trigger)}</strong></div><div><span>Buyer role</span><strong>{pretty(r.buyerRole)}</strong></div><div><span>Assessment origin</span><strong>{r.reviewedManually?'Manual review':'Supplied workbook'}</strong></div></div><p>{r.reason||'This result has not yet been assessed.'}</p></section><section className="detail-section"><div className="section-title-row"><h3>Conversation potential</h3><Status text={pretty(r.qbc)}/></div><p>{r.qbcReason||'No event-specific QBC rationale was supplied.'}</p>{r.qbcAngle&&<blockquote>{r.qbcAngle}</blockquote>}<div className="fit-score"><strong>{r.commercialScore??'â€”'}<small> / 5</small></strong><div><b>Account commercial fit</b><span>Independent of the conversation decision</span></div></div><p>{r.commercialReason||'Commercial fit has not been assessed.'}</p>{r.offering&&<p><b>Target offering:</b> {r.offering}</p>}{r.targetCustomer&&<p><b>Target customers:</b> {r.targetCustomer}</p>}{r.bottlenecks&&<p><b>Potential needs:</b> {r.bottlenecks}</p>}</section><Button className="full-width" onClick={()=>setTab('assessment')}>Review assessment<ArrowRight size={16}/></Button></>:<form onSubmit={submit} className="review-form"><p className="form-intro">Review this result against your criteria using the evidence provided. These are manual decisions; no AI evaluation is run.</p><div className="form-grid"><Field label="Relevance decision"><Choice label="Relevance decision" value={draft.relevance||'unassessed'} onChange={v=>{set('relevance',v);set('strength',v==='RELEVANT'?4:v==='PARTIALLY_RELEVANT'?3:1);}} options={[{value:'unassessed',label:'Choose a decision'},...relevanceValues.map(v=>({value:v,label:pretty(v)}))]}/></Field><Field label="Evidence strength"><Choice label="Evidence strength" value={String(draft.strength??1)} onChange={v=>set('strength',Number(v))} options={[1,2,3,4,5].map(n=>({value:String(n),label:`${n} / 5`}))}/></Field><Field label="Observed trigger"><Choice label="Observed trigger" value={draft.trigger||'OTHER'} onChange={v=>set('trigger',v)} options={triggers.map(v=>({value:v,label:pretty(v)}))}/></Field><Field label="Evidenced buyer role"><Choice label="Evidenced buyer role" value={draft.buyerRole} onChange={v=>set('buyerRole',v)} options={['ECONOMIC','INFLUENCER','OPERATOR','UNKNOWN'].map(v=>({value:v,label:pretty(v)}))}/></Field></div><Field label="Relevance reason" hint={`${draft.reason.length} / 400 characters`}><Textarea aria-label="Relevance reason" rows={4} maxLength={400} value={draft.reason} onChange={e=>set('reason',e.target.value)}/></Field><hr/><h3>Qualified Business Conversation</h3><div className="form-grid"><Field label="QBC decision"><Choice label="QBC decision" value={draft.qbc||'unassessed'} onChange={v=>set('qbc',v==='unassessed'?'':v)} options={[{value:'unassessed',label:'Not assessed'},...qbcValues.map(v=>({value:v,label:pretty(v)}))]}/></Field><Field label="Account commercial fit"><Choice label="Account commercial fit" value={String(draft.commercialScore??'unknown')} onChange={v=>set('commercialScore',v==='unknown'?null:Number(v))} options={[{value:'unknown',label:'Unknown'},...[1,2,3,4,5].map(n=>({value:String(n),label:`${n} / 5`}))]}/></Field></div><Field label="QBC rationale" hint="Connect the observed event, potential need and seller contribution. State any evidence gap."><Textarea aria-label="QBC rationale" maxLength={600} rows={4} value={draft.qbcReason} onChange={e=>set('qbcReason',e.target.value)}/></Field>{['YES','POSSIBLE'].includes(draft.qbc)&&<Field label="Exploratory question" hint="An evidence-based question to open a conversation; maximum 260 characters."><Textarea aria-label="Exploratory question" maxLength={260} rows={3} value={draft.qbcAngle} onChange={e=>set('qbcAngle',e.target.value)}/></Field>}<Field label="Commercial fit reason"><Textarea aria-label="Commercial fit reason" rows={3} maxLength={320} value={draft.commercialReason} onChange={e=>set('commercialReason',e.target.value)}/></Field>{error&&<p role="alert" className="form-error">{error}</p>}<Button type="submit" className="full-width"><CheckCheck size={16}/>Save assessment</Button></form>}</div></>;
}

function AccountDetail({account:a,clientId,onIntelligenceCreated}:{account:Account;clientId:number;onIntelligenceCreated:()=>void}){
 const [intelligence,setIntelligence]=useState<{
   id:number;
   account_id:number;
   website_scraped_text:string;
   cc_location:string[];
   cc_description:string;
   cc_services_being_sold:string[];
   cc_service_description:unknown[];
   cc_typical_promblems_we_solve:string[];
   cc_typical_engagements:string[];
   cc_ideal_buying_situations:string[];
   cc_known_affairs_subsidiaries:string[];
   cc_parent_company:string;
   cc_alternate_names_abbreviations:string[];
 }|null>(null);
 const [loading,setLoading]=useState(true);
 const [running,setRunning]=useState(false);
 const [error,setError]=useState('');

 async function loadIntelligence(){
   setLoading(true);
   setError('');
   try{
     const data=await api.getAccountIntelligence(clientId,Number(a.id));
     setIntelligence(data);
   }catch{
     setIntelligence(null);
   }finally{
     setLoading(false);
   }
 }

 useEffect(()=>{loadIntelligence();},[clientId,a.id]);

 async function runIntelligence(){
   setRunning(true);
   setError('');
   try{
     await api.generateAccountIntelligence(clientId,Number(a.id));
      onIntelligenceCreated();
     await loadIntelligence();
     toast.success('Account intelligence generated and saved');
   }catch(error){
     console.error('ACCOUNT INTELLIGENCE FAILED:',error);
     setError('Could not generate account intelligence.');
     toast.error('Could not generate account intelligence.');
   }finally{
     setRunning(false);
   }
 }

 const hasIntelligence=!!intelligence;

 return <><SheetHeader className="detail-header"><div className="account-detail-heading"><Avatar name={a.name}/><div><SheetTitle>{a.name}</SheetTitle><SheetDescription>Named account Â· Company intelligence</SheetDescription></div></div><div><Status text={hasIntelligence?'Intelligence Created':'Pending Intelligence'}/></div></SheetHeader><div className="detail-body"><div className="link-row">{safeUrl(a.website)&&<a href={safeUrl(a.website)} target="_blank" rel="noreferrer"><Globe2 size={16}/>Website<ArrowUpRight size={13}/></a>}{safeUrl(a.linkedin)&&<a href={safeUrl(a.linkedin)} target="_blank" rel="noreferrer"><Link2 size={16}/>LinkedIn<ArrowUpRight size={13}/></a>}</div>{loading?<div className="detail-section"><p>Loading saved company intelligence...</p></div>:hasIntelligence?<><div className="detail-section"><Button className="full-width" onClick={runIntelligence} disabled={running}>{running?'Running intelligence...':'Run Intelligence Again'}</Button></div><DetailSection title="Company description" content={intelligence.cc_description}/><DetailList title="Services sold" items={intelligence.cc_services_being_sold}/><DetailList title="Typical problems solved for its customers" items={intelligence.cc_typical_promblems_we_solve}/><DetailList title="Typical engagements" items={intelligence.cc_typical_engagements}/><DetailList title="Its ideal buying situations" items={intelligence.cc_ideal_buying_situations}/><DetailList title="Locations / market presence" items={intelligence.cc_location}/><DetailSection title="Parent company" content={intelligence.cc_parent_company}/><DetailList title="Known subsidiaries" items={intelligence.cc_known_affairs_subsidiaries}/><DetailList title="Alternate names" items={intelligence.cc_alternate_names_abbreviations}/><p className="subtle-note">These fields describe what the target sells to its own customers. They do not establish the targetâ€™s current needs or buying intent.</p></>:<><Empty title="Company intelligence is not available yet" description="The account is saved. Run intelligence to extract and structure its company context from the backend workflow."/><Button className="full-width" onClick={runIntelligence} disabled={running}>{running?'Running intelligence...':'Run Intelligence'}</Button></>}{error&&<p role="alert" className="form-error">{error}</p>}</div></>;}
function DetailSection({title,content}:{title:string;content:string}){return <section className="detail-section"><h3>{title}</h3><p>{content||'Not supplied'}</p></section>;}
function DetailList({title,items}:{title:string;items:unknown[]}){return <section className="detail-section"><h3>{title}</h3>{items.length?<ul className="detail-list">{items.map((x,i)=><li key={i}>{typeof x==='string'?x:JSON.stringify(x)}</li>)}</ul>:<p className="subtle-note">Not supplied</p>}</section>;}
function SignalDetail({signal:s}:{signal:Signal}){return <><SheetHeader className="detail-header"><span className="eyebrow">SIGNAL DEFINITION Â· {String(s.id).padStart(2,'0')}</span><SheetTitle>{s.family}</SheetTitle><SheetDescription>{s.category} Â· A hypothesis to monitor</SheetDescription></SheetHeader><div className="detail-body"><DetailSection title="Observable event" content={s.event}/><DetailSection title="Company archetype revealed" content={s.archetype}/><DetailSection title="Underlying buying condition" content={s.condition}/><DetailSection title="Why it matters" content={s.why}/><DetailList title="Likely buyer personas" items={s.buyers}/><div className="metadata-grid"><div><span>Potential buying window</span><strong>{s.window}</strong></div><div><span>Potential signal strength</span><strong>{s.strength}</strong></div></div><section className="detail-section"><h3>Illustrative discovery query</h3><code className="query-block">{s.query}</code><Button variant="outline" onClick={()=>copy(s.query)}><Copy size={15}/>Copy query</Button></section><p className="subtle-note">Personas, timing and strength describe a research hypothesis. A search result must independently establish the observed event and the actual buying window.</p></div></>;}
function AddClient({
  add,
}: {
  add: (client: {
    company_name: string;
    website: string;
    linkedin_url: string;
    bu_in_focus: string;
  }) => void;
}) {
  const [name,setName]=useState('');
  const [website,setWebsite]=useState('');
  const [linkedin,setLinkedin]=useState('');
  const [businessUnit,setBusinessUnit]=useState('');
  const [error,setError]=useState('');

  return (
    <>
      <form
        onSubmit={e=>{
          e.preventDefault();
          setError('');

          if(!name.trim()){
            setError('Enter the company name.');
            return;
          }

          if(!safeUrl(website)){
            setError('Enter a valid http or https website.');
            return;
          }

          if(linkedin && !safeUrl(linkedin)){
            setError('Enter a valid LinkedIn URL.');
            return;
          }

          add({
            company_name:name.trim(),
            website:website.trim(),
            linkedin_url:linkedin.trim(),
            bu_in_focus:businessUnit.trim(),
          });
        }}
      >
        <Field label="Company name">
          <Input
            aria-label="Client company name"
            placeholder="e.g. Example Energy"
            value={name}
            onChange={e=>setName(e.target.value)}
            required
          />
        </Field>

        <Field label="Company website">
          <Input
            aria-label="Client website"
            placeholder="https://company.com"
            value={website}
            onChange={e=>setWebsite(e.target.value)}
            type="url"
            required
          />
        </Field>

        <Field label="LinkedIn URL (optional)">
          <Input
            aria-label="Client LinkedIn URL"
            placeholder="https://linkedin.com/company/..."
            value={linkedin}
            onChange={e=>setLinkedin(e.target.value)}
            type="url"
          />
        </Field>

        <Field label="Business unit in focus">
          <Input
            aria-label="Business unit in focus"
            placeholder="e.g. Technology"
            value={businessUnit}
            onChange={e=>setBusinessUnit(e.target.value)}
          />
        </Field>

        {error&&<p role="alert" className="form-error">{error}</p>}

        <Button className="full-width" type="submit">
          <Plus size={16}/>
          Add client
        </Button>
      </form>
    </>
  );
}
function AddAccounts({existing,add}:{existing:Account[];add:(a:Account[])=>Promise<void>;}){
 const [tab,setTab]=useState('single');const [name,setName]=useState('');const [website,setWebsite]=useState('');const [linkedin,setLinkedin]=useState('');const [error,setError]=useState('');const [preview,setPreview]=useState<Account[]>([]);const [skipped,setSkipped]=useState(0);const [fileName,setFileName]=useState('');
const [importing, setImporting] = useState(false);
const [importStatus, setImportStatus] = useState('');

const normalizeAccountUrl = (value: string) => {
  try {
    const url = new URL(value.trim());
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    const path = url.pathname.replace(/\/+$/, '').toLowerCase();
    return `${host}${path}`;
  } catch {
    return value.trim().toLowerCase().replace(/\/+$/, '');
  }
};

 async function importFile(file?:File){setError('');setPreview([]);setImportStatus('');if(!file)return;setImporting(true);
  setImportStatus('Reading CSV file...');if(file.size>1024*1024){setError('Use a CSV smaller than 1 MB.');return;}setImporting(true);
  setImportStatus('Reading CSV file...');try{setImportStatus('Reading and validating CSV rows...');const rows=parseCsv((await file.text()).replace(/^\uFEFF/,''));const headers=rows.shift()?.map(x=>x.trim().toLowerCase())||[];const ni=headers.findIndex(x=>['ca_name','company','name','company name'].includes(x));const wi=headers.findIndex(x=>['ca_website','website','company website'].includes(x));const li=headers.findIndex(x=>['ca_linkedin_url','linkedin','linkedin url'].includes(x));if(ni<0||wi<0)throw Error('Use ca_name and ca_website columns, with optional ca_linkedin_url.');

const accountKey = (a: Account) => {
  const linkedin = a.linkedin?.trim();
  if (linkedin) {
    return `linkedin:${normalizeAccountUrl(linkedin)}`;
  }
  return `website:${normalizeAccountUrl(a.website)}`;
};

const seen = new Set(existing.map(accountKey));
const next: Account[] = [];
let duplicates = 0;

for (const row of rows) {
  const n = (row[ni] || '').trim();
  const w = (row[wi] || '').trim();
  const l = (row[li] || '').trim();

  if (!n || !safeUrl(w)) {
    throw Error('Every row needs a company name and a valid http or https website.');
  }

  if (l && !safeUrl(l)) {
    throw Error('A LinkedIn URL is invalid.');
  }

  const key = l
    ? `linkedin:${normalizeAccountUrl(l)}`
    : `website:${normalizeAccountUrl(w)}`;


if(seen.has(key)){
  duplicates++;
  continue;
}

seen.add(key);
next.push(blankAccount(n,w,l));}if(!next.length)throw Error('No new accounts found. The rows are empty or already in your universe.');setPreview(next);setImportStatus(
  `CSV checked: ${next.length} new accounts found; ${duplicates} duplicates skipped.`
);setSkipped(duplicates);setFileName(file.name);} catch (e) {
  setError((e as Error).message);
} finally {
  setImporting(false);
}}
 return <><DialogHeader><DialogTitle>Add named accounts</DialogTitle><DialogDescription>Start with the company name and website. Company intelligence is a separate step.</DialogDescription></DialogHeader><Tabs value={tab} onValueChange={v=>{setTab(v);setError('');}}><TabsList className="full-width"><TabsTrigger value="single">One account</TabsTrigger><TabsTrigger value="csv">Import CSV</TabsTrigger></TabsList></Tabs>{tab==='single'?<form onSubmit={e=>{e.preventDefault();setError('');if(!safeUrl(website)||(linkedin&&!safeUrl(linkedin))){setError('Enter a valid http or https URL.');return;}if(existing.some(a=>{
  const existingLinkedin=a.linkedin?.trim().toLowerCase();
  if(linkedin.trim()){
    return existingLinkedin===linkedin.trim().toLowerCase();
  }
  return !existingLinkedin &&
    a.website.trim().toLowerCase()===website.trim().toLowerCase();
})){setError('This company is already in your account universe.');return;}if(!name.trim()){setError('Enter the company name.');return;}add([blankAccount(name.trim(),website.trim(),linkedin.trim())]);}}><Field label="Company name"><Input aria-label="Company name" placeholder="e.g. Example Energy" value={name} onChange={e=>setName(e.target.value)} required/></Field><Field label="Company website"><Input aria-label="Company website" placeholder="https://company.com" value={website} onChange={e=>setWebsite(e.target.value)} type="url" required/></Field><Field label="LinkedIn URL (optional)"><Input aria-label="Account LinkedIn URL" placeholder="https://linkedin.com/company/â€¦" value={linkedin} onChange={e=>setLinkedin(e.target.value)} type="url"/></Field>{error&&<p role="alert" className="form-error">{error}</p>}<Button className="full-width" type="submit"><Plus size={16}/>Add account</Button></form>:<div><label className="upload-zone"><Upload size={28}/><strong>Select an account CSV</strong><span>ca_name, ca_website, ca_linkedin_url up to 1 MB</span><Input aria-label="Import accounts CSV" type="file" accept=".csv,text/csv" onChange={e=>importFile(e.target.files?.[0])}/></label><button className="text-action" onClick={()=>download('VisionScaleX-account-template.csv','ca_name,ca_website,ca_linkedin_url\r\n','text/csv;charset=utf-8')}><Download size={14}/>Download CSV template</button>{error&&<p role="alert" className="form-error">{error}</p>}
{importStatus && (
  <p role="status" aria-live="polite" className="subtle-note">
    {importStatus}
  </p>
)}
{preview.length>0&&<div className="import-preview"><strong>{fileName}</strong><p>{preview.length} new accounts {skipped} duplicates skipped</p><ul>{preview.slice(0,4).map(a=><li key={a.id}>{a.name}</li>)}</ul>
<Button
  className="full-width"
  disabled={importing}
  onClick={async () => {
    setImporting(true);
    setImportStatus(`Importing ${preview.length} accounts...`);
    setError('');

    try {
      await add(preview);
      setImportStatus(`Import complete: ${preview.length} accounts imported; ${skipped} duplicates skipped.`);
      setPreview([]);
    } catch (e) {
      setError((e as Error).message || 'Import failed.');
      setImportStatus('Import failed.');
    } finally {
      setImporting(false);
    }
  }}
>
  {importing ? 'Importing accounts...' : `Import ${preview.length} accounts`}
</Button>
</div>}</div>}</>;
}
function CriteriaEditor({criteria,save}:{criteria:Criteria;save:(c:Criteria)=>void}){const [draft,setDraft]=useState(criteria);return <><DialogHeader><DialogTitle>Qualification criteria</DialogTitle><DialogDescription>Keep the evidence decision separate from the commercial conversation decision.</DialogDescription></DialogHeader><form onSubmit={e=>{e.preventDefault();save(draft);}}><Field label="1. Relevance criteria" hint="Specify must-have conditions, exclusions, geography and any date window."><Textarea aria-label="Relevance criteria" rows={6} value={draft.relevance} onChange={e=>setDraft(s=>({...s,relevance:e.target.value}))}/></Field><Field label="2. QBC criteria" hint="Define what creates a credible reason to engage the account with this offering."><Textarea aria-label="QBC criteria" rows={6} value={draft.qbc} onChange={e=>setDraft(s=>({...s,qbc:e.target.value}))}/></Field><p className="subtle-note">Blank fields use the defaults in your supplied prompts. Saving changes flags existing assessments for review; it does not rerun them.</p><Button type="submit" className="full-width">Save qualification criteria</Button></form></>;}
function RunPlanner({state}:{state:WorkspaceState}){
 const [account,setAccount]=useState('all');const [limit,setLimit]=useState('10');const signals=state.signals.filter(s=>s.enabled);const accounts=state.accounts.filter(a=>account==='all'||a.name===account);const all=queries.filter(q=>accounts.some(a=>a.name===q.account)&&signals.some(s=>s.family===q.family));const ready=all.filter(q=>q.query);const missing=accounts.length*signals.length-ready.length;
 return <><DialogHeader><DialogTitle>Prepare a monitoring run</DialogTitle><DialogDescription>Review the scope and export a run plan for your processing workflow.</DialogDescription></DialogHeader><div className="run-notice"><CircleAlert size={17}/><p>Live execution is not connected. This prepares the inputs and queries; it does not run searches or call AI.</p></div><Field label="Accounts to include"><Choice label="Run accounts" value={account} onChange={setAccount} options={[{value:'all',label:`All ${state.accounts.length} named accounts`},...state.accounts.map(a=>({value:a.name,label:a.name}))]}/></Field><Field label="Maximum results per query"><Choice label="Maximum results per query" value={limit} onChange={setLimit} options={[{value:'10',label:'10 results'},{value:'20',label:'20 results'}]}/></Field><div className="run-counts"><div><strong>{accounts.length}</strong><span>accounts</span></div><div><strong>{signals.length}</strong><span>active signals</span></div><div><strong>{ready.length}</strong><span>prepared queries</span></div></div><div className="run-details"><p><span>Queries still to generate</span><strong>{missing}</strong></p><p><span>Maximum results from prepared queries</span><strong>{ready.length*Number(limit)}</strong></p><p><span>Relevance & QBC criteria</span><strong>Included</strong></p></div><Button className="full-width" disabled={!accounts.length||!signals.length} onClick={()=>{download('VisionScaleX-monitoring-run-plan.json',JSON.stringify({kind:'monitoring_run_plan',execution:'not_started',created_at:new Date().toISOString(),seller_reference:state.client,criteria:state.criteria,accounts,signal_catalog:signals,prepared_queries:ready,queries_to_generate:missing,max_results_per_query:Number(limit),requirements:['Generate missing account-specific queries','Run public-web searches server-side','Apply relevance criteria','Evaluate QBC independently of account commercial fit']},null,2));toast.success('Run plan downloaded. No searches were executed.');}}><Download size={16}/>Download run plan</Button></>;
}





