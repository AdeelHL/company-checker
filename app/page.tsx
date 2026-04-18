"use client";

import { useState, useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Shield, Globe, FileText, Users, CheckCircle2, XCircle,
  Star, ExternalLink, Sun, Moon,
} from "lucide-react";
import type { CheckResult, CheckItem } from "@/app/api/check/route";

// ── Theme toggle ──────────────────────────────────────────────────────────────
function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="w-9 h-9" />;
  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-500 dark:text-white/50 hover:text-gray-900 dark:hover:text-white transition-colors"
      aria-label="Toggle theme"
    >
      {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}

// ── Animated count-up ─────────────────────────────────────────────────────────
function useCountUp(target: number, duration = 1400) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    setCount(0);
    if (target === 0) return;
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setCount(target); clearInterval(timer); }
      else setCount(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return count;
}

// ── SVG Gauge ─────────────────────────────────────────────────────────────────
function ScoreGauge({ score, color, isDark }: { score: number; color: string; isDark: boolean }) {
  const radius = 72;
  const stroke = 10;
  const size = (radius + stroke) * 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;
  const [offset, setOffset] = useState(circumference);
  const displayScore = useCountUp(score);

  useEffect(() => {
    const t = setTimeout(() => setOffset(circumference - (score / 100) * circumference), 100);
    return () => clearTimeout(t);
  }, [score, circumference]);

  const textColor = isDark ? "white" : "#111827";
  const subColor = isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)";
  const trackColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="drop-shadow-lg">
      <circle cx={cx} cy={cy} r={radius} fill="none" stroke={trackColor} strokeWidth={stroke} />
      <circle
        cx={cx} cy={cy} r={radius} fill="none"
        stroke={color} strokeWidth={stroke}
        strokeDasharray={circumference} strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition: "stroke-dashoffset 1.4s cubic-bezier(0.4,0,0.2,1)" }}
      />
      <text x={cx} y={cy - 8} textAnchor="middle" dominantBaseline="middle"
        fill={textColor} fontSize="38" fontWeight="700" fontFamily="inherit">
        {displayScore}
      </text>
      <text x={cx} y={cy + 22} textAnchor="middle"
        fill={subColor} fontSize="11" fontFamily="inherit">
        out of 100
      </text>
    </svg>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const VERDICT_STYLES: Record<CheckResult["verdict"], { badge: string; gauge: string }> = {
  "Likely Legit": { badge: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30", gauge: "#34d399" },
  Suspicious:     { badge: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/30",  gauge: "#fbbf24" },
  "Likely Scam":  { badge: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30",              gauge: "#f87171" },
};

const CATEGORY_META: Record<CheckItem["category"], { label: string; icon: React.ReactNode }> = {
  security: { label: "Security", icon: <Shield className="w-3.5 h-3.5" /> },
  domain:   { label: "Domain",   icon: <Globe className="w-3.5 h-3.5" /> },
  content:  { label: "Content",  icon: <FileText className="w-3.5 h-3.5" /> },
  presence: { label: "Presence", icon: <Users className="w-3.5 h-3.5" /> },
};

const SOCIAL_COLORS: Record<string, string> = {
  LinkedIn:  "bg-[#0a66c2]/10 text-[#0a66c2] dark:text-[#60a5fa] border-[#0a66c2]/30",
  Twitter:   "bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-white/70 border-gray-200 dark:border-white/10",
  Facebook:  "bg-[#1877f2]/10 text-[#1877f2] dark:text-[#60a5fa] border-[#1877f2]/30",
  Instagram: "bg-pink-50 dark:bg-pink-500/15 text-pink-600 dark:text-pink-400 border-pink-200 dark:border-pink-500/30",
  YouTube:   "bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/30",
};

const STATUS_MESSAGES = [
  "Searching for website…",
  "Checking SSL certificate…",
  "Looking up domain age…",
  "Scanning page content…",
  "Detecting social profiles…",
  "Checking Trustpilot…",
  "Calculating trust score…",
];

// ── Domain age bar ────────────────────────────────────────────────────────────
function DomainAgeBar({ age }: { age: number | null }) {
  const pct = age !== null ? Math.min((age / 15) * 100, 100) : 0;
  const color = age === null ? "bg-gray-200 dark:bg-white/10"
    : age >= 3 ? "bg-emerald-500"
    : age >= 1 ? "bg-yellow-500"
    : "bg-red-500";
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-gray-400 dark:text-white/40">
        <span>0 yrs</span>
        <span className="text-gray-700 dark:text-white/60 font-medium">
          {age !== null ? `${age} yr${age !== 1 ? "s" : ""}` : "Unknown"}
        </span>
        <span>15+ yrs</span>
      </div>
      <div className="h-2 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-1000 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── Star rating ───────────────────────────────────────────────────────────────
function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`w-3.5 h-3.5 ${i <= Math.round(rating) ? "text-yellow-400 fill-yellow-400" : "text-gray-200 dark:text-white/15"}`} />
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Home() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusIdx, setStatusIdx] = useState(0);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const statusTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (loading) {
      setStatusIdx(0);
      statusTimer.current = setInterval(() => {
        setStatusIdx((i) => Math.min(i + 1, STATUS_MESSAGES.length - 1));
      }, 1800);
    } else {
      if (statusTimer.current) clearInterval(statusTimer.current);
    }
    return () => { if (statusTimer.current) clearInterval(statusTimer.current); };
  }, [loading]);

  async function handleCheck() {
    if (!query.trim()) return;
    setLoading(true); setResult(null); setError(null);
    try {
      const res = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company: query }),
      });
      if (!res.ok) throw new Error("failed");
      setResult(await res.json());
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const isDark = !mounted || resolvedTheme === "dark";
  const style = result ? VERDICT_STYLES[result.verdict] : null;
  const grouped = result
    ? (["security", "domain", "content", "presence"] as const)
        .map((cat) => ({ cat, items: result.checks.filter((c) => c.category === cat) }))
        .filter((g) => g.items.length > 0)
    : [];

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-[#080810] text-gray-900 dark:text-white flex flex-col items-center px-4 py-16 transition-colors duration-300">

      {/* Theme toggle — top right */}
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      {/* Header */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-full px-4 py-1.5 text-xs text-gray-400 dark:text-white/50 mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
          Company Legitimacy Checker
        </div>
        <h1 className="text-5xl font-bold tracking-tight mb-4 bg-gradient-to-b from-gray-900 to-gray-500 dark:from-white dark:to-white/40 bg-clip-text text-transparent">
          Is this company legit?
        </h1>
        <p className="text-gray-400 dark:text-white/35 text-lg max-w-md mx-auto leading-relaxed">
          Enter a company name and get an instant trust score based on domain age, SSL, social presence, Trustpilot, and more.
        </p>
      </div>

      {/* Search */}
      <div className="w-full max-w-xl mb-10">
        <div className="flex gap-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !loading && handleCheck()}
            placeholder="e.g. Apple, Shopify, some-unknown-store…"
            className="flex-1 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-5 py-3.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-300 dark:placeholder:text-white/20 outline-none focus:border-gray-400 dark:focus:border-white/20 transition-colors"
          />
          <button
            onClick={handleCheck}
            disabled={loading || !query.trim()}
            className="bg-gray-900 dark:bg-white text-white dark:text-black font-semibold text-sm px-6 rounded-xl disabled:opacity-30 transition-opacity hover:opacity-80"
          >
            {loading ? "Checking…" : "Check"}
          </button>
        </div>
        {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="w-full max-w-xl flex flex-col items-center gap-6 py-8">
          <div className="relative w-[164px] h-[164px]">
            <svg className="absolute inset-0 animate-spin" style={{ animationDuration: "3s" }} viewBox="0 0 164 164">
              <circle cx="82" cy="82" r="72" fill="none" stroke={isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"} strokeWidth="10" />
              <circle cx="82" cy="82" r="72" fill="none" stroke={isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)"} strokeWidth="10"
                strokeDasharray="452" strokeDashoffset="340" strokeLinecap="round" transform="rotate(-90 82 82)" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <Shield className="w-8 h-8 text-gray-300 dark:text-white/30" />
            </div>
          </div>
          <div className="text-center space-y-1">
            <p className="text-gray-600 dark:text-white/70 text-sm font-medium">{STATUS_MESSAGES[statusIdx]}</p>
            <p className="text-gray-400 dark:text-white/25 text-xs">This may take up to 15 seconds</p>
          </div>
          <div className="flex gap-1.5">
            {STATUS_MESSAGES.map((_, i) => (
              <div key={i} className={`h-1 rounded-full transition-all duration-500 ${i <= statusIdx ? "bg-gray-400 dark:bg-white/50 w-4" : "bg-gray-200 dark:bg-white/10 w-1.5"}`} />
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {result && !loading && style && (
        <div className="w-full max-w-xl space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">

          {/* Score hero */}
          <Card className="bg-white dark:bg-white/[0.04] border-gray-200 dark:border-white/10 text-gray-900 dark:text-white shadow-sm">
            <CardContent className="pt-6 pb-5">
              <div className="flex items-center gap-6">
                <ScoreGauge score={result.score} color={style.gauge} isDark={isDark} />
                <div className="flex-1 space-y-3">
                  <div>
                    <Badge className={`border text-xs font-medium mb-2 ${style.badge}`}>
                      {result.verdict}
                    </Badge>
                    <p className="text-gray-500 dark:text-white/50 text-sm">
                      {result.domain ? (
                        <span className="flex items-center gap-1.5">
                          <Globe className="w-3.5 h-3.5" />
                          <span className="text-gray-700 dark:text-white/70">{result.domain}</span>
                          <a href={`https://${result.domain}`} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-3 h-3 text-gray-300 dark:text-white/30 hover:text-gray-600 dark:hover:text-white/60 transition-colors" />
                          </a>
                        </span>
                      ) : "No domain found"}
                    </p>
                  </div>
                  <Separator className="bg-gray-100 dark:bg-white/5" />
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-gray-400 dark:text-white/30 mb-0.5">Registrar</p>
                      <p className="text-gray-700 dark:text-white/70 truncate">{result.domainInfo.registrar || "—"}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 dark:text-white/30 mb-0.5">Country</p>
                      <p className="text-gray-700 dark:text-white/70">{result.domainInfo.country || "—"}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Domain age */}
          <Card className="bg-white dark:bg-white/[0.04] border-gray-200 dark:border-white/10">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-gray-400 dark:text-white/40 mb-3 font-medium uppercase tracking-wider">Domain Age</p>
              <DomainAgeBar age={result.domainInfo.age} />
            </CardContent>
          </Card>

          {/* Social media */}
          <Card className="bg-white dark:bg-white/[0.04] border-gray-200 dark:border-white/10">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-gray-400 dark:text-white/40 mb-3 font-medium uppercase tracking-wider">Social Media</p>
              <div className="flex flex-wrap gap-2">
                {result.socials.map((s) => (
                  <span
                    key={s.platform}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                      s.found ? SOCIAL_COLORS[s.platform] : "bg-gray-50 dark:bg-white/[0.03] text-gray-300 dark:text-white/20 border-gray-100 dark:border-white/5"
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${s.found ? "bg-current" : "bg-gray-300 dark:bg-white/20"}`} />
                    {s.platform}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Trustpilot */}
          {result.trustpilot.found && (
            <Card className="bg-white dark:bg-white/[0.04] border-gray-200 dark:border-white/10">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-400 dark:text-white/40 mb-1 font-medium uppercase tracking-wider">Trustpilot</p>
                    {result.trustpilot.rating && <StarRating rating={result.trustpilot.rating} />}
                  </div>
                  <div className="text-right">
                    {result.trustpilot.rating && (
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{result.trustpilot.rating.toFixed(1)}</p>
                    )}
                    {result.trustpilot.reviews && (
                      <p className="text-xs text-gray-400 dark:text-white/30">{result.trustpilot.reviews.toLocaleString()} reviews</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Grouped checks */}
          {grouped.map(({ cat, items }) => {
            const meta = CATEGORY_META[cat];
            const passed = items.filter((i) => i.passed).length;
            return (
              <Card key={cat} className="bg-white dark:bg-white/[0.04] border-gray-200 dark:border-white/10">
                <CardHeader className="pb-0 pt-4">
                  <CardTitle className="text-xs font-medium text-gray-400 dark:text-white/40 uppercase tracking-wider flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      {meta.icon}
                      {meta.label}
                    </span>
                    <span className={`text-xs font-semibold ${passed === items.length ? "text-emerald-500 dark:text-emerald-400" : passed === 0 ? "text-red-500 dark:text-red-400" : "text-yellow-500 dark:text-yellow-400"}`}>
                      {passed}/{items.length}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-2 pb-1">
                  {items.map((check, i) => (
                    <div key={i}>
                      {i > 0 && <Separator className="bg-gray-100 dark:bg-white/5" />}
                      <div className="flex items-start gap-3 py-3">
                        {check.passed
                          ? <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
                          : <XCircle className="w-4 h-4 text-red-500 dark:text-red-400 mt-0.5 flex-shrink-0" />}
                        <div>
                          <p className="text-sm font-medium text-gray-800 dark:text-white/80">{check.label}</p>
                          <p className="text-xs text-gray-400 dark:text-white/35 mt-0.5">{check.detail}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}
