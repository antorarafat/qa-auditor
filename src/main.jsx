import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import {
  AudioLines, BarChart3, BookOpen, Check, ChevronDown, ClipboardCheck, CloudUpload,
  FileAudio, FileDown, FileText, Globe2, Languages, LayoutDashboard, LogOut, Menu,
  MessageSquareQuote, Moon, PanelLeftClose, PanelLeftOpen, Play, Printer, RefreshCw,
  Settings2, ShieldCheck, Sparkles, Trash2, UserRound, X
} from 'lucide-react';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, Select, Separator, Switch, Textarea } from './components/ui';
import { getPromptText } from './prompts';
import './index.css';

const copy = {
  en: {
    signIn: 'Sign in to QA Auditor', signInDescription: 'Use your authorized account to continue.', email: 'Email', password: 'Password', login: 'Sign in', signingIn: 'Signing in…',
    dashboard: 'Dashboard', audit: 'Call audit', settings: 'Settings', language: 'Language', english: 'English', bangla: 'বাংলা', logout: 'Log out',
    welcome: 'Welcome back', workspace: 'Audit workspace', provider: 'AI provider', providerHint: 'Your account’s server-side API key will be used securely.', gemini: 'Google Gemini', openai: 'OpenAI',
    productBrief: 'Product brief', productBriefHint: 'Add the fact sheet used for accuracy checks.', loadDemo: 'Load demo', clear: 'Clear', customQa: 'Custom QA scorecard', customQaHint: 'Enable this to use your own scoring rules.', defaultScorecard: 'Restore default',
    recordings: 'Call recordings', recordingsHint: 'Upload one or more audio files.', drop: 'Drop audio files here or browse', supported: 'MP3, WAV, M4A, AAC, OGG', analyze: 'Run Bangla audit', analyzing: 'Analyzing…',
    mode: 'Analysis mode', qaMode: 'QA audit & scorecard', voiceMode: 'Customer voice & objections', coachingMode: 'Advisor pitch & coaching',
    report: 'Audit report', reportHint: 'Generated in Bangla, as requested.', downloadPdf: 'PDF', downloadWord: 'Word', copy: 'Copy', print: 'Print', cached: 'Cached result', fresh: 'Fresh AI result',
    noFiles: 'Please upload at least one audio recording.', noProvider: 'Your account has no key for this provider.', serverError: 'Something went wrong. Please try again.', loginError: 'Invalid email or password.', unavailable: 'The authentication service is unavailable.',
    companyFallback: 'QA Auditor', security: 'Secure workspace', remove: 'Remove', files: 'files', overview: 'Overview', ready: 'Ready when you are.'
  },
  bn: {
    signIn: 'QA Auditor-এ লগইন করুন', signInDescription: 'অনুমোদিত অ্যাকাউন্ট দিয়ে প্রবেশ করুন।', email: 'ইমেইল', password: 'পাসওয়ার্ড', login: 'লগইন', signingIn: 'যাচাই হচ্ছে…',
    dashboard: 'ড্যাশবোর্ড', audit: 'কল অডিট', settings: 'সেটিংস', language: 'ভাষা', english: 'English', bangla: 'বাংলা', logout: 'লগআউট',
    welcome: 'স্বাগতম', workspace: 'অডিট ওয়ার্কস্পেস', provider: 'AI প্রোভাইডার', providerHint: 'আপনার অ্যাকাউন্টের সংরক্ষিত API key সার্ভারে নিরাপদে ব্যবহৃত হবে।', gemini: 'Google Gemini', openai: 'OpenAI',
    productBrief: 'প্রোডাক্ট ব্রিফ', productBriefHint: 'তথ্য যাচাইয়ের জন্য ফ্যাক্ট শিট যোগ করুন।', loadDemo: 'ডেমো লোড', clear: 'মুছুন', customQa: 'কাস্টম QA স্কোরকার্ড', customQaHint: 'নিজস্ব স্কোরিং নিয়ম ব্যবহার করতে চালু করুন।', defaultScorecard: 'ডিফল্ট ফিরিয়ে আনুন',
    recordings: 'কল রেকর্ডিং', recordingsHint: 'এক বা একাধিক অডিও ফাইল আপলোড করুন।', drop: 'এখানে অডিও ফেলুন অথবা ব্রাউজ করুন', supported: 'MP3, WAV, M4A, AAC, OGG', analyze: 'বাংলা অডিট চালান', analyzing: 'বিশ্লেষণ হচ্ছে…',
    mode: 'বিশ্লেষণের ধরন', qaMode: 'QA অডিট ও স্কোরকার্ড', voiceMode: 'কাস্টমার ভয়েস ও আপত্তি', coachingMode: 'এডভাইসর পিচ ও কোচিং',
    report: 'অডিট রিপোর্ট', reportHint: 'আপনার অনুরোধ অনুযায়ী রিপোর্ট বাংলায় তৈরি হবে।', downloadPdf: 'PDF', downloadWord: 'Word', copy: 'কপি', print: 'প্রিন্ট', cached: 'ক্যাশড ফলাফল', fresh: 'নতুন AI ফলাফল',
    noFiles: 'কমপক্ষে একটি অডিও রেকর্ডিং আপলোড করুন।', noProvider: 'এই প্রোভাইডারের জন্য আপনার অ্যাকাউন্টে কোনো key নেই।', serverError: 'সমস্যা হয়েছে। আবার চেষ্টা করুন।', loginError: 'ইমেইল বা পাসওয়ার্ড সঠিক নয়।', unavailable: 'অথেন্টিকেশন সার্ভিস এখন unavailable।',
    companyFallback: 'QA Auditor', security: 'নিরাপদ ওয়ার্কস্পেস', remove: 'মুছুন', files: 'টি ফাইল', overview: 'ওভারভিউ', ready: 'আপনি প্রস্তুত হলে শুরু করুন।'
  }
};

