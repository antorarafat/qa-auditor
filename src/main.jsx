import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import {
  AudioLines, BarChart3, Check, ClipboardCheck, CloudUpload,
  Eye, EyeOff, FileAudio, FileDown, FileText, Globe2, LogOut,
  MessageSquareQuote, Play, RefreshCw,
  Settings2, Sparkles, Trash2, UserRound
} from 'lucide-react';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, Select, Separator, Switch, Textarea } from './components/ui';
import { MultiSelect } from './components/multi-select';
import './index.css';

const copy = {
  en: {
    signIn: 'Welcome back', signInDescription: 'Sign in to continue to your call quality workspace.', email: 'Email', password: 'Password', showPassword: 'Show password', hidePassword: 'Hide password', login: 'Sign in', signingIn: 'Signing in…',
    dashboard: 'Dashboard', audit: 'Call audit', settings: 'Settings', language: 'Language', english: 'English', bangla: 'বাংলা', logout: 'Log out',
    welcome: 'Welcome back', workspace: 'Audit workspace', provider: 'AI provider', providerHint: 'Your account’s server-side API key will be used securely.', gemini: 'Google Gemini', openai: 'OpenAI',
    productBrief: 'Product', category: 'Category', subCategory: 'Sub-category', chooseCategory: 'Choose categories (optional)', chooseSubCategory: 'Choose sub-categories (optional)', searchCategory: 'Search categories…', searchSubCategory: 'Search sub-categories…', noResults: 'No results found.', selectedCount: '{count} selected', clearSelections: 'Clear selections', loadingSetup: 'Loading sheet setup…', configurationError: 'The sheet setup could not be loaded.', clear: 'Clear', customQa: 'Custom QA scorecard', customQaHint: 'Enable this to use your own scoring rules.', defaultScorecard: 'Restore sheet scorecard',
    recordings: 'Call recordings', recordingsHint: 'Upload one or more audio files.', drop: 'Drop audio files here or browse', supported: 'MP3, WAV, M4A, AAC, OGG', analyze: 'Run', analyzing: 'Analyzing…',
    mode: 'Analysis mode', qaMode: 'QA audit & scorecard', voiceMode: 'Customer voice & objections', coachingMode: 'Advisor pitch & coaching',
    report: 'Audit report', reportHint: 'Generated in Bangla, as requested.', downloadPdf: 'PDF', downloadWord: 'Word', copy: 'Copy', print: 'Print', cached: 'Cached result', fresh: 'Fresh AI result',
    noFiles: 'Please upload at least one audio recording.', noProvider: 'Your account has no key for this provider.', serverError: 'Something went wrong. Please try again.', loginError: 'Invalid email or password.', networkAccessError: 'This network address is not allowed. Ask the administrator to update the app address.', unavailable: 'The authentication service is unavailable.',
    companyFallback: 'QA Auditor', security: 'Private & secure', remove: 'Remove', files: 'files', overview: 'Overview', ready: 'Turn every call into clear, actionable coaching.',
    pageTitle: 'Review a customer call', pageHint: 'Upload the recording, choose what you want to learn, and get a Bangla report.', setup: 'Audit setup', context: 'Audit context', contextHint: 'Optional details that improve the accuracy of your report.', runSummary: 'Ready to analyze', account: 'Account', chooseFiles: 'Choose audio files', optional: 'Optional', customize: 'Customize', defaultActive: 'Sheet scorecard active', fileReady: 'ready', unsupported: 'Choose a supported audio file.', duplicate: 'That recording is already in the list.', copyUnavailable: 'Copy is unavailable in this browser.'
  },
  bn: {
    signIn: 'আবার স্বাগতম', signInDescription: 'কল কোয়ালিটি ওয়ার্কস্পেসে যেতে লগইন করুন।', email: 'ইমেইল', password: 'পাসওয়ার্ড', showPassword: 'পাসওয়ার্ড দেখান', hidePassword: 'পাসওয়ার্ড লুকান', login: 'লগইন', signingIn: 'যাচাই হচ্ছে…',
    dashboard: 'ড্যাশবোর্ড', audit: 'কল অডিট', settings: 'সেটিংস', language: 'ভাষা', english: 'English', bangla: 'বাংলা', logout: 'লগআউট',
    welcome: 'স্বাগতম', workspace: 'অডিট ওয়ার্কস্পেস', provider: 'AI প্রোভাইডার', providerHint: 'আপনার অ্যাকাউন্টের সংরক্ষিত API key সার্ভারে নিরাপদে ব্যবহৃত হবে।', gemini: 'Google Gemini', openai: 'OpenAI',
    productBrief: 'প্রোডাক্ট', category: 'ক্যাটাগরি', subCategory: 'সাব-ক্যাটাগরি', chooseCategory: 'ক্যাটাগরি বেছে নিন (ঐচ্ছিক)', chooseSubCategory: 'সাব-ক্যাটাগরি বেছে নিন (ঐচ্ছিক)', searchCategory: 'ক্যাটাগরি খুঁজুন…', searchSubCategory: 'সাব-ক্যাটাগরি খুঁজুন…', noResults: 'কোনো ফল পাওয়া যায়নি।', selectedCount: '{count}টি নির্বাচিত', clearSelections: 'নির্বাচন মুছুন', loadingSetup: 'শিট সেটআপ লোড হচ্ছে…', configurationError: 'শিট সেটআপ লোড করা যায়নি।', clear: 'মুছুন', customQa: 'কাস্টম QA স্কোরকার্ড', customQaHint: 'নিজস্ব স্কোরিং নিয়ম ব্যবহার করতে চালু করুন।', defaultScorecard: 'শিটের স্কোরকার্ড ফিরিয়ে আনুন',
    recordings: 'কল রেকর্ডিং', recordingsHint: 'এক বা একাধিক অডিও ফাইল আপলোড করুন।', drop: 'এখানে অডিও ফেলুন অথবা ব্রাউজ করুন', supported: 'MP3, WAV, M4A, AAC, OGG', analyze: 'Run', analyzing: 'বিশ্লেষণ হচ্ছে…',
    mode: 'বিশ্লেষণের ধরন', qaMode: 'QA অডিট ও স্কোরকার্ড', voiceMode: 'কাস্টমার ভয়েস ও আপত্তি', coachingMode: 'এডভাইসর পিচ ও কোচিং',
    report: 'অডিট রিপোর্ট', reportHint: 'আপনার অনুরোধ অনুযায়ী রিপোর্ট বাংলায় তৈরি হবে।', downloadPdf: 'PDF', downloadWord: 'Word', copy: 'কপি', print: 'প্রিন্ট', cached: 'ক্যাশড ফলাফল', fresh: 'নতুন AI ফলাফল',
    noFiles: 'কমপক্ষে একটি অডিও রেকর্ডিং আপলোড করুন।', noProvider: 'এই প্রোভাইডারের জন্য আপনার অ্যাকাউন্টে কোনো key নেই।', serverError: 'সমস্যা হয়েছে। আবার চেষ্টা করুন।', loginError: 'ইমেইল বা পাসওয়ার্ড সঠিক নয়।', networkAccessError: 'এই নেটওয়ার্ক ঠিকানাটি অনুমোদিত নয়। অ্যাপের ঠিকানা আপডেট করতে অ্যাডমিনকে বলুন।', unavailable: 'অথেন্টিকেশন সার্ভিস এখন unavailable।',
    companyFallback: 'QA Auditor', security: 'ব্যক্তিগত ও নিরাপদ', remove: 'মুছুন', files: 'টি ফাইল', overview: 'ওভারভিউ', ready: 'প্রতিটি কল থেকে পরিষ্কার, কার্যকর কোচিং পান।',
    pageTitle: 'কাস্টমার কল রিভিউ করুন', pageHint: 'রেকর্ডিং আপলোড করুন, কী জানতে চান বেছে নিন, এবং বাংলায় রিপোর্ট পান।', setup: 'অডিট সেটআপ', context: 'অডিট কনটেক্সট', contextHint: 'ঐচ্ছিক তথ্য যা রিপোর্ট আরও নির্ভুল করে।', runSummary: 'বিশ্লেষণের জন্য প্রস্তুত', account: 'অ্যাকাউন্ট', chooseFiles: 'অডিও ফাইল বাছুন', optional: 'ঐচ্ছিক', customize: 'কাস্টমাইজ করুন', defaultActive: 'শিটের স্কোরকার্ড সক্রিয়', fileReady: 'প্রস্তুত', unsupported: 'সমর্থিত অডিও ফাইল বেছে নিন।', duplicate: 'এই রেকর্ডিংটি ইতিমধ্যে তালিকায় আছে।', copyUnavailable: 'এই ব্রাউজারে কপি করা যাচ্ছে না।'
  }
};

