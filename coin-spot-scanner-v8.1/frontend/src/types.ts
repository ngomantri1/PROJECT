export type Policy = 'ALWAYS_REFRESH' | 'REFRESH_IF_STALE' | 'USE_LATEST_VALID'
export type StepSchedule = {id:number;step_key:string;sequence:number;auto_enabled:boolean;interval_minutes:number;total_scan_policy:Policy;notify_on_complete:boolean;last_run_at:string|null;next_run_at:string|null}
export type Profile = {id:number;name:string;slug:string;version:number;is_default:boolean;is_active:boolean;config:any;step_schedules:StepSchedule[]}
export type ScanStep = {id:number;step_key:string;sequence:number;status:string;progress:number;message:string;policy:Policy;payload:any;started_at:string|null;finished_at:string|null}
export type Candidate = {id:number;rank:number;symbol:string;name:string;binance_pair:string;stage:string;market_cap_usd:string|null;volume_24h_usd:string|null;quality_score_low:string|null;quality_score_high:string|null;quality_status:string;entry_score:string|null;entry_status:string;opportunity_score:string|null;opportunity_status:string;action:string;risk_codes:string[];details:any}
export type ScanRun = {id:string;profile_name:string;mode_requested:string;mode_validated:string;status:string;current_step:string;progress:number;counters:Record<string,number>;results:any;validation:any;error_message:string;created_at:string;steps:ScanStep[];candidates:Candidate[]}
export type Notification = {id:number;level:string;title:string;message:string;created_at:string}
export type DashboardData = {profile:Profile|null;latest_run:ScanRun|null;notifications:Notification[]}
