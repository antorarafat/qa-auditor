import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  Check,
  ChevronLeft,
  FileText,
  FileDown,
  KeyRound,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  Textarea,
} from "./components/ui";

async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(
      data.error || "The request could not be completed.",
    );
    error.status = response.status;
    error.code = data.errorCode;
    throw error;
  }
  return data;
}
function body(method, value) {
  return { method, body: JSON.stringify(value) };
}
function Markdown({ value }) {
  return (
    <div
      className="report-content"
      dangerouslySetInnerHTML={{
        __html: DOMPurify.sanitize(marked.parse(value || "")),
      }}
    />
  );
}
function Notice({ message, error = false }) {
  return message ? (
    <div className={error ? "management-notice error" : "management-notice"}>
      {error ? <AlertTriangle size={16} /> : <Check size={16} />}
      {message}
    </div>
  ) : null;
}

export function SetupScreen({ onComplete }) {
  const [form, setForm] = useState({
    setupToken: "",
    email: "",
    username: "",
    password: "",
    companyName: "",
  });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await api("/api/setup", body("POST", form));
      onComplete();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-shell">
      <Card className="login-card setup-card">
        <CardHeader>
          <div className="setup-symbol">
            <ShieldCheck />
          </div>
          <CardTitle>Set up QA Auditor</CardTitle>
          <CardDescription>
            Create the first administrator. The setup token comes from your
            server’s .env file and works only once.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="stack-form" onSubmit={submit}>
            <Label>Setup token</Label>
            <Input
              type="password"
              required
              value={form.setupToken}
              onChange={(e) => setForm({ ...form, setupToken: e.target.value })}
            />
            <div className="form-grid">
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div>
                <Label>Username</Label>
                <Input
                  required
                  value={form.username}
                  onChange={(e) =>
                    setForm({ ...form, username: e.target.value })
                  }
                />
              </div>
            </div>
            <Label>Company name</Label>
            <Input
              required
              value={form.companyName}
              onChange={(e) =>
                setForm({ ...form, companyName: e.target.value })
              }
            />
            <Label>Password</Label>
            <Input
              type="password"
              minLength="12"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <small>
              Use 12–128 characters and do not include the username or email
              name.
            </small>
            <Notice message={message} error />
            <Button size="lg" disabled={busy}>
              {busy ? "Creating…" : "Create administrator"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export function PasswordChange({ forced = false, onChanged }) {
  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirm: "",
  });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    if (form.newPassword !== form.confirm)
      return setMessage("The new passwords do not match.");
    setBusy(true);
    setMessage("");
    try {
      await api("/api/account/password", body("PUT", form));
      onChanged?.();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }
  const content = (
    <form className="stack-form" onSubmit={submit}>
      <Label>Current password</Label>
      <Input
        type="password"
        autoComplete="current-password"
        required
        value={form.currentPassword}
        onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
      />
      <Label>New password</Label>
      <Input
        type="password"
        autoComplete="new-password"
        minLength="12"
        required
        value={form.newPassword}
        onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
      />
      <Label>Confirm new password</Label>
      <Input
        type="password"
        autoComplete="new-password"
        required
        value={form.confirm}
        onChange={(e) => setForm({ ...form, confirm: e.target.value })}
      />
      <Notice message={message} error />
      <Button disabled={busy}>{busy ? "Saving…" : "Change password"}</Button>
    </form>
  );
  if (!forced) return content;
  return (
    <div className="login-shell">
      <Card className="login-card">
        <CardHeader>
          <CardTitle>Set a private password</CardTitle>
          <CardDescription>
            Your temporary password must be replaced before you can continue.
            Changing it signs out every device.
          </CardDescription>
        </CardHeader>
        <CardContent>{content}</CardContent>
      </Card>
    </div>
  );
}

