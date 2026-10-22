import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface IpDetails {
  ip: string;
  version: string;
  city: string;
  region: string;
  country: string;
  countryName: string;
  postal: string;
  latitude: number | null;
  longitude: number | null;
  timezone: string;
  utcOffset: string;
  asn: string;
  org: string;
  network: string;
  currency: string;
  callingCode: string;
}

@Component({
  selector: 'app-ip-checker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ip-checker.component.html',
  styleUrl: './ip-checker.component.scss'
})
export class IpCheckerComponent implements OnInit {
  targetIp = signal<string>('');
  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  ipData = signal<IpDetails | null>(null);
  copiedField = signal<string | null>(null);

  // Network connection info from browser navigator
  connectionType = signal<string>('Unknown');
  downlinkSpeed = signal<string>('Unknown');
  rttLatency = signal<string>('Unknown');

  ngOnInit() {
    this.readBrowserNetworkInfo();
    this.fetchMyIp();
  }

  readBrowserNetworkInfo() {
    const nav: any = navigator;
    if (nav.connection) {
      this.connectionType.set(nav.connection.effectiveType?.toUpperCase() || 'Broadband / WiFi');
      this.downlinkSpeed.set(nav.connection.downlink ? `${nav.connection.downlink} Mbps` : 'N/A');
      this.rttLatency.set(nav.connection.rtt ? `${nav.connection.rtt} ms` : 'N/A');
    } else {
      this.connectionType.set('Standard Connection');
    }
  }

  async fetchMyIp() {
    this.targetIp.set('');
    await this.lookupIp('');
  }

  async onSearch() {
    const ip = this.targetIp().trim();
    await this.lookupIp(ip);
  }

  async lookupIp(queryIp: string) {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    const url = queryIp
      ? `https://ipapi.co/${encodeURIComponent(queryIp)}/json/`
      : 'https://ipapi.co/json/';

    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Lookup failed with status ${res.status}`);
      }
      const data = await res.json();
      if (data.error) {
        throw new Error(data.reason || 'Invalid IP address or rate limit exceeded');
      }

      this.ipData.set({
        ip: data.ip || 'Unknown',
        version: data.version || (data.ip?.includes(':') ? 'IPv6' : 'IPv4'),
        city: data.city || 'Unknown',
        region: data.region || 'Unknown',
        country: data.country || '',
        countryName: data.country_name || 'Unknown',
        postal: data.postal || 'N/A',
        latitude: data.latitude || null,
        longitude: data.longitude || null,
        timezone: data.timezone || 'UTC',
        utcOffset: data.utc_offset || '',
        asn: data.asn || 'N/A',
        org: data.org || 'Unknown Provider',
        network: data.network || 'N/A',
        currency: data.currency || 'USD',
        callingCode: data.country_calling_code || ''
      });
    } catch (err: any) {
      // Fallback via ipify if ipapi.co rate limits
      try {
        const fallbackRes = await fetch('https://api.ipify.org?format=json');
        const fallbackData = await fallbackRes.json();
        this.ipData.set({
          ip: fallbackData.ip,
          version: fallbackData.ip.includes(':') ? 'IPv6' : 'IPv4',
          city: 'Local Edge',
          region: 'Global',
          country: '',
          countryName: 'Internet',
          postal: 'N/A',
          latitude: null,
          longitude: null,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
          utcOffset: '+00:00',
          asn: 'Direct',
          org: 'ISP Network',
          network: fallbackData.ip,
          currency: 'USD',
          callingCode: ''
        });
      } catch {
        this.errorMessage.set(err.message || 'Unable to retrieve IP details.');
      }
    } finally {
      this.isLoading.set(false);
    }
  }

  copy(val: string, field: string) {
    navigator.clipboard.writeText(val);
    this.copiedField.set(field);
    setTimeout(() => this.copiedField.set(null), 2000);
  }
}

