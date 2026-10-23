import '@angular/compiler';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Php2shellCheckerComponent } from './php2shell-checker.component';

describe('Php2shellCheckerComponent', () => {
  let component: Php2shellCheckerComponent;
  beforeEach(() => { component = new Php2shellCheckerComponent({ markForCheck() {} } as any); });
  afterEach(() => { component.ngOnDestroy(); vi.unstubAllGlobals(); });

  it.each([['8.2.34', '8.2.35'], ['8.3.35', '8.3.36'], ['8.4.26', '8.4.27'], ['8.5.11', '8.5.12']])('checks the advisory boundary %s / %s', (before, fixed) => {
    expect(component.evaluatePhpVersion(before).status).toBe('vulnerable');
    expect(component.evaluatePhpVersion(fixed).status).toBe('safe');
    expect(component.evaluatePhpVersion(before).minFixedVersion).toBe(fixed);
  });
  it.each(['8.2.20', '8.3.8', '8.4.0', '8.5.0'])('does not confuse older CGI fixes with PHP2Shell fixes: %s', version => {
    expect(component.evaluatePhpVersion(version).status).toBe('vulnerable');
    expect(component.evaluatePhpVersion(version).verdictTitle).toContain('CVE-2026-109618');
    expect(component.evaluatePhpVersion(version).verdictTitle).toContain('CVE-2026-109619');
  });
  it.each(['7.4.33', '8.0.30', '8.1.34'])('requires backport verification on EOL %s', version => {
    const result = component.evaluatePhpVersion(version);
    expect(result.status).toBe('eol_vulnerable');
    expect(result.verdictDescription).toContain('backport');
  });
  it('includes the session upload progress follow-up even at the fixed baseline', () => {
    expect(component.evaluatePhpVersion('8.5.12').recommendations.join(' ')).toContain('session.upload_progress.enabled=0');
  });
  it.each(['garbage', '8.2', '8.3.8RC1', '8.3.8-RC1', '8.6.0', '9.0.0', '8.2.20.1'])('does not certify %s', version => {
    expect(component.evaluatePhpVersion(version).status).toBe('unknown');
  });
  it('parses package revisions without treating revision digits as patch digits', () => {
    expect(component.evaluatePhpVersion('8.2.1-1ubuntu20').status).toBe('vulnerable');
  });
  it('extracts advertised versions', () => {
    expect(component.extractPhpVersion('Server: Apache PHP/8.2.19')?.version).toBe('8.2.19');
  });
  it('preserves prerelease tokens in advertised headers', () => {
    component.rawHeaders.set('X-Powered-By: PHP/8.3.8RC1');
    component.checkHeaders();
    expect(component.assessment()?.status).toBe('unknown');
  });
  it('does not treat missing headers as a patched runtime', () => {
    component.rawHeaders.set('Server: nginx'); component.checkHeaders();
    expect(component.assessment()?.status).toBe('no_header');
  });
  it('clears an old result on empty input', () => {
    component.manualVersion.set('8.2.20'); component.checkManualVersion();
    component.manualVersion.set(''); component.checkManualVersion();
    expect(component.assessment()).toBeNull();
  });
  it('preserves protocol and path and ignores late results after reset', async () => {
    let resolve!: (response: Response) => void;
    const fetchMock = vi.fn((_url: string, _options: RequestInit) => new Promise<Response>(r => { resolve = r; }));
    vi.stubGlobal('fetch', fetchMock);
    component.onUrlInput('http://example.com/test.php');
    const pending = component.checkSiteUrl();
    expect(fetchMock.mock.calls[0][0]).toBe('http://example.com/test.php');
    component.switchMode('version');
    resolve(new Response(null, { headers: { 'X-Powered-By': 'PHP/8.2.19' } }));
    await pending;
    expect(component.assessment()).toBeNull();
    expect(component.isLoading()).toBe(false);
  });
  it('handles network restrictions without a false verdict', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    component.targetUrl.set('example.com'); await component.checkSiteUrl();
    expect(component.infoMessage()).toContain('CORS');
    expect(component.assessment()).toBeNull();
    expect(component.isLoading()).toBe(false);
  });
  it.each([
    ['X-PHP-Version: 8.2.19', '8.2.19'],
    ['X-Powered-By: PHP 8.3.8', '8.3.8'],
    ['Server: Apache mod_php/8.2.20', '8.2.20'],
    ['PHP 8.2.20 (cli) (built: Jun 2024)', '8.2.20']
  ])('recognizes banner %s', (header, version) => {
    expect(component.extractPhpVersion(header)?.version).toBe(version);
  });
  it('uses the final response in a redirect chain', () => {
    component.rawHeaders.set('HTTP/1.1 301 Moved\r\nX-Powered-By: PHP/8.2.19\r\n\r\nHTTP/2 200 OK\r\nX-Powered-By: PHP/8.2.20');
    component.checkHeaders();
    expect(component.assessment()?.detectedVersion).toBe('8.2.20');
  });
  it('reports conflicting banners instead of certifying the first', () => {
    component.rawHeaders.set('X-Powered-By: PHP/8.2.20\nServer: Apache PHP/8.2.19');
    component.checkHeaders();
    expect(component.assessment()?.status).toBe('unknown');
    expect(component.assessment()?.evidence).toHaveLength(3);
  });
  it('ignores page prose and cookie values as version evidence', () => {
    component.rawHeaders.set('Set-Cookie: text=PHP/8.2.20\n\nPHP 8.2.20 tutorial');
    component.checkHeaders();
    expect(component.assessment()?.status).toBe('no_header');
  });
  it('shows framework hints without inventing a version', () => {
    component.rawHeaders.set('Set-Cookie: laravel_session=secret; HttpOnly\nServer: Microsoft-IIS/10.0');
    component.checkHeaders();
    expect(component.assessment()?.phpFingerprint).toContain('Laravel');
    expect(component.assessment()?.detectedVersion).toBeNull();
    expect(component.assessment()?.evidence?.join(' ')).not.toContain('secret');
  });
  it('falls back to GET when HEAD is unsupported and reads error response headers', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(null, { status: 405 }))
      .mockResolvedValueOnce(new Response(null, { status: 403, headers: { 'X-Powered-By': 'PHP/8.2.19' } }));
    vi.stubGlobal('fetch', fetchMock);
    component.targetUrl.set('example.com'); await component.checkSiteUrl();
    expect(fetchMock.mock.calls[1][1].method).toBe('GET');
    expect(component.assessment()?.status).toBe('vulnerable');
    expect(component.infoMessage()).toContain('HTTP 403');
  });

  it('quotes shell metacharacters in the helper command', () => {
    component.targetUrl.set('https://example.com/$(whoami)');
    expect(component.getCurlCommand()).toContain("'https://example.com/$(whoami)'");
  });
});
