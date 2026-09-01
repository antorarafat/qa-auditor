import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { marked } from "marked";
import DOMPurify from "dompurify";
import {
  AudioLines,
  BarChart3,
  Check,
  ChevronDown,
  ClipboardCheck,
  CloudUpload,
  Eye,
  EyeOff,
  FileAudio,
  FileDown,
  FileText,
  Globe2,
  LogOut,
  MessageSquareQuote,
  Play,
  RefreshCw,
  Settings2,
  Sparkles,
  Trash2,
  UserRound,
  AlertTriangle,
  History,
  KeyRound,
  Moon,
  Plus,
  ShieldCheck,
  Sun,
} from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Label,
  RadioGroup,
  RadioGroupItem,
  Select,
  Separator,
  Tabs,
  TabsList,
  TabsTrigger,
} from "./components/ui";
import { MultiSelect } from "./components/multi-select";
import { SingleSelect } from "./components/single-select";
import { LanguageProvider, useLanguage } from "./language";
import "./index.css";

const lazyView = (name) =>
  React.lazy(() =>
    import("./management").then((module) => ({ default: module[name] })),
  );
const AccountView = lazyView("AccountView");
const AdminView = lazyView("AdminView");
const PasswordChange = lazyView("PasswordChange");
const ReportsView = lazyView("ReportsView");
const SummaryView = lazyView("ReportsView");
const SetupScreen = lazyView("SetupScreen");
function ViewLoader({ children }) {
  const language = useLanguage();
  return (
    <React.Suspense
      fallback={
        <div className="loading-screen">
          <Sparkles size={22} />
          {language === "bn" ? "লোড হচ্ছে…" : "Loading…"}
        </div>
      }
    >
      {children}
    </React.Suspense>
  );
}

const viewPaths = {
  audit: "/audit",
  reports: "/report",
  summary: "/summary",
  admin: "/admin",
  account: "/password",
  "admin-network": "/network",
  "admin-products": "/products",
  "admin-company": "/company",
  "admin-scorecards": "/scorecards",
};
function viewFromPath(pathname) {
  if (pathname === "/" || pathname === "") return "audit";
  if (pathname === "/report" || pathname === "/reports") return "reports";
  if (pathname === "/summary") return "summary";
  if (pathname === "/password" || pathname === "/account") return "account";
  if (pathname === "/network") return "admin-network";
  if (pathname === "/products") return "admin-products";
  if (pathname === "/company") return "admin-company";
  if (pathname === "/scorecards") return "admin-scorecards";
  if (pathname === "/admin") return "admin";
  return "audit";
}
function adminTabPath(tab) {
  return tab === "network" ? "admin-network" : tab === "products" ? "admin-products" : tab === "company" ? "admin-company" : tab === "scorecards" ? "admin-scorecards" : "admin";
}

