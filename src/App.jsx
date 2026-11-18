import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocalStorageState, useSessionStorageState } from "ahooks";
import { useAtom } from "jotai";
import { motion, AnimatePresence } from "motion/react";
import { Facehash } from "facehash";
import { Blobatar } from "@blobatar/react";
import { BellRingIcon } from "@animateicons/react/lucide";
import { Toaster, toast } from "@yusufceng1z/ding-react";
import { SyncLoader } from "react-spinners";
import {
  ArrowRight,
  Check,
  ChevronDown,
  CircleHelp,
  Download,
  Eye,
  EyeOff,
  FileJson2,
  FilePlus2,
  History,
  IndianRupee,
  LogOut,
  Moon,
  Pencil,
  ShieldCheck,
  Sun,
  TrendingDown,
  Upload,
  Wallet,
  X,
  Trash2,
} from "lucide-react";

import { createPasswordRecord, verifyPassword } from "./utils/auth";
import { compareScenarios } from "./utils/emiCalculator";
import { defaultLoan, themeAtom } from "./store/atoms";
import {
  createLoanProfile,
  isValidImportedProfile,
  loadUserLoanData,
  saveUserLoanData,
} from "./utils/loanStorage";

import "blobatar/motion.css";

const money = (value, decimals = 0) => {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(value);
};

const monthsLabel = (months) => {
  if (!Number.isFinite(months)) return "Does not close";
  const years = Math.floor(months / 12);
  const remaining = months % 12;
  if (!years) return `${remaining} mo`;
  if (!remaining) return `${years} yr`;
  return `${years} yr ${remaining} mo`;
};

const waitForFeedback = () =>
  new Promise((resolve) => window.setTimeout(resolve, 1100));

const DEMO_ACCOUNT = {
  username: "dummytest",
  email: "dummytest@test.com",
  password: "password01",
};
let demoAccountRecordPromise;

function getDemoAccountRecord() {
  if (!demoAccountRecordPromise) {
    demoAccountRecordPromise = createPasswordRecord(DEMO_ACCOUNT.password).then(
      (credential) => ({
        username: DEMO_ACCOUNT.username,
        email: DEMO_ACCOUNT.email,
        ...credential,
        createdAt: new Date().toISOString(),
        lastLoginAt: null,
        loginCount: 0,
        loginHistory: [],
      }),
    );
  }
  return demoAccountRecordPromise;
}

function makeLoginEvent(eventType) {
  const userAgent = navigator.userAgent;
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /Firefox\//.test(userAgent)
      ? "Firefox"
      : /Chrome\//.test(userAgent)
        ? "Chrome"
        : /Safari\//.test(userAgent)
          ? "Safari"
          : "Other";
  const timestamp = new Date().toISOString();
  return {
    id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
    eventType,
    timestamp,
    browser,
    platform:
      navigator.userAgentData?.platform || navigator.platform || "Unknown",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Unknown",
    language: navigator.language || "Unknown",
    screen: `${window.screen.width} × ${window.screen.height}`,
    viewport: `${window.innerWidth} × ${window.innerHeight}`,
    connection: navigator.onLine ? "Online" : "Offline",
  };
}

function Field({
  label,
  value,
  onChange,
  prefix,
  suffix,
  step = "any",
  min = "0",
  type = "number",
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <span className="input-wrap">
        {prefix && <span className="input-affix">{prefix}</span>}
        <input
          type={type}
          inputMode={type === "number" ? "decimal" : undefined}
          min={type === "number" ? min : undefined}
          step={type === "number" ? step : undefined}
          value={value}
          onChange={(event) => {
            const nextValue = event.target.value;
            onChange(
              type === "number" && nextValue !== ""
                ? Number(nextValue)
                : nextValue,
            );
          }}
        />
        {suffix && <span className="input-affix suffix">{suffix}</span>}
      </span>
    </label>
  );
}

