declare module 'whois-json' {
  function whois(domain: string): Promise<Record<string, unknown>>;
  export = whois;
}