function formatBytes(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function App() {
  const [language, setLanguage] = useState(() => localStorage.getItem('qa-language') || 'en');
  const [user, setUser] = useState(null);
  const [loginState, setLoginState] = useState({ loading: true, error: '' });
  const [provider, setProvider] = useState('gemini');
  const [auditConfig, setAuditConfig] = useState({ products: [], scorecard: '' });
  const [configState, setConfigState] = useState({ loading: false, error: '' });
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedSubCategoryIds, setSelectedSubCategoryIds] = useState([]);
  const [customQaEnabled, setCustomQaEnabled] = useState(false);
  const [customQa, setCustomQa] = useState('');
  const [mode, setMode] = useState('single');
  const [files, setFiles] = useState([]);
  const [report, setReport] = useState('');
  const [cached, setCached] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef(null);
  const reportRef = useRef(null);
  const reportCardRef = useRef(null);
  const analysisRunRef = useRef(0);
  const t = copy[language];

  useEffect(() => { localStorage.setItem('qa-language', language); document.documentElement.lang = language === 'bn' ? 'bn' : 'en'; }, [language]);
  useEffect(() => { checkSession(); }, []);
  useEffect(() => { if (user) loadAuditConfiguration(); }, [user]);

  const availableProviders = user?.providers || [];
  const companyName = user?.companyName || t.companyFallback;
  const categoryOptions = useMemo(() => auditConfig.products.map(item => item.category), [auditConfig.products]);
  const subCategoryOptions = useMemo(() => auditConfig.products
    .filter(item => selectedCategories.includes(item.category))
    .flatMap(item => item.subCategories.map(subCategory => ({
      value: JSON.stringify([item.category, subCategory]),
      label: subCategory,
      description: item.category,
      category: item.category,
      subCategory
    }))), [auditConfig.products, selectedCategories]);
  const productSelections = useMemo(() => selectedSubCategoryIds.map(id => subCategoryOptions.find(option => option.value === id))
    .filter(Boolean)
    .map(option => ({ category: option.category, subCategory: option.subCategory })), [selectedSubCategoryIds, subCategoryOptions]);
  const renderedReport = useMemo(() => report ? DOMPurify.sanitize(marked.parse(report)) : '', [report]);
  const previewUrls = useMemo(() => files.map(file => ({ file, url: URL.createObjectURL(file) })), [files]);
  useEffect(() => () => previewUrls.forEach(item => URL.revokeObjectURL(item.url)), [previewUrls]);
  useEffect(() => { if (report) requestAnimationFrame(() => reportCardRef.current?.focus()); }, [report]);

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
      if (!response.ok) {
        const message = response.status === 403
          ? t.networkAccessError
          : response.status === 503 ? t.unavailable : t.loginError;
        throw new Error(message);
      }
      setUser(data.user);
      setProvider(data.user.providers[0] || 'gemini');
      setLoginForm({ email: '', password: '' });
    } catch (error) { setLoginState({ loading: false, error: error.message }); return; }
    setLoginState({ loading: false, error: '' });
  }

  async function loadAuditConfiguration() {
    setConfigState({ loading: true, error: '' });
    try {
      const response = await fetch('/api/audit-config', { credentials: 'same-origin' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || t.configurationError);
      const products = Array.isArray(data.products) ? data.products : [];
      const scorecard = String(data.scorecard || '');
      setAuditConfig({ products, scorecard });
      setCustomQa(scorecard);
      setSelectedCategories([]);
      setSelectedSubCategoryIds([]);
      setConfigState({ loading: false, error: '' });
    } catch (error) {
      setConfigState({ loading: false, error: error.message || t.configurationError });
    }
  }

  async function logout() {
    analysisRunRef.current += 1;
    await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {});
    setUser(null); setFiles([]); setReport(''); setCached(false); setAuditConfig({ products: [], scorecard: '' }); setSelectedCategories([]); setSelectedSubCategoryIds([]); setCustomQa('');
  }

  function addFiles(incoming) {
    setFiles(current => {
      const next = [...current];
      for (const file of incoming) {
        const supported = file.type.startsWith('audio/') || /\.(mp3|wav|m4a|aac|ogg)$/i.test(file.name);
        if (!supported) { setStatus(t.unsupported); continue; }
        if (next.some(item => item.name === file.name && item.size === file.size)) { setStatus(t.duplicate); continue; }
        next.push(file);
        setStatus('');
      }
      return next;
    });
  }

  function removeFile(index) { setFiles(current => { const next = current.filter((_, itemIndex) => itemIndex !== index); if (!next.length && inputRef.current) inputRef.current.value = ''; return next; }); }
  function clearFiles() { setFiles([]); if (inputRef.current) inputRef.current.value = ''; }

  async function analyze() {
    if (!files.length) { setStatus(t.noFiles); return; }
    if (!availableProviders.includes(provider)) { setStatus(t.noProvider); return; }
    const runId = analysisRunRef.current + 1;
    analysisRunRef.current = runId;
    setBusy(true); setStatus(t.analyzing);
    try {
      const encoded = [];
      for (let index = 0; index < files.length; index += 1) {
        setStatus(`${t.analyzing} ${index + 1}/${files.length}`);
        encoded.push({ name: files[index].name, mimeType: files[index].type || 'audio/mp3', data: await toBase64(files[index]) });
      }
      const response = await fetch('/api/analyze', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider, mode, categories: selectedCategories, productSelections, customScorecard: customQaEnabled ? customQa.trim() : '', audioFiles: encoded }) });
      const data = await response.json().catch(() => ({}));
      if (runId !== analysisRunRef.current) return;
      if (response.status === 401) { await logout(); throw new Error(t.loginError); }
      if (!response.ok) throw new Error(data.error || t.serverError);
      setReport(data.report || ''); setCached(Boolean(data.cached)); setStatus('');
    } catch (error) { if (runId === analysisRunRef.current) setStatus(error.message || t.serverError); }
    finally { if (runId === analysisRunRef.current) setBusy(false); }
  }

  function exportPdf() { window.print(); }
  function exportWord() { if (!reportRef.current) return; const html = `<html><head><meta charset="utf-8"><title>QA Report</title><style>body{font-family:Arial}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:8px}h1{color:#b91c1c}</style></head><body>${reportRef.current.innerHTML}</body></html>`; const link = document.createElement('a'); link.href = `data:application/msword;charset=utf-8,${encodeURIComponent(html)}`; link.download = `QA_Audit_${new Date().toISOString().slice(0, 10)}.doc`; link.click(); }
  async function copyReport() { if (!navigator.clipboard) { setStatus(t.copyUnavailable); return; } await navigator.clipboard.writeText(reportRef.current?.innerText || ''); setStatus(language === 'en' ? 'Report copied.' : 'রিপোর্ট কপি হয়েছে।'); }
  function toggleLanguage() { setLanguage(current => current === 'en' ? 'bn' : 'en'); }

  if (loginState.loading) return <div className="loading-screen"><Sparkles size={22} /> Loading QA Auditor…</div>;
  if (!user) return <LoginScreen t={t} language={language} toggleLanguage={toggleLanguage} loginForm={loginForm} setLoginForm={setLoginForm} onSubmit={handleLogin} state={loginState} />;

  return <div className="app-shell" id="top">
    <header className="topbar">
      <div className="topbar-inner">
        <div className="brand-lockup"><div className="brand-mark"><AudioLines size={21} /></div><div><strong>{companyName}</strong><span>QA Auditor</span></div></div>
        <div className="topbar-actions">
          <LanguageToggle language={language} onClick={toggleLanguage} />
          <div className="account-chip"><div className="avatar"><UserRound size={16} /></div><div><strong>{user.name || user.email.split('@')[0]}</strong><span>{user.email}</span></div></div>
          <Button variant="ghost" size="icon" onClick={logout} aria-label={t.logout} title={t.logout}><LogOut size={18} /></Button>
        </div>
      </div>
    </header>

    <main className="main-area">
      <div className="page-container">
        <div className="page-heading"><h1>{t.pageTitle}</h1></div>

        <div className="audit-layout">
          <section className="flow-panel" aria-labelledby="recordings-heading">
            <div className="section-heading"><div className="section-icon"><CloudUpload size={19} /></div><h2 id="recordings-heading">{t.recordings}</h2></div>

            <button type="button" className={`dropzone ${dragActive ? 'drag-active' : ''} ${files.length ? 'compact' : ''}`} onClick={() => inputRef.current?.click()} onDragEnter={event => { event.preventDefault(); setDragActive(true); }} onDragOver={event => event.preventDefault()} onDragLeave={() => setDragActive(false)} onDrop={event => { event.preventDefault(); setDragActive(false); addFiles(Array.from(event.dataTransfer.files)); }} disabled={busy}>
              <div className="upload-icon"><CloudUpload size={25} /></div><div><strong>{t.drop}</strong><span>{t.supported}</span></div>
            </button>
            <input ref={inputRef} type="file" accept="audio/*" multiple hidden onChange={event => addFiles(Array.from(event.target.files || []))} />

            {files.length > 0 && <div className="file-list">{previewUrls.map(({ file, url }, index) => <div className="file-row" key={`${file.name}-${file.size}`}><div className="file-type"><FileAudio size={17} /></div><div className="file-meta"><strong>{file.name}</strong><span>{formatBytes(file.size)} · {t.fileReady}</span></div><audio controls src={url} preload="metadata" /><Button variant="ghost" size="icon" onClick={() => removeFile(index)} aria-label={`${t.remove} ${file.name}`} disabled={busy}><Trash2 size={16} /></Button></div>)}</div>}

            <div className="mode-section"><div className="inline-heading"><h2>{t.mode}</h2></div><div className="mode-grid" role="radiogroup" aria-label={t.mode}>{[['single', ClipboardCheck, t.qaMode], ['voice', MessageSquareQuote, t.voiceMode], ['coaching', BarChart3, t.coachingMode]].map(([value, Icon, label]) => <button type="button" role="radio" aria-checked={mode === value} className={`mode-card ${mode === value ? 'selected' : ''}`} key={value} onClick={() => setMode(value)} disabled={busy}><Icon size={19} /><span>{label}</span>{mode === value && <Check size={16} />}</button>)}</div></div>
            <div className="run-action"><Button className="analyze-button" size="lg" onClick={analyze} disabled={busy || !files.length}>{busy ? <RefreshCw className="spin" size={18} /> : <Play size={18} />}{busy ? t.analyzing : t.analyze}</Button></div>
            <div className={`status-message ${busy ? 'processing' : /copied|কপি হয়েছে/.test(status) ? 'success' : ''}`} role="status" aria-live="polite">{status}</div>
          </section>

          <aside className="setup-panel" aria-labelledby="setup-heading">
            <div className="section-heading"><div className="section-icon subtle"><Settings2 size={18} /></div><h2 id="setup-heading">{t.setup}</h2></div>
            <div className="setup-fields">
              {availableProviders.length > 1 && <div><Label htmlFor="provider">{t.provider}</Label><Select id="provider" value={provider} onChange={event => setProvider(event.target.value)} disabled={busy}>{availableProviders.includes('gemini') && <option value="gemini">{t.gemini}</option>}{availableProviders.includes('openai') && <option value="openai">{t.openai}</option>}</Select></div>}
              {availableProviders.length === 1 && <div className="provider-summary"><span>{t.provider}</span><strong>{provider === 'gemini' ? t.gemini : t.openai}</strong></div>}
              <div className="product-fields">
                <div><Label htmlFor="product-category">{t.category}</Label><MultiSelect id="product-category" value={selectedCategories} options={categoryOptions} placeholder={t.chooseCategory} searchPlaceholder={t.searchCategory} emptyText={t.noResults} selectedText={t.selectedCount} clearText={t.clearSelections} disabled={busy || configState.loading} onChange={values => { setSelectedCategories(values); setSelectedSubCategoryIds(current => current.filter(id => { try { return values.includes(JSON.parse(id)[0]); } catch { return false; } })); }} /></div>
                <div><Label htmlFor="product-sub-category">{t.subCategory}</Label><MultiSelect id="product-sub-category" value={selectedSubCategoryIds} options={subCategoryOptions} placeholder={t.chooseSubCategory} searchPlaceholder={t.searchSubCategory} emptyText={t.noResults} selectedText={t.selectedCount} clearText={t.clearSelections} disabled={busy || configState.loading || !selectedCategories.length} onChange={setSelectedSubCategoryIds} /></div>
                {configState.loading && <div className="field-state">{t.loadingSetup}</div>}
                {configState.error && <div className="error-message" role="alert">{configState.error}</div>}
              </div>
              <div className="scorecard-field"><div className="field-label-row"><Label htmlFor="custom-scorecard-toggle">{t.customQa}</Label><Switch id="custom-scorecard-toggle" aria-label={t.customQa} checked={customQaEnabled} onChange={setCustomQaEnabled} disabled={busy || !auditConfig.scorecard} /></div>{customQaEnabled ? <><Textarea aria-label={t.customQa} value={customQa} onChange={event => setCustomQa(event.target.value)} rows={9} disabled={busy} /><Button variant="link" size="sm" onClick={() => setCustomQa(auditConfig.scorecard)} disabled={busy}>{t.defaultScorecard}</Button></> : <button type="button" className="scorecard-summary" onClick={() => setCustomQaEnabled(true)} disabled={busy || !auditConfig.scorecard}><span><Check size={15} /> {t.defaultActive}</span><strong>{t.customize}</strong></button>}</div>
            </div>
          </aside>
        </div>

        {report && <Card ref={reportCardRef} className="report-card" tabIndex="-1"><CardHeader><div className="report-heading"><div><div className="result-kicker"><Check size={14} /> {cached ? t.cached : t.fresh}</div><CardTitle><FileText size={19} /> {t.report}</CardTitle></div><div className="report-actions"><Button variant="outline" size="sm" onClick={exportPdf}><FileDown size={15} /> {t.downloadPdf}</Button><Button variant="outline" size="sm" onClick={exportWord}><FileText size={15} /> {t.downloadWord}</Button><Button variant="outline" size="sm" onClick={copyReport}><Check size={15} /> {t.copy}</Button></div></div></CardHeader><CardContent><div ref={reportRef} className="report-content" dangerouslySetInnerHTML={{ __html: renderedReport }} /></CardContent></Card>}
      </div>
    </main>
  </div>;
}

