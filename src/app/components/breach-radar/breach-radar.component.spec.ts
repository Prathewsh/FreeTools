import '@angular/compiler';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BreachRadarComponent } from './breach-radar.component';

describe('BreachRadarComponent', () => {
  let component: BreachRadarComponent;
  const mockCdr: any = { markForCheck: () => {} };

  beforeEach(() => {
    component = new BreachRadarComponent(mockCdr);
  });

  afterEach(() => { component.ngOnDestroy(); vi.unstubAllGlobals(); });

  it('initializes with major historic breaches and iconic CVEs', () => {
    expect(component.MAJOR_BREACHES.length).toBeGreaterThan(5);
    expect(component.ICONIC_CVES.length).toBeGreaterThan(5);
    expect(component.activeTab()).toBe('breaches');
  });

  it('filters breaches by search query', () => {
    component.searchQuery.set('Yahoo');
    const filtered = component.filteredBreaches();
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe('yahoo');
    expect(filtered[0].recordsExposed).toBe(3000000000);
  });

  it('filters breaches by category', () => {
    component.selectedCategory.set('Finance');
    const filtered = component.filteredBreaches();
    expect(filtered.every(b => b.category === 'Finance')).toBe(true);
    expect(filtered.some(b => b.id === 'equifax')).toBe(true);
  });

  it('filters CVEs by name or CVE ID', () => {
    component.searchQuery.set('Log4Shell');
    const filtered = component.filteredCves();
    expect(filtered.length).toBe(1);
    expect(filtered[0].cveId).toBe('CVE-2021-44228');
    expect(filtered[0].cvss).toBe(10.0);
  });

  it('normalizes queries and reads CVE 5 metadata, zero scores and CNA references', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      cveMetadata: { cveId: 'CVE-2021-44228', datePublished: '2021-12-10' },
      containers: { cna: {
        descriptions: [{ lang: 'fr', value: 'French' }, { lang: 'en', value: 'English' }],
        metrics: [{ cvssV3_0: { baseScore: 0 } }],
        references: [{ url: 'https://example.com/advisory' }, { url: 'javascript:alert(1)' }]
      } }
    })));
    vi.stubGlobal('fetch', fetchMock);
    component.liveCveQuery.set('2021-44228');
    await component.searchLiveCve();
    expect(component.liveCveQuery()).toBe('CVE-2021-44228');
    expect(component.liveCveResult()).toMatchObject({ summary: 'English', cvss: 0, references: ['https://example.com/advisory'] });
  });

  it('rejects malformed IDs without a network call', async () => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    component.liveCveQuery.set('garbage'); await component.searchLiveCve();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(component.liveError()).toContain('valid CVE');
  });

  it('reports feed failures separately from search errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await component.fetchRecentLiveCves();
    expect(component.feedError()).toContain('retry');
    expect(component.liveError()).toBeNull();
    expect(component.isLoadingFeed()).toBe(false);
  });

  it('loads the CVE-specific feed and filters invalid entries', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([
      { cveMetadata: { cveId: 'CVE-2024-4577' }, containers: { cna: { descriptions: [{lang: 'en', value: 'PHP'}] } } },
      { id: 'GHSA-other' }
    ])));
    vi.stubGlobal('fetch', fetchMock);
    await component.fetchRecentLiveCves();
    expect(fetchMock.mock.calls[0][0]).toContain('/last/cvelistv5/20');
    expect(component.recentCveList()).toHaveLength(1);
  });

  it('keeps the newest search result when requests finish out of order', async () => {
    let resolveFirst!: (response: Response) => void;
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => new Promise<Response>(resolve => { resolveFirst = resolve; }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'CVE-2024-4577', summary: 'Newest' })));
    vi.stubGlobal('fetch', fetchMock);
    component.liveCveQuery.set('CVE-2021-44228');
    const first = component.searchLiveCve();
    component.liveCveQuery.set('CVE-2024-4577');
    await component.searchLiveCve();
    resolveFirst(new Response(JSON.stringify({ id: 'CVE-2021-44228', summary: 'Older' })));
    await first;
    expect(component.liveCveResult()?.id).toBe('CVE-2024-4577');
  });

  it('manages modal open and close states', () => {
    const breach = component.MAJOR_BREACHES[0];
    component.selectBreachDetail(breach);
    expect(component.selectedBreach()).toEqual(breach);

    component.closeModal();
    expect(component.selectedBreach()).toBeNull();

    const cve = component.ICONIC_CVES[0];
    component.selectCveDetail(cve);
    expect(component.selectedCve()).toEqual(cve);

    component.closeModal();
    expect(component.selectedCve()).toBeNull();
  });
});

