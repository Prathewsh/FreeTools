import { Component, signal, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface DataBreach {
  id: string;
  name: string;
  domain: string;
  year: number;
  recordsExposed: number;
  recordsFormatted: string;
  category: 'Tech' | 'Social' | 'Finance' | 'Healthcare' | 'Government' | 'Retail';
  dataCompromised: string[];
  description: string;
  impact: string;
}

export interface IconicCVE {
  cveId: string;
  name: string;
  year: number;
  cvss: number;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  affectedSoftware: string;
  attackVector: string;
  summary: string;
  historicalImpact: string;
  remediation: string;
}

export interface LiveCveResult {
  id: string;
  summary: string;
  cvss?: number;
  published?: string;
  modified?: string;
  cwe?: string;
  references: string[];
  vulnerableProducts?: string[];
}

@Component({
  selector: 'app-breach-radar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './breach-radar.component.html',
  styleUrl: './breach-radar.component.scss'
})
export class BreachRadarComponent implements OnInit {
  activeTab = signal<'breaches' | 'cves' | 'live'>('breaches');
  searchQuery = signal<string>('');
  selectedCategory = signal<string>('ALL');

  // Live CIRCL API state
  liveCveQuery = signal<string>('CVE-2021-44228');
  liveCveResult = signal<LiveCveResult | null>(null);
  recentCveList = signal<LiveCveResult[]>([]);
  isLoadingLive = signal<boolean>(false);
  liveError = signal<string | null>(null);

  isLoadingFeed = signal(false);
  feedError = signal<string | null>(null);
  private searchRequest = 0;
  private searchController?: AbortController;
  private feedController?: AbortController;

  // Selected item modal / detail view
  selectedBreach = signal<DataBreach | null>(null);
  selectedCve = signal<IconicCVE | null>(null);

  // Comprehensive historic repository of the largest data breaches
  readonly MAJOR_BREACHES: DataBreach[] = [
    {
      id: 'cam4',
      name: 'CAM4',
      domain: 'cam4.com',
      year: 2020,
      recordsExposed: 10880000000,
      recordsFormatted: '10.88 Billion',
      category: 'Social',
      dataCompromised: ['Email addresses', 'Passwords', 'IP addresses', 'Payment logs', 'Chat transcripts'],
      description: 'Misconfigured Elasticsearch cluster exposed almost 11 billion records containing PII, plaintext emails, password hashes, and user interactions.',
      impact: 'Largest single database exposure in recorded internet history.'
    },
    {
      id: 'yahoo',
      name: 'Yahoo!',
      domain: 'yahoo.com',
      year: 2013,
      recordsExposed: 3000000000,
      recordsFormatted: '3.0 Billion',
      category: 'Tech',
      dataCompromised: ['Names', 'Email addresses', 'Hashed passwords', 'Security questions & answers', 'Dates of birth'],
      description: 'State-sponsored threat actors compromised Yahoo user authentication systems, accessing every registered account on the platform.',
      impact: 'Forced massive global credential resets and wiped $350M from Verizon acquisition price.'
    },
    {
      id: 'aadhaar',
      name: 'Aadhaar Database Leak',
      domain: 'uidai.gov.in',
      year: 2018,
      recordsExposed: 1100000000,
      recordsFormatted: '1.1 Billion',
      category: 'Government',
      dataCompromised: ['Aadhaar 12-digit IDs', 'Names', 'Bank account links', 'Biometric tokens', 'Postal addresses'],
      description: 'State utility portal endpoint lacked authentication controls, allowing arbitrary querying of biometric citizen ID records.',
      impact: 'Compromised identity records for almost the entire adult population of India.'
    },
    {
      id: 'first-american',
      name: 'First American Financial',
      domain: 'firstam.com',
      year: 2019,
      recordsExposed: 885000000,
      recordsFormatted: '885 Million',
      category: 'Finance',
      dataCompromised: ['Bank account details', 'Social Security numbers', 'Wire transactions', 'Tax documents', 'Mortgage records'],
      description: 'Insecure Direct Object Reference (IDOR) flaw allowed anyone without login to view mortgage records dating back to 2003.',
      impact: 'Led to landmark SEC cybersecurity enforcement fines.'
    },
    {
      id: 'linkedin',
      name: 'LinkedIn Data Scrape & Breach',
      domain: 'linkedin.com',
      year: 2021,
      recordsExposed: 700000000,
      recordsFormatted: '700 Million',
      category: 'Social',
      dataCompromised: ['Full names', 'Email addresses', 'Phone numbers', 'Work history', 'Geolocation records'],
      description: 'Threat actors abused official API endpoints and scraping bots to compile records for over 92% of LinkedIn total user base.',
      impact: 'Used in mass spear-phishing campaigns and credential stuffing attacks worldwide.'
    },
    {
      id: 'facebook',
      name: 'Facebook / Meta Data Leak',
      domain: 'facebook.com',
      year: 2019,
      recordsExposed: 533000000,
      recordsFormatted: '533 Million',
      category: 'Social',
      dataCompromised: ['Mobile phone numbers', 'Facebook IDs', 'Full names', 'Locations', 'Email addresses'],
      description: 'Vulnerability in Facebook contact importer allowed scraping phone numbers linked to user accounts across 106 countries.',
      impact: 'Publicly dumped on hacking forums for free in 2021, triggering global SIM-swapping wave.'
    },
    {
      id: 'marriott',
      name: 'Marriott International (Starwood)',
      domain: 'marriott.com',
      year: 2018,
      recordsExposed: 500000000,
      recordsFormatted: '500 Million',
      category: 'Retail',
      dataCompromised: ['Passport numbers', 'Travel itineraries', 'Credit card info', 'Dates of birth', 'Mailing addresses'],
      description: 'Advanced persistent threat actors resided undetected in the Starwood reservations system for four years (since 2014).',
      impact: 'Resulted in £18.4M GDPR fine from the UK Information Commissioner.'
    },
    {
      id: 'equifax',
      name: 'Equifax Credit Bureau',
      domain: 'equifax.com',
      year: 2017,
      recordsExposed: 147000000,
      recordsFormatted: '147 Million',
      category: 'Finance',
      dataCompromised: ['Social Security Numbers', 'Dates of birth', 'Driver licenses', 'Credit dispute documents', 'Credit cards'],
      description: 'Failure to patch an unauthenticated remote-code-execution flaw in Apache Struts (CVE-2017-5638) allowed web shell deployment.',
      impact: 'Historic $700M FTC settlement; permanent identity theft risk for nearly half of US adults.'
    },
    {
      id: 'target',
      name: 'Target Corporation',
      domain: 'target.com',
      year: 2013,
      recordsExposed: 110000000,
      recordsFormatted: '110 Million',
      category: 'Retail',
      dataCompromised: ['Payment card magnetic stripe data', 'CVVs', 'Names', 'Mailing addresses', 'Phone numbers'],
      description: 'Attackers stole credentials from an HVAC third-party vendor, pivoted into the internal corporate network, and deployed POS RAM scrapers.',
      impact: 'Spurred the nationwide transition to EMV chip cards in the United States.'
    },
    {
      id: 'canva',
      name: 'Canva Design Platform',
      domain: 'canva.com',
      year: 2019,
      recordsExposed: 139000000,
      recordsFormatted: '139 Million',
      category: 'Tech',
      dataCompromised: ['Usernames', 'Real names', 'Email addresses', 'bcrypt hashed passwords', 'City and country data'],
      description: 'Hacker Gnosticplayers breached Canva production databases and exfiltrated user records before being detected.',
      impact: 'Prompted industry-wide audits of oauth token storage and bcrypt workload factors.'
    },
    {
      id: 'adobe',
      name: 'Adobe Systems',
      domain: 'adobe.com',
      year: 2013,
      recordsExposed: 153000000,
      recordsFormatted: '153 Million',
      category: 'Tech',
      dataCompromised: ['Encrypted passwords', 'Password hints', 'User IDs', 'Credit card numbers', 'ColdFusion source code'],
      description: 'Attackers compromised network servers, stealing customer account records and source code for Adobe Acrobat and Photoshop.',
      impact: 'Symmetric encryption flaw exposed millions of passwords because identical passwords yielded identical ciphertext.'
    },
    {
      id: 'anthem',
      name: 'Anthem Health Insurance',
      domain: 'anthem.com',
      year: 2015,
      recordsExposed: 78800000,
      recordsFormatted: '78.8 Million',
      category: 'Healthcare',
      dataCompromised: ['Social Security Numbers', 'Medical IDs', 'Birthdates', 'Employment info', 'Income data'],
      description: 'Spear-phishing email delivered malware stealing credentials of five Anthem database administrators.',
      impact: 'Largest healthcare data breach in US history; resulted in $115M class-action settlement.'
    }
  ];

  // The most critical and notorious CVEs in cybersecurity history
  readonly ICONIC_CVES: IconicCVE[] = [
    {
      cveId: 'CVE-2026-109618', name: 'PHP2Shell — Out-of-memory corruption', year: 2026,
      cvss: 9.2, severity: 'CRITICAL',
      affectedSoftware: 'PHP before 8.2.35, 8.3.36, 8.4.27 or 8.5.12 in the corresponding branch; older EOL branches require backport verification',
      attackVector: 'Network / Unauthenticated memory corruption',
      summary: 'Interrupted allocation can leave partially initialized request data that is accessed during cleanup, potentially allowing remote code execution.',
      historicalImpact: 'Disclosed October 2026. Web-serving PHP runtimes are at risk; PHP identifies mod_php as the highest-risk interface.',
      remediation: 'Update to the fixed branch release or a verified vendor backport and restart all PHP workers. Advisory: https://github.com/php/php-src/security/advisories/GHSA-w8hw-w9fx-j79w'
    },
    {
      cveId: 'CVE-2026-109619', name: 'PHP2Shell — Stale global state', year: 2026,
      cvss: 9.2, severity: 'CRITICAL',
      affectedSoftware: 'PHP before 8.2.35, 8.3.36, 8.4.27 or 8.5.12 in the corresponding branch; older EOL branches require backport verification',
      attackVector: 'Network / Cross-request use-after-free',
      summary: 'Worker state can retain references to freed request memory. A later request can use that stale state before initialization, potentially allowing remote code execution.',
      historicalImpact: 'Disclosed with CVE-2026-109618 as PHP2Shell in October 2026; exposure depends on reachable state producers and consumers.',
      remediation: 'Update and restart workers. Review session.upload_progress.enabled=0 and the follow-up PHP advisory. Advisory: https://github.com/php/php-src/security/advisories/GHSA-6wmf-4rv5-p3rp'
    },
    {
      cveId: 'CVE-2021-44228',
      name: 'Log4Shell (Apache Log4j)',
      year: 2021,
      cvss: 10.0,
      severity: 'CRITICAL',
      affectedSoftware: 'Apache Log4j 2.0-beta9 to 2.14.1',
      attackVector: 'Network / Unauthenticated JNDI Injection',
      summary: 'JNDI lookups in Log4j allowed unauthenticated remote attackers to execute arbitrary Java bytecode by submitting a crafted string like ${jndi:ldap://...}.',
      historicalImpact: 'Impacted billions of devices, enterprise clouds, and SaaS products globally with CVSS 10.0 severity.',
      remediation: 'Upgrade Log4j to 2.17.1+ or set log4j2.formatMsgNoLookups=true.'
    },
    {
      cveId: 'CVE-2014-0160',
      name: 'Heartbleed (OpenSSL)',
      year: 2014,
      cvss: 7.5,
      severity: 'HIGH',
      affectedSoftware: 'OpenSSL 1.0.1 through 1.0.1f',
      attackVector: 'Network / Memory Over-read via TLS Heartbeat',
      summary: 'A missing bounds check in the TLS heartbeat extension allowed attackers to read up to 64KB of server memory per heartbeat without authentication.',
      historicalImpact: 'Exposed private SSL/TLS keys, session tokens, and passwords across 66% of active internet web servers.',
      remediation: 'Upgrade to OpenSSL 1.0.1g+ and revoke/reissue all TLS certificates.'
    },
    {
      cveId: 'CVE-2017-0144',
      name: 'EternalBlue (Microsoft SMBv1)',
      year: 2017,
      cvss: 9.8,
      severity: 'CRITICAL',
      affectedSoftware: 'Microsoft Windows Vista, 7, 8.1, 10, Server 2008/2012/2016',
      attackVector: 'Network / Remote SMBv1 Buffer Overflow',
      summary: 'SMBv1 buffer overflow developed by the NSA and leaked by Shadow Brokers allowed unauthenticated remote code execution with SYSTEM privileges.',
      historicalImpact: 'Weaponized in the WannaCry ransomware attack and NotPetya cyberwarfare attacks causing over $10 Billion in global damages.',
      remediation: 'Apply Microsoft MS17-010 patch and completely disable SMBv1.'
    },
    {
      cveId: 'CVE-2024-4577',
      name: 'PHP CGI Argument Injection',
      year: 2024,
      cvss: 9.8,
      severity: 'CRITICAL',
      affectedSoftware: 'PHP 8.1, 8.2, 8.3 on Windows / Apache CGI',
      attackVector: 'Network / Best-fit Unicode Character Injection',
      summary: 'Windows Best-Fit character encoding conversion bypassed input validation in PHP CGI handlers, allowing unauthenticated remote command execution.',
      historicalImpact: 'Mass-exploited within 48 hours of public disclosure by multiple botnets and ransomware groups.',
      remediation: 'CVE-2024-4577 was fixed in PHP 8.1.29, 8.2.20 and 8.3.8. Upgrade to a current supported release and review Windows CGI configuration.'
    },
    {
      cveId: 'CVE-2023-34362',
      name: 'MOVEit Transfer SQL Injection',
      year: 2023,
      cvss: 9.8,
      severity: 'CRITICAL',
      affectedSoftware: 'Progress Software MOVEit Transfer prior to 2023.0.1',
      attackVector: 'Network / SQL Injection to Remote Code Execution',
      summary: 'Unauthenticated SQL injection in the MOVEit Transfer web app allowed attackers to infer database structure and deploy the LEMURLOOT web shell.',
      historicalImpact: 'The Cl0p ransomware syndicate exploited this zero-day to breach over 2,700 organizations and 93 million individuals.',
      remediation: 'Apply Progress Software security patches and delete untrusted guest accounts.'
    },
    {
      cveId: 'CVE-2014-6271',
      name: 'Shellshock (GNU Bash)',
      year: 2014,
      cvss: 9.8,
      severity: 'CRITICAL',
      affectedSoftware: 'GNU Bash through version 4.3',
      attackVector: 'Network / Environment Variable Trailing Command Injection',
      summary: 'Bash improperly processed function definitions in environment variables, executing trailing commands automatically when invoking a subshell.',
      historicalImpact: 'Trivially exploitable via HTTP headers (User-Agent) against CGI scripts on Unix/Linux servers.',
      remediation: 'Patch Bash to version containing parse_and_execute bounds check.'
    },
    {
      cveId: 'CVE-2017-5638',
      name: 'Apache Struts Jakarta Multipart Parser',
      year: 2017,
      cvss: 9.8,
      severity: 'CRITICAL',
      affectedSoftware: 'Apache Struts 2.3.5 to 2.3.31, 2.5 to 2.5.10',
      attackVector: 'Network / OGNL Expression Injection via Content-Type',
      summary: 'Jakarta Multipart parser evaluated user-supplied OGNL expressions inside HTTP Content-Type headers when error handling triggered.',
      historicalImpact: 'Direct root cause of the Equifax mega-breach exposing 147 million consumers.',
      remediation: 'Upgrade Apache Struts to 2.3.32 or 2.5.10.1 or replace parser.'
    },
    {
      cveId: 'CVE-2019-0708',
      name: 'BlueKeep (Microsoft RDP)',
      year: 2019,
      cvss: 9.8,
      severity: 'CRITICAL',
      affectedSoftware: 'Windows XP, 7, Server 2003, Server 2008 R2',
      attackVector: 'Network / Unauthenticated Pre-Auth RDP Memory Corruption',
      summary: 'Pre-authentication Remote Desktop Protocol vulnerability allowed remote attackers to trigger use-after-free and execute kernel code.',
      historicalImpact: 'Prompted rare emergency patches from Microsoft for out-of-support systems like Windows XP to prevent global worm outbreaks.',
      remediation: 'Apply Microsoft security updates and enable Network Level Authentication (NLA).'
    },
    {
      cveId: 'CVE-2020-1472',
      name: 'Zerologon (Netlogon Cryptography Flaw)',
      year: 2020,
      cvss: 10.0,
      severity: 'CRITICAL',
      affectedSoftware: 'Microsoft Windows Server 2008 through 2019',
      attackVector: 'Network / AES-CFB8 Fixed IV Flaw',
      summary: 'Insecure use of AES-CFB8 with a fixed all-zero Initialization Vector (IV) in the Netlogon protocol allowed spoofing Domain Controller credentials.',
      historicalImpact: 'Allowed unauthenticated attackers on internal networks to gain instant Active Directory Domain Admin control within seconds.',
      remediation: 'Enforce secure RPC communication with Netlogon protocol updates.'
    },
    {
      cveId: 'CVE-2017-5754',
      name: 'Meltdown (Speculative Execution Flaw)',
      year: 2018,
      cvss: 7.9,
      severity: 'HIGH',
      affectedSoftware: 'Modern Intel and ARM processors',
      attackVector: 'Local / Hardware Speculative Execution Side-Channel',
      summary: 'Hardware bug in out-of-order execution bypassed memory protection, allowing unprivileged processes to read kernel and physical memory contents.',
      historicalImpact: 'Fundamentally transformed microarchitecture design; required OS-level Kernel Page Table Isolation (KPTI) with CPU performance hits.',
      remediation: 'Apply OS kernel patches (KPTI) and microcode updates.'
    }
  ];

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    // Load initial live CVE batch from open-source CIRCL API
    this.fetchRecentLiveCves();
  }

  filteredBreaches(): DataBreach[] {
    const q = this.searchQuery().toLowerCase().trim();
    const cat = this.selectedCategory();

    return this.MAJOR_BREACHES.filter(b => {
      const matchCat = cat === 'ALL' || b.category === cat;
      const matchQuery =
        !q ||
        b.name.toLowerCase().includes(q) ||
        b.domain.toLowerCase().includes(q) ||
        b.description.toLowerCase().includes(q) ||
        b.dataCompromised.some(d => d.toLowerCase().includes(q));
      return matchCat && matchQuery;
    });
  }

  filteredCves(): IconicCVE[] {
    const q = this.searchQuery().toLowerCase().trim();
    return this.ICONIC_CVES.filter(c => {
      if (!q) return true;
      return (
        c.cveId.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.affectedSoftware.toLowerCase().includes(q) ||
        c.summary.toLowerCase().includes(q) ||
        c.attackVector.toLowerCase().includes(q)
      );
    });
  }

  private normalizeCve(data: any): LiveCveResult | null {
    const id = data?.cveMetadata?.cveId ?? data?.id;
    if (typeof id !== 'string' || !/^CVE-\d{4}-\d{4,}$/i.test(id)) return null;
    const cna = data.containers?.cna;
    const containers = [cna, ...(data.containers?.adp ?? [])].filter(Boolean);
    const metrics = containers.flatMap(c => c.metrics ?? []);
    const score = metrics.map(m => m.cvssV4_0?.baseScore ?? m.cvssV3_1?.baseScore ?? m.cvssV3_0?.baseScore ?? m.cvssV2_0?.baseScore).find(v => v !== undefined) ?? data.cvss;
    const cvss = score === undefined || score === null || score === '' ? undefined : Number(score);
    const refs = [...(data.references ?? []), ...containers.flatMap(c => c.references ?? [])];
    return {
      id: id.toUpperCase(),
      summary: cna?.descriptions?.find((d: any) => d.lang === 'en')?.value ?? cna?.descriptions?.[0]?.value ?? data.summary ?? cna?.rejectedReasons?.[0]?.value ?? 'No summary available.',
      cvss: cvss !== undefined && Number.isFinite(cvss) && cvss >= 0 && cvss <= 10 ? cvss : undefined,
      published: data.cveMetadata?.datePublished ?? data.Published ?? data.published,
      modified: data.cveMetadata?.dateUpdated ?? data.Modified ?? data.modified,
      cwe: cna?.problemTypes?.[0]?.descriptions?.[0]?.description ?? data.cwe,
      references: [...new Set<string>(refs.map((r: any) => typeof r === 'string' ? r : r?.url).filter((url: any) => typeof url === 'string' && /^https?:\/\//i.test(url)))].slice(0, 5)
    };
  }

  async searchLiveCve() {
    this.searchController?.abort();
    const request = ++this.searchRequest;
    this.isLoadingLive.set(false);
    this.liveCveResult.set(null);
    this.liveError.set(null);
    let query = this.liveCveQuery().trim().toUpperCase();
    if (/^\d{4}-\d{4,}$/.test(query)) query = `CVE-${query}`;
    this.liveCveQuery.set(query);
    if (!/^CVE-\d{4}-\d{4,}$/.test(query)) {
      this.liveError.set('Enter a valid CVE ID, such as CVE-2024-4577.');
      return;
    }
    const controller = new AbortController();
    this.searchController = controller;
    const timeout = setTimeout(() => controller.abort(), 15000);
    this.isLoadingLive.set(true);
    try {
      const res = await fetch(`https://vulnerability.circl.lu/api/vulnerability/${encodeURIComponent(query)}`, { signal: controller.signal });
      if (!res.ok) throw new Error(res.status === 404 ? `No record found for ${query}.` : `CIRCL returned HTTP ${res.status}.`);
      const result = this.normalizeCve(await res.json());
      if (!result || result.id !== query) throw new Error(`No valid CVE record found for ${query}.`);
      if (request === this.searchRequest) this.liveCveResult.set(result);
    } catch (error) {
      if (request === this.searchRequest) this.liveError.set(controller.signal.aborted ? 'CVE lookup timed out. Try again.' : error instanceof Error ? error.message : 'CVE lookup failed. Try again.');
    } finally {
      clearTimeout(timeout);
      if (request === this.searchRequest) this.isLoadingLive.set(false);
      this.cdr.markForCheck();
    }
  }

  async fetchRecentLiveCves() {
    if (this.isLoadingFeed()) return;
    const controller = new AbortController();
    this.feedController = controller;
    const timeout = setTimeout(() => controller.abort(), 15000);
    this.isLoadingFeed.set(true);
    this.feedError.set(null);
    try {
      const res = await fetch('https://vulnerability.circl.lu/api/vulnerability/last/cvelistv5/20', { signal: controller.signal });
      if (!res.ok) throw new Error(`CIRCL returned HTTP ${res.status}.`);
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error('Unexpected CVE feed response.');
      const results = data.map(item => this.normalizeCve(item)).filter((item): item is LiveCveResult => item !== null);
      if (data.length && !results.length) throw new Error('The feed contained no valid CVE records.');
      if (!controller.signal.aborted) this.recentCveList.set([...new Map(results.map(item => [item.id, item])).values()]);
    } catch (error) {
      this.feedError.set(controller.signal.aborted ? 'Feed request timed out. Refresh to retry.' : 'Unable to load the CVE feed. Refresh to retry.');
    } finally {
      clearTimeout(timeout);
      this.isLoadingFeed.set(false);
      this.cdr.markForCheck();
    }
  }

  ngOnDestroy() {
    this.searchRequest++;
    this.searchController?.abort();
    this.feedController?.abort();
  }

  selectBreachDetail(b: DataBreach) {
    this.selectedBreach.set(b);
  }

  selectCveDetail(c: IconicCVE) {
    this.selectedCve.set(c);
  }

  closeModal() {
    this.selectedBreach.set(null);
    this.selectedCve.set(null);
  }
}