const defaultScorecard = `১. Greetings (৫ নম্বর)\n- Greetings (২)\n- Permission (২)\n- Timely (১)\n\n২. Profiling (২০ নম্বর)\n- Student Inquiry (৫)\n- Active Listening (৫)\n- Relevant Questioning (৫)\n- Feedback (৫)\n\n৩. Advising (২০ নম্বর)\n- Personalized Advice (১০)\n- Clarity (৫)\n- Magic Words (৫)\n\n৪. Product Pitch (২৫ নম্বর)\n- Features (৫)\n- Personalization (৫)\n- Benefits (৫)\n- Pricing Clarity (৫)\n- Confidence (৫)\n\n৫. Soft Skills (১৫ নম্বর)\n- Rudeness, Hurriedness, Enthusiasm, Interruption, Accent, Empathy (১৫)\n\n৬. CRM Input (১০ নম্বর)\n- Data Accuracy & Remarks (১০)\n\n৭. Closing (৫ নম্বর)\n- Purchase Guideline (৩)\n- Standard Closing (২)\n\nCRITICAL ERRORS (CE - Zero Score Rule):\nযদি নিচের যেকোনো একটি Critical Error পাওয়া যায়, তবে মোট অর্জিত নম্বর সরাসরি 0 (Zero) হবে:\n- Wrong info (ভুল তথ্য)\n- Rudeness (অশিষ্ট আচরণ)\n- False promise (মিথ্যা প্রতিশ্রুতি)\n- Wrong guidance (ভুল দিকনির্দেশনা)\n- Broken callback (কথা দিয়ে কলব্যাক না করা)`;

