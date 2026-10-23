import { Component, signal, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface VersionAssessment {
  detectedVersion: string | null;
  branch: string | null;
  minFixedVersion: string | null;
  status: 'safe' | 'vulnerable' | 'eol_vulnerable' | 'no_header' | 'unknown';
  advertisedHeader: string | null;
  phpFingerprint?: string | null;
  evidence?: string[];
  isOlderThanFix: boolean;
  verdictTitle: string;
  verdictDescription: string;
  recommendations: string[];
}

@Component({
  selector: 'app-php2shell-checker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './php2shell-checker.component.html',
  styleUrl: './php2shell-checker.component.scss'
})
export class Php2shellCheckerComponent {
  mode = signal<'url' | 'headers' | 'version'>('url');
  targetUrl = signal<string>('');
  rawHeaders = signal<string>('');
  manualVersion = signal<string>('');

  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  infoMessage = signal<string | null>(null);
  assessment = signal<VersionAssessment | null>(null);
  copiedCode = signal<string | null>(null);

  // CVE-2026-109618 / CVE-2026-109619: https://github.com/php/php-src/security/advisories/GHSA-w8hw-w9fx-j79w
  readonly FIX_MATRIX: Record<string, { minPatch: number; fixedVersion: string }> = {
    '8.2': { minPatch: 35, fixedVersion: '8.2.35' },
    '8.3': { minPatch: 36, fixedVersion: '8.3.36' },
    '8.4': { minPatch: 27, fixedVersion: '8.4.27' },
    '8.5': { minPatch: 12, fixedVersion: '8.5.12' }
  };
  private requestId = 0;
  private controller?: AbortController;

  constructor(private cdr: ChangeDetectorRef) {}

  switchMode(target: 'url' | 'headers' | 'version') {
    if (this.mode() === target) return;
    this.mode.set(target);
    this.reset();
  }

  reset() {
    this.requestId++;
    this.controller?.abort();
    this.targetUrl.set('');
    this.rawHeaders.set('');
    this.manualVersion.set('');
    this.assessment.set(null);
    this.errorMessage.set(null);
    this.infoMessage.set(null);
    this.isLoading.set(false);
    this.cdr.markForCheck();
  }

  onUrlInput(val: string) {
    // Preserve explicit protocol, port and path.
    const cleaned = val.trim();
    this.targetUrl.set(cleaned);
  }

  private siteUrl(): string {
    const raw = this.targetUrl().trim();
    if (!raw) throw new Error('Please enter a site URL.');
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || /\s/.test(raw)) {
      throw new Error('Please enter a valid HTTP or HTTPS URL without credentials.');
    }
    return url.href;
  }

  async checkSiteUrl() {
    this.controller?.abort();
    const request = ++this.requestId;
    this.assessment.set(null);
    this.errorMessage.set(null);
    this.infoMessage.set(null);
    this.isLoading.set(false);
    let url: string;
    try { url = this.siteUrl(); }
    catch { this.errorMessage.set('Please enter a valid HTTP or HTTPS site URL.'); return; }
    const controller = new AbortController();
    this.controller = controller;
    const timeout = setTimeout(() => controller.abort(), 10000);
    this.isLoading.set(true);
    try {
      let response = await fetch(url, { method: 'HEAD', mode: 'cors', signal: controller.signal });
      if (request !== this.requestId) return;
      if (response.status === 405 || response.status === 501) {
        response = await fetch(url, { method: 'GET', mode: 'cors', signal: controller.signal });
        await response.body?.cancel();
      }
      if (request !== this.requestId) return;

      let headers = '';
      response.headers.forEach((value, key) => { headers += `${key}: ${value}\n`; });
      this.rawHeaders.set(headers);
      this.checkHeaders();
      this.infoMessage.set(`HTTP ${response.status}. Only browser-exposed response headers were inspected. Missing headers do not prove PHP is absent or patched. Paste server response headers for a fuller check.`);
    } catch (error) {
      if (request !== this.requestId) return;
      this.infoMessage.set(controller.signal.aborted
        ? 'The request timed out. Try again or paste response headers.'
        : `Headers could not be read. The host may restrict CORS or be unreachable. ${error instanceof Error ? error.message : ''} Use the cURL command below and paste its output.`);
    } finally {
      clearTimeout(timeout);
      if (request === this.requestId) this.isLoading.set(false);
      this.cdr.markForCheck();
    }
  }

  ngOnDestroy() { this.requestId++; this.controller?.abort(); }

  checkHeaders() {
    this.errorMessage.set(null);
    this.infoMessage.set(null);
    this.assessment.set(null);
    const content = this.rawHeaders().trim();
    if (!content) {
      this.errorMessage.set('Please paste the HTTP response headers.');
      return;
    }

    // curl -L can include proxy, redirect and informational response blocks.
    const blocks = content.split(/(?=^HTTP\/\S+\s+\d{3}\b)/im).filter(part => part.trim());
    const finalBlock = blocks.at(-1) ?? content;
    const headers = finalBlock.split(/\r?\n\r?\n/)[0];
    const versions = this.extractPhpVersions(headers);
    const evidence = versions.map(v => v.headerContext);
    const fingerprints: string[] = [];
    for (const [pattern, label] of [
      [/^set-cookie\s*:\s*PHPSESSID=/im, 'PHP session cookie (PHPSESSID)'],
      [/^set-cookie\s*:\s*ci_session=/im, 'CodeIgniter session cookie (ci_session)'],
      [/^set-cookie\s*:\s*laravel_session=/im, 'Laravel session cookie (laravel_session)'],
      [/^set-cookie\s*:\s*(?:CAKEPHP|CakeCookie)=/im, 'CakePHP cookie'],
      [/^expires\s*:[^\r\n]*19 Nov 1981/im, 'PHP-style session cache expiry'],
      [/^x-powered-by\s*:[^\r\n]*\bPHP\b/im, 'PHP advertised in X-Powered-By']
    ] as [RegExp, string][]) {
      if (pattern.test(headers)) fingerprints.push(label);
    }
    evidence.push(...fingerprints);
    const platform = headers.match(/^server\s*:[^\r\n]*\b(?:Win32|Win64|Windows|Microsoft-IIS)[^\r\n]*/im);
    if (platform) evidence.push(`Possible Windows platform: ${platform[0]}`);
    if (blocks.length > 1) evidence.push('Used the final HTTP response block; earlier redirect/proxy banners were ignored.');
    const unique = [...new Set(versions.map(v => v.version))];
    if (unique.length === 1) {
      this.assessment.set({ ...this.evaluatePhpVersion(unique[0], versions[0].headerContext), evidence });
    } else {
      this.assessment.set({
        detectedVersion: null, branch: null, minFixedVersion: '8.2.35 / 8.3.36 / 8.4.27 / 8.5.12',
        status: unique.length > 1 ? 'unknown' : 'no_header',
        advertisedHeader: null, phpFingerprint: fingerprints.join('; ') || null,
        evidence, isOlderThanFix: false,
        verdictTitle: unique.length > 1 ? 'Conflicting PHP versions advertised' : fingerprints.length ? 'Possible PHP signatures; version unknown' : 'No PHP version observed',
        verdictDescription: unique.length > 1
          ? `The response advertises ${unique.join(', ')}. A proxy or multiple runtimes may be involved; verify the serving runtime before assessing patch status.`
          : 'Cookies and headers are hints and can be changed or hidden. They cannot establish the exact runtime version or confirm PHP2Shell exposure.',
        recommendations: [
          'Check the PHP runtime serving this application; php -v may report a different CLI installation.',
          'Verify the web-serving PHP build, worker restart status and vendor backports.',
          'Use a current supported PHP release and consult the linked advisory.'
        ]
      });
    }
    this.cdr.markForCheck();
  }

  checkManualVersion() {
    this.errorMessage.set(null);
    this.infoMessage.set(null);
    this.assessment.set(null);
    const raw = this.manualVersion().trim();
    if (!raw) {
      this.errorMessage.set('Please enter a PHP version (e.g. 8.2.14 or 8.3.36).');
      return;
    }

    const clean = /^PHP(?:\/|\s)/i.test(raw) ? (this.extractPhpVersion(raw)?.version ?? raw) : raw;
    this.assessment.set(this.evaluatePhpVersion(clean, `Manual input: PHP ${clean}`));
    this.cdr.markForCheck();
  }

  private extractPhpVersions(text: string): { version: string; headerContext: string }[] {
    const found: { version: string; headerContext: string }[] = [];
    for (const line of text.split(/\r?\n/)) {
      // Do not mistake arbitrary page prose, URLs or cookie values for runtime banners.
      if (!/^\s*(?:(?:x-powered-by|server|x-php-version)\s*:|(?:PHP|mod_php)(?:\/|\s))/i.test(line)) continue;
      const pattern = /(?:\b(?:PHP|mod_php)(?:\s+Version)?\s*[/:]?\s+|\b(?:PHP|mod_php)\/|^\s*x-php-version\s*:\s*)(\d+\.\d+(?:\.\d+)*(?:[a-z][a-z0-9.]*|-[a-z0-9.+~_-]+)?)/gi;
      for (const match of line.matchAll(pattern)) found.push({ version: match[1], headerContext: line.trim() });
    }
    return found;
  }

  extractPhpVersion(text: string): { version: string; headerContext: string } | null {
    return this.extractPhpVersions(text)[0] ?? null;
  }

  evaluatePhpVersion(versionStr: string, headerContext?: string): VersionAssessment {
    const match = /^(\d+)\.(\d+)\.(\d+)(?:-[a-z0-9.+~_-]+)?$/i.exec(versionStr);
    const branch = match ? `${Number(match[1])}.${Number(match[2])}` : null;
    const rule = branch ? this.FIX_MATRIX[branch] : undefined;
    const base: VersionAssessment = {
      detectedVersion: versionStr, branch, minFixedVersion: rule?.fixedVersion ?? null,
      status: 'unknown', advertisedHeader: headerContext ?? null, isOlderThanFix: false,
      verdictTitle: 'Version cannot be verified',
      verdictDescription: 'Enter a complete stable PHP version (major.minor.patch). Unlisted branches and prereleases cannot be assessed.',
      recommendations: ['Verify the running web-server PHP version; CLI PHP can differ.', 'Check vendor advisories and distribution backports.']
    };
    if (!match || /-(?:rc|alpha|beta|dev)/i.test(versionStr)) return base;
    const major = Number(match[1]), minor = Number(match[2]), patch = Number(match[3]);
    if (major < 5 || major > 8 || (major === 8 && minor > 5)) return base;
    if (major < 8 || (major === 8 && minor < 2)) {
      return { ...base, status: 'eol_vulnerable', verdictTitle: 'PHP2Shell: end-of-life branch; verify backport',
        verdictDescription: 'This upstream branch predates the PHP2Shell fixes and is end-of-life. Upgrade or verify a vendor backport. PHP published source backports for 7.4, 8.0 and 8.1; the version banner alone cannot establish patch status.' };
    }
    const older = !!rule && patch < rule.minPatch;
    return { ...base, status: older ? 'vulnerable' : 'safe', isOlderThanFix: older,
      minFixedVersion: rule?.fixedVersion ?? 'Not in the affected branches',
      verdictTitle: older ? 'Potentially affected by CVE-2026-109618 / CVE-2026-109619' : 'Meets CVE-2026-109618 / CVE-2026-109619 version baseline',
      verdictDescription: older
        ? 'This version predates both PHP2Shell fixes. Web-serving PHP is at risk, including FPM, mod_php, CGI, FrankenPHP and LiteSpeed. Verify vendor backports; headers alone cannot prove exploitability or prior compromise.'
        : 'This version is outside the affected range for CVE-2026-109618 / CVE-2026-109619. This is not a general security certification or proof of the installed binary.',
      recommendations: [
        'Use the latest supported PHP release, including subsequent security fixes.',
        'Restart every PHP worker after updating, including bundled and container runtimes.',
        'Review the 23 October 2026 PHP session upload progress advisory; keep session.upload_progress.enabled=0 until the applicable follow-up fix.',
        'Verify the web-server runtime and vendor package advisory; CLI PHP can differ.',
        'Set expose_php = Off to reduce version disclosure.'
      ]
    };
  }

  async copySnippet(text: string, id: string) {
    try { await navigator.clipboard.writeText(text); }
    catch { this.errorMessage.set('Clipboard unavailable. Select and copy the snippet manually.'); return; }
    this.copiedCode.set(id);
    setTimeout(() => {
      if (this.copiedCode() === id) {
        this.copiedCode.set(null);
      }
    }, 2000);
  }

  getCurlCommand(): string {
    let url: string;
    try { url = this.siteUrl(); } catch { url = 'https://your-site.com/'; }
    const quoted = "'" + url.replace(/'/g, "'\\''") + "'";
    return `curl -I -sS -L --max-time 15 -- ${quoted}`;
  }
}
