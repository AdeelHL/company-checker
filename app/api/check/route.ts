import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import * as cheerio from "cheerio";
import whois from "whois-json";

export interface CheckResult {
  company: string;
  score: number;
  verdict: "Likely Legit" | "Suspicious" | "Likely Scam";
  domain: string | null;
  checks: {
    label: string;
    passed: boolean;
    detail: string;
  }[];
}

function extractDomain(url: string): string {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^www\./, "");
  }
}

function verdictFromScore(score: number): CheckResult["verdict"] {
  if (score >= 60) return "Likely Legit";
  if (score >= 35) return "Suspicious";
  return "Likely Scam";
}

async function searchForDomain(company: string): Promise<string | null> {
  try {
    const query = encodeURIComponent(`${company} official website`);
    const res = await axios.get(`https://www.google.com/search?q=${query}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
      },
      timeout: 8000,
    });
    const $ = cheerio.load(res.data);
    // Pull first cite element (Google shows domain in green under results)
    const firstCite = $("cite").first().text().trim();
    if (firstCite) {
      const match = firstCite.match(/^([a-zA-Z0-9.-]+\.[a-z]{2,})/);
      if (match) return extractDomain(match[1]);
    }
    return null;
  } catch {
    return null;
  }
}

async function checkSSL(domain: string): Promise<boolean> {
  try {
    await axios.get(`https://${domain}`, { timeout: 6000 });
    return true;
  } catch (e: unknown) {
    if (axios.isAxiosError(e) && e.code === "ECONNREFUSED") return false;
    // Any response (even 4xx) means HTTPS works
    return true;
  }
}

async function fetchPageContent(
  domain: string
): Promise<{ html: string; reachable: boolean }> {
  try {
    const res = await axios.get(`https://${domain}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
      },
      timeout: 8000,
    });
    return { html: res.data as string, reachable: true };
  } catch {
    return { html: "", reachable: false };
  }
}

async function getDomainAge(domain: string): Promise<number | null> {
  try {
    const data = await whois(domain);
    const raw =
      data.creationDate ||
      data.created ||
      data["creation date"] ||
      data["registered on"];
    if (!raw) return null;
    const dateStr = Array.isArray(raw) ? raw[0] : raw;
    const created = new Date(dateStr as string);
    if (isNaN(created.getTime())) return null;
    const years =
      (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24 * 365);
    return Math.round(years * 10) / 10;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const { company } = await req.json();
  if (!company || typeof company !== "string") {
    return NextResponse.json({ error: "Company name required" }, { status: 400 });
  }

  const domain = await searchForDomain(company.trim());
  const checks: CheckResult["checks"] = [];
  let score = 0;

  // 1. Domain found
  if (domain) {
    score += 15;
    checks.push({
      label: "Website Found",
      passed: true,
      detail: `Found domain: ${domain}`,
    });
  } else {
    checks.push({
      label: "Website Found",
      passed: false,
      detail: "No website could be located for this company",
    });
  }

  if (domain) {
    // 2. SSL check
    const hasSSL = await checkSSL(domain);
    if (hasSSL) score += 10;
    checks.push({
      label: "SSL Certificate (HTTPS)",
      passed: hasSSL,
      detail: hasSSL
        ? "Site uses HTTPS — connection is encrypted"
        : "No valid HTTPS — data may not be secure",
    });

    // 3. Domain age
    const ageYears = await getDomainAge(domain);
    const domainOld = ageYears !== null && ageYears >= 1;
    if (domainOld) score += 20;
    checks.push({
      label: "Domain Age",
      passed: domainOld,
      detail:
        ageYears !== null
          ? `Domain is ${ageYears} year${ageYears !== 1 ? "s" : ""} old`
          : "Could not determine domain age",
    });

    // 4–8: Page content checks
    const { html, reachable } = await fetchPageContent(domain);
    const $page = cheerio.load(html);
    const text = $page("body").text().toLowerCase();

    if (reachable) score += 5;
    checks.push({
      label: "Website Reachable",
      passed: reachable,
      detail: reachable ? "Website loaded successfully" : "Website did not respond",
    });

    if (reachable) {
      const hasContact =
        text.includes("contact") ||
        text.includes("email") ||
        text.includes("phone") ||
        text.includes("support");
      if (hasContact) score += 10;
      checks.push({
        label: "Contact Information",
        passed: hasContact,
        detail: hasContact
          ? "Contact details found on site"
          : "No contact information detected",
      });

      const hasAbout =
        text.includes("about us") ||
        text.includes("about the company") ||
        text.includes("our story") ||
        text.includes("who we are");
      if (hasAbout) score += 10;
      checks.push({
        label: "About Page",
        passed: hasAbout,
        detail: hasAbout
          ? "About/company info section found"
          : "No about page or company info detected",
      });

      const hasPrivacy =
        text.includes("privacy policy") ||
        text.includes("terms of service") ||
        text.includes("terms and conditions");
      if (hasPrivacy) score += 10;
      checks.push({
        label: "Privacy Policy / Terms",
        passed: hasPrivacy,
        detail: hasPrivacy
          ? "Legal pages found (privacy policy or terms)"
          : "No privacy policy or terms of service found",
      });

      const suspiciousWords = [
        "guaranteed returns",
        "act now",
        "limited time offer",
        "click here to claim",
        "you have been selected",
        "wire transfer",
        "western union",
      ];
      const hasSuspicious = suspiciousWords.some((w) => text.includes(w));
      if (!hasSuspicious) score += 10;
      checks.push({
        label: "No Scam Phrases",
        passed: !hasSuspicious,
        detail: hasSuspicious
          ? "Suspicious language detected on site"
          : "No common scam phrases found",
      });
    }
  }

  const capped = Math.min(score, 100);

  return NextResponse.json({
    company: company.trim(),
    score: capped,
    verdict: verdictFromScore(capped),
    domain,
    checks,
  } satisfies CheckResult);
}