function formatBytes(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function App() {
  const [language, setLanguage] = useState(() => localStorage.getItem('qa-language') || 'en');
  const [user, setUser] = useState(null);
  const [loginState, setLoginState] = useState({ loading: true, error: '' });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [provider, setProvider] = useState('gemini');
  const [productBrief, setProductBrief] = useState('');
  const [customQaEnabled, setCustomQaEnabled] = useState(false);
  const [customQa, setCustomQa] = useState(defaultScorecard);
  const [mode, setMode] = useState('single');
  const [files, setFiles] = useState([]);
  const [report, setReport] = useState('');
  const [cached, setCached] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [mobileSettings, setMobileSettings] = useState(false);
  const inputRef = useRef(null);
  const reportRef = useRef(null);
  const t = copy[language];

  useEffect(() => { localStorage.setItem('qa-language', language); document.documentElement.lang = language === 'bn' ? 'bn' : 'en'; }, [language]);
  useEffect(() => { checkSession(); }, []);

  const availableProviders = user?.providers || [];
  const companyName = user?.companyName || t.companyFallback;
  const renderedReport = useMemo(() => report ? DOMPurify.sanitize(marked.parse(report)) : '', [report]);
  const previewUrls = useMemo(() => files.map(file => ({ file, url: URL.createObjectURL(file) })), [files]);
  useEffect(() => () => previewUrls.forEach(item => URL.revokeObjectURL(item.url)), [previewUrls]);

  async function checkSession() {
    try {
      const response = await fetch('/api/session', { credentials: 'same-origin' });
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        if (!data.user.providers.includes(provider)) setProvider(data.user.providers[0] || 'gemini');
      }
    } catch { /* login screen remains available */ }
    setLoginState(state => ({ ...state, loading: false }));
  }

  async function handleLogin(event) {
    event.preventDefault();
    setLoginState({ loading: true, error: '' });
    try {
      const response = await fetch('/api/login', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(loginForm) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(response.status === 503 ? t.unavailable : t.loginError);
      setUser(data.user);
      setProvider(data.user.providers[0] || 'gemini');
      setLoginForm({ email: '', password: '' });
    } catch (error) { setLoginState({ loading: false, error: error.message }); return; }
    setLoginState({ loading: false, error: '' });
  }

  async function logout() {
    await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {});
    setUser(null); setFiles([]); setReport(''); setCached(false); setSidebarOpen(false);
  }

  function addFiles(incoming) {
    setFiles(current => {
      const next = [...current];
      for (const file of incoming) if (file.type.startsWith('audio/') && !next.some(item => item.name === file.name && item.size === file.size)) next.push(file);
      return next;
    });
  }

  function removeFile(index) { setFiles(current => current.filter((_, itemIndex) => itemIndex !== index)); }
  function clearFiles() { setFiles([]); if (inputRef.current) inputRef.current.value = ''; }

  async function analyze() {
    if (!files.length) { setStatus(t.noFiles); return; }
    if (!availableProviders.includes(provider)) { setStatus(t.noProvider); return; }
    setBusy(true); setStatus(t.analyzing); setReport('');
    try {
      const encoded = [];
      for (let index = 0; index < files.length; index += 1) {
        setStatus(`${t.analyzing} ${index + 1}/${files.length}`);
        encoded.push({ name: files[index].name, mimeType: files[index].type || 'audio/mp3', data: await toBase64(files[index]) });
      }
      const prompt = getPromptText(mode, productBrief.trim(), customQaEnabled ? customQa.trim() : '', files.length);
      const response = await fetch('/api/analyze', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider, audioFiles: encoded, promptText: prompt }) });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) { await logout(); throw new Error(t.loginError); }
      if (!response.ok) throw new Error(data.error || t.serverError);
      setReport(data.report || ''); setCached(Boolean(data.cached)); setStatus('');
    } catch (error) { setStatus(error.message || t.serverError); }
    finally { setBusy(false); }
  }

  function loadDemo() {
    setProductBrief('Course: HSC 26 Online Batch\nRegular fee: 6,000 BDT\nDiscount fee: 4,500 BDT\nLive classes, lecture sheets, model tests, doubt solving and 2-year playback.');
  }

  function exportPdf() { window.print(); }
  function exportWord() { if (!reportRef.current) return; const html = `<html><head><meta charset="utf-8"><title>QA Report</title><style>body{font-family:Arial}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:8px}h1{color:#b91c1c}</style></head><body>${reportRef.current.innerHTML}</body></html>`; const link = document.createElement('a'); link.href = `data:application/msword;charset=utf-8,${encodeURIComponent(html)}`; link.download = `QA_Audit_${new Date().toISOString().slice(0, 10)}.doc`; link.click(); }
  async function copyReport() { await navigator.clipboard?.writeText(reportRef.current?.innerText || ''); setStatus(language === 'en' ? 'Report copied.' : 'রিপোর্ট কপি হয়েছে।'); }
  function toggleLanguage() { setLanguage(current => current === 'en' ? 'bn' : 'en'); }

  if (loginState.loading) return <div className="loading-screen"><Sparkles size={22} /> Loading QA Auditor…</div>;
  if (!user) return <LoginScreen t={t} language={language} toggleLanguage={toggleLanguage} loginForm={loginForm} setLoginForm={setLoginForm} onSubmit={handleLogin} state={loginState} />;

  return <div className="app-shell" id="top">
    <Sidebar t={t} language={language} user={user} companyName={companyName} collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} open={sidebarOpen} setOpen={setSidebarOpen} toggleLanguage={toggleLanguage} onLogout={logout} />
    <main className={`main-area ${sidebarCollapsed ? 'main-area-collapsed' : ''}`}>
      <div className="mobile-header"><Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} aria-label="Open menu"><Menu size={20} /></Button><span>{companyName}</span><LanguageToggle language={language} onClick={toggleLanguage} /></div>
      <div className="page-container">
        <div className="page-heading"><div><div className="eyebrow"><ShieldCheck size={15} /> {t.security}</div><h1>{t.welcome}, {user.name || user.email.split('@')[0]}</h1><p>{t.ready}</p></div><LanguageToggle language={language} onClick={toggleLanguage} /></div>
        <div className="workspace-grid">
          <section className="workspace-main">
            <Card className="hero-card"><CardContent><div className="hero-icon"><AudioLines size={25} /></div><div><p className="eyebrow">{t.workspace}</p><h2>{t.audit}</h2><p>{t.reportHint}</p></div></CardContent></Card>
            <Card id="settings"><CardHeader><CardTitle><Settings2 size={18} /> {t.settings}</CardTitle><CardDescription>{t.providerHint}</CardDescription></CardHeader><CardContent className="settings-grid">
              <div><Label>{t.provider}</Label><Select value={provider} onChange={event => setProvider(event.target.value)}>{availableProviders.includes('gemini') && <option value="gemini">{t.gemini}</option>}{availableProviders.includes('openai') && <option value="openai">{t.openai}</option>}</Select></div>
              <div className="field-span"><div className="field-label-row"><Label>{t.productBrief}</Label><Button variant="link" size="sm" onClick={loadDemo}>{t.loadDemo}</Button></div><Textarea value={productBrief} onChange={event => setProductBrief(event.target.value)} placeholder={t.productBriefHint} rows={5} /><div className="field-footer"><span>{t.productBriefHint}</span>{productBrief && <Button variant="ghost" size="sm" onClick={() => setProductBrief('')}>{t.clear}</Button>}</div></div>
              <div className="field-span"><div className="field-label-row"><div><Label>{t.customQa}</Label><p className="field-hint">{t.customQaHint}</p></div><Switch checked={customQaEnabled} onChange={setCustomQaEnabled} /></div>{customQaEnabled && <Textarea value={customQa} onChange={event => setCustomQa(event.target.value)} rows={7} />}{!customQaEnabled && <div className="disabled-scorecard">{customQa.split('\n').slice(0, 3).join(' · ')}… <Button variant="link" size="sm" onClick={() => setCustomQaEnabled(true)}>{t.defaultScorecard}</Button></div>}</div>
            </CardContent></Card>
            <Card><CardHeader><CardTitle><CloudUpload size={18} /> {t.recordings}</CardTitle><CardDescription>{t.recordingsHint} · {t.supported}</CardDescription></CardHeader><CardContent><div className="dropzone" onClick={() => inputRef.current?.click()} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); addFiles(Array.from(event.dataTransfer.files)); }}><CloudUpload size={30} /><strong>{t.drop}</strong><span>{t.supported}</span><input ref={inputRef} type="file" accept="audio/*" multiple hidden onChange={event => addFiles(Array.from(event.target.files || []))} /></div>{files.length > 0 && <div className="file-list">{previewUrls.map(({ file, url }, index) => <div className="file-row" key={`${file.name}-${file.size}`}><FileAudio size={18} /><div className="file-meta"><strong>{file.name}</strong><span>{formatBytes(file.size)}</span></div><audio controls src={url} /><Button variant="ghost" size="icon" onClick={() => removeFile(index)} aria-label={t.remove}><Trash2 size={16} /></Button></div>)}<Button variant="ghost" size="sm" onClick={clearFiles}>{t.clear}</Button></div>}</CardContent></Card>
            <Card><CardHeader><CardTitle><LayoutDashboard size={18} /> {t.mode}</CardTitle></CardHeader><CardContent><div className="mode-grid">{[['single', ClipboardCheck, t.qaMode], ['voice', MessageSquareQuote, t.voiceMode], ['coaching', BarChart3, t.coachingMode]].map(([value, Icon, label]) => <button className={`mode-card ${mode === value ? 'selected' : ''}`} key={value} onClick={() => setMode(value)}><Icon size={20} /><span>{label}</span>{mode === value && <Check size={16} />}</button>)}</div><Button className="analyze-button" size="lg" onClick={analyze} disabled={busy}>{busy ? <RefreshCw className="spin" size={18} /> : <Play size={18} />}{busy ? t.analyzing : t.analyze}</Button>{status && <div className="status-message">{status}</div>}</CardContent></Card>
          </section>
          <aside className="workspace-side"><Card className="side-card"><CardHeader><CardTitle><BookOpen size={18} /> {t.overview}</CardTitle></CardHeader><CardContent><div className="stat"><span>{t.recordings}</span><strong>{files.length}</strong></div><Separator /><div className="stat"><span>{t.provider}</span><strong>{provider === 'gemini' ? 'Gemini' : 'OpenAI'}</strong></div><Separator /><div className="stat"><span>{t.language}</span><strong>{language === 'en' ? 'English' : 'বাংলা'}</strong></div></CardContent></Card><Card className="side-card accent-card"><CardContent><Sparkles size={20} /><strong>{t.reportHint}</strong><span>{t.security}</span></CardContent></Card></aside>
        </div>
        {report && <Card className="report-card"><CardHeader><div className="report-heading"><div><CardTitle><FileText size={19} /> {t.report}</CardTitle><CardDescription>{cached ? t.cached : t.fresh}</CardDescription></div><div className="report-actions"><Button variant="outline" size="sm" onClick={exportPdf}><FileDown size={15} /> {t.downloadPdf}</Button><Button variant="outline" size="sm" onClick={exportWord}><FileText size={15} /> {t.downloadWord}</Button><Button variant="outline" size="sm" onClick={copyReport}><Check size={15} /> {t.copy}</Button><Button variant="outline" size="sm" onClick={() => window.print()}><Printer size={15} /> {t.print}</Button></div></div></CardHeader><CardContent><div ref={reportRef} className="report-content" dangerouslySetInnerHTML={{ __html: renderedReport }} /></CardContent></Card>}
      </div>
    </main>
  </div>;
}

