import { useEffect, useState } from 'react'
import { Alert, App as AntApp, Avatar, Button, Card, Drawer, Empty, Form, InputNumber, Layout, Menu, Modal, Progress, Select, Skeleton, Space, Spin, Switch, Table, Tag, Tooltip, Typography, message } from 'antd'
import { AppstoreOutlined, BarChartOutlined, CaretRightOutlined, CheckCircleOutlined, ExclamationCircleOutlined, FileTextOutlined, HomeOutlined, InfoCircleOutlined, PauseOutlined, PlayCircleOutlined, ReloadOutlined, SafetyCertificateOutlined, SettingOutlined, UnorderedListOutlined, WarningOutlined } from '@ant-design/icons'
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { api } from './api'
import type { Candidate, DashboardData, Notification, Policy, Profile, ScanRun, StepSchedule } from './types'

const { Header, Sider, Content } = Layout

const steps = [
  { key: 'UNIVERSE_SCAN', title: 'Universe Scan', description: 'Quét danh sách thị trường' },
  { key: 'MARKET_REGIME', title: 'Market Regime', description: 'Đánh giá trạng thái thị trường' },
  { key: 'RESEARCH_SHORTLIST', title: 'Research Shortlist', description: 'Lập danh sách nghiên cứu' },
  { key: 'EXECUTION_VERIFICATION', title: 'Execution Verification', description: 'Xác minh dữ liệu thực thi' },
  { key: 'SCORING_VALIDATION', title: 'Scoring & Validation', description: 'Chấm điểm và kiểm định' },
  { key: 'INVESTMENT_RESULTS', title: 'Investment Results', description: 'Kết quả đầu tư' },
] as const

const policyOptions = [
  { value: 'ALWAYS_REFRESH', label: 'Luôn làm mới', help: 'Luôn lấy dữ liệu mới khi chạy quét tổng.' },
  { value: 'REFRESH_IF_STALE', label: 'Khi dữ liệu cũ', help: 'Chỉ lấy lại khi dữ liệu stale hoặc đầu vào thay đổi.' },
  { value: 'USE_LATEST_VALID', label: 'Dùng bản hợp lệ gần nhất', help: 'Dùng kết quả hợp lệ gần nhất nếu vẫn còn freshness.' },
]

const statusMeta: Record<string, { color: string; label: string }> = {
  COMPLETED: { color: 'success', label: 'Hoàn tất' },
  COMPLETED_WITH_WARNINGS: { color: 'warning', label: 'Hoàn tất có cảnh báo' },
  RUNNING: { color: 'processing', label: 'Đang chạy' },
  WAITING: { color: 'default', label: 'Chờ chạy' },
  QUEUED: { color: 'processing', label: 'Đang chờ hàng đợi' },
  FAILED: { color: 'error', label: 'Thất bại' },
  PAUSED: { color: 'default', label: 'Đã tạm dừng' },
  STALE: { color: 'default', label: 'Dữ liệu đã cũ' },
  SKIPPED: { color: 'default', label: 'Đã bỏ qua' },
}

function isCompleted(status?: string) {
  return status === 'COMPLETED' || status === 'COMPLETED_WITH_WARNINGS'
}

function isFinished(status?: string) {
  return isCompleted(status) || status === 'FAILED' || status === 'SKIPPED' || status === 'CANCELLED'
}

function statusTag(status?: string) {
  const meta = statusMeta[status || 'WAITING'] || statusMeta.WAITING
  return <Tag color={meta.color}>{meta.label}</Tag>
}

function formatDate(value?: string | null) {
  if (!value) return 'Chưa có dữ liệu'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Chưa có dữ liệu'
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} · ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function formatShortDate(value?: string | null) {
  const full = formatDate(value)
  return full === 'Chưa có dữ liệu' ? full : full.replace(/\/\d{4} · (\d{2}:\d{2}):\d{2}$/, ' · $1')
}

function friendlyCode(value?: string) {
  const labels: Record<string, string> = {
    UNKNOWN: 'Chưa xác định', NOT_SCORED: 'Chưa chấm điểm', WATCH_ONLY: 'Chỉ theo dõi',
  }
  return labels[value || ''] || value || 'Chưa xác định'
}

