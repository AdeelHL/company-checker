import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import * as cheerio from "cheerio";
import whois from "whois-json";

export interface SocialResult {
  platform: "LinkedIn" | "Twitter" | "Facebook" | "Instagram" | "YouTube";
  found: boolean;
  url: string | null;
}

export interface CheckItem {
  label: string;
  passed: boolean;
  detail: string;
  category: "security" | "domain" | "content" | "presence";
}

export interface CheckResult {
  company: string;
  score: number;
  verdict: "Likely Legit" | "Suspicious" | "Likely Scam";
  domain: string | null;
  domainInfo: {
    age: number | null;
    registrar: string | null;
    country: string | null;
  };
  socials: SocialResult[];
  trustpilot: {
    found: boolean;
    rating: number | null;
    reviews: number | null;
  };
  checks: CheckItem[];
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
    const res = await axios.get(`https://html.duckduckgo.com/html/?q=${query}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
      timeout: 10000,
    });
    const $ = cheerio.load(res.data as string);
    const firstUrl = $(".result__url").first().text().trim();
    if (firstUrl) {
      const match = firstUrl.match(/([a-zA-Z0-9.-]+\.[a-z]{2,})/);
      if (match) return extractDomain(match[1]);
    }
    const firstHref = $(".result__a").first().attr("href");
    if (firstHref) {
      const urlMatch = firstHref.match(/uddg=([^&]+)/);
      if (urlMatch) return extractDomain(decodeURIComponent(urlMatch[1]));
    }
  } catch {
    // fall through
  }

  const slug = company.toLowerCase().replace(/[^a-z0-9]/g, "");
  for (const candidate of [`${slug}.com`, `${slug}.co`, `${slug}.io`]) {
    try {
      await axios.get(`https://${candidate}`, { timeout: 5000 });
      return candidate;
    } catch (e: unknown) {
      if (axios.isAxiosError(e) && e.response) return candidate;
    }
  }
  return null;
}