function AuthScreen({ users, onAuthenticated, theme }) {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [demoDialogOpen, setDemoDialogOpen] = useState(false);

  const resetErrors = () => setError("");

  async function handleSubmit(event) {
    event.preventDefault();
    resetErrors();

    const cleanUsername = username.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (mode === "register") {
      if (!/^[a-zA-Z0-9._-]{3,24}$/.test(cleanUsername)) {
        const message =
          "Username must be 3–24 characters and can contain letters, numbers, dots, underscores or hyphens.";
        setError(message);
        toast.error("Check your username", { description: message });
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        setError("Enter a valid email address.");
        toast.error("Enter a valid email address");
        return;
      }
      if (
        password.length < 8 ||
        !/[A-Za-z]/.test(password) ||
        !/[0-9]/.test(password)
      ) {
        setError("Use at least 8 characters, including a letter and a number.");
        toast.error("Password does not meet the requirements");
        return;
      }
      if (password !== confirmPassword) {
        setError("Your passwords do not match. Please try again.");
        toast.error("Passwords do not match");
        return;
      }
      if (
        users.some(
          (user) =>
            user.username.toLowerCase() === cleanUsername.toLowerCase() ||
            user.email === cleanEmail,
        )
      ) {
        setError(
          "That username or email is already registered. Try signing in instead.",
        );
        toast.error("Account already exists", {
          description: "Try signing in instead.",
        });
        return;
      }

      setBusy(true);
      try {
        const credential = await createPasswordRecord(password);
        await waitForFeedback();
        const loginEvent = makeLoginEvent("Registration");
        const account = {
          username: cleanUsername,
          email: cleanEmail,
          ...credential,
          createdAt: new Date().toISOString(),
          lastLoginAt: loginEvent.timestamp,
          loginCount: 1,
          loginHistory: [loginEvent],
        };
        onAuthenticated(account);
        toast.success("Account created", {
          description: `Your local profile is ready. First login: ${new Date(loginEvent.timestamp).toLocaleString()}`,
        });
      } catch (authError) {
        setError(authError.message || "Registration failed. Please try again.");
        toast.error("Registration failed", {
          description: authError.message || "Please try again.",
        });
      } finally {
        setBusy(false);
      }
      return;
    }

    if (!username.trim() || !password) {
      setError("Enter your username/email and password.");
      toast.error("Enter your username/email and password");
      return;
    }

    const identifier = username.trim().toLowerCase();
    const account = users.find(
      (user) =>
        user.username.toLowerCase() === identifier ||
        user.email.toLowerCase() === identifier,
    );

    if (!account) {
      setError("We couldn't find an account with those details.");
      toast.error("Login failed", {
        description: "We couldn't find an account with those details.",
      });
      return;
    }

    setBusy(true);
    try {
      const matches = await verifyPassword(password, account);
      if (!matches) {
        setError("Incorrect password. Please check it and try again.");
        toast.error("Login failed", {
          description: "Incorrect password. Please check it and try again.",
        });
        return;
      }
      await waitForFeedback();
      const loginEvent = makeLoginEvent("Login");
      const updatedAccount = {
        ...account,
        lastLoginAt: loginEvent.timestamp,
        loginCount: (account.loginCount || 0) + 1,
        loginHistory: [loginEvent, ...(account.loginHistory || [])].slice(
          0,
          100,
        ),
      };
      onAuthenticated(updatedAccount);
      toast.success("Signed in", {
        description: `Last login: ${new Date(loginEvent.timestamp).toLocaleString()}`,
      });
    } catch (authError) {
      setError(authError.message || "Unable to verify your password.");
      toast.error("Unable to verify your password", {
        description: authError.message,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={`auth-page ${theme}`}>
      <motion.section
        className="auth-card"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
      >
        <div className="auth-left">
          <div className="brand">
            <div className="brand-mark">
              <IndianRupee size={19} />
            </div>
            <span>
              emi<span className="brand-light">studio</span>
            </span>
          </div>

          <div className="auth-heading">
            <span className="eyebrow">PERSONAL LOAN SIMULATOR</span>
            <h1>{mode === "login" ? "Welcome back." : "Create your space."}</h1>
            <p>
              {mode === "login"
                ? "Sign in to compare repayment scenarios and see what a higher EMI could save."
                : "Set up a local profile to keep your EMI scenarios separate on this browser."}
            </p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            {mode === "register" && (
              <Field
                label="Username"
                type="text"
                value={username}
                onChange={setUsername}
                prefix="@"
              />
            )}
            {mode === "register" && (
              <Field
                label="Email address"
                type="email"
                value={email}
                onChange={setEmail}
              />
            )}
            {mode === "login" && (
              <Field
                label="Username or email"
                type="text"
                value={username}
                onChange={setUsername}
              />
            )}

            <label className="field">
              <span className="field-label">Password</span>
              <span className="input-wrap">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                />
                <button
                  type="button"
                  className="input-action"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </span>
            </label>

            {mode === "register" && (
              <label className="field">
                <span className="field-label">Confirm password</span>
                <span className="input-wrap">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="input-action"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </span>
              </label>
            )}

            <AnimatePresence>
              {error && (
                <motion.div
                  className="form-error"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <X size={15} />
                  <span>{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              className="primary-button auth-submit"
              type="submit"
              disabled={busy}
            >
              {busy ? (
                <>
                  <SyncLoader
                    color="currentColor"
                    size={5}
                    aria-label="Signing in"
                  />{" "}
                  <span>Verifying locally…</span>
                </>
              ) : mode === "login" ? (
                "Sign in"
              ) : (
                "Create account"
              )}
              {!busy && <ArrowRight size={17} />}
            </button>
          </form>

          <p className="auth-switch">
            {mode === "login"
              ? "New to EMI Repay Simulator?"
              : "Already have an account?"}
            <button
              type="button"
              onClick={() => {
                setMode(mode === "login" ? "register" : "login");
                setError("");
              }}
            >
              {mode === "login" ? "Create an account" : "Sign in"}
            </button>
          </p>

          <div className="auth-demo-entry">
            <span>Just looking around?</span>
            <button type="button" onClick={() => setDemoDialogOpen(true)}>
              View demo credentials
            </button>
          </div>

          <div className="local-note">
            <ShieldCheck size={16} />
            <span>
              Local-only demo · No backend · No data is sent to a server
            </span>
          </div>
        </div>

        <aside className="auth-right">
          <div className="auth-art-copy">
            <span className="eyebrow light">A CLEARER WAY TO REPAY</span>
            <h2>
              Small changes.
              <br />
              Meaningful savings.
            </h2>
            <p>
              Explore different EMI amounts before you commit to paying more
              each month.
            </p>
          </div>

          <div className="auth-feature-card">
            <div className="auth-feature-icon">
              <TrendingDown size={20} />
            </div>
            <div>
              <span>YOUR LOCAL WORKSPACE</span>
              <strong>Compare every repayment path.</strong>
              <p>
                Save named loans and see payoff estimates update as you edit.
              </p>
            </div>
          </div>

          <div className="auth-quote">
            <div className="quote-avatar">
              <Facehash name={username || "emi-studio-guest"} size={44} />
            </div>
            <div>
              <strong>Your numbers. Your decisions.</strong>
              <span>Understand the impact before changing your EMI.</span>
            </div>
          </div>
        </aside>
      </motion.section>

      <p className="auth-disclaimer">
        Demo authentication only. Do not reuse a real password. Browser storage
        can be inspected or modified by anyone with access to this device.
      </p>

      <AnimatePresence>
        {demoDialogOpen && (
          <motion.div
            className="modal-backdrop demo-credential-backdrop"
            role="presentation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget)
                setDemoDialogOpen(false);
            }}
          >
            <motion.section
              className="profile-modal panel compact-modal demo-credential-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="demo-credentials-title"
              initial={{ opacity: 0, y: 18, scale: 0.94, rotateX: 7 }}
              animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
              exit={{ opacity: 0, y: 10, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 280, damping: 24 }}
            >
              <div className="demo-dialog-mark">
                <IndianRupee size={19} />
              </div>
              <button
                className="icon-button demo-dialog-close"
                type="button"
                aria-label="Close demo credentials"
                onClick={() => setDemoDialogOpen(false)}
              >
                <X size={17} />
              </button>
              <span className="eyebrow">A READY-MADE WORKSPACE</span>
              <h2 id="demo-credentials-title">
                Take EMI Repay Simulator for a spin.
              </h2>
              <p className="demo-dialog-copy">
                Use this shared local demo account to explore the calculator and
                sample loan profiles.
              </p>
              <div className="demo-credential-list">
                <motion.div
                  initial={{ opacity: 0, x: -9 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.08 }}
                >
                  <span>USERNAME</span>
                  <strong>{DEMO_ACCOUNT.username}</strong>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, x: 9 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.14 }}
                >
                  <span>EMAIL</span>
                  <strong>{DEMO_ACCOUNT.email}</strong>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, x: -9 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <span>PASSWORD</span>
                  <strong>{DEMO_ACCOUNT.password}</strong>
                </motion.div>
              </div>
              <p className="demo-credential-warning">
                This account is shared and browser-local. Avoid entering
                personal or sensitive loan information.
              </p>
              <div className="modal-footer demo-dialog-actions">
                <button
                  className="text-button"
                  type="button"
                  onClick={() => setDemoDialogOpen(false)}
                >
                  Close
                </button>
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setUsername(DEMO_ACCOUNT.username);
                    setPassword(DEMO_ACCOUNT.password);
                    setError("");
                    setDemoDialogOpen(false);
                    toast.info("Demo login filled", {
                      description:
                        "Select Sign in to open the sample workspace.",
                    });
                  }}
                >
                  Use demo account <ArrowRight size={16} />
                </button>
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

function Dashboard({ user, initialData, onLogout }) {
  const [profiles, setProfiles] = useState(initialData.profiles);
  const [activeProfileId, setActiveProfileId] = useState(
    initialData.activeProfileId,
  );
  const [theme, setTheme] = useAtom(themeAtom);
  const [avatarMode, setAvatarMode] = useState("blobatar");
  const [avatarSeed, setAvatarSeed] = useState(user.username);
  const [showNote, setShowNote] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [nameDialogOpen, setNameDialogOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [nameMode, setNameMode] = useState("copy");
  const [editingProfileId, setEditingProfileId] = useState(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [importedProfiles, setImportedProfiles] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [downloadPhase, setDownloadPhase] = useState("idle");
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState(null);
  const menuRef = useRef(null);
  const importInputRef = useRef(null);
  const burstParent = useRef(null);
  const latestData = useRef(initialData);
  const saveQueue = useRef(Promise.resolve());
  const saveNoticeTimer = useRef(null);

  const activeProfile =
    profiles.find((profile) => profile.id === activeProfileId) || profiles[0];
  const loan = activeProfile?.loan || defaultLoan;
  const randomizeAvatar = () => {
    setAvatarSeed(
      globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
    );
    setAvatarMode(Math.random() < 0.5 ? "blobatar" : "facehash");
  };

  const showMetricTooltip = (event, text, id) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setActiveTooltip({
      text,
      id,
      top: Math.max(12, rect.top - 8),
      left: Math.max(8, Math.min(rect.left, window.innerWidth - 266)),
    });
  };

  useEffect(() => {
    latestData.current = {
      userKey: user.username.toLowerCase(),
      schemaVersion: 1,
      profiles,
      activeProfileId: activeProfile?.id,
    };
  }, [activeProfile?.id, activeProfileId, profiles, user.username]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target))
        setMenuOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        setManageOpen(false);
        setNameDialogOpen(false);
        setPendingDeleteId(null);
        setImportOpen(false);
        setBackupOpen(false);
        setActivityOpen(false);
        if (downloadPhase !== "pulling") setDownloadDialogOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [downloadPhase]);

  useEffect(() => () => window.clearTimeout(saveNoticeTimer.current), []);

  const persistData = (nextData, successMessage) => {
    latestData.current = nextData;
    setProfiles(nextData.profiles);
    setActiveProfileId(nextData.activeProfileId);
    saveQueue.current = saveQueue.current
      .catch(() => {})
      .then(() => saveUserLoanData(user.username, nextData))
      .then(() => {
        if (successMessage) {
          toast.success(successMessage);
          celebrateSavings();
        }
        return true;
      })
      .catch((storageError) => {
        toast.error("Could not save loan data", {
          description: storageError.message,
        });
        return false;
      });
    return saveQueue.current;
  };

  const updateLoan = (field, value) => {
    if (!activeProfile) return;
    const nextProfiles = profiles.map((profile) =>
      profile.id === activeProfile.id
        ? { ...profile, loan: { ...profile.loan, [field]: value } }
        : profile,
    );
    const save = persistData({ ...latestData.current, profiles: nextProfiles });
    window.clearTimeout(saveNoticeTimer.current);
    saveNoticeTimer.current = window.setTimeout(() => {
      save.then((saved) => {
        if (saved) toast.success("Loan profile updated");
      });
    }, 650);
  };
  const updateScenario = (index, value) => {
    const scenarios = [...(loan.scenarios || defaultLoan.scenarios)];
    scenarios[index] = value;
    updateLoan("scenarios", scenarios);
  };

  const openNameDialog = (mode, profile = null) => {
    setNameMode(mode);
    setEditingProfileId(profile?.id || null);
    setNameDraft(profile?.name || "");
    setNameDialogOpen(true);
    setMenuOpen(false);
  };

  const saveNamedProfile = (event) => {
    event.preventDefault();
    const name = nameDraft.trim();
    if (!name) {
      toast.error("Enter a name for this loan");
      return;
    }
    if (nameMode === "rename") {
      const nextProfiles = profiles.map((profile) =>
        profile.id === editingProfileId
          ? { ...profile, name: name.slice(0, 60) }
          : profile,
      );
      persistData(
        { ...latestData.current, profiles: nextProfiles },
        "Loan profile updated",
      );
    } else {
      const sourceLoan = nameMode === "new" ? defaultLoan : loan;
      const profile = createLoanProfile(name, sourceLoan);
      const nextProfiles = [...profiles, profile];
      persistData(
        {
          ...latestData.current,
          profiles: nextProfiles,
          activeProfileId: profile.id,
        },
        "Loan profile saved",
      );
    }
    setNameDialogOpen(false);
    setManageOpen(false);
  };

  const deleteProfile = () => {
    const remaining = profiles.filter(
      (profile) => profile.id !== pendingDeleteId,
    );
    if (!remaining.length) {
      toast.warning("Keep at least one loan profile", {
        description: "Create another profile before deleting this one.",
      });
      setPendingDeleteId(null);
      return;
    }
    const nextActiveId =
      activeProfileId === pendingDeleteId ? remaining[0].id : activeProfileId;
    persistData(
      {
        ...latestData.current,
        profiles: remaining,
        activeProfileId: nextActiveId,
      },
      "Loan profile deleted",
    );
    setPendingDeleteId(null);
  };

  const exportLoans = () => {
    try {
      const backup = {
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        username: user.username,
        profiles: profiles.map(({ id, name, loan: savedLoan }) => ({
          id,
          name,
          loan: savedLoan,
        })),
      };
      const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `emi-studio-${user.username.toLowerCase()}-loans.json`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Loan backup exported");
    } catch (exportError) {
      toast.error("Could not export loan data", {
        description: exportError.message,
      });
    }
    setMenuOpen(false);
  };

  const downloadTemplate = () => {
    const template = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      profiles: [
        {
          name: "Home Loan",
          loan: { ...defaultLoan, scenarios: [...defaultLoan.scenarios] },
        },
      ],
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(template, null, 2)], {
        type: "application/json",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "emi-studio-loan-template.json";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success("JSON template downloaded", {
      description:
        "Edit the loan values, keep the same field names, then import it.",
    });
  };

  const readImportFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const backup = JSON.parse(await file.text());
      if (
        backup?.schemaVersion !== 1 ||
        !Array.isArray(backup.profiles) ||
        !backup.profiles.length ||
        !backup.profiles.every(isValidImportedProfile)
      ) {
        throw new Error(
          "This file is not a supported EMI Repay Simulator loan backup.",
        );
      }
      setImportedProfiles(backup.profiles);
      setImportOpen(true);
      setMenuOpen(false);
    } catch (importError) {
      toast.error("Invalid JSON backup", {
        description:
          importError.message ||
          "Choose a valid EMI Repay Simulator export file.",
      });
    }
  };

  const applyImport = (mode) => {
    const imported = importedProfiles.map((profile) =>
      createLoanProfile(profile.name, profile.loan),
    );
    let nextProfiles = imported;
    if (mode === "merge") {
      const names = new Set(
        profiles.map((profile) => profile.name.toLowerCase()),
      );
      nextProfiles = [
        ...profiles,
        ...imported.map((profile) => {
          let name = profile.name;
          let suffix = 2;
          while (names.has(name.toLowerCase()))
            name = `${profile.name} (${suffix++})`;
          names.add(name.toLowerCase());
          return { ...profile, name };
        }),
      ];
    }
    persistData(
      {
        ...latestData.current,
        profiles: nextProfiles,
        activeProfileId:
          mode === "replace" ? nextProfiles[0].id : activeProfileId,
      },
      "Loan backup imported",
    );
    setImportOpen(false);
    setImportedProfiles(null);
  };

  const downloadPdf = async () => {
    const id = toast.loading("Preparing your EMI report…", {
      description: `Loading ${activeProfile?.name || "loan"} and its latest repayment scenarios.`,
      progress: 0.08,
    });
    setDownloadPhase("pulling");
    setDownloadDialogOpen(true);
    try {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      toast.update(id, {
        title: "Building the report",
        description:
          "Calculating payoff schedules and formatting the comparison table…",
        progress: 0.42,
      });
      const { downloadLoanReport } = await import("./utils/pdfReport");
      toast.update(id, {
        title: "Creating your PDF",
        description:
          "Adding current loan inputs, scenario results, and assumptions…",
        progress: 0.78,
      });
      downloadLoanReport({
        loan,
        profileName: activeProfile?.name || "My Loan",
        username: user.username,
        current,
        scenarios,
      });
      toast.update(id, {
        type: "success",
        title: "PDF report downloaded",
        description: `Downloaded ${activeProfile?.name || "loan"} · ${new Date().toLocaleString()}. Current input values are included.`,
        progress: null,
      });
      setDownloadPhase("success");
    } catch (pdfError) {
      toast.update(id, {
        type: "error",
        title: "PDF download failed",
        description: pdfError.message || "Please try again.",
      });
      setDownloadPhase("error");
    }
  };

  const { current, scenarios } = useMemo(() => compareScenarios(loan), [loan]);
  const validInputs =
    Number(loan.principal) > 0 &&
    Number(loan.currentEmi) > 0 &&
    Number(loan.annualRate) >= 0 &&
    Number(loan.balanceTenure) > 0 &&
    (loan.scenarios || []).length === 3 &&
    (loan.scenarios || []).every((amount) => Number(amount) > 0);

  const tenureDifference = current.paidOff
    ? current.months - Number(loan.balanceTenure)
    : null;
  const bestScenario = scenarios
    .map((result, index) => ({ result, index }))
    .filter(({ result }) => result.paidOff)
    .sort((a, b) => a.result.totalInterest - b.result.totalInterest)[0];

  async function celebrateSavings() {
    if (!burstParent.current || !bestScenario || !bestScenario.result.paidOff)
      return;
    try {
      const { default: mojs } = await import("@mojs/core");
      new mojs.Burst({
        parent: burstParent.current,
        radius: { 0: 92 },
        count: 16,
        children: {
          shape: "circle",
          fill: ["#10b981", "#60a5fa", "#f59e0b", "#a78bfa"],
          radius: { 7: 0 },
          duration: 850,
        },
      }).play();
    } catch (animationError) {
      toast.info("Loan profile saved", {
        description:
          animationError.message ||
          "The savings animation could not be loaded.",
      });
    }
  }

  const scenarioNames = ["Scenario 1", "Scenario 2", "Scenario 3"];
  const allResults = [current, ...scenarios];

  const comparisonRows = [
    {
      label: "Monthly EMI",
      render: (_, index) =>
        money(index === 0 ? loan.currentEmi : loan.scenarios[index - 1]),
    },
    {
      label: "Additional EMI",
      render: (_, index) =>
        index === 0
          ? "Baseline"
          : money(Number(loan.scenarios[index - 1]) - Number(loan.currentEmi)),
    },
    {
      label: "First-month interest",
      tooltip:
        "Interest calculated on the outstanding principal for the first month.",
      render: (result) =>
        result?.valid ? money(result.firstMonthInterest, 2) : "—",
    },
    {
      label: "First-month principal repayment",
      tooltip:
        "The portion of the first payment that reduces the outstanding principal.",
      render: (result) =>
        result?.valid ? money(result.firstMonthPrincipal, 2) : "—",
    },
    {
      label: "Loan closure period (months)",
      tooltip:
        "Estimated number of monthly payments required to close the outstanding balance.",
      render: (result) =>
        result?.paidOff ? `${result.months} months` : "Does not close",
    },
    {
      label: "Loan closure period (years and months)",
      tooltip:
        "The simulated payoff period expressed in years and remaining months.",
      render: (result) =>
        result?.paidOff ? monthsLabel(result.months) : "Does not close",
    },
    {
      label: "Principal repaid",
      tooltip: "The outstanding principal repaid over the simulated schedule.",
      render: (result) =>
        result?.paidOff ? money(result.principalRepaid ?? loan.principal) : "—",
    },
    {
      label: "Total interest payable",
      tooltip: "Total interest payable over the simulated repayment period.",
      render: (result) => (result?.paidOff ? money(result.totalInterest) : "—"),
    },
    {
      label: "Total repayment amount",
      tooltip: "Total of all payments made, including principal and interest.",
      render: (result) => (result?.paidOff ? money(result.totalPaid) : "—"),
    },
    {
      label: "Interest saved",
      tooltip:
        "Difference between the current EMI's total interest and this EMI's total interest.",
      className: "saving-row",
      render: (result, index) =>
        index === 0
          ? "Baseline"
          : current?.paidOff && result?.paidOff
            ? current.totalInterest >= result.totalInterest
              ? money(current.totalInterest - result.totalInterest)
              : `-${money(result.totalInterest - current.totalInterest)}`
            : "—",
    },
    {
      label: "Time saved",
      tooltip:
        "Difference between the current EMI's payoff period and this EMI's payoff period.",
      className: "saving-row",
      render: (result, index) =>
        index === 0
          ? "Baseline"
          : current?.paidOff && result?.paidOff
            ? current.months >= result.months
              ? `${current.months - result.months} months sooner`
              : `${result.months - current.months} months longer`
            : "—",
    },
    {
      label: "Post-payoff EMI cash flow freed",
      tooltip:
        "Estimated available cash flow after the scenario closes early: months saved versus the current EMI multiplied by this scenario EMI. This is not the same as net repayment savings.",
      className: "saving-row",
      render: (result, index) => {
        if (index === 0) return "Baseline";
        if (!current?.paidOff || !result?.paidOff) return "—";
        const monthsFreed = current.months - result.months;
        return monthsFreed > 0
          ? money(monthsFreed * Number(loan.scenarios[index - 1]))
          : "—";
      },
    },
    {
      label: "Estimated value of saved months",
      tooltip:
        "The scenario EMI multiplied by the number of months saved. It illustrates the monthly cash flow no longer committed to the loan after payoff; it should not be added to interest savings.",
      className: "saving-row",
      render: (result, index) => {
        if (index === 0) return "Baseline";
        if (!current?.paidOff || !result?.paidOff) return "—";
        const monthsSaved = current.months - result.months;
        return monthsSaved > 0
          ? `${monthsSaved} × ${money(loan.scenarios[index - 1])} = ${money(monthsSaved * Number(loan.scenarios[index - 1]))}`
          : monthsSaved < 0
            ? `${Math.abs(monthsSaved)} months longer`
            : "No months saved";
      },
    },
    {
      label: "Net repayment saved vs current EMI",
      tooltip:
        "Current total repayment minus the scenario total repayment. For the same principal, this equals the interest difference and is the direct reduction in total paid.",
      className: "saving-row",
      render: (result, index) =>
        index === 0
          ? "Baseline"
          : current?.paidOff && result?.paidOff
            ? current.totalPaid >= result.totalPaid
              ? money(current.totalPaid - result.totalPaid)
              : `-${money(result.totalPaid - current.totalPaid)}`
            : "—",
    },
    {
      label: "Final instalment amount",
      tooltip:
        "The adjusted last payment required to close the remaining balance.",
      render: (result) =>
        result?.paidOff ? money(result.finalPayment, 2) : "—",
    },
    {
      label: "Interest-to-principal ratio",
      tooltip:
        "Total simulated interest divided by the original outstanding principal.",
      render: (result) =>
        result?.paidOff
          ? `${(result.interestToPrincipalRatio * 100).toFixed(2)}%`
          : "—",
    },
  ];

  return (
    <div className={`app-shell ${theme}`}>
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <IndianRupee size={19} />
          </div>
          <span>
            emi<span className="brand-light">studio</span>
          </span>
        </div>
        <div className="topbar-actions">
          <button
            className="icon-button"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            aria-label="Toggle theme"
            title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
          >
            {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
          </button>
          <div className="profile-area" ref={menuRef}>
            <button
              className="profile-button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              title="Open account menu"
            >
              {avatarMode === "blobatar" ? (
                <Blobatar
                  name={`${user.username}-${avatarSeed}`}
                  size={38}
                  animate="hover"
                />
              ) : (
                <Facehash name={`${user.username}-${avatarSeed}`} size={38} />
              )}
              <span>{user.username}</span>
              <ChevronDown size={15} className={menuOpen ? "rotate" : ""} />
            </button>
            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  className="profile-menu"
                  role="menu"
                  initial={{ opacity: 0, y: -7, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -5, scale: 0.98 }}
                  transition={{ duration: 0.16 }}
                >
                  <div className="menu-account">
                    <strong>{user.username}</strong>
                    <span>{user.email}</span>
                    <span>
                      Last login ·{" "}
                      {user.lastLoginAt
                        ? new Date(user.lastLoginAt).toLocaleString()
                        : "Not recorded"}
                    </span>
                  </div>
                  <div className="menu-section-label">SWITCH LOAN PROFILE</div>
                  <div className="profile-options">
                    {profiles.map((profile) => (
                      <button
                        key={profile.id}
                        role="menuitemradio"
                        aria-checked={profile.id === activeProfile?.id}
                        className={
                          profile.id === activeProfile?.id ? "selected" : ""
                        }
                        onClick={() => {
                          persistData({
                            ...latestData.current,
                            activeProfileId: profile.id,
                          });
                          setMenuOpen(false);
                        }}
                      >
                        <span>{profile.name}</span>
                        {profile.id === activeProfile?.id && (
                          <Check size={14} />
                        )}
                      </button>
                    ))}
                  </div>
                  <button
                    className="menu-action"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      setManageOpen(true);
                    }}
                  >
                    Manage saved loans
                  </button>
                  <button
                    className="menu-action"
                    role="menuitem"
                    onClick={() => openNameDialog("copy")}
                  >
                    Save current loan as new
                  </button>
                  <button
                    className="menu-action"
                    role="menuitem"
                    onClick={() => openNameDialog("new")}
                  >
                    <FilePlus2 size={15} /> Create a blank loan
                  </button>
                  <button
                    className="menu-action"
                    role="menuitem"
                    onClick={() => {
                      setBackupOpen(true);
                      setMenuOpen(false);
                    }}
                  >
                    <FileJson2 size={15} /> JSON backup &amp; restore
                  </button>
                  <button
                    className="menu-action"
                    role="menuitem"
                    onClick={() => {
                      setActivityOpen(true);
                      setMenuOpen(false);
                    }}
                  >
                    <History size={15} /> Login activity
                  </button>
                  <button
                    className="menu-action"
                    role="menuitem"
                    onClick={randomizeAvatar}
                  >
                    Generate random avatar
                  </button>
                  <button
                    className="menu-action danger"
                    role="menuitem"
                    onClick={onLogout}
                  >
                    <LogOut size={15} /> Log out
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
            <input
              ref={importInputRef}
              className="visually-hidden"
              type="file"
              accept="application/json,.json"
              onChange={readImportFile}
            />
          </div>
        </div>
      </header>

      <main className="dashboard">
        <motion.section
          className="welcome-row"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div>
            <span className="eyebrow">YOUR REPAYMENT WORKSPACE</span>
            <h1>Make your EMI work harder.</h1>
            <p>
              Change the monthly amount. See the interest and time you could
              save.
            </p>
          </div>
          <div className="welcome-actions">
            <div className="welcome-chip">
              <span className="online-dot" /> Calculations update live
            </div>
            <motion.button
              className="primary-button download-button"
              type="button"
              onClick={downloadPdf}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
            >
              <Download size={16} /> Download PDF
            </motion.button>
          </div>
        </motion.section>

        <section className="workspace-grid">
          <motion.section
            className="panel loan-panel"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
          >
            <div className="panel-heading">
              <div>
                <span className="eyebrow">01 / LOAN INPUTS</span>
                <h2>{activeProfile?.name || "Current loan"}</h2>
              </div>
              <div className="panel-icon">
                <Wallet size={19} />
              </div>
            </div>

            <div className="fields-grid">
              <Field
                label="Last month's EMI"
                prefix="₹"
                value={loan.currentEmi}
                onChange={(value) => updateLoan("currentEmi", value)}
              />
              <Field
                label="Balance tenure"
                suffix="months"
                value={loan.balanceTenure}
                onChange={(value) => updateLoan("balanceTenure", value)}
                step="1"
                min="1"
              />
              <Field
                label="Annual interest rate"
                suffix="% p.a."
                value={loan.annualRate}
                onChange={(value) => updateLoan("annualRate", value)}
              />
              <Field
                label="Principal outstanding"
                prefix="₹"
                value={loan.principal}
                onChange={(value) => updateLoan("principal", value)}
              />
            </div>

            <div className="scenario-divider">
              <div>
                <span className="eyebrow">02 / WHAT-IF SCENARIOS</span>
                <h3>Try three EMI amounts</h3>
              </div>
              <span className="live-tag">
                <span /> LIVE
              </span>
            </div>

            <div className="scenario-inputs">
              {loan.scenarios.map((amount, index) => (
                <Field
                  key={index}
                  label={`Scenario ${index + 1}`}
                  prefix="₹"
                  value={amount}
                  onChange={(value) => updateScenario(index, value)}
                />
              ))}
            </div>

            <div className="input-footnote">
              <CircleHelp size={15} />
              Scenario amounts are the new total monthly EMI, not an extra
              amount added to your current EMI.
            </div>
          </motion.section>

          <motion.aside
            className="panel insight-panel"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.16 }}
          >
            <div className="panel-heading">
              <div>
                <span className="eyebrow">QUICK INSIGHT</span>
                <h2>Your best scenario</h2>
              </div>
              <div className="panel-icon green">
                <TrendingDown size={19} />
              </div>
            </div>

            {bestScenario ? (
              <>
                <div className="best-amount">
                  {money(loan.scenarios[bestScenario.index])}
                  <span>/ month</span>
                </div>
                <p className="insight-subtitle">
                  {scenarioNames[bestScenario.index]} closes in{" "}
                  {bestScenario.result.months} months with{" "}
                  {money(bestScenario.result.totalInterest)} total interest.
                </p>
                <div className="insight-stats">
                  <div>
                    <span>
                      {current.paidOff
                        ? "Net repayment saved"
                        : "Scenario total repayment"}
                    </span>
                    <motion.strong
                      key={`repayment-${bestScenario.index}-${loan.principal}-${loan.currentEmi}`}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      {current.paidOff
                        ? money(
                            current.totalPaid - bestScenario.result.totalPaid,
                          )
                        : money(bestScenario.result.totalPaid)}
                    </motion.strong>
                  </div>
                  <div>
                    <span>
                      {current.paidOff
                        ? "Time difference"
                        : "First-month principal"}
                    </span>
                    <motion.strong
                      key={`duration-${bestScenario.index}-${bestScenario.result.months}-${current.months}`}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      {current.paidOff
                        ? `${Math.abs(current.months - bestScenario.result.months)} months ${current.months >= bestScenario.result.months ? "sooner" : "longer"}`
                        : money(bestScenario.result.firstMonthPrincipal, 2)}
                    </motion.strong>
                  </div>
                  <div>
                    <span>First-month interest</span>
                    <strong>
                      {money(bestScenario.result.firstMonthInterest, 2)}
                    </strong>
                  </div>
                  <div>
                    <span>Final instalment</span>
                    <strong>
                      {money(bestScenario.result.finalPayment, 2)}
                    </strong>
                  </div>
                  <div>
                    <span>Monthly EMI increase</span>
                    <strong>
                      {money(
                        Number(loan.scenarios[bestScenario.index]) -
                          Number(loan.currentEmi),
                      )}
                    </strong>
                  </div>
                  <div>
                    <span>Freed cash flow after payoff</span>
                    <strong>
                      {current.paidOff &&
                      current.months > bestScenario.result.months
                        ? money(
                            (current.months - bestScenario.result.months) *
                              Number(loan.scenarios[bestScenario.index]),
                          )
                        : "—"}
                    </strong>
                  </div>
                </div>
                <button className="celebrate-button" onClick={celebrateSavings}>
                  <BellRingIcon size={18} color="currentColor" />
                  Celebrate this payoff
                </button>
                <div className="burst-layer" ref={burstParent} />
              </>
            ) : (
              <div className="insight-empty">
                <div className="empty-icon">
                  <CircleHelp size={22} />
                </div>
                <strong>Enter valid loan details</strong>
                <span>
                  We'll identify the scenario with the lowest interest once the
                  current EMI can repay the loan.
                </span>
              </div>
            )}

            <div className="assumption-note">
              <ShieldCheck size={15} />
              Assumes the interest rate remains unchanged and interest is
              calculated monthly on a reducing balance.
            </div>
          </motion.aside>
        </section>

        <motion.section
          className="panel comparison-panel"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22 }}
        >
          <div className="comparison-heading">
            <div>
              <span className="eyebrow">03 / SIDE-BY-SIDE RESULTS</span>
              <h2>EMI comparison</h2>
              <p>
                Every scenario starts from the same outstanding principal.
                Payoff periods come from the simulated EMI schedule.
              </p>
            </div>
            <div className="comparison-badge">
              <Check size={15} />{" "}
              {validInputs ? "Live comparison" : "Check your inputs"}
            </div>
          </div>

          {validInputs &&
            current.paidOff &&
            Math.abs(tenureDifference) >
              Math.max(2, Number(loan.balanceTenure) * 0.05) && (
              <div className="notice info">
                <CircleHelp size={17} />
                <span>
                  Your EMI simulation closes this loan in{" "}
                  <strong>{current.months} months</strong>, which differs from
                  the statement tenure of{" "}
                  <strong>{loan.balanceTenure} months</strong>. The entered
                  tenure is unchanged; estimates use the EMI, principal and
                  rate.
                </span>
              </div>
            )}

          {validInputs &&
            allResults.some((result) => result?.valid && !result.paidOff) && (
              <div className="notice warning">
                <CircleHelp size={17} />
                <span>
                  One or more EMI amounts do not cover the first month's
                  interest or exceed the simulation limit. Those repayment
                  schedules cannot close; see the highlighted table values.
                </span>
              </div>
            )}

          {!validInputs && (
            <div className="notice warning">
              <CircleHelp size={17} />
              <span>
                Enter a positive principal, EMI and tenure. Interest rate cannot
                be negative, and all three scenarios need a positive EMI.
              </span>
            </div>
          )}

          <div className="table-scroll">
            <table className="comparison-table">
              <thead>
                <tr>
                  <th className="metric-heading">Repayment metric</th>
                  <th className="current-column">
                    <span className="column-kicker">BASELINE</span>Current EMI
                  </th>
                  {scenarioNames.map((name, index) => (
                    <th key={name}>
                      <span className="column-kicker">WHAT IF {index + 1}</span>
                      {money(loan.scenarios[index])}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr key={row.label} className={row.className || ""}>
                    <th scope="row">
                      <span className="metric-label">{row.label}</span>
                      {row.tooltip && (
                        <span className="metric-help">
                          <button
                            type="button"
                            aria-label={`About ${row.label}`}
                            aria-describedby={`metric-tip-${comparisonRows.indexOf(row)}`}
                            onMouseEnter={(event) =>
                              showMetricTooltip(
                                event,
                                row.tooltip,
                                `metric-tip-${comparisonRows.indexOf(row)}`,
                              )
                            }
                            onMouseLeave={(event) => {
                              if (
                                document.activeElement !== event.currentTarget
                              )
                                setActiveTooltip(null);
                            }}
                            onFocus={(event) =>
                              showMetricTooltip(
                                event,
                                row.tooltip,
                                `metric-tip-${comparisonRows.indexOf(row)}`,
                              )
                            }
                            onBlur={() => setActiveTooltip(null)}
                          >
                            <CircleHelp size={13} />
                          </button>
                        </span>
                      )}
                    </th>
                    {allResults.map((result, index) => (
                      <td
                        key={`${row.label}-${index}`}
                        className={`${index === 0 ? "current-column" : ""} ${row.label.startsWith("Loan closure") && result?.valid && !result.paidOff ? "warning-cell" : ""} ${(row.label === "Interest saved" || row.label === "Net repayment saved vs current EMI") && index > 0 && current?.paidOff && result?.paidOff && current.totalPaid < result.totalPaid ? "negative-saving" : ""} ${(row.label === "Time saved" || row.label === "Estimated value of saved months") && index > 0 && current?.paidOff && result?.paidOff && current.months < result.months ? "negative-saving" : ""}`}
                      >
                        {validInputs ? row.render(result, index) : "—"}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="reference-row">
                  <th scope="row">Bank-stated balance tenure</th>
                  <td className="current-column">
                    {Number(loan.balanceTenure) || "—"} months
                  </td>
                  <td>{Number(loan.balanceTenure) || "—"} months</td>
                  <td>{Number(loan.balanceTenure) || "—"} months</td>
                  <td>{Number(loan.balanceTenure) || "—"} months</td>
                </tr>
              </tbody>
            </table>
          </div>

          <AnimatePresence>
            {activeTooltip && (
              <motion.div
                className="metric-tooltip"
                role="tooltip"
                id={activeTooltip.id}
                style={{
                  top: activeTooltip.top,
                  left: activeTooltip.left,
                  transform: "translateY(-100%)",
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {activeTooltip.text}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="table-footer">
            <span>
              <span className="legend-dot baseline" /> Current EMI baseline
            </span>
            <span>
              <span className="legend-dot scenario" /> Alternative repayment
              scenarios
            </span>
            <button
              type="button"
              className="text-button"
              onClick={() => setShowNote((value) => !value)}
            >
              How are these calculated?{" "}
              <ChevronDown size={15} className={showNote ? "rotate" : ""} />
            </button>
          </div>

          <AnimatePresence>
            {showNote && (
              <motion.div
                className="calculation-note"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
              >
                <div className="calculation-detail-grid">
                  <div>
                    <strong>1. Monthly rate</strong>
                    <span>
                      {Number(loan.annualRate || 0)}% ÷ 1200 ={" "}
                      {(Number(loan.annualRate || 0) / 1200).toFixed(6)} per
                      month.
                    </span>
                  </div>
                  <div>
                    <strong>2. First month's interest</strong>
                    <span>
                      {money(Number(loan.principal || 0))} ×{" "}
                      {(Number(loan.annualRate || 0) / 1200).toFixed(6)} ={" "}
                      {money(current.firstMonthInterest, 2)}.
                    </span>
                  </div>
                  <div>
                    <strong>3. First month's principal</strong>
                    <span>
                      {money(Number(loan.currentEmi || 0))} EMI −{" "}
                      {money(current.firstMonthInterest, 2)} interest ={" "}
                      {money(current.firstMonthPrincipal, 2)} principal
                      reduction.
                    </span>
                  </div>
                  <div>
                    <strong>4. Repeat the schedule</strong>
                    <span>
                      Each following month calculates interest on the new
                      remaining balance. The simulation runs until zero balance
                      or the 1,200-month safety limit.
                    </span>
                  </div>
                  <div>
                    <strong>5. Final instalment</strong>
                    <span>
                      The last payment is the remaining balance plus that
                      month's interest, capped at the regular EMI. This is why
                      it can be smaller than a normal payment.
                    </span>
                  </div>
                  <div>
                    <strong>Payoff vs. statement tenure</strong>
                    <span>
                      The payoff months shown are simulated from principal,
                      rate, and EMI. Bank-stated balance tenure is shown
                      separately as a reference and is not substituted into the
                      schedule.
                    </span>
                  </div>
                </div>
                <p className="calculation-caveat">
                  Estimates assume a fixed annual rate, monthly reducing-balance
                  interest, and end-of-month payments. Fees, insurance,
                  daily-interest conventions, and lender-specific rounding are
                  not modeled. Monetary totals retain precision internally and
                  are rounded only for display.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>

        <AnimatePresence>
          {backupOpen && (
            <motion.div
              className="modal-backdrop"
              role="presentation"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) setBackupOpen(false);
              }}
            >
              <motion.section
                className="profile-modal panel compact-modal backup-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="backup-title"
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8 }}
              >
                <div className="modal-heading">
                  <div>
                    <span className="eyebrow">JSON BACKUP</span>
                    <h2 id="backup-title">Backup &amp; restore</h2>
                  </div>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label="Close backup dialog"
                    onClick={() => setBackupOpen(false)}
                  >
                    <X size={17} />
                  </button>
                </div>
                <p className="modal-copy">
                  Export includes only this account's loan profiles, never
                  account credentials. Import a valid version 1 file to merge
                  profiles or replace this account's loans.
                </p>
                <p className="backup-local-note">
                  The working JSON copy is saved in this browser beside
                  IndexedDB. A browser page cannot overwrite the app's project
                  files directly; use Export to create an editable .json file on
                  your device.
                </p>
                <div className="template-guide">
                  <strong>Need the right format?</strong>
                  <span>
                    Download the template, edit the name and loan numbers, and
                    keep the field names and three scenario values intact.
                  </span>
                  <code>{`{ "schemaVersion": 1, "profiles": [{ "name": "Home Loan", "loan": { "principal": 56702, "currentEmi": 703, "balanceTenure": 123, "annualRate": 8.85, "scenarios": [1000, 1100, 1500] } }] }`}</code>
                </div>
                <div className="backup-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={downloadTemplate}
                  >
                    <Download size={15} /> Download template
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => {
                      setBackupOpen(false);
                      exportLoans();
                    }}
                  >
                    <FileJson2 size={15} /> Export my loans
                  </button>
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => {
                      setBackupOpen(false);
                      window.setTimeout(
                        () => importInputRef.current?.click(),
                        80,
                      );
                    }}
                  >
                    <Upload size={15} /> Choose JSON file
                  </button>
                </div>
              </motion.section>
            </motion.div>
          )}
          {activityOpen && (
            <motion.div
              className="modal-backdrop"
              role="presentation"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onMouseDown={(event) => {
                if (event.target === event.currentTarget)
                  setActivityOpen(false);
              }}
            >
              <motion.section
                className="profile-modal panel activity-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="activity-title"
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8 }}
              >
                <div className="modal-heading">
                  <div>
                    <span className="eyebrow">LOCAL ACCOUNT HISTORY</span>
                    <h2 id="activity-title">Login activity</h2>
                  </div>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label="Close activity dialog"
                    onClick={() => setActivityOpen(false)}
                  >
                    <X size={17} />
                  </button>
                </div>
                <div className="activity-summary">
                  <span>
                    <strong>
                      {user.loginCount || user.loginHistory?.length || 0}
                    </strong>{" "}
                    recorded sign-ins
                  </span>
                  <span>
                    <strong>
                      {user.lastLoginAt
                        ? new Date(user.lastLoginAt).toLocaleString()
                        : "Not recorded"}
                    </strong>{" "}
                    last login
                  </span>
                  <span>
                    <strong>
                      {user.createdAt
                        ? new Date(user.createdAt).toLocaleDateString()
                        : "Unknown"}
                    </strong>{" "}
                    account created
                  </span>
                </div>
                <div className="activity-table-scroll">
                  <table className="activity-table">
                    <thead>
                      <tr>
                        {[
                          "Date / time",
                          "Event",
                          "Browser",
                          "Platform",
                          "Timezone",
                          "Language",
                          "Screen",
                          "Viewport",
                          "Connection",
                        ].map((heading) => (
                          <th key={heading}>{heading}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(user.loginHistory || []).map((entry) => (
                        <tr key={entry.id || entry.timestamp}>
                          <td>{new Date(entry.timestamp).toLocaleString()}</td>
                          <td>{entry.eventType}</td>
                          <td>{entry.browser}</td>
                          <td>{entry.platform}</td>
                          <td>{entry.timezone}</td>
                          <td>{entry.language}</td>
                          <td>{entry.screen}</td>
                          <td>{entry.viewport}</td>
                          <td>{entry.connection}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!user.loginHistory?.length && (
                    <p className="empty-activity">
                      No activity was recorded for this account yet. New
                      successful sign-ins will appear here.
                    </p>
                  )}
                </div>
                <p className="modal-copy activity-note">
                  This history stays in this browser and is user-editable local
                  demo data. Device and browser values are informational only,
                  not verified security evidence.
                </p>
              </motion.section>
            </motion.div>
          )}
          {downloadDialogOpen && (
            <motion.div
              className="modal-backdrop download-backdrop"
              role="presentation"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.section
                className={`profile-modal panel download-modal ${downloadPhase}`}
                role="dialog"
                aria-modal="true"
                aria-labelledby="download-title"
                initial={{ opacity: 0, y: 16, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10 }}
              >
                <div className="modal-heading">
                  <div>
                    <span className="eyebrow">EMI REPAY SIMULATOR REPORT</span>
                    <h2 id="download-title">
                      {downloadPhase === "success"
                        ? "Your report is ready"
                        : downloadPhase === "error"
                          ? "Download needs attention"
                          : "Preparing your loan report"}
                    </h2>
                  </div>
                  {downloadPhase !== "pulling" && (
                    <button
                      className="icon-button"
                      type="button"
                      aria-label="Close download dialog"
                      onClick={() => {
                        setDownloadDialogOpen(false);
                        setDownloadPhase("idle");
                      }}
                    >
                      <X size={17} />
                    </button>
                  )}
                </div>
                <div className="retrieval-scene" aria-hidden="true">
                  <div className="scene-ceiling-line" />
                  <motion.div
                    className="scene-hook"
                    animate={
                      downloadPhase === "pulling"
                        ? { rotate: [-5, 6, -4] }
                        : { rotate: 0 }
                    }
                    transition={{
                      duration: 1.2,
                      repeat: downloadPhase === "pulling" ? Infinity : 0,
                    }}
                  >
                    <span />
                    <i />
                  </motion.div>
                  <motion.div
                    className="scene-stickman"
                    animate={
                      downloadPhase === "pulling"
                        ? { y: [0, -6, 0], rotate: [0, -2, 1] }
                        : downloadPhase === "success"
                          ? { y: -8, rotate: 4 }
                          : { y: 0 }
                    }
                    transition={{
                      duration: 1,
                      repeat: downloadPhase === "pulling" ? Infinity : 0,
                    }}
                  >
                    <i />
                    <b />
                    <em />
                    <strong />
                  </motion.div>
                  <motion.div
                    className="scene-report"
                    animate={
                      downloadPhase === "pulling"
                        ? { y: [0, 16, 0], rotate: [0, 4, -2] }
                        : downloadPhase === "success"
                          ? { y: 43, opacity: 0, rotate: 12 }
                          : { opacity: 1 }
                    }
                    transition={{
                      duration: downloadPhase === "success" ? 0.55 : 1.4,
                      repeat: downloadPhase === "pulling" ? Infinity : 0,
                    }}
                  >
                    <span>EMI</span>
                    <small>REPORT</small>
                  </motion.div>
                  <div className="scene-floor" />
                </div>
                <div className="download-status-line">
                  <span className={`download-status-dot ${downloadPhase}`} />
                  <div>
                    <strong>
                      {downloadPhase === "success"
                        ? "PDF downloaded"
                        : downloadPhase === "error"
                          ? "PDF could not be created"
                          : "Collecting loan inputs and simulations"}
                    </strong>
                    <span>
                      {downloadPhase === "success"
                        ? `${activeProfile?.name || "Loan"} · ${new Date().toLocaleString()}`
                        : downloadPhase === "error"
                          ? "Check the notification for details and try again."
                          : "Building a report from the current values, comparison, and assumptions."}
                    </span>
                  </div>
                </div>
                <div className="download-progress-track">
                  <motion.div
                    className="download-progress-fill"
                    animate={{
                      width:
                        downloadPhase === "success"
                          ? "100%"
                          : downloadPhase === "error"
                            ? "100%"
                            : ["18%", "62%", "86%"],
                    }}
                    transition={{
                      duration: downloadPhase === "pulling" ? 1.7 : 0.35,
                      repeat: downloadPhase === "pulling" ? Infinity : 0,
                      ease: "easeInOut",
                    }}
                  />
                </div>
                {downloadPhase !== "pulling" && (
                  <div className="modal-footer">
                    <button
                      className="primary-button"
                      type="button"
                      onClick={() => {
                        setDownloadDialogOpen(false);
                        setDownloadPhase("idle");
                      }}
                    >
                      {downloadPhase === "success" ? "Done" : "Close"}
                    </button>
                  </div>
                )}
              </motion.section>
            </motion.div>
          )}
          {manageOpen && (
            <motion.div
              className="modal-backdrop"
              role="presentation"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) setManageOpen(false);
              }}
            >
              <motion.section
                className="profile-modal panel"
                role="dialog"
                aria-modal="true"
                aria-labelledby="manage-loans-title"
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8 }}
              >
                <div className="modal-heading">
                  <div>
                    <span className="eyebrow">YOUR LOCAL LIBRARY</span>
                    <h2 id="manage-loans-title">Manage saved loans</h2>
                  </div>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label="Close loan manager"
                    onClick={() => setManageOpen(false)}
                  >
                    <X size={17} />
                  </button>
                </div>
                <div className="manage-list">
                  {profiles.map((profile) => (
                    <div className="manage-row" key={profile.id}>
                      <div>
                        <strong>{profile.name}</strong>
                        <span>
                          {money(profile.loan.principal)} principal ·{" "}
                          {money(profile.loan.currentEmi)} EMI
                        </span>
                      </div>
                      <div className="manage-actions">
                        {profile.id === activeProfile?.id && (
                          <span className="active-tag">CURRENT</span>
                        )}
                        <button
                          className="icon-button"
                          type="button"
                          aria-label={`Rename ${profile.name}`}
                          onClick={() => openNameDialog("rename", profile)}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          className="icon-button delete-icon"
                          type="button"
                          aria-label={`Delete ${profile.name}`}
                          onClick={() => setPendingDeleteId(profile.id)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="modal-footer">
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => openNameDialog("new")}
                  >
                    <FilePlus2 size={16} /> Create a blank loan
                  </button>
                </div>
              </motion.section>
            </motion.div>
          )}
          {nameDialogOpen && (
            <motion.div
              className="modal-backdrop"
              role="presentation"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onMouseDown={(event) => {
                if (event.target === event.currentTarget)
                  setNameDialogOpen(false);
              }}
            >
              <motion.section
                className="profile-modal panel compact-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="loan-name-title"
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8 }}
              >
                <div className="modal-heading">
                  <div>
                    <span className="eyebrow">LOAN PROFILE</span>
                    <h2 id="loan-name-title">
                      {nameMode === "rename"
                        ? "Rename loan"
                        : nameMode === "new"
                          ? "Create a blank loan"
                          : "Save current loan as"}
                    </h2>
                  </div>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label="Close dialog"
                    onClick={() => setNameDialogOpen(false)}
                  >
                    <X size={17} />
                  </button>
                </div>
                <form onSubmit={saveNamedProfile}>
                  <label className="field">
                    <span className="field-label">Loan name</span>
                    <span className="input-wrap">
                      <input
                        type="text"
                        maxLength={60}
                        autoFocus
                        value={nameDraft}
                        onChange={(event) => setNameDraft(event.target.value)}
                        placeholder="e.g. Home Loan"
                      />
                    </span>
                  </label>
                  <div className="modal-footer">
                    <button
                      className="text-button"
                      type="button"
                      onClick={() => setNameDialogOpen(false)}
                    >
                      Cancel
                    </button>
                    <button className="primary-button" type="submit">
                      <Check size={16} /> Save profile
                    </button>
                  </div>
                </form>
              </motion.section>
            </motion.div>
          )}
          {pendingDeleteId && (
            <motion.div
              className="modal-backdrop"
              role="presentation"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onMouseDown={(event) => {
                if (event.target === event.currentTarget)
                  setPendingDeleteId(null);
              }}
            >
              <motion.section
                className="profile-modal panel compact-modal"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="delete-loan-title"
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8 }}
              >
                <div className="modal-heading">
                  <div>
                    <span className="eyebrow">CONFIRM DELETE</span>
                    <h2 id="delete-loan-title">
                      Delete{" "}
                      {
                        profiles.find(
                          (profile) => profile.id === pendingDeleteId,
                        )?.name
                      }
                      ?
                    </h2>
                  </div>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label="Cancel delete"
                    onClick={() => setPendingDeleteId(null)}
                  >
                    <X size={17} />
                  </button>
                </div>
                <p className="modal-copy">
                  This removes the loan profile from this browser. This cannot
                  be undone unless you have an exported backup.
                </p>
                <div className="modal-footer">
                  <button
                    className="text-button"
                    type="button"
                    onClick={() => setPendingDeleteId(null)}
                  >
                    Cancel
                  </button>
                  <button
                    className="danger-button"
                    type="button"
                    onClick={deleteProfile}
                  >
                    <Trash2 size={15} /> Delete loan
                  </button>
                </div>
              </motion.section>
            </motion.div>
          )}
          {importOpen && (
            <motion.div
              className="modal-backdrop"
              role="presentation"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) setImportOpen(false);
              }}
            >
              <motion.section
                className="profile-modal panel compact-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="import-loans-title"
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8 }}
              >
                <div className="modal-heading">
                  <div>
                    <span className="eyebrow">JSON BACKUP</span>
                    <h2 id="import-loans-title">Import loan profiles</h2>
                  </div>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label="Close import dialog"
                    onClick={() => setImportOpen(false)}
                  >
                    <X size={17} />
                  </button>
                </div>
                <p className="modal-copy">
                  Found {importedProfiles?.length || 0} valid profile(s). Merge
                  keeps your existing loans; replace removes them and restores
                  only this backup.
                </p>
                <div className="modal-footer import-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => applyImport("merge")}
                  >
                    Merge profiles
                  </button>
                  <button
                    className="danger-button"
                    type="button"
                    onClick={() => applyImport("replace")}
                  >
                    Replace existing
                  </button>
                </div>
              </motion.section>
            </motion.div>
          )}
        </AnimatePresence>

        <footer className="dashboard-footer">
          <span>EMI Repay Simulator · Personal repayment simulator</span>
          <span>Estimates only · Confirm exact figures with your lender</span>
        </footer>
      </main>
    </div>
  );
}