function notificationDisplay(notification: Notification) {
  const raw = notification.message || ''
  if (/\b429\b/.test(raw) && /coingecko/i.test(raw)) {
    return {
      title: 'Không thể lấy dữ liệu CoinGecko',
      message: 'Nguồn dữ liệu đang giới hạn tần suất truy cập. Vui lòng thử lại sau ít phút.',
      code: 'HTTP 429', raw,
    }
  }
  return { title: notification.title, message: raw, code: undefined, raw }
}

function policyHelp(value: Policy) {
  return policyOptions.find(option => option.value === value)?.help || 'Chưa có mô tả chính sách.'
}

function Shell() {
  const nav = useNavigate()
  const loc = useLocation()
  const [healthy, setHealthy] = useState<boolean | null>(null)
  const items = [
    { key: '/', icon: <HomeOutlined />, label: 'Tổng quan' },
    { key: '/progress', icon: <BarChartOutlined />, label: 'Tiến trình quét' },
    { key: '/coins', icon: <UnorderedListOutlined />, label: 'Danh sách coin' },
    { key: '/coin', icon: <AppstoreOutlined />, label: 'Chi tiết coin' },
    { key: '/risk', icon: <SafetyCertificateOutlined />, label: 'Risk Register' },
    { key: '/reports', icon: <FileTextOutlined />, label: 'Báo cáo' },
    { key: '/settings', icon: <SettingOutlined />, label: 'Cài đặt' },
  ]

  useEffect(() => {
    let active = true
    api.health().then(() => active && setHealthy(true)).catch(() => active && setHealthy(false))
    return () => { active = false }
  }, [])

  const healthLabel = healthy === true ? 'Ứng dụng đang hoạt động' : healthy === false ? 'Không kết nối được API' : 'Đang kiểm tra ứng dụng'
  const healthColor = healthy === true ? 'success' : healthy === false ? 'error' : 'default'

  return <Layout className="app-shell">
    <Sider width={240} theme="light" className="sidebar">
      <div className="brand"><div className="brand-main">COIN <span>SPOT</span> <b>V8.1</b></div><div>Scanner</div></div>
      <Menu mode="inline" selectedKeys={[loc.pathname]} onClick={({ key }) => nav(key)} items={items} />
      <div className="sidebar-footer"><span>Môi trường: Local</span><span>V8.1 · 0.1.0</span></div>
    </Sider>
    <Layout>
      <Header className="topbar"><Typography.Title level={2} className="page-title">{loc.pathname === '/settings' ? 'Cài đặt Checklist V8.1' : 'Quy trình quét đầu tư V8.1'}</Typography.Title><div className="top-actions"><Tooltip title="Kiểm tra kết nối tới Backend API"><Tag color={healthColor}>{healthLabel}</Tag></Tooltip><Avatar>NT</Avatar><span className="investor-label">Nhà đầu tư</span></div></Header>
      <Content className="content"><Routes><Route path="/" element={<Dashboard />} /><Route path="/settings" element={<Settings />} /><Route path="*" element={<ComingSoon />} /></Routes></Content>
    </Layout>
  </Layout>
}

function ComingSoon() {
  return <Card><Empty description="Module đang được xây dựng" /></Card>
}