const copy = {
  en: {
    signIn: "Welcome back",
    signInDescription: "Sign in to continue to your call quality workspace.",
    email: "Email",
    password: "Password",
    showPassword: "Show password",
    hidePassword: "Hide password",
    login: "Sign in",
    signingIn: "Signing in…",
    logout: "Log out",
    provider: "AI provider",
    gemini: "Google Gemini",
    openai: "OpenAI",
    category: "Category",
    subCategory: "Sub-category",
    chooseCategory: "Choose categories (optional)",
    chooseSubCategory: "Choose sub-categories (optional)",
    searchCategory: "Search categories…",
    searchSubCategory: "Search sub-categories…",
    noResults: "No results found.",
    selectedCount: "{count} selected",
    clearSelections: "Clear selections",
    loadingSetup: "Loading audit setup…",
    configurationError: "The audit setup could not be loaded.",
    recordings: "Call recordings",
    drop: "Drop audio files here or browse",
    supported: "MP3, WAV, M4A, AAC, OGG",
    analyze: "Run",
    analyzing: "Analyzing…",
    mode: "Analysis mode",
    qaMode: "QA audit & scorecard",
    voiceMode: "Customer voice & objections",
    coachingMode: "Advisor pitch & coaching",
    report: "Audit report",
    downloadPdf: "PDF",
    downloadWord: "Word",
    copy: "Copy",
    cached: "Cached result",
    fresh: "Fresh AI result",
    noFiles: "Please upload at least one audio recording.",
    noProvider: "Your account has no key for this provider.",
    noParameter: "Choose a QA parameter.",
    serverError: "Something went wrong. Please try again.",
    loginError: "Invalid email or password.",
    loginRateLimited: "Too many login attempts. Please wait a few minutes and try again.",
    networkAccessError: "This network address is not allowed.",
    unavailable: "The authentication service is unavailable.",
    companyFallback: "QA Auditor",
    remove: "Remove",
    pageTitle: "Review a customer call",
    setup: "Audit setup",
    fileReady: "ready",
    unsupported: "Choose a supported audio file.",
    duplicate: "That recording is already in the list.",
    copyUnavailable: "Copy is unavailable in this browser.",
    parameter: "QA parameter",
    chooseParameter: "Choose a parameter",
    searchParameter: "Search parameters…",
    saveDefault: "Save as default",
    defaultSaved: "Default saved",
    temporary: "Active for this session",
    unsavedWarning:
      "Results were generated but were not saved to the database.",
    failedCall: "Call failed",
    summary: "Run summary",
    queued: "Queued",
    processing: "Processing",
    queuePosition: "Queue position: {position}",
    auditTab: "Audit",
    reportsTab: "Report",
    adminPanel: "Admin panel",
    accountSecurity: "Change Password/API",
    changeLanguage: "বাংলায় দেখুন",
    darkTheme: "Material dark theme",
    lightTheme: "Light theme",
    newAudit: "New Audit",
    reAudit: "Re-audit",
    profileMenu: "Open profile menu",
    modelUsed: "Models",
    reasoningUsed: "Reasoning",
    estimatedCost: "Estimated API cost",
    evidenceCache: "Evidence cache",
  },
  bn: {
    signIn: "আবার স্বাগতম",
    signInDescription: "কল কোয়ালিটি ওয়ার্কস্পেসে যেতে লগইন করুন।",
    email: "ইমেইল",
    password: "পাসওয়ার্ড",
    showPassword: "পাসওয়ার্ড দেখান",
    hidePassword: "পাসওয়ার্ড লুকান",
    login: "লগইন",
    signingIn: "যাচাই হচ্ছে…",
    logout: "লগআউট",
    provider: "AI প্রোভাইডার",
    gemini: "Google Gemini",
    openai: "OpenAI",
    category: "ক্যাটাগরি",
    subCategory: "সাব-ক্যাটাগরি",
    chooseCategory: "ক্যাটাগরি বেছে নিন (ঐচ্ছিক)",
    chooseSubCategory: "সাব-ক্যাটাগরি বেছে নিন (ঐচ্ছিক)",
    searchCategory: "ক্যাটাগরি খুঁজুন…",
    searchSubCategory: "সাব-ক্যাটাগরি খুঁজুন…",
    noResults: "কোনো ফল পাওয়া যায়নি।",
    selectedCount: "{count}টি নির্বাচিত",
    clearSelections: "নির্বাচন মুছুন",
    loadingSetup: "অডিট সেটআপ লোড হচ্ছে…",
    configurationError: "অডিট সেটআপ লোড করা যায়নি।",
    recordings: "কল রেকর্ডিং",
    drop: "এখানে অডিও ফেলুন অথবা ব্রাউজ করুন",
    supported: "MP3, WAV, M4A, AAC, OGG",
    analyze: "Run",
    analyzing: "বিশ্লেষণ হচ্ছে…",
    mode: "বিশ্লেষণের ধরন",
    qaMode: "QA অডিট ও স্কোরকার্ড",
    voiceMode: "কাস্টমার ভয়েস ও আপত্তি",
    coachingMode: "এডভাইসর পিচ ও কোচিং",
    report: "অডিট রিপোর্ট",
    downloadPdf: "PDF",
    downloadWord: "Word",
    copy: "কপি",
    cached: "ক্যাশড ফলাফল",
    fresh: "নতুন AI ফলাফল",
    noFiles: "কমপক্ষে একটি অডিও রেকর্ডিং আপলোড করুন।",
    noProvider: "এই প্রোভাইডারের জন্য কোনো key নেই।",
    noParameter: "একটি QA প্যারামিটার বেছে নিন।",
    serverError: "সমস্যা হয়েছে। আবার চেষ্টা করুন।",
    loginError: "ইমেইল বা পাসওয়ার্ড সঠিক নয়।",
    loginRateLimited: "অনেকবার লগইন চেষ্টা হয়েছে। কয়েক মিনিট অপেক্ষা করে আবার চেষ্টা করুন।",
    networkAccessError: "এই নেটওয়ার্ক ঠিকানাটি অনুমোদিত নয়।",
    unavailable: "অথেন্টিকেশন সার্ভিস এখন unavailable।",
    companyFallback: "QA Auditor",
    remove: "মুছুন",
    pageTitle: "কাস্টমার কল রিভিউ করুন",
    setup: "অডিট সেটআপ",
    fileReady: "প্রস্তুত",
    unsupported: "সমর্থিত অডিও ফাইল বেছে নিন।",
    duplicate: "এই রেকর্ডিংটি ইতিমধ্যে তালিকায় আছে।",
    copyUnavailable: "এই ব্রাউজারে কপি করা যাচ্ছে না।",
    parameter: "QA প্যারামিটার",
    chooseParameter: "প্যারামিটার বেছে নিন",
    searchParameter: "প্যারামিটার খুঁজুন…",
    saveDefault: "ডিফল্ট হিসেবে সেভ করুন",
    defaultSaved: "ডিফল্ট সেভ হয়েছে",
    temporary: "এই সেশনের জন্য সক্রিয়",
    unsavedWarning: "রিপোর্ট তৈরি হয়েছে, কিন্তু ডেটাবেসে সেভ হয়নি।",
    failedCall: "কল ব্যর্থ",
    summary: "রান সামারি",
    queued: "কিউতে আছে",
    processing: "প্রসেস হচ্ছে",
    queuePosition: "কিউ পজিশন: {position}",
    auditTab: "অডিট",
    reportsTab: "রিপোর্ট",
    adminPanel: "অ্যাডমিন প্যানেল",
    accountSecurity: "পাসওয়ার্ড/API পরিবর্তন",
    changeLanguage: "View in English",
    darkTheme: "ম্যাটেরিয়াল ডার্ক থিম",
    lightTheme: "লাইট থিম",
    newAudit: "নতুন অডিট",
    reAudit: "আবার অডিট করুন",
    profileMenu: "প্রোফাইল মেনু খুলুন",
    modelUsed: "ব্যবহৃত মডেল",
    reasoningUsed: "রিজনিং",
    estimatedCost: "আনুমানিক API খরচ",
    evidenceCache: "এভিডেন্স ক্যাশ",
  },
};

