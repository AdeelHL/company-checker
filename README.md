# Company Checker

A full-stack web app that analyses whether a company is legitimate by scoring it across multiple trust signals — domain age, SSL certificate, web presence, contact info, legal pages, and scam phrase detection.

Built with **Next.js 15**, **TypeScript**, **Tailwind CSS**, and **shadcn/ui**.

## Features

- Search any company by name — no URL required
- Automatically finds the company's website via search
- Scores across 8 signals and returns a 0–100 trust score
- Verdict: **Likely Legit**, **Suspicious**, or **Likely Scam**
- Clean, dark UI with animated loading states

## Signals Checked

| Signal | Description |
|---|---|
| Website Found | Locates the company's domain from its name |
| SSL Certificate | Verifies HTTPS is valid and active |
| Domain Age | Older domains are significantly more trustworthy |
| Website Reachable | Confirms the site actually loads |
| Contact Information | Checks for email, phone, or support details |
| About Page | Looks for company info or "about us" content |
| Privacy Policy / Terms | Flags absence of legal pages |
| No Scam Phrases | Detects common scam/fraud language patterns |

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Data**: whois-json, axios, cheerio

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Deployment

Deploy instantly with [Vercel](https://vercel.com) — push to GitHub and import the repo.