function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [starting, setStarting] = useState(false)
  const [notificationOpen, setNotificationOpen] = useState(false)
  const load = async () => {
    try { setData(await api.dashboard()) } catch (error: any) { message.error(error.message) } finally { setLoading(false) }
  }
  useEffect(() => { load(); const timer = setInterval(load, 4000); return () => clearInterval(timer) }, [])
  const start = async (requestedSteps?: string[]) => {
    if (!data?.profile) return
    setStarting(true)
    try { await api.startScan(data.profile.id, requestedSteps); message.success('Đã đưa quy trình vào hàng đợi'); setModal(false); await load() } catch (error: any) { message.error(error.message) } finally { setStarting(false) }
  }
  if (loading && !data) return <div className="dashboard-skeleton"><Skeleton active paragraph={{ rows: 12 }} /></div>

  const run = data?.latest_run
  const latestFailed = run?.status === 'FAILED'
  const resultRun: ScanRun | null = latestFailed ? data?.latest_successful_run || null : run || null
  const runSteps = run?.steps || []
  const resultCounters = resultRun?.counters || {}
  const candidates = (resultRun?.candidates || []).filter(candidate => ['RESEARCH_SHORTLIST', 'EXECUTION_VERIFICATION'].includes(candidate.stage)).sort((a, b) => a.rank - b.rank).slice(0, 8)
  const warningCount = runSteps.filter(step => step.status === 'COMPLETED_WITH_WARNINGS').length
  const errorCount = runSteps.filter(step => step.status === 'FAILED').length
  const completedCount = runSteps.filter(step => isCompleted(step.status)).length
  const finishedCount = runSteps.filter(step => isFinished(step.status)).length
  const waitingCount = runSteps.filter(step => step.status === 'WAITING').length
  const failedStep = runSteps.find(step => step.status === 'FAILED')?.step_key || run?.current_step
  const hasResults = Boolean(resultRun?.results?.ranking?.length || resultRun?.results?.executive_decision)
  const decision = resultRun?.results?.executive_decision
  const regime = resultRun?.results?.market_regime
  const groupedNotifications = groupNotifications(data?.notifications || [])
  const scrollToResults = () => document.getElementById('research-shortlist')?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return <AntApp>
    <div className="dashboard-grid"><main>
      <Card className="master-card" title="Điều khiển quét tổng">
        <Space wrap className="scan-actions">
          <Button type="primary" size="large" icon={<PlayCircleOutlined />} loading={starting} disabled={starting || run?.status === 'RUNNING'} onClick={() => setModal(true)}>Bắt đầu quét toàn bộ</Button>
          <Button size="large" icon={<ReloadOutlined />} loading={starting} disabled={starting || run?.status === 'RUNNING'} onClick={() => start()}>Chạy lại từ đầu</Button>
          <Tooltip title="Tính năng tạm dừng đang được phát triển"><span><Button size="large" icon={<PauseOutlined />} disabled>Tạm dừng</Button></span></Tooltip>
        </Space>
        <Alert type="info" showIcon icon={<InfoCircleOutlined />} message="Hệ thống thực hiện tuần tự 6 bước. Khi thiếu dữ liệu critical, kết quả bị hạ trạng thái thay vì tạo BUY_SETUP giả." style={{ marginTop: 14 }} />
      </Card>

      <Card title="Quy trình tự động" className="pipeline-card"><div className="pipeline">{(data?.profile?.step_schedules || []).map(schedule => {
        const runStep = runSteps.find(step => step.step_key === schedule.step_key)
        return <StepCard key={schedule.id} schedule={schedule} runStep={runStep} disabled={starting || run?.status === 'RUNNING'} onChange={async patch => { await api.updateSchedule(schedule.id, patch); await load() }} onRun={() => start([schedule.step_key])} onViewResults={scrollToResults} hasResults={hasResults} />
      })}</div></Card>

      <Card title={<div className="progress-title"><div><span>Tiến trình quét tổng</span><small>{finishedCount}/6 bước đã kết thúc</small></div><div className="progress-summary">{latestFailed && <Tag color="error">Quét thất bại</Tag>}{warningCount > 0 && <Tag color="warning">Hoàn tất có cảnh báo</Tag>}{completedCount > 0 && <span>{completedCount} hoàn tất</span>}{warningCount > 0 && <span>{warningCount} cảnh báo</span>}{errorCount > 0 && <Tag color="error">{errorCount} lỗi</Tag>}{waitingCount > 0 && <span>{waitingCount} chờ</span>}</div></div>}>
        <Progress percent={run?.progress || 0} status={run?.status === 'FAILED' ? 'exception' : run?.status === 'RUNNING' ? 'active' : 'normal'} />
        {latestFailed && failedStep && <small className="failure-summary">Dừng tại bước {steps.findIndex(step => step.key === failedStep) + 1 || runSteps.find(step => step.step_key === failedStep)?.sequence || '—'} — {steps.find(step => step.key === failedStep)?.title || failedStep}</small>}
        <div className="milestones">{steps.map((step, index) => { const current = runSteps.find(item => item.step_key === step.key); const state = current?.status === 'COMPLETED_WITH_WARNINGS' ? 'warning' : isCompleted(current?.status) ? 'done' : current?.status === 'RUNNING' ? 'active' : current?.status === 'FAILED' ? 'failed' : current?.status === 'STALE' ? 'stale' : current?.status === 'SKIPPED' ? 'skipped' : current?.status === 'PAUSED' ? 'paused' : ''; return <div key={step.key} className={`milestone ${state}`}><b>{index + 1}</b><span>{step.title}</span></div> })}</div>
      </Card>

      <Card id="research-shortlist" title={latestFailed && resultRun ? 'Research Shortlist — Kết quả thành công gần nhất' : 'Research Shortlist'} extra={resultRun ? <Tag>{resultRun.mode_validated}</Tag> : null}><CandidateTable rows={candidates} /></Card>
    </main>
    <aside>
      <QuickDecision latestRun={run} resultRun={resultRun} decision={decision} regime={regime} counters={resultCounters} nextAction={resultRun?.validation?.warnings?.[0]} />
      <Card title="Thông báo" extra={<Button type="link" onClick={() => setNotificationOpen(true)}>Xem toàn bộ</Button>}><NotificationList notifications={groupedNotifications.slice(0, 4)} /></Card>
    </aside></div>
    <Drawer title="Thông báo" open={notificationOpen} onClose={() => setNotificationOpen(false)}><NotificationList notifications={groupedNotifications} /></Drawer>
    <StartModal open={modal} loading={starting} onCancel={() => setModal(false)} onStart={() => start()} />
  </AntApp>
}