async function fetchPageContent(domain: string): Promise<{
  html: string;
  reachable: boolean;
  finalDomain: string;
}> {
  try {
    const res = await axios.get(`https://${domain}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
      },
      timeout: 8000,
      maxRedirects: 5,
    });
    const finalUrl = res.request?.res?.responseUrl || res.config.url || `https://${domain}`;
    const finalDomain = extractDomain(finalUrl);
    return { html: res.data as string, reachable: true, finalDomain };
  } catch {
    return { html: "", reachable: false, finalDomain: domain };
  }
}

async function getDomainInfo(domain: string): Promise<{
  age: number | null;
  registrar: string | null;
  country: string | null;
}> {
  try {
    const data = await whois(domain);
    const raw = data.creationDate || data.created || data["creation date"] || data["registered on"];
    let age: number | null = null;
    if (raw) {
      const dateStr = Array.isArray(raw) ? (raw[0] as string) : (raw as string);
      const created = new Date(dateStr);
      if (!isNaN(created.getTime())) {
        age = Math.round(((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24 * 365)) * 10) / 10;
      }
    }
    const registrar = (data.registrar || data["registrar name"] || null) as string | null;
    const country = (data.registrantCountry || data["registrant country"] || data.country || null) as string | null;
    return { age, registrar: registrar ? String(registrar).split("\n")[0].trim() : null, country };
  } catch {
    return { age: null, registrar: null, country: null };
  }
}

async function checkTrustpilot(domain: string): Promise<{
  found: boolean;
  rating: number | null;
  reviews: number | null;
}> {
  try {
    const res = await axios.get(`https://www.trustpilot.com/review/${domain}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
      },
      timeout: 8000,
    });
    const $ = cheerio.load(res.data as string);
    // Try JSON-LD structured data first
    let rating: number | null = null;
    let reviews: number | null = null;
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const json = JSON.parse($(el).html() || "{}");
        if (json.aggregateRating) {
          rating = parseFloat(json.aggregateRating.ratingValue) || null;
          reviews = parseInt(json.aggregateRating.reviewCount) || null;
        }
      } catch { /* ignore */ }
    });
    if (!rating) {
      const ratingText = $('[data-rating-typography]').first().text().trim();
      if (ratingText) rating = parseFloat(ratingText) || null;
    }
    return { found: true, rating, reviews };
  } catch {
    return { found: false, rating: null, reviews: null };
  }
}

function detectSocials(html: string): SocialResult[] {
  const $ = cheerio.load(html);
  const platforms: { platform: SocialResult["platform"]; hostnames: string[] }[] = [
    { platform: "LinkedIn",  hostnames: ["linkedin.com"] },
    { platform: "Twitter",   hostnames: ["twitter.com", "x.com"] },
    { platform: "Facebook",  hostnames: ["facebook.com"] },
    { platform: "Instagram", hostnames: ["instagram.com"] },
    { platform: "YouTube",   hostnames: ["youtube.com"] },
  ];

  return platforms.map(({ platform, hostnames }) => {
    let url: string | null = null;
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href") || "";
      try {
        const hostname = new URL(href).hostname.replace(/^www\./, "");
        if (hostnames.includes(hostname)) {
          url = href;
          return false; // break cheerio loop
        }
      } catch {
        // relative or invalid URL — skip
      }
    });
    return { platform, found: url !== null, url };
  });
}

export async function POST(req: NextRequest) {
  const { company } = await req.json();
  if (!company || typeof company !== "string") {
    return NextResponse.json({ error: "Company name required" }, { status: 400 });
  }

  const domain = await searchForDomain(company.trim());
  const checks: CheckItem[] = [];
  let score = 0;

  // 1. Domain found
  if (domain) {
    score += 15;
    checks.push({ label: "Website Found", passed: true, detail: `Found domain: ${domain}`, category: "presence" });
  } else {
    checks.push({ label: "Website Found", passed: false, detail: "No website could be located for this company", category: "presence" });
    return NextResponse.json({
      company: company.trim(), score: 0, verdict: "Likely Scam",
      domain: null,
      domainInfo: { age: null, registrar: null, country: null },
      socials: [],
      trustpilot: { found: false, rating: null, reviews: null },
      checks,
    } satisfies CheckResult);
  }

  // Run all async checks in parallel
  const [domainInfo, pageResult, trustpilot, sslOk] = await Promise.all([
    getDomainInfo(domain),
    fetchPageContent(domain),
    checkTrustpilot(domain),
    axios.get(`https://${domain}`, { timeout: 6000 }).then(() => true).catch((e) => {
      if (axios.isAxiosError(e) && e.response) return true;
      return false;
    }),
  ]);

  const { html, reachable, finalDomain } = pageResult;
  const socials = html ? detectSocials(html) : [];

  // 2. SSL
  if (sslOk) score += 10;
  checks.push({
    label: "SSL Certificate (HTTPS)", passed: sslOk,
    detail: sslOk ? "Site uses HTTPS — connection is encrypted" : "No valid HTTPS detected",
    category: "security",
  });

  // 3. Redirect check
  const redirectSuspicious = finalDomain !== domain && !finalDomain.includes(domain.split(".")[0]);
  const redirectOk = !redirectSuspicious;
  if (redirectOk) score += 5;
  checks.push({
    label: "No Suspicious Redirects", passed: redirectOk,
    detail: redirectOk
      ? finalDomain === domain ? "Site does not redirect" : `Redirects to ${finalDomain} (expected)`
      : `Redirects to unrelated domain: ${finalDomain}`,
    category: "security",
  });

  // 4. Domain age
  const { age, registrar, country } = domainInfo;
  const domainOld = age !== null && age >= 1;
  if (domainOld) score += 15;
  if (age !== null && age >= 3) score += 5;
  checks.push({
    label: "Domain Age", passed: domainOld,
    detail: age !== null ? `Domain is ${age} year${age !== 1 ? "s" : ""} old` : "Could not determine domain age",
    category: "domain",
  });

  // 5. Website reachable
  if (reachable) score += 5;
  checks.push({
    label: "Website Reachable", passed: reachable,
    detail: reachable ? "Website loaded successfully" : "Website did not respond",
    category: "presence",
  });

  if (reachable && html) {
    const $page = cheerio.load(html);
    const text = $page("body").text().toLowerCase();

    // 6. Contact info
    const hasContact = text.includes("contact") || text.includes("email") || text.includes("support");
    if (hasContact) score += 8;
    checks.push({
      label: "Contact Information", passed: hasContact,
      detail: hasContact ? "Contact details found on site" : "No contact information detected",
      category: "content",
    });

    // 7. Phone number
    const hasPhone = /(\+?[\d\s\-().]{7,}\d)/.test(text);
    if (hasPhone) score += 5;
    checks.push({
      label: "Phone Number", passed: hasPhone,
      detail: hasPhone ? "Phone number found on site" : "No phone number detected",
      category: "content",
    });

    // 8. Physical address
    const hasAddress =
      /\d+\s+[\w\s]+(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr)/i.test(text) ||
      text.includes("our address") || text.includes("headquarters") || text.includes("hq");
    if (hasAddress) score += 5;
    checks.push({
      label: "Physical Address", passed: hasAddress,
      detail: hasAddress ? "Physical address or HQ info found" : "No physical address detected",
      category: "content",
    });

    // 9. About page
    const hasAbout = text.includes("about us") || text.includes("our story") || text.includes("who we are");
    if (hasAbout) score += 8;
    checks.push({
      label: "About Page", passed: hasAbout,
      detail: hasAbout ? "About/company info section found" : "No about page detected",
      category: "content",
    });

    // 10. Privacy / Terms
    const hasPrivacy = text.includes("privacy policy") || text.includes("terms of service") || text.includes("terms and conditions");
    if (hasPrivacy) score += 8;
    checks.push({
      label: "Privacy Policy / Terms", passed: hasPrivacy,
      detail: hasPrivacy ? "Legal pages found" : "No privacy policy or terms detected",
      category: "content",
    });

    // 11. Scam phrases
    const scamWords = ["guaranteed returns", "act now", "limited time offer", "click here to claim", "you have been selected", "wire transfer", "western union"];
    const hasScam = scamWords.some((w) => text.includes(w));
    if (!hasScam) score += 8;
    checks.push({
      label: "No Scam Phrases", passed: !hasScam,
      detail: hasScam ? "Suspicious language detected on site" : "No common scam phrases found",
      category: "content",
    });

    // 12. Social presence score
    const foundSocials = socials.filter((s) => s.found).length;
    score += foundSocials * 2;
    checks.push({
      label: "Social Media Presence", passed: foundSocials >= 2,
      detail: foundSocials > 0 ? `Found ${foundSocials} social profile${foundSocials > 1 ? "s" : ""} linked on site` : "No social media links found on site",
      category: "presence",
    });
  }

  // 13. Trustpilot
  if (trustpilot.found) {
    score += 3;
    if (trustpilot.rating && trustpilot.rating >= 3.5) score += 5;
  }
  checks.push({
    label: "Trustpilot Listing", passed: trustpilot.found,
    detail: trustpilot.found
      ? trustpilot.rating ? `Rated ${trustpilot.rating}/5 from ${trustpilot.reviews?.toLocaleString() ?? "?"} reviews` : "Listed on Trustpilot"
      : "No Trustpilot listing found",
    category: "presence",
  });

  return NextResponse.json({
    company: company.trim(),
    score: Math.min(score, 100),
    verdict: verdictFromScore(Math.min(score, 100)),
    domain,
    domainInfo: { age, registrar, country },
    socials,
    trustpilot,
    checks,
  } satisfies CheckResult);
}