function SkeletonBone({ className = "" }) {
  return (
    <motion.div
      className={`skeleton-bone ${className}`}
      animate={{ backgroundPosition: ["100% 0", "-100% 0"] }}
      transition={{ duration: 1.35, ease: "linear", repeat: Infinity }}
    />
  );
}

function DashboardSkeleton({ theme }) {
  return (
    <div
      className={`app-shell ${theme}`}
      aria-label="Loading saved loan profiles"
      aria-busy="true"
    >
      <header className="topbar skeleton-topbar">
        <SkeletonBone className="logo-bone" />
        <SkeletonBone className="avatar-bone" />
      </header>
      <main className="dashboard skeleton-dashboard">
        <div className="skeleton-welcome">
          <SkeletonBone className="line-bone wide" />
          <SkeletonBone className="line-bone medium" />
        </div>
        <section className="workspace-grid">
          <div className="panel loan-panel skeleton-panel">
            <SkeletonBone className="line-bone medium" />
            <div className="skeleton-fields">
              {Array.from({ length: 4 }, (_, index) => (
                <SkeletonBone className="field-bone" key={index} />
              ))}
            </div>
            <SkeletonBone className="line-bone short" />
            <div className="skeleton-fields scenario-skeleton">
              {Array.from({ length: 3 }, (_, index) => (
                <SkeletonBone className="field-bone" key={index} />
              ))}
            </div>
          </div>
          <div className="panel insight-panel skeleton-panel">
            <SkeletonBone className="line-bone short" />
            <SkeletonBone className="amount-bone" />
            <div className="skeleton-fields">
              <SkeletonBone className="stat-bone" />
              <SkeletonBone className="stat-bone" />
            </div>
          </div>
        </section>
        <div className="panel comparison-panel skeleton-panel">
          <SkeletonBone className="line-bone medium" />
          <div className="skeleton-table">
            {Array.from({ length: 7 }, (_, index) => (
              <SkeletonBone className="table-line" key={index} />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

function AppContent() {
  const [users = [], setUsers] = useLocalStorageState("emi-studio-users", {
    defaultValue: [],
  });
  const [session, setSession] = useSessionStorageState("emi-studio-session", {
    defaultValue: null,
  });
  const [theme] = useAtom(themeAtom);
  const [loanData, setLoanData] = useState(null);
  const [loadingLoans, setLoadingLoans] = useState(false);
  const [loanLoadError, setLoanLoadError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);

  const user = users.find(
    (account) =>
      account.username.toLowerCase() === session?.username?.toLowerCase(),
  );

  useEffect(() => {
    const demoIdentityExists = users.some(
      (account) =>
        account.username.toLowerCase() === DEMO_ACCOUNT.username ||
        account.email.toLowerCase() === DEMO_ACCOUNT.email,
    );
    if (demoIdentityExists) return undefined;

    let active = true;
    getDemoAccountRecord()
      .then((demoAccount) => {
        if (!active) return;
        setUsers((previous = []) => {
          const collision = previous.some(
            (account) =>
              account.username.toLowerCase() === DEMO_ACCOUNT.username ||
              account.email.toLowerCase() === DEMO_ACCOUNT.email,
          );
          return collision ? previous : [...previous, demoAccount];
        });
      })
      .catch((seedError) => {
        if (active) {
          toast.error("Demo account unavailable", {
            description:
              seedError.message || "Secure browser cryptography is required.",
          });
        }
      });

    return () => {
      active = false;
    };
  }, [setUsers, users]);

  useEffect(() => {
    let active = true;
    if (!user) {
      setLoanData(null);
      setLoadingLoans(false);
      return () => {
        active = false;
      };
    }
    setLoadingLoans(true);
    setLoanData(null);
    setLoanLoadError("");
    loadUserLoanData(user.username.toLowerCase())
      .then((data) => {
        if (active) setLoanData(data);
      })
      .catch((storageError) => {
        if (active) {
          setLoanLoadError(
            storageError.message || "Browser storage could not be opened.",
          );
          toast.error("Could not load local loans", {
            description: storageError.message,
          });
        }
      })
      .finally(() => {
        if (active) setLoadingLoans(false);
      });
    return () => {
      active = false;
    };
  }, [loadAttempt, user?.username]);

  if (!user) {
    return (
      <AuthScreen
        users={users}
        onAuthenticated={(account) => {
          setUsers((previous = []) => {
            const existingIndex = previous.findIndex(
              (item) =>
                item.username.toLowerCase() === account.username.toLowerCase(),
            );
            if (existingIndex < 0) return [...previous, account];
            return previous.map((item, index) =>
              index === existingIndex ? account : item,
            );
          });
          setSession({ username: account.username });
        }}
        theme={theme}
      />
    );
  }

  if (loadingLoans) return <DashboardSkeleton theme={theme} />;
  if (loanLoadError || !loanData) {
    return (
      <main className={`auth-page ${theme}`}>
        <section
          className="profile-modal panel compact-modal storage-error"
          role="alert"
        >
          <div className="modal-heading">
            <div>
              <span className="eyebrow">LOCAL STORAGE</span>
              <h2>Could not open your loan workspace</h2>
            </div>
          </div>
          <p className="modal-copy">
            {loanLoadError || "Your loan data is not available yet."} Your
            account data has not been changed.
          </p>
          <div className="modal-footer">
            <button
              className="primary-button"
              type="button"
              onClick={() => setLoadAttempt((attempt) => attempt + 1)}
            >
              Try again
            </button>
            <button
              className="text-button"
              type="button"
              onClick={() => setSession(null)}
            >
              Sign out
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <Dashboard
      key={user.username.toLowerCase()}
      user={user}
      initialData={loanData}
      onLogout={() => setSession(null)}
    />
  );
}

export default function App() {
  const [theme] = useAtom(themeAtom);
  useEffect(() => {
    toast.configure({ sound: true, volume: 0.22, theme });
  }, [theme]);
  return (
    <>
      <Toaster position="bottom-right" theme={theme} />
      <AppContent />
    </>
  );
}