function StepCard({ schedule, runStep, disabled, onChange, onRun, onViewResults, hasResults }: { schedule: StepSchedule; runStep: any; disabled: boolean; onChange: (patch: Partial<StepSchedule>) => void; onRun: () => void; onViewResults: () => void; hasResults: boolean }) {
  const definition = steps.find(step => step.key === schedule.step_key)
  const viewResults = schedule.step_key === 'INVESTMENT_RESULTS'
  return <Card size="small" className={`step-card ${runStep?.status === 'RUNNING' ? 'running' : ''}`}>
    <div className="step-head"><span className="step-number">{schedule.sequence}</span><div><strong>{definition?.title}</strong><small>{definition?.description}</small></div></div>
    {statusTag(runStep?.status)}
    <div className="field-row"><span>Tự động theo lịch</span><Switch size="small" checked={schedule.auto_enabled} disabled={disabled} onChange={value => onChange({ auto_enabled: value })} /></div>
    <label>Khi quét tổng <Tooltip title={policyHelp(schedule.total_scan_policy)}><InfoCircleOutlined /></Tooltip></label>
    <Select size="small" value={schedule.total_scan_policy} options={policyOptions.map(({ value, label }) => ({ value, label }))} disabled={disabled} onChange={value => onChange({ total_scan_policy: value as Policy })} />
    <label>Tần suất</label>
    <Select size="small" value={schedule.interval_minutes} disabled={disabled} options={[15, 30, 60, 120, 240, 720, 1440].map(value => ({ value, label: value < 60 ? `${value} phút` : value < 1440 ? `${value / 60} giờ` : '1 ngày' }))} onChange={value => onChange({ interval_minutes: value })} />
    <Tooltip title={formatDate(schedule.last_run_at)}><small className="last-run">Lần chạy cuối: {formatShortDate(schedule.last_run_at)}</small></Tooltip>
    {viewResults ? <Tooltip title={hasResults ? 'Xem kết quả của lần quét gần nhất' : 'Chưa có kết quả để hiển thị'}><span><Button block onClick={onViewResults} disabled={!hasResults}>Xem kết quả</Button></span></Tooltip> : <Button block icon={<CaretRightOutlined />} disabled={disabled} onClick={onRun}>Chạy bước này</Button>}
  </Card>
}

