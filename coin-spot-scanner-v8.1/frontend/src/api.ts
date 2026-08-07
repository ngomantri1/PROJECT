import type { DashboardData, HealthStatus, Profile, ScanRun, StepSchedule } from './types'
const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'
async function request<T>(path:string, options?:RequestInit):Promise<T>{
  const response = await fetch(`${API}${path}`, {headers:{'Content-Type':'application/json', ...(options?.headers||{})}, ...options})
  const data = await response.json().catch(()=>({}))
  if(!response.ok) throw new Error(data.detail || `HTTP ${response.status}`)
  return data as T
}
export const api = {
  health:()=>request<HealthStatus>('/health/'),
  dashboard:()=>request<DashboardData>('/dashboard/'),
  startScan:(profileId?:number, requestedSteps?:string[])=>request<ScanRun>('/scan-runs/start/',{method:'POST',body:JSON.stringify({profile_id:profileId,requested_steps:requestedSteps})}),
  scan:(id:string)=>request<ScanRun>(`/scan-runs/${id}/`),
  profiles:()=>request<Profile[]>('/profiles/'),
  updateProfile:(id:number, data:any)=>request<Profile>(`/profiles/${id}/`,{method:'PATCH',body:JSON.stringify(data)}),
  cloneProfile:(id:number,name:string)=>request<Profile>(`/profiles/${id}/clone/`,{method:'POST',body:JSON.stringify({name})}),
  activateProfile:(id:number)=>request<Profile>(`/profiles/${id}/activate/`,{method:'POST'}),
  updateSchedule:(id:number,data:Partial<StepSchedule>)=>request<StepSchedule>(`/step-schedules/${id}/`,{method:'PATCH',body:JSON.stringify(data)}),
}
