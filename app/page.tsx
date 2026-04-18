"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import type { CheckResult } from "@/app/api/check/route";

const verdictColor: Record<CheckResult["verdict"], string> = {
  "Likely Legit": "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  Suspicious: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  "Likely Scam": "bg-red-500/15 text-red-400 border-red-500/30",
};

const scoreColor = (score: number) => {
  if (score >= 60) return "text-emerald-400";
  if (score >= 35) return "text-yellow-400";
  return "text-red-400";
};

const progressColor = (score: number) => {
  if (score >= 60) return "[&>div]:bg-emerald-500";
  if (score >= 35) return "[&>div]:bg-yellow-500";
  return "[&>div]:bg-red-500";
};

export default function Home() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCheck() {
    if (!query.trim()) return;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company: query }),
      });
      if (!res.ok) throw new Error("Request failed");
      const data: CheckResult = await res.json();
      setResult(data);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white flex flex-col items-center px-4 py-16">
      {/* Header */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 text-xs text-white/50 mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
          Company Legitimacy Checker
        </div>
        <h1 className="text-5xl font-bold tracking-tight mb-4 bg-gradient-to-b from-white to-white/50 bg-clip-text text-transparent">
          Is this company legit?
        </h1>
        <p className="text-white/40 text-lg max-w-md mx-auto">
          Enter a company name and we&apos;ll analyse its web presence, domain
          age, SSL, and more to give you a trust score.
        </p>
      </div>

      {/* Search */}
      <div className="w-full max-w-xl mb-10">
        <div className="flex gap-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCheck()}
            placeholder="e.g. Apple, Shopify, some-random-store.com"
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-5 py-3.5 text-sm text-white placeholder:text-white/25 outline-none focus:border-white/25 transition"
          />
          <button
            onClick={handleCheck}
            disabled={loading || !query.trim()}
            className="bg-white text-black font-semibold text-sm px-6 rounded-xl disabled:opacity-40 transition hover:bg-white/90"
          >
            {loading ? "Checking…" : "Check"}
          </button>
        </div>
        {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="w-full max-w-xl space-y-3 animate-pulse">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 rounded-xl bg-white/5" />
          ))}
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <div className="w-full max-w-xl space-y-5">
          {/* Score card */}
          <Card className="bg-white/5 border-white/10 text-white">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-medium text-white/70">
                  Trust Score
                </CardTitle>
                <Badge
                  className={`border text-xs font-medium ${verdictColor[result.verdict]}`}
                >
                  {result.verdict}
                </Badge>
              </div>
              <p className="text-white/40 text-sm">
                {result.domain ? (
                  <>
                    Analysed{" "}
                    <span className="text-white/60">{result.domain}</span>
                  </>
                ) : (
                  "No domain found"
                )}
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-end gap-2">
                <span
                  className={`text-6xl font-bold tabular-nums ${scoreColor(result.score)}`}
                >
                  {result.score}
                </span>
                <span className="text-white/30 text-xl mb-2">/100</span>
              </div>
              <Progress
                value={result.score}
                className={`h-2 bg-white/10 ${progressColor(result.score)}`}
              />
            </CardContent>
          </Card>

          {/* Checks */}
          <Card className="bg-white/5 border-white/10 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium text-white/70">
                Signal Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-0">
              {result.checks.map((check, i) => (
                <div key={i}>
                  {i > 0 && <Separator className="bg-white/5 my-0" />}
                  <div className="flex items-start gap-3 py-3.5">
                    <div
                      className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${
                        check.passed
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-red-500/20 text-red-400"
                      }`}
                    >
                      {check.passed ? "✓" : "✗"}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white/80">
                        {check.label}
                      </p>
                      <p className="text-xs text-white/40 mt-0.5">
                        {check.detail}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </main>
  );
}