function QuickDecision({ latestRun, resultRun, decision, regime, counters, nextAction }: { latestRun: ScanRun | null | undefined; resultRun: ScanRun | null; decision: any; regime: any; counters: Record<string, number>; nextAction?: string }) {
  const statement = decision?.statement || 'Chưa đủ dữ liệu để kết luận'
  const usdt = decision?.usdt_pct
  return <Card title="Kết quả nhanh" className="quick-card">
    {latestRun?.status === 'FAILED' && <Alert className="latest-failure" type="error" showIcon message="Lần quét mới nhất thất bại" description={<><span>Dừng tại {latestRun.current_step || 'bước chưa xác định'} · {formatDate(latestRun.finished_at || latestRun.created_at)}</span><small>{notificationDisplay({ id: 0, level: 'ERROR', title: '', message: latestRun.error_message, created_at: latestRun.created_at }).message}</small></>} />}
    {latestRun?.status === 'FAILED' && <div className="result-source">KẾT QUẢ THÀNH CÔNG GẦN NHẤT{resultRun && <small>Quét lúc {formatDate(resultRun.finished_at || resultRun.created_at)}</small>}</div>}
    {!resultRun && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có lần quét thành công để hiển thị kết quả" />}
    {resultRun && <>
    <div className="decision"><small>Quyết định hiện tại</small><strong>{statement}</strong><b>{typeof usdt === 'number' ? `${usdt}% USDT` : 'UNKNOWN'}</b></div>
    <div className="regime"><small>Trạng thái thị trường</small><strong>{regime?.regime || 'UNKNOWN'}</strong><span>{regime?.status || 'Chưa đủ dữ liệu'} · Confidence {regime?.confidence || 'UNKNOWN'}</span></div>
    <div className="metrics">{[['Universe', counters.initial_count], ['Binance hợp lệ', counters.binance_spot_eligible], ['Research Shortlist', counters.research_shortlist], ['Execution Verification', counters.execution_verification], ['BUY_SETUP', counters.buy_setup]].map(([label, value]) => <div className="metric" key={String(label)}><span>{label}</span><strong>{typeof value === 'number' ? value : '—'}</strong></div>)}</div>
    <Alert type="warning" showIcon icon={<WarningOutlined />} message={nextAction || 'Chưa có hành động tiếp theo từ lần quét gần nhất.'} />
    </>}
  </Card>
}

function candidateReason(candidate: Candidate) {
  const execution = candidate.details?.execution
  if (candidate.entry_status === 'NOT_SCORED' && execution) {
    const missing = ['unlock', 'stop', 'rr'].filter(key => key === 'unlock' ? execution.unlock?.status !== 'PASS' : execution[key] == null)
    const labels: Record<string, string> = { unlock: 'Unlock', stop: 'Stop', rr: 'RR' }
    return missing.length ? `Thiếu ${missing.map(key => labels[key]).join(', ')}` : 'Entry chưa được chấm điểm'
  }
  if (candidate.quality_status === 'RANGE') return 'Quality đang ở trạng thái RANGE'
  return candidate.risk_codes?.[0] || 'Chưa đủ dữ liệu'
}

function CandidateTable({ rows }: { rows: Candidate[] }) {
  const columns: any = [
    { title: 'Hạng', dataIndex: 'rank', width: 64 },
    { title: 'Coin', render: (_: any, row: Candidate) => <div><b>{row.symbol}</b><small>{row.binance_pair || '—'}</small></div> },
    { title: 'Quality', render: (_: any, row: Candidate) => <div><Tag color={row.quality_status === 'FINAL' ? 'success' : row.quality_status === 'PROVISIONAL' ? 'warning' : row.quality_status === 'RANGE' ? 'blue' : 'default'}>{row.quality_score_low && row.quality_score_high ? `${Number(row.quality_score_low).toFixed(0)}–${Number(row.quality_score_high).toFixed(0)}` : '—'}</Tag><small>{friendlyCode(row.quality_status)} · {row.quality_status}</small></div> },
    { title: 'Entry', render: (_: any, row: Candidate) => <Tooltip title="Chưa đủ dữ liệu execution để chấm Entry"><div><Tag>{friendlyCode(row.entry_status)}</Tag><small>{row.entry_status}</small></div></Tooltip> },
    { title: 'Opportunity', render: (_: any, row: Candidate) => row.opportunity_score ?? '—' },
    { title: 'Action', render: (_: any, row: Candidate) => <Tooltip title={row.action}><Tag color={row.action === 'BLOCKED' ? 'error' : 'warning'}>{friendlyCode(row.action)}</Tag></Tooltip> },
    { title: 'Lý do', render: (_: any, row: Candidate) => candidateReason(row) },
    { title: 'Chi tiết', render: () => <Tooltip title="Trang chi tiết coin đang được phát triển"><span><Button type="link" disabled>Chưa hỗ trợ</Button></span></Tooltip> },
  ]
  return rows.length ? <Table rowKey="id" size="small" scroll={{ x: 900 }} pagination={false} columns={columns} dataSource={rows} /> : <Empty description="Chưa có Research Shortlist" />
}

function groupNotifications(notifications: Notification[]) {
  const groups = new Map<string, Notification & { count: number }>()
  notifications.forEach(notification => {
    const key = `${notification.level}|${notification.title}|${notification.message}`
    const current = groups.get(key)
    if (current) current.count += 1
    else groups.set(key, { ...notification, count: 1 })
  })
  return [...groups.values()]
}

function NotificationList({ notifications }: { notifications: Array<Notification & { count: number }> }) {
  if (!notifications.length) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có thông báo" />
  return <div>{notifications.map(notification => { const display = notificationDisplay(notification); return <div className={`notification ${notification.level.toLowerCase()}`} key={`${notification.id}-${notification.title}`}><b>{notification.level === 'SUCCESS' ? <CheckCircleOutlined /> : notification.level === 'WARNING' ? <WarningOutlined /> : notification.level === 'ERROR' ? <ExclamationCircleOutlined /> : <InfoCircleOutlined />} {display.title}</b><span>{display.message}</span>{display.code && <Tooltip title={display.raw}><Tag>{display.code} · Xem chi tiết kỹ thuật</Tag></Tooltip>}{notification.count > 1 && <small>{notification.count} lần tương tự</small>}<small>{formatDate(notification.created_at)}</small></div> })}</div>
}

function StartModal({ open, loading, onCancel, onStart }: { open: boolean; loading: boolean; onCancel: () => void; onStart: () => void }) {
  return <Modal open={open} onCancel={onCancel} footer={null} width={760}><div className="modal-title"><PlayCircleOutlined className="play-circle" /><div><Typography.Title level={2}>Bắt đầu quét toàn bộ</Typography.Title><p>Hệ thống sẽ thực hiện lần lượt 6 bước theo checklist V8.1.</p></div></div><div className="modal-grid"><div className="modal-steps">{steps.map((step, index) => <div key={step.key}><span>{index + 1}</span><div><b>{step.title}</b><small>{step.description}</small></div></div>)}</div><Alert type="info" showIcon message="Lần quét dùng cấu hình đang hoạt động. Các tuỳ chọn chưa có backend hỗ trợ không được hiển thị." /></div><div className="modal-actions"><Button size="large" onClick={onCancel}>Hủy</Button><Button size="large" type="primary" icon={<PlayCircleOutlined />} loading={loading} onClick={onStart}>Bắt đầu chạy ngay</Button></div></Modal>
}

function Settings(){
 const [profiles,setProfiles]=useState<Profile[]>([]); const [profile,setProfile]=useState<Profile|null>(null); const [saving,setSaving]=useState(false)
 const load=async()=>{const ps=await api.profiles();setProfiles(ps);setProfile(p=>p?ps.find(x=>x.id===p.id)||ps[0]:ps.find(x=>x.is_active)||ps[0])}
 useEffect(()=>{load().catch((e:any)=>message.error(e.message))},[])
 const cfg=profile?.config; if(!profile||!cfg)return <Spin/>
 const update=(path:string[],value:any)=>{const copy=structuredClone(profile);let ref=copy.config;path.slice(0,-1).forEach(k=>ref=ref[k]);ref[path.at(-1)!]=value;setProfile(copy)}
 const save=async()=>{setSaving(true);try{const p=await api.updateProfile(profile.id,{name:profile.name,config:profile.config});setProfile(p);message.success('Đã lưu cấu hình')}catch(e:any){message.error(e.message)}finally{setSaving(false)}}
 const clone=async()=>{const p=await api.cloneProfile(profile.id,`${profile.name} — Custom`);setProfiles(x=>[p,...x]);setProfile(p);message.success('Đã tạo cấu hình mới')}
 return <div className="settings-layout"><main><Card title="Cấu hình đang sử dụng"><Space wrap><Select style={{width:360}} value={profile.id} options={profiles.map(p=>({value:p.id,label:p.name}))} onChange={id=>setProfile(profiles.find(p=>p.id===id)! )}/><Button onClick={clone}>Sao chép</Button><Button type="primary" loading={saving} disabled={profile.is_default} onClick={save}>Lưu</Button><Tooltip title="Chưa được hỗ trợ"><span><Button disabled>+ Lưu thành cấu hình mới</Button></span></Tooltip><Tooltip title="Chưa được hỗ trợ"><span><Button disabled>So sánh</Button></span></Tooltip><Tooltip title="Chưa được hỗ trợ"><span><Button disabled>Chạy thử cấu hình</Button></span></Tooltip><Tooltip title="Chưa được hỗ trợ"><span><Button danger disabled>Khôi phục mặc định V8.1</Button></span></Tooltip></Space><div className="profile-meta"><span>Version <b>v{profile.version}</b></span><span>Base <b>{profile.is_default?'V8.1 DEFAULT':'CUSTOM'}</b></span><span>Loại <b>{profile.is_default?'Mặc định khóa':'Có thể chỉnh sửa'}</b></span></div></Card><Card title="Universe & Market Cap">{profile.is_default&&<Alert type="info" showIcon message="Cấu hình mặc định bị khóa. Bấm Sao chép để tạo cấu hình có thể chỉnh sửa." style={{marginBottom:16}}/>}<Form layout="vertical" disabled={profile.is_default}><div className="form-grid"><Form.Item label="Nguồn Universe"><Select value={cfg.universe.source} options={[{value:'COINGECKO',label:'CoinGecko'},{value:'COINMARKETCAP',label:'CoinMarketCap (chưa cấu hình API)'}]} onChange={v=>update(['universe','source'],v)}/></Form.Item><Form.Item label="Số lượng coin Top"><InputNumber min={50} max={1000} step={50} value={cfg.universe.top_count} onChange={v=>update(['universe','top_count'],v)}/></Form.Item><Form.Item label="Yêu cầu Binance Spot/USDT"><Switch checked={cfg.universe.require_binance_spot_usdt} onChange={v=>update(['universe','require_binance_spot_usdt'],v)}/></Form.Item><Form.Item label="Research Shortlist"><InputNumber min={1} max={100} value={cfg.universe.research_shortlist_count} onChange={v=>update(['universe','research_shortlist_count'],v)}/></Form.Item><Form.Item label="Execution Verification"><InputNumber min={1} max={20} value={cfg.universe.execution_verification_count} onChange={v=>update(['universe','execution_verification_count'],v)}/></Form.Item></div><div className="form-grid four"><Form.Item label="MC tối thiểu (USD)"><InputNumber style={{width:'100%'}} value={cfg.universe.market_cap_min_usd} onChange={v=>update(['universe','market_cap_min_usd'],v)}/></Form.Item><Form.Item label="MC ưu tiên từ"><InputNumber style={{width:'100%'}} value={cfg.universe.market_cap_preferred_min_usd} onChange={v=>update(['universe','market_cap_preferred_min_usd'],v)}/></Form.Item><Form.Item label="MC ưu tiên đến"><InputNumber style={{width:'100%'}} value={cfg.universe.market_cap_preferred_max_usd} onChange={v=>update(['universe','market_cap_preferred_max_usd'],v)}/></Form.Item><Form.Item label="MC tối đa"><InputNumber style={{width:'100%'}} value={cfg.universe.market_cap_max_usd} onChange={v=>update(['universe','market_cap_max_usd'],v)}/></Form.Item></div><Typography.Title level={5}>Loại trừ</Typography.Title><Space wrap>{Object.entries(cfg.universe.exclude).map(([k,v])=><span className="toggle-item" key={k}>{k}<Switch size="small" checked={Boolean(v)} onChange={x=>update(['universe','exclude',k],x)}/></span>)}</Space></Form><Alert type="info" showIcon message="Thay đổi các mục trên sẽ ảnh hưởng toàn bộ quy trình từ Universe Scan." style={{marginTop:20}}/></Card></main><aside><Card title="Cấu hình đang soạn"><h3>{profile.name}</h3><div className="metric"><span>Version</span><b>{profile.version}</b></div><div className="metric"><span>Cảnh báo</span><b className="orange">2</b></div><div className="metric"><span>Lỗi</span><b>0</b></div><Button block type="primary" onClick={async()=>{await api.activateProfile(profile.id);await load();message.success('Đã đặt làm cấu hình đang dùng')}}>Đặt làm đang dùng</Button></Card><Card title="Quy tắc bị khóa">{cfg.locked_rules.map((r:string)=><div className="locked" key={r}>🔒 {r}</div>)}</Card></aside></div>
}

export default function App() { return <Shell /> }