function LoginScreen({ t, language, toggleLanguage, loginForm, setLoginForm, onSubmit, state }) {
  const [showPassword, setShowPassword] = useState(false);
  return <div className="login-shell"><Card className="login-card"><div className="login-brand"><strong>QA Auditor</strong><LanguageToggle language={language} onClick={toggleLanguage} /></div><Separator /><CardHeader><CardTitle>{t.signIn}</CardTitle><CardDescription>{t.signInDescription}</CardDescription></CardHeader><CardContent><form onSubmit={onSubmit} className="login-form"><Label htmlFor="email">{t.email}</Label><Input id="email" type="email" autoComplete="username" required value={loginForm.email} onChange={event => setLoginForm({ ...loginForm, email: event.target.value })} /><Label htmlFor="password">{t.password}</Label><div className="password-field"><Input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={loginForm.password} onChange={event => setLoginForm({ ...loginForm, password: event.target.value })} /><button type="button" className="password-toggle" onClick={() => setShowPassword(current => !current)} aria-label={showPassword ? t.hidePassword : t.showPassword} title={showPassword ? t.hidePassword : t.showPassword}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>{state.error && <div className="error-message" role="alert">{state.error}</div>}<Button type="submit" size="lg" disabled={state.loading}>{state.loading ? t.signingIn : t.login}</Button></form></CardContent></Card></div>;
}

function LanguageToggle({ language, onClick }) { return <Button variant="outline" size="sm" onClick={onClick}><Globe2 size={15} /> {language === 'en' ? 'বাংলা' : 'English'}</Button>; }

function toBase64(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = reject; reader.readAsDataURL(file); }); }

createRoot(document.getElementById('root')).render(<App />);