function formatBytes(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
function renderMarkdown(markdown) {
  return DOMPurify.sanitize(marked.parse(markdown || ""));
}

const WORD_REPORT_STYLES = `
  @page WordSection1 { size: 8.27in 11.69in; margin: .62in .55in; }
  body { margin: 0; color: #252a34; font-family: "Nirmala UI", "Arial Unicode MS", Arial, sans-serif; font-size: 10.5pt; line-height: 1.55; }
  .result-items { display: block; }
  .report-card { page: WordSection1; page-break-after: always; }
  .report-card:last-child { page-break-after: auto; }
  .card-header { display: none; }
  .card-content { padding: 0; }
  .report-content h1 { margin: 0 0 20pt; color: #d92d20; font-size: 20pt; line-height: 1.25; }
  .report-content h2 { margin: 20pt 0 10pt; padding-top: 12pt; border-top: 1pt solid #d0d5dd; color: #204bb5; font-size: 13.5pt; line-height: 1.35; page-break-after: avoid; }
  .report-content h1 + h2 { margin-top: 0; padding-top: 0; border-top: 0; }
  .report-content p { margin: 0 0 9pt; }
  .report-content ul, .report-content ol { margin: 0 0 12pt; padding-left: 20pt; }
  .report-content li { margin-bottom: 4pt; }
  .report-content strong { color: #111827; }
  .report-content blockquote { margin: 14pt 0 0; padding: 9pt 11pt; border-left: 3pt solid #e5484d; background: #fff7f7; }
  .report-content blockquote p { margin: 0; }
  .report-content table { width: 100%; margin: 10pt 0 15pt; border: 1pt solid #98a2b3; border-collapse: collapse; font-size: 8pt; line-height: 1.35; }
  .report-content th, .report-content td { padding: 5pt; border: 1pt solid #b7bec8; text-align: left; vertical-align: top; }
  .report-content th { background: #eef1f5; color: #172033; font-weight: bold; }
  .report-content tbody tr:last-child { background: #f2f4f7; }
  .failed-result { color: #b42318; }
`;

function AppContent({ language, toggleLanguage, theme, toggleTheme }) {
  const [user, setUser] = useState(null);
  const [loginState, setLoginState] = useState({ loading: true, error: "" });
  const [setupRequired, setSetupRequired] = useState(false);
  const [view, setView] = useState(() => viewFromPath(window.location.pathname));
  const [provider, setProvider] = useState("gemini");
  const [auditConfig, setAuditConfig] = useState({
    products: [],
    parameters: [],
    savedDefaultParameter: "",
    activeParameter: "",
  });
  const [configState, setConfigState] = useState({ loading: false, error: "" });
  const [parameter, setParameter] = useState("");
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedSubCategoryIds, setSelectedSubCategoryIds] = useState([]);
  const [mode, setMode] = useState("single");
  const [files, setFiles] = useState([]);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef(null);
  const reportRef = useRef(null);
  const reportCardRef = useRef(null);
  const runRef = useRef(0);
  const t = copy[language];

  useEffect(() => {
    checkSession();
  }, []);
  useEffect(() => {
    const onPopState = () => setView(viewFromPath(window.location.pathname));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  function navigateView(next) {
    setView(next);
    const path = viewPaths[next] || "/audit";
    if (window.location.pathname !== path) window.history.pushState({}, "", path);
  }
  useEffect(() => {
    if (user) {
      loadAuditConfiguration();
      const jobId = localStorage.getItem("qa-active-job");
      if (jobId) resumeAnalysisJob(jobId);
    }
  }, [user]);
  useEffect(() => {
    document.body.dataset.workspaceTheme = user ? theme : "light";
  }, [theme, user]);
  useEffect(() => {
    if (result) requestAnimationFrame(() => reportCardRef.current?.focus());
  }, [result]);

  const providers = user?.providers || [];
  const companyName = user?.companyName || t.companyFallback;
  const categoryOptions = useMemo(
    () => auditConfig.products.map((item) => item.category),
    [auditConfig.products],
  );
  const subCategoryOptions = useMemo(
    () =>
      auditConfig.products
        .filter((item) => selectedCategories.includes(item.category))
        .flatMap((item) =>
          item.subCategories.map((subCategory) => ({
            value: JSON.stringify([item.category, subCategory]),
            label: subCategory,
            description: item.category,
            category: item.category,
            subCategory,
          })),
        ),
    [auditConfig.products, selectedCategories],
  );
  const productSelections = useMemo(
    () =>
      selectedSubCategoryIds
        .map((id) => subCategoryOptions.find((option) => option.value === id))
        .filter(Boolean)
        .map((option) => ({
          category: option.category,
          subCategory: option.subCategory,
        })),
    [selectedSubCategoryIds, subCategoryOptions],
  );
  const previewUrls = useMemo(
    () => files.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [files],
  );
  useEffect(
    () => () => previewUrls.forEach((item) => URL.revokeObjectURL(item.url)),
    [previewUrls],
  );

  async function checkSession() {
    try {
      const response = await fetch("/api/session", {
        credentials: "same-origin",
      });
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        setProvider(data.user.providers[0] || "gemini");
        setSetupRequired(false);
      } else {
        const setup = await fetch("/api/setup/status")
          .then((item) => item.json())
          .catch(() => ({ required: false }));
        setSetupRequired(Boolean(setup.required));
      }
    } catch {}
    setLoginState((state) => ({ ...state, loading: false }));
  }
  async function handleLogin(event) {
    event.preventDefault();
    setLoginState({ loading: true, error: "" });
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginForm),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          response.status === 429
            ? t.loginRateLimited
            : response.status === 403
            ? t.networkAccessError
            : response.status === 503
              ? t.unavailable
              : t.loginError,
        );
      setUser(data.user);
      setProvider(data.user.providers[0] || "gemini");
      setLoginForm({ email: "", password: "" });
      setLoginState({ loading: false, error: "" });
    } catch (error) {
      setLoginState({ loading: false, error: error.message });
    }
  }
  async function loadAuditConfiguration() {
    setConfigState({ loading: true, error: "" });
    try {
      const response = await fetch("/api/audit-config", {
        credentials: "same-origin",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || t.configurationError);
      const next = {
        products: Array.isArray(data.products) ? data.products : [],
        parameters: Array.isArray(data.parameters) ? data.parameters : [],
        savedDefaultParameter: String(data.savedDefaultParameter || ""),
        activeParameter: String(data.activeParameter || ""),
      };
      setAuditConfig(next);
      setParameter(next.activeParameter);
      setSelectedCategories([]);
      setSelectedSubCategoryIds([]);
      setConfigState({ loading: false, error: "" });
    } catch (error) {
      setConfigState({
        loading: false,
        error: error.message || t.configurationError,
      });
    }
  }
  async function changeParameter(value) {
    setParameter(value);
    setAuditConfig((current) => ({ ...current, activeParameter: value }));
    setStatus("");
    try {
      const response = await fetch("/api/session/parameter", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parameter: value }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || t.serverError);
    } catch (error) {
      setStatus(error.message);
      loadAuditConfiguration();
    }
  }
  async function saveDefault() {
    try {
      const response = await fetch("/api/user/default-parameter", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parameter }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || t.serverError);
      setAuditConfig((current) => ({
        ...current,
        savedDefaultParameter: data.savedDefaultParameter,
        activeParameter: data.activeParameter,
      }));
      setStatus(t.defaultSaved);
    } catch (error) {
      setStatus(error.message);
    }
  }
  async function logout() {
    runRef.current += 1;
    localStorage.removeItem("qa-active-job");
    await fetch("/api/logout", {
      method: "POST",
      credentials: "same-origin",
    }).catch(() => {});
    setUser(null);
    navigateView("audit");
    setFiles([]);
    setResult(null);
    setParameter("");
    setAuditConfig({
      products: [],
      parameters: [],
      savedDefaultParameter: "",
      activeParameter: "",
    });
    setSelectedCategories([]);
    setSelectedSubCategoryIds([]);
  }
  function startNewAudit() {
    runRef.current += 1;
    localStorage.removeItem("qa-active-job");
    navigateView("audit");
    setFiles([]);
    setResult(null);
    setBusy(false);
    setStatus("");
    setDragActive(false);
    setMode("single");
    setSelectedCategories([]);
    setSelectedSubCategoryIds([]);
    if (inputRef.current) inputRef.current.value = "";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function addFiles(incoming) {
    setFiles((current) => {
      const next = [...current];
      for (const file of incoming) {
        const supported =
          file.type.startsWith("audio/") ||
          /\.(mp3|wav|m4a|aac|ogg)$/i.test(file.name);
        if (!supported) {
          setStatus(t.unsupported);
          continue;
        }
        if (
          next.some(
            (item) => item.name === file.name && item.size === file.size,
          )
        ) {
          setStatus(t.duplicate);
          continue;
        }
        next.push(file);
        setStatus("");
      }
      return next;
    });
  }
  function removeFile(index) {
    setFiles((current) =>
      current.filter((_, itemIndex) => itemIndex !== index),
    );
  }

  async function pollAnalysisJob(jobId, runId) {
    for (;;) {
      const response = await fetch(
        `/api/analysis-jobs/${encodeURIComponent(jobId)}`,
        { credentials: "same-origin" },
      );
      const job = await response.json().catch(() => ({}));
      if (runId !== runRef.current) return null;
      if (response.status === 401) {
        await logout();
        throw new Error(t.loginError);
      }
      if (!response.ok) throw new Error(job.error || t.serverError);
      if (job.status === "complete") {
        localStorage.removeItem("qa-active-job");
        return job.result;
      }
      if (job.status === "failed") {
        localStorage.removeItem("qa-active-job");
        throw new Error(job.error?.error || t.serverError);
      }
      setStatus(
        job.status === "queued"
          ? `${t.queued} · ${t.queuePosition.replace("{position}", job.position || 1)}`
          : t.processing,
      );
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  async function resumeAnalysisJob(jobId) {
    const runId = ++runRef.current;
    setBusy(true);
    setStatus(t.processing);
    try {
      const data = await pollAnalysisJob(jobId, runId);
      if (data && runId === runRef.current) {
        setResult(data);
        setStatus("");
      }
    } catch (error) {
      localStorage.removeItem("qa-active-job");
      if (runId === runRef.current) setStatus(error.message || t.serverError);
    } finally {
      if (runId === runRef.current) setBusy(false);
    }
  }

  async function analyze(forceFresh = false) {
    if (!files.length) return setStatus(t.noFiles);
    if (!providers.includes(provider)) return setStatus(t.noProvider);
    if (mode !== "voice" && !parameter) return setStatus(t.noParameter);
    const runId = ++runRef.current;
    setBusy(true);
    setStatus(t.analyzing);
    setResult(null);
    try {
      const audioFiles = [];
      for (let index = 0; index < files.length; index += 1) {
        setStatus(`${t.analyzing} ${index + 1}/${files.length}`);
        audioFiles.push({
          name: files[index].name,
          mimeType: files[index].type || "audio/mp3",
          data: await toBase64(files[index]),
        });
      }
      const response = await fetch("/api/analyze", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          mode,
          parameter,
          categories: selectedCategories,
          productSelections,
          forceFresh,
          audioFiles,
        }),
      });
      let data = await response.json().catch(() => ({}));
      if (runId !== runRef.current) return;
      if (response.status === 401) {
        await logout();
        throw new Error(t.loginError);
      }
      if (!response.ok) throw new Error(data.error || t.serverError);
      if (response.status === 202 && data.jobId) {
        localStorage.setItem("qa-active-job", data.jobId);
        data = await pollAnalysisJob(data.jobId, runId);
        if (!data) return;
      }
      setResult(data);
      setStatus("");
    } catch (error) {
      if (runId === runRef.current) setStatus(error.message || t.serverError);
    } finally {
      if (runId === runRef.current) setBusy(false);
    }
  }

  function exportPdf() {
    window.print();
  }
  function exportWord() {
    if (!reportRef.current) return;
    const html = `<!doctype html><html lang="${language === "bn" ? "bn" : "en"}"><head><meta charset="utf-8"><title>QA Report</title><style>${WORD_REPORT_STYLES}</style></head><body><div class="result-items">${reportRef.current.innerHTML}</div></body></html>`;
    const url = URL.createObjectURL(
      new Blob(["\ufeff", html], { type: "application/msword" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `QA_Audit_${new Date().toISOString().slice(0, 10)}.doc`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  async function copyReport() {
    if (!navigator.clipboard) return setStatus(t.copyUnavailable);
    await navigator.clipboard.writeText(result?.report || "");
    setStatus(language === "en" ? "Report copied." : "রিপোর্ট কপি হয়েছে।");
  }
  if (loginState.loading)
    return (
      <div className="loading-screen">
        <Sparkles size={22} />
        {language === "bn" ? "QA Auditor লোড হচ্ছে…" : "Loading QA Auditor…"}
      </div>
    );
  if (setupRequired)
    return (
      <ViewLoader>
        <SetupScreen
          onComplete={() => {
            setSetupRequired(false);
            setLoginState({ loading: false, error: "" });
          }}
        />
      </ViewLoader>
    );
  if (!user)
    return (
      <LoginScreen
        t={t}
        language={language}
        toggleLanguage={toggleLanguage}
        loginForm={loginForm}
        setLoginForm={setLoginForm}
        onSubmit={handleLogin}
        state={loginState}
      />
    );
  if (user.mustChangePassword)
    return (
      <ViewLoader>
        <PasswordChange forced onChanged={logout} />
      </ViewLoader>
    );
  return (
    <div className={`app-shell${theme === "dark" ? " theme-dark" : ""}`} id="top">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand-lockup">
            <div className="brand-mark">
              <AudioLines size={21} />
            </div>
            <div>
              <strong>{companyName}</strong>
              <span>QA Auditor</span>
            </div>
          </div>
          <Tabs className="app-nav-shell" value={["audit", "reports", "summary"].includes(view) ? view : undefined} onValueChange={navigateView}>
            <TabsList className="app-nav" aria-label={t.auditTab}>
              <TabsTrigger value="audit">
                <ClipboardCheck size={15} /> {t.auditTab}
              </TabsTrigger>
              <TabsTrigger value="reports">
                <History size={15} /> {t.reportsTab}
              </TabsTrigger>
              <TabsTrigger value="summary">
                <FileText size={15} /> {t.summary || "Summary"}
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="topbar-actions">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  className="account-chip"
                  aria-label={t.profileMenu}
                >
                  <div className="avatar">
                    <UserRound size={16} />
                  </div>
                  <div className="account-details">
                    <strong>
                      {user.username || user.name || user.email.split("@")[0]}
                    </strong>
                    <span>{user.email}</span>
                  </div>
                  <ChevronDown className="account-chevron" size={15} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="profile-menu" align="end">
                <DropdownMenuLabel>
                  <strong>
                    {user.username || user.name || user.email.split("@")[0]}
                  </strong>
                  <span>{user.email}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {user.role === "admin" && (
                <DropdownMenuItem onSelect={() => navigateView("admin")}>
                    <ShieldCheck size={16} /> {t.adminPanel}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onSelect={() => navigateView("account")}>
                  <KeyRound size={16} /> {t.accountSecurity}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={toggleLanguage}>
                  <Globe2 size={16} /> {t.changeLanguage}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={toggleTheme}>
                  {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
                  {theme === "dark" ? t.lightTheme : t.darkTheme}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem destructive onSelect={logout}>
                  <LogOut size={16} /> {t.logout}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
      <main className="main-area">
        <ViewLoader>
          {view === "reports" ? (
            <ReportsView user={user} onNewAudit={startNewAudit} />
          ) : view === "summary" ? (
            <SummaryView user={user} summaryMode onNewAudit={startNewAudit} />
          ) : view === "admin" && user.role === "admin" ? (
            <AdminView onTabChange={(tab) => navigateView(adminTabPath(tab))} />
          ) : view.startsWith("admin-") && user.role === "admin" ? (
            <AdminView initialTab={view.replace("admin-", "")} onTabChange={(tab) => navigateView(adminTabPath(tab))} />
          ) : view === "account" ? (
            <AccountView user={user} onSignedOut={logout} />
          ) : (
            <div className="page-container">
              <div className="page-heading">
                <h1>{t.pageTitle}</h1>
                <Button variant="outline" onClick={startNewAudit}>
                  <Plus size={16} /> {t.newAudit}
                </Button>
              </div>
              <div className="audit-layout">
                <section className="flow-panel">
                  <div className="section-heading">
                    <div className="section-icon">
                      <CloudUpload size={19} />
                    </div>
                    <h2>{t.recordings}</h2>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className={`dropzone ${dragActive ? "drag-active" : ""} ${files.length ? "compact" : ""}`}
                    onClick={() => inputRef.current?.click()}
                    onDragEnter={(event) => {
                      event.preventDefault();
                      setDragActive(true);
                    }}
                    onDragOver={(event) => event.preventDefault()}
                    onDragLeave={() => setDragActive(false)}
                    onDrop={(event) => {
                      event.preventDefault();
                      setDragActive(false);
                      addFiles(Array.from(event.dataTransfer.files));
                    }}
                    disabled={busy}
                  >
                    <div className="upload-icon">
                      <CloudUpload size={25} />
                    </div>
                    <div>
                      <strong>{t.drop}</strong>
                      <span>{t.supported}</span>
                    </div>
                  </Button>
                  <input
                    ref={inputRef}
                    type="file"
                    accept="audio/*"
                    multiple
                    hidden
                    onChange={(event) =>
                      addFiles(Array.from(event.target.files || []))
                    }
                  />
                  {files.length > 0 && (
                    <div className="file-list">
                      {previewUrls.map(({ file, url }, index) => (
                        <div
                          className="file-row"
                          key={`${file.name}-${file.size}`}
                        >
                          <div className="file-type">
                            <FileAudio size={17} />
                          </div>
                          <div className="file-meta">
                            <strong>{file.name}</strong>
                            <span>
                              {formatBytes(file.size)} · {t.fileReady}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeFile(index)}
                            aria-label={`${t.remove} ${file.name}`}
                            disabled={busy}
                          >
                            <Trash2 size={16} />
                          </Button>
                          <audio controls src={url} preload="metadata" />
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mode-section">
                    <div className="inline-heading">
                      <h2>{t.mode}</h2>
                    </div>
                    <RadioGroup
                      className="mode-grid"
                      value={mode}
                      onValueChange={setMode}
                      disabled={busy}
                      aria-label={t.mode}
                    >
                      {[
                        ["single", ClipboardCheck, t.qaMode],
                        ["voice", MessageSquareQuote, t.voiceMode],
                        ["coaching", BarChart3, t.coachingMode],
                      ].map(([value, Icon, label]) => (
                        <RadioGroupItem
                          className={`mode-card ${mode === value ? "selected" : ""}`}
                          key={value}
                          value={value}
                        >
                          <Icon size={19} />
                          <span>{label}</span>
                          {mode === value && <Check size={16} />}
                        </RadioGroupItem>
                      ))}
                    </RadioGroup>
                  </div>
                  <div className="run-action">
                    <Button
                      className="analyze-button"
                      size="lg"
                      onClick={() => analyze(false)}
                      disabled={
                        busy ||
                        !files.length ||
                        (mode !== "voice" && !parameter)
                      }
                    >
                      {busy ? (
                        <RefreshCw className="spin" size={18} />
                      ) : (
                        <Play size={18} />
                      )}
                      {busy ? t.analyzing : t.analyze}
                    </Button>
                  </div>
                  <div
                    className={`status-message ${busy ? "processing" : ""}`}
                    role="status"
                  >
                    {status}
                  </div>
                </section>
                <aside className="setup-panel">
                  <div className="section-heading">
                    <div className="section-icon subtle">
                      <Settings2 size={18} />
                    </div>
                    <h2>{t.setup}</h2>
                  </div>
                  <div className="setup-fields">
                    {providers.length > 1 ? (
                      <div>
                        <Label htmlFor="provider">{t.provider}</Label>
                        <Select
                          id="provider"
                          value={provider}
                          onValueChange={setProvider}
                          disabled={busy}
                          options={providers.map((value) => ({
                            value,
                            label: value === "gemini" ? t.gemini : t.openai,
                          }))}
                        />
                      </div>
                    ) : (
                      <div className="provider-summary">
                        <span>{t.provider}</span>
                        <strong>
                          {provider === "gemini" ? t.gemini : t.openai}
                        </strong>
                      </div>
                    )}
                    {mode !== "voice" && (
                      <div className="parameter-field">
                        <Label htmlFor="qa-parameter">{t.parameter}</Label>
                        <SingleSelect
                          id="qa-parameter"
                          value={parameter}
                          options={auditConfig.parameters}
                          placeholder={t.chooseParameter}
                          searchPlaceholder={t.searchParameter}
                          emptyText={t.noResults}
                          disabled={busy || configState.loading}
                          onChange={changeParameter}
                        />
                        <div className="field-footer">
                          <span>
                            {parameter === auditConfig.savedDefaultParameter
                              ? t.defaultSaved
                              : t.temporary}
                          </span>
                          {parameter &&
                            parameter !== auditConfig.savedDefaultParameter && (
                              <Button
                                variant="link"
                                size="sm"
                                onClick={saveDefault}
                                disabled={busy}
                              >
                                {t.saveDefault}
                              </Button>
                            )}
                        </div>
                      </div>
                    )}
                    <div className="product-fields">
                      <div>
                        <Label htmlFor="product-category">{t.category}</Label>
                        <MultiSelect
                          id="product-category"
                          value={selectedCategories}
                          options={categoryOptions}
                          placeholder={t.chooseCategory}
                          searchPlaceholder={t.searchCategory}
                          emptyText={t.noResults}
                          selectedText={t.selectedCount}
                          clearText={t.clearSelections}
                          disabled={busy || configState.loading}
                          onChange={(values) => {
                            setSelectedCategories(values);
                            setSelectedSubCategoryIds((current) =>
                              current.filter((id) => {
                                try {
                                  return values.includes(JSON.parse(id)[0]);
                                } catch {
                                  return false;
                                }
                              }),
                            );
                          }}
                        />
                      </div>
                      <div>
                        <Label htmlFor="product-sub-category">
                          {t.subCategory}
                        </Label>
                        <MultiSelect
                          id="product-sub-category"
                          value={selectedSubCategoryIds}
                          options={subCategoryOptions}
                          placeholder={t.chooseSubCategory}
                          searchPlaceholder={t.searchSubCategory}
                          emptyText={t.noResults}
                          selectedText={t.selectedCount}
                          clearText={t.clearSelections}
                          disabled={
                            busy ||
                            configState.loading ||
                            !selectedCategories.length
                          }
                          onChange={setSelectedSubCategoryIds}
                        />
                      </div>
                      {configState.loading && (
                        <div className="field-state">{t.loadingSetup}</div>
                      )}
                      {configState.error && (
                        <div className="error-message">{configState.error}</div>
                      )}
                    </div>
                  </div>
                </aside>
              </div>
              {result && (
                <section
                  ref={reportCardRef}
                  className="result-section"
                  tabIndex="-1"
                >
                  <div className="report-toolbar">
                    <div>
                      <div className="result-kicker">
                        <Check size={14} /> {result.cached ? t.cached : t.fresh}
                      </div>
                      <h2>
                        <FileText size={19} /> {t.report}
                      </h2>
                    </div>
                    <div className="report-actions">
                      <Button variant="outline" size="sm" onClick={exportPdf}>
                        <FileDown size={15} /> {t.downloadPdf}
                      </Button>
                      <Button variant="outline" size="sm" onClick={exportWord}>
                        <FileText size={15} /> {t.downloadWord}
                      </Button>
                      <Button variant="outline" size="sm" onClick={copyReport}>
                        <Check size={15} /> {t.copy}
                      </Button>
                      <Button size="sm" onClick={() => analyze(true)} disabled={busy || !files.length}>
                        <RefreshCw size={15} /> {t.reAudit}
                      </Button>
                    </div>
                  </div>
                  {(result.model || result.reasoningEffort || result.evidenceCache) && (
                    <div className="result-meta">
                      {result.model && <span>{t.modelUsed}: <strong>{result.model}</strong></span>}
                      {result.reasoningEffort && <span>{t.reasoningUsed}: <strong>{result.reasoningEffort}</strong></span>}
                      {Number.isFinite(Number(result.estimatedCostUsd)) && <span>{t.estimatedCost}: <strong>${Number(result.estimatedCostUsd).toFixed(6)}</strong></span>}
                      {result.evidenceCache && <span>{t.evidenceCache}: <strong>{result.evidenceCache.hits || 0}/{(result.evidenceCache.hits || 0) + (result.evidenceCache.misses || 0)}</strong></span>}
                    </div>
                  )}
                  {result.auditResultWrite?.status === "failed" && (
                    <div className="storage-warning">
                      <AlertTriangle size={18} />
                      <strong>
                        {result.auditResultWrite.message || t.unsavedWarning}
                      </strong>
                    </div>
                  )}
                  <div ref={reportRef} className="result-items">
                    {result.items?.map((item, index) =>
                      item.status === "success" ? (
                        <Card
                          className="report-card"
                          key={`${item.kind}-${item.fileName || index}`}
                        >
                          <CardHeader>
                            <CardTitle>
                              {item.kind === "summary"
                                ? t.summary
                                : item.fileName || t.report}
                              {item.kind === "call" && (
                                <span
                                  className={`score-pill ${item.ce ? "ce" : ""}`}
                                >
                                  {item.score}/{item.maximum}
                                </span>
                              )}
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div
                              className="report-content"
                              dangerouslySetInnerHTML={{
                                __html: renderMarkdown(item.markdown),
                              }}
                            />
                          </CardContent>
                        </Card>
                      ) : (
                        <Card
                          className="report-card failed-result"
                          key={`${item.kind}-${item.fileName || index}`}
                        >
                          <CardContent>
                            <AlertTriangle size={20} />
                            <div>
                              <strong>
                                {item.fileName || t.summary}: {t.failedCall}
                              </strong>
                              <p>{item.error}</p>
                            </div>
                          </CardContent>
                        </Card>
                      ),
                    )}
                  </div>
                </section>
              )}
            </div>
          )}
        </ViewLoader>
      </main>
    </div>
  );
}

function LoginScreen({
  t,
  language,
  toggleLanguage,
  loginForm,
  setLoginForm,
  onSubmit,
  state,
}) {
  const [showPassword, setShowPassword] = useState(false);
  return (
    <div className="login-shell">
      <div className="login-hero" aria-hidden="true">
        <div className="login-hero-grid" />
        <div className="login-hero-inner">
          <div className="login-hero-brand"><span className="login-hero-mark"><AudioLines size={18} /></span><strong>QA Auditor</strong></div>
          <div className="login-hero-copy">
            <h1>Turn every call into<br /><em>clear coaching.</em></h1>
            <p>Upload recordings, evaluate consistently, and give every advisor feedback they can act on.</p>
            <div className="login-hero-cards">
              <div className="login-hero-card card-a"><span>QA scorecard</span><strong>92 / 100</strong></div>
              <div className="login-hero-card card-b"><span>Advisor coaching</span><strong>Actionable insights</strong></div>
              <div className="login-hero-card card-c"><span>Customer voice</span><strong>Find the signal</strong></div>
            </div>
          </div>
        </div>
      </div>
      <Card className="login-card">
        <div className="login-form-panel">
          <div className="login-brand"><strong>QA Auditor</strong><LanguageToggle language={language} onClick={toggleLanguage} /></div>
          <CardHeader>
            <CardTitle>{language === "bn" ? "QA Auditor-এ সাইন ইন করুন" : "Sign in to QA Auditor"}</CardTitle>
            <CardDescription>{t.signInDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="login-form">
            <Label htmlFor="email">{t.email}</Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              required
              value={loginForm.email}
              onChange={(event) =>
                setLoginForm({ ...loginForm, email: event.target.value })
              }
            />
            <Label htmlFor="password">{t.password}</Label>
            <div className="password-field">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={loginForm.password}
                onChange={(event) =>
                  setLoginForm({ ...loginForm, password: event.target.value })
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="password-toggle"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? t.hidePassword : t.showPassword}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </Button>
            </div>
            {state.error && (
              <div className="error-message" role="alert">
                {state.error}
              </div>
            )}
            <Button type="submit" size="lg" disabled={state.loading}>
              {state.loading ? t.signingIn : t.login}
            </Button>
            </form>
          </CardContent>
        </div>
      </Card>
    </div>
  );
}
function LanguageToggle({ language, onClick }) {
  return (
    <Button variant="outline" size="sm" onClick={onClick}>
      <Globe2 size={15} /> {language === "en" ? "বাংলা" : "English"}
    </Button>
  );
}
function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function App() {
  const [language, setLanguage] = useState(
    () => localStorage.getItem("qa-language") || "en",
  );
  const [theme, setTheme] = useState(
    () => localStorage.getItem("qa-theme") || "light",
  );
  useEffect(() => {
    localStorage.setItem("qa-language", language);
    document.documentElement.lang = language === "bn" ? "bn" : "en";
  }, [language]);
  useEffect(() => {
    localStorage.setItem("qa-theme", theme);
  }, [theme]);
  const toggleLanguage = () =>
    setLanguage((current) => (current === "en" ? "bn" : "en"));
  const toggleTheme = () =>
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  return (
    <LanguageProvider language={language}>
      <AppContent language={language} toggleLanguage={toggleLanguage} theme={theme} toggleTheme={toggleTheme} />
    </LanguageProvider>
  );
}

createRoot(document.getElementById("root")).render(<App />);