function LoginScreen({ t, language, toggleLanguage, loginForm, setLoginForm, onSubmit, state }) { return <div className="login-shell"><Card className="login-card"><div className="login-brand"><div className="brand-mark"><ShieldCheck size={24} /></div><div><strong>QA Auditor</strong><span>{t.companyFallback}</span></div><LanguageToggle language={language} onClick={toggleLanguage} /></div><Separator /><CardHeader><CardTitle>{t.signIn}</CardTitle><CardDescription>{t.signInDescription}</CardDescription></CardHeader><CardContent><form onSubmit={onSubmit} className="login-form"><Label htmlFor="email">{t.email}</Label><Input id="email" type="email" autoComplete="username" required value={loginForm.email} onChange={event => setLoginForm({ ...loginForm, email: event.target.value })} /><Label htmlFor="password">{t.password}</Label><Input id="password" type="password" autoComplete="current-password" required value={loginForm.password} onChange={event => setLoginForm({ ...loginForm, password: event.target.value })} />{state.error && <div className="error-message">{state.error}</div>}<Button type="submit" size="lg" disabled={state.loading}>{state.loading ? t.signingIn : t.login}</Button></form></CardContent></Card></div>; }

function Sidebar({ t, language, user, companyName, collapsed, setCollapsed, open, setOpen, toggleLanguage, onLogout }) { return <><div className={`sidebar-backdrop ${open ? 'visible' : ''}`} onClick={() => setOpen(false)} /><aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${open ? 'mobile-open' : ''}`}><div className="sidebar-top"><div className="brand-mark"><ShieldCheck size={21} /></div>{!collapsed && <div className="brand-copy"><strong>{companyName}</strong><span>{t.companyFallback}</span></div>}<Button variant="ghost" size="icon" className="desktop-collapse" onClick={() => setCollapsed(!collapsed)}>{collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}</Button><Button variant="ghost" size="icon" className="mobile-close" onClick={() => setOpen(false)}><X size={18} /></Button></div><Separator /><nav className="sidebar-nav"><a className="nav-item active" href="#top"><LayoutDashboard size={18} /><span>{t.dashboard}</span></a><a className="nav-item" href="#settings"><Settings2 size={18} /><span>{t.settings}</span></a></nav><div className="sidebar-bottom"><div className="user-card"><div className="avatar"><UserRound size={17} /></div>{!collapsed && <div><strong>{user.name || user.email}</strong><span>{user.email}</span></div>}</div><Button variant="ghost" className="sidebar-action" onClick={toggleLanguage}><Languages size={17} /><span>{t.language}: {t[language === 'en' ? 'bangla' : 'english']}</span></Button><Button variant="ghost" className="sidebar-action" onClick={onLogout}><LogOut size={17} /><span>{t.logout}</span></Button></div></aside></>; }

function LanguageToggle({ language, onClick }) { return <Button variant="outline" size="sm" onClick={onClick}><Globe2 size={15} /> {language === 'en' ? 'বাংলা' : 'English'}</Button>; }

function toBase64(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = reject; reader.readAsDataURL(file); }); }

createRoot(document.getElementById('root')).render(<App />);