export function AccountView({ user, onSignedOut }) {
  const [keys, setKeys] = useState(user.apiKeyStatus || {});
  const [provider, setProvider] = useState("gemini");
  const [apiKey, setApiKey] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function saveKey(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const data = await api(
        `/api/account/api-keys/${provider}`,
        body("PUT", { apiKey }),
      );
      setKeys((current) => ({ ...current, [provider]: data.apiKey }));
      setApiKey("");
      setMessage(data.warning || "API key encrypted and saved.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }
  async function removeKey(name) {
    if (!confirm(`Remove your ${name} API key?`)) return;
    await api(`/api/account/api-keys/${name}`, { method: "DELETE" });
    setKeys((current) => ({ ...current, [name]: { configured: false } }));
  }
  return (
    <Workspace
      title="Account security"
      subtitle="Manage your password and personal provider keys. Administrators cannot see these keys."
    >
      <div className="management-grid two">
        <Card>
          <CardHeader>
            <CardTitle>
              <KeyRound size={18} /> Password
            </CardTitle>
            <CardDescription>
              Changing your password signs out every active device.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PasswordChange onChanged={onSignedOut} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>
              <ShieldCheck size={18} /> API keys
            </CardTitle>
            <CardDescription>
              Keys are encrypted. Saved values are never shown again.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="key-list">
              {["gemini", "openai"].map((name) => (
                <div className="key-row" key={name}>
                  <div>
                    <strong>
                      {name === "gemini" ? "Google Gemini" : "OpenAI"}
                    </strong>
                    <span>
                      {keys[name]?.configured
                        ? `•••• ${keys[name].lastFour} · ${keys[name].status || "saved"}`
                        : "Not configured"}
                    </span>
                  </div>
                  {keys[name]?.configured && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeKey(name)}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <form className="stack-form compact" onSubmit={saveKey}>
              <Label>Provider</Label>
              <Select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
              >
                <option value="gemini">Google Gemini</option>
                <option value="openai">OpenAI</option>
              </Select>
              <Label>New API key</Label>
              <Input
                type="password"
                required
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Paste a new key"
              />
              <Notice
                message={message}
                error={/rejected|could not|invalid/i.test(message)}
              />
              <Button disabled={busy}>
                {busy ? "Checking…" : "Validate and save"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </Workspace>
  );
}

function Workspace({ title, subtitle, actions, children }) {
  return (
    <div className="workspace-view">
      <div className="workspace-heading">
        <div>
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {actions}
      </div>
      {children}
    </div>
  );
}
function modeName(mode) {
  return mode === "single"
    ? "QA scorecard"
    : mode === "voice"
      ? "Customer voice"
      : mode === "coaching"
        ? "Advisor coaching"
        : "Legacy report";
}
function dateText(value) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return "";
  }
}

export function ReportsView({ user }) {
  const [data, setData] = useState({ items: [], nextCursor: null });
  const [selected, setSelected] = useState(null);
  const [owners, setOwners] = useState([]);
  const [filters, setFilters] = useState({
    mode: "",
    search: "",
    ce: "",
    ownerUserId: "",
    parameter: "",
    from: "",
    to: "",
    minScore: "",
    maxScore: "",
  });
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("");
  async function load(cursor = "", append = false) {
    setBusy(true);
    setMessage("");
    try {
      const params = new URLSearchParams({ limit: "20" });
      Object.entries(filters).forEach(
        ([key, value]) =>
          value && params.set(key, key === "to" ? `${value}T23:59:59` : value),
      );
      if (cursor) params.set("cursor", cursor);
      const next = await api(`/api/reports?${params}`);
      setData((current) => ({
        items: append ? [...current.items, ...next.items] : next.items,
        nextCursor: next.nextCursor,
      }));
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (user.role === "admin")
      api("/api/admin/users")
        .then((value) => setOwners(value.users))
        .catch(() => {});
  }, [user.role]);
  useEffect(() => {
    const timer = setTimeout(() => load(), 180);
    return () => clearTimeout(timer);
  }, [JSON.stringify(filters)]);
  async function openReport(id) {
    setBusy(true);
    try {
      const value = await api(`/api/reports/${id}`);
      setSelected(value.report);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }
  function downloadWord() {
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>QA Report</title></head><body>${DOMPurify.sanitize(marked.parse(selected?.report || ""))}</body></html>`;
    const url = URL.createObjectURL(
      new Blob(["\ufeff", html], { type: "application/msword" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `QA_Report_${new Date().toISOString().slice(0, 10)}.doc`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  if (selected)
    return (
      <Workspace
        title="Report detail"
        actions={
          <div className="form-actions">
            <Button variant="outline" onClick={() => setSelected(null)}>
              <ChevronLeft size={16} /> Back
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              <FileDown size={15} /> PDF
            </Button>
            <Button variant="outline" onClick={downloadWord}>
              <FileText size={15} /> Word
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                navigator.clipboard?.writeText(selected.report || "")
              }
            >
              <Check size={15} /> Copy
            </Button>
          </div>
        }
      >
        <Card className="history-detail">
          <CardHeader>
            <CardTitle>{modeName(selected.mode)}</CardTitle>
            <CardDescription>
              {selected.ownerName || selected.ownerEmail} ·{" "}
              {dateText(selected.completedAt || selected.createdAt)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="report-facts">
              <span>
                Model<strong>{selected.model || "Not recorded"}</strong>
              </span>
              <span>
                Source<strong>{selected.cached ? "Cached" : "Fresh"}</strong>
              </span>
              <span>
                Company<strong>{selected.companySnapshot}</strong>
              </span>
              <span>
                Parameter
                <strong>{selected.parameterSnapshot || "Generic"}</strong>
              </span>
            </div>
            {selected.items?.map((item, index) =>
              item.status === "success" ? (
                <section className="history-report" key={index}>
                  <h3>{item.fileName || modeName(item.kind)}</h3>
                  <Markdown value={item.markdown} />
                </section>
              ) : (
                <Notice
                  key={index}
                  message={`${item.fileName || "Call"} failed: ${item.error}`}
                  error
                />
              ),
            )}
          </CardContent>
        </Card>
      </Workspace>
    );
  return (
    <Workspace
      title="Reports"
      subtitle={
        user.role === "admin"
          ? "All completed audit and insight reports."
          : "Your completed audit and insight reports."
      }
    >
      <Card>
        <CardContent className="report-filters">
          <div className="search-field">
            <Search size={16} />
            <Input
              aria-label="Search reports"
              placeholder="Search filename, user, or text"
              value={filters.search}
              onChange={(e) =>
                setFilters({ ...filters, search: e.target.value })
              }
            />
          </div>
          <Select
            aria-label="Report mode"
            value={filters.mode}
            onChange={(e) => setFilters({ ...filters, mode: e.target.value })}
          >
            <option value="">All modes</option>
            <option value="single">QA scorecard</option>
            <option value="voice">Customer voice</option>
            <option value="coaching">Advisor coaching</option>
          </Select>
          <Select
            aria-label="CE status"
            value={filters.ce}
            onChange={(e) => setFilters({ ...filters, ce: e.target.value })}
          >
            <option value="">All CE statuses</option>
            <option value="true">Has CE</option>
            <option value="false">Non-CE</option>
          </Select>
          {user.role === "admin" && (
            <Select
              aria-label="Report owner"
              value={filters.ownerUserId}
              onChange={(e) =>
                setFilters({ ...filters, ownerUserId: e.target.value })
              }
            >
              <option value="">All users</option>
              {owners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.username}
                </option>
              ))}
            </Select>
          )}
          <Input
            aria-label="Parameter"
            placeholder="Parameter"
            value={filters.parameter}
            onChange={(e) =>
              setFilters({ ...filters, parameter: e.target.value })
            }
          />
          <Input
            aria-label="From date"
            type="date"
            value={filters.from}
            onChange={(e) => setFilters({ ...filters, from: e.target.value })}
          />
          <Input
            aria-label="To date"
            type="date"
            value={filters.to}
            onChange={(e) => setFilters({ ...filters, to: e.target.value })}
          />
          <Input
            aria-label="Minimum score"
            type="number"
            min="0"
            placeholder="Min score"
            value={filters.minScore}
            onChange={(e) =>
              setFilters({ ...filters, minScore: e.target.value })
            }
          />
          <Input
            aria-label="Maximum score"
            type="number"
            min="0"
            placeholder="Max score"
            value={filters.maxScore}
            onChange={(e) =>
              setFilters({ ...filters, maxScore: e.target.value })
            }
          />
        </CardContent>
      </Card>
      <Notice message={message} error />
      <div className="history-list">
        {data.items.map((item) => (
          <button
            className="history-row"
            key={item.id}
            onClick={() => openReport(item.id)}
          >
            <div className="history-icon">
              <FileText size={18} />
            </div>
            <div className="history-main">
              <strong>{modeName(item.mode)}</strong>
              <span>
                {item.files?.map((file) => file.name).join(", ") ||
                  "Report run"}
              </span>
            </div>
            <div className="history-meta">
              <strong>
                {item.mode === "single" && item.minimumScore != null
                  ? `${item.minimumScore}${item.maximumScore !== item.minimumScore ? `–${item.maximumScore}` : ""}`
                  : item.model || ""}
              </strong>
              <span>
                {user.role === "admin"
                  ? `${item.ownerName || item.ownerEmail} · `
                  : ""}
                {dateText(item.createdAt)}
              </span>
            </div>
            {item.ceCount > 0 && <span className="ce-badge">CE</span>}
          </button>
        ))}
        {!busy && !data.items.length && (
          <div className="empty-state">
            <FileText />
            <strong>No reports yet</strong>
            <span>Completed audits and insight reports will appear here.</span>
          </div>
        )}
      </div>
      {busy && (
        <div className="inline-loading">
          <RefreshCw className="spin" /> Loading reports…
        </div>
      )}
      {data.nextCursor && !busy && (
        <Button variant="outline" onClick={() => load(data.nextCursor, true)}>
          Load more
        </Button>
      )}
    </Workspace>
  );
}

function UsersAdmin() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ email: "", username: "", password: "" });
  const [reset, setReset] = useState({ userId: "", password: "" });
  const [message, setMessage] = useState("");
  async function load() {
    try {
      setUsers((await api("/api/admin/users")).users);
    } catch (error) {
      setMessage(error.message);
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function create(event) {
    event.preventDefault();
    try {
      await api("/api/admin/users", body("POST", form));
      setForm({ email: "", username: "", password: "" });
      setMessage("User created with a temporary password.");
      load();
    } catch (error) {
      setMessage(error.message);
    }
  }
  async function update(user, action, value) {
    try {
      await api(
        `/api/admin/users/${user.id}/${action}`,
        body("PUT", { [action]: value }),
      );
      load();
    } catch (error) {
      setMessage(error.message);
    }
  }
  async function resetPassword(event, user) {
    event.preventDefault();
    try {
      await api(
        `/api/admin/users/${user.id}/reset-password`,
        body("POST", { temporaryPassword: reset.password }),
      );
      setReset({ userId: "", password: "" });
      setMessage(
        "Temporary password saved. Their existing sessions were revoked.",
      );
    } catch (error) {
      setMessage(error.message);
    }
  }
  return (
    <div className="management-grid two">
      <Card>
        <CardHeader>
          <CardTitle>
            <Plus size={18} /> Create user
          </CardTitle>
          <CardDescription>
            API keys are added privately by each user.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="stack-form" onSubmit={create}>
            <Label>Email</Label>
            <Input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <Label>Username</Label>
            <Input
              required
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />
            <Label>Temporary password</Label>
            <Input
              type="password"
              minLength="12"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <Button>Create user</Button>
            <Notice
              message={message}
              error={/required|found|use|least|could/i.test(message)}
            />
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>
            <UsersRound size={18} /> Accounts
          </CardTitle>
        </CardHeader>
        <CardContent className="admin-list">
          {users.map((user) => (
            <React.Fragment key={user.id}>
              <div className="admin-row">
                <div>
                  <strong>{user.username}</strong>
                  <span>{user.email}</span>
                </div>
                <Select
                  value={user.role}
                  onChange={(e) => update(user, "role", e.target.value)}
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    update(
                      user,
                      "status",
                      user.status === "active" ? "inactive" : "active",
                    )
                  }
                >
                  {user.status === "active" ? "Deactivate" : "Reactivate"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setReset({ userId: user.id, password: "" })}
                >
                  Reset password
                </Button>
              </div>
              {reset.userId === user.id && (
                <form
                  className="inline-reset"
                  onSubmit={(event) => resetPassword(event, user)}
                >
                  <Input
                    aria-label={`Temporary password for ${user.username}`}
                    type="password"
                    minLength="12"
                    required
                    value={reset.password}
                    onChange={(event) =>
                      setReset({ ...reset, password: event.target.value })
                    }
                  />
                  <Button size="sm">Save temporary password</Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setReset({ userId: "", password: "" })}
                  >
                    Cancel
                  </Button>
                </form>
              )}
            </React.Fragment>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function CompanyAdmin() {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    api("/api/admin/company")
      .then((value) => setName(value.companyName))
      .catch((error) => setMessage(error.message));
  }, []);
  async function save(event) {
    event.preventDefault();
    try {
      await api("/api/admin/company", body("PUT", { companyName: name }));
      setMessage("Company name saved for future reports.");
    } catch (error) {
      setMessage(error.message);
    }
  }
  return (
    <Card className="narrow-card">
      <CardHeader>
        <CardTitle>Company name</CardTitle>
        <CardDescription>
          Historical reports keep their original company snapshot.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="stack-form" onSubmit={save}>
          <Label>Company name</Label>
          <Input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button>Save company</Button>
          <Notice message={message} error={/could|required/i.test(message)} />
        </form>
      </CardContent>
    </Card>
  );
}

function ProductsAdmin() {
  const empty = { category: "", subCategory: "", brief: "" };
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState("");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  async function load() {
    setItems((await api("/api/admin/product-briefs")).items);
  }
  useEffect(() => {
    load().catch((error) => setMessage(error.message));
  }, []);
  async function save(event) {
    event.preventDefault();
    try {
      if (editId)
        await api(`/api/admin/product-briefs/${editId}`, body("PUT", form));
      else await api("/api/admin/product-briefs", body("POST", form));
      setForm(empty);
      setEditId("");
      setMessage("Product brief saved.");
      load();
    } catch (error) {
      setMessage(error.message);
    }
  }
  async function archive(item) {
    await api(
      `/api/admin/product-briefs/${item.id}`,
      body("PUT", { archived: !item.archived }),
    );
    load();
  }
  const visible = items.filter((item) =>
    `${item.category} ${item.subCategory} ${item.brief}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <div className="management-grid two">
      <Card>
        <CardHeader>
          <CardTitle>
            {editId ? "Edit product brief" : "Add product brief"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form className="stack-form" onSubmit={save}>
            <Label>Category</Label>
            <Input
              required
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            />
            <Label>Sub-category</Label>
            <Input
              required
              value={form.subCategory}
              onChange={(e) =>
                setForm({ ...form, subCategory: e.target.value })
              }
            />
            <Label>Factual product brief</Label>
            <Textarea
              rows="10"
              required
              value={form.brief}
              onChange={(e) => setForm({ ...form, brief: e.target.value })}
            />
            <div className="form-actions">
              <Button>{editId ? "Update" : "Add product"}</Button>
              {editId && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setEditId("");
                    setForm(empty);
                  }}
                >
                  Cancel
                </Button>
              )}
            </div>
            <Notice
              message={message}
              error={/required|exist|could/i.test(message)}
            />
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Product catalog</CardTitle>
          <div className="search-field">
            <Search size={16} />
            <Input
              placeholder="Search products"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="admin-list">
          {visible.map((item) => (
            <div
              className={`catalog-row ${item.archived ? "archived" : ""}`}
              key={item.id}
            >
              <div>
                <strong>
                  {item.category} · {item.subCategory}
                </strong>
                <span>{item.brief}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditId(item.id);
                  setForm({
                    category: item.category,
                    subCategory: item.subCategory,
                    brief: item.brief,
                  });
                }}
              >
                Edit
              </Button>
              <Button variant="ghost" size="sm" onClick={() => archive(item)}>
                <Archive size={14} />
                {item.archived ? "Restore" : "Archive"}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function ScorecardsAdmin() {
  const newDefinition = () => ({
    name: "",
    overallTotal: 100,
    criticalErrors: "",
    categories: [
      {
        name: "Opening",
        weight: 100,
        rows: [{ name: "Greeting", weight: 100 }],
      },
    ],
  });
  const [form, setForm] = useState(newDefinition);
  const [items, setItems] = useState([]);
  const [editId, setEditId] = useState("");
  const [message, setMessage] = useState("");
  async function load() {
    setItems((await api("/api/admin/scorecards")).items);
  }
  useEffect(() => {
    load().catch((error) => setMessage(error.message));
  }, []);
  function setCategory(index, field, value) {
    setForm((current) => ({
      ...current,
      categories: current.categories.map((category, i) =>
        i === index ? { ...category, [field]: value } : category,
      ),
    }));
  }
  function setRow(categoryIndex, rowIndex, field, value) {
    setForm((current) => ({
      ...current,
      categories: current.categories.map((category, i) =>
        i === categoryIndex
          ? {
              ...category,
              rows: category.rows.map((row, j) =>
                j === rowIndex ? { ...row, [field]: value } : row,
              ),
            }
          : category,
      ),
    }));
  }
  async function save(event) {
    event.preventDefault();
    try {
      await api(
        editId ? `/api/admin/scorecards/${editId}` : "/api/admin/scorecards",
        body(editId ? "PUT" : "POST", {
          name: form.name,
          definition: {
            overallTotal: Number(form.overallTotal),
            criticalErrors: form.criticalErrors
              .split("\n")
              .map((v) => v.trim())
              .filter(Boolean),
            categories: form.categories.map((category) => ({
              name: category.name,
              weight: Number(category.weight),
              rows: category.rows.map((row) => ({
                name: row.name,
                weight: Number(row.weight),
              })),
            })),
          },
        }),
      );
      setForm(newDefinition());
      setEditId("");
      setMessage("Scorecard saved.");
      load();
    } catch (error) {
      setMessage(error.message);
    }
  }
  async function archive(item) {
    await api(
      `/api/admin/scorecards/${item.id}`,
      body("PUT", { archived: !item.archived }),
    );
    load();
  }
  function edit(item) {
    const definition = item.definition || {};
    setEditId(item.id);
    setForm({
      name: item.name,
      overallTotal: definition.overallTotal || definition.total || 100,
      criticalErrors: (definition.criticalErrors || []).join("\n"),
      categories: (definition.categories || []).map((category) => ({
        name: category.name,
        weight:
          category.weight ||
          (category.rows || []).reduce(
            (sum, row) => sum + Number(row.weight || 0),
            0,
          ),
        rows: category.rows || [],
      })),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  return (
    <div className="management-grid scorecard-grid">
      <Card>
        <CardHeader>
          <CardTitle>
            {editId ? "Edit scorecard" : "Structured scorecard builder"}
          </CardTitle>
          <CardDescription>
            Category weights and the overall total must reconcile exactly.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="stack-form" onSubmit={save}>
            <div className="form-grid">
              <div>
                <Label>Parameter name</Label>
                <Input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <Label>Overall total</Label>
                <Input
                  type="number"
                  min="1"
                  required
                  value={form.overallTotal}
                  onChange={(e) =>
                    setForm({ ...form, overallTotal: e.target.value })
                  }
                />
              </div>
            </div>
            {form.categories.map((category, categoryIndex) => (
              <div className="builder-category" key={categoryIndex}>
                <div className="form-grid">
                  <Input
                    aria-label="Category name"
                    placeholder="Category name"
                    required
                    value={category.name}
                    onChange={(e) =>
                      setCategory(categoryIndex, "name", e.target.value)
                    }
                  />
                  <Input
                    aria-label="Category weight"
                    type="number"
                    min="1"
                    placeholder="Weight"
                    required
                    value={category.weight}
                    onChange={(e) =>
                      setCategory(categoryIndex, "weight", e.target.value)
                    }
                  />
                </div>
                {category.rows.map((row, rowIndex) => (
                  <div className="builder-row" key={rowIndex}>
                    <Input
                      aria-label="Score row name"
                      placeholder="Score row"
                      required
                      value={row.name}
                      onChange={(e) =>
                        setRow(categoryIndex, rowIndex, "name", e.target.value)
                      }
                    />
                    <Input
                      aria-label="Score row weight"
                      type="number"
                      min="1"
                      required
                      value={row.weight}
                      onChange={(e) =>
                        setRow(
                          categoryIndex,
                          rowIndex,
                          "weight",
                          e.target.value,
                        )
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setCategory(
                          categoryIndex,
                          "rows",
                          category.rows.filter((_, i) => i !== rowIndex),
                        )
                      }
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setCategory(categoryIndex, "rows", [
                      ...category.rows,
                      { name: "", weight: 1 },
                    ])
                  }
                >
                  <Plus size={14} /> Add row
                </Button>
                {form.categories.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        categories: current.categories.filter(
                          (_, index) => index !== categoryIndex,
                        ),
                      }))
                    }
                  >
                    Remove category
                  </Button>
                )}
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setForm((current) => ({
                  ...current,
                  categories: [
                    ...current.categories,
                    { name: "", weight: 1, rows: [{ name: "", weight: 1 }] },
                  ],
                }))
              }
            >
              <Plus size={15} /> Add category
            </Button>
            <Label>Critical-error rules (one per line)</Label>
            <Textarea
              rows="5"
              value={form.criticalErrors}
              onChange={(e) =>
                setForm({ ...form, criticalErrors: e.target.value })
              }
            />
            <Notice
              message={message}
              error={/must|required|exist|duplicate|positive/i.test(message)}
            />
            <div className="form-actions">
              <Button>{editId ? "Update scorecard" : "Save scorecard"}</Button>
              {editId && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setEditId("");
                    setForm(newDefinition());
                  }}
                >
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Scorecards</CardTitle>
        </CardHeader>
        <CardContent className="admin-list">
          {items.map((item) => (
            <div
              className={`catalog-row ${item.archived ? "archived" : ""}`}
              key={item.id}
            >
              <div>
                <strong>{item.name}</strong>
                <span>
                  Version {item.version || 1} ·{" "}
                  {item.definition?.overallTotal || "legacy"} points
                </span>
              </div>
              <Button variant="outline" size="sm" onClick={() => edit(item)}>
                Edit
              </Button>
              <Button variant="ghost" size="sm" onClick={() => archive(item)}>
                <Archive size={14} />
                {item.archived ? "Restore" : "Archive"}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export function AdminView() {
  const [tab, setTab] = useState("users");
  const views = {
    users: <UsersAdmin />,
    company: <CompanyAdmin />,
    products: <ProductsAdmin />,
    scorecards: <ScorecardsAdmin />,
  };
  return (
    <Workspace
      title="Admin"
      subtitle="Manage access and future audit configuration."
    >
      <div className="subnav">
        {[
          ["users", "Users"],
          ["company", "Company"],
          ["products", "Products"],
          ["scorecards", "Scorecards"],
        ].map(([value, label]) => (
          <Button
            key={value}
            variant={tab === value ? "default" : "ghost"}
            onClick={() => setTab(value)}
          >
            {label}
          </Button>
        ))}
      </div>
      {views[tab]}
    </Workspace>
  );
}
