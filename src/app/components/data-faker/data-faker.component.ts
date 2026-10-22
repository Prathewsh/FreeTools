import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface FakePerson {
  id: string;
  name: string;
  email: string;
  role: string;
  company: string;
  phone: string;
  city: string;
  country: string;
  joinedDate: string;
}

@Component({
  selector: 'app-data-faker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './data-faker.component.html',
  styleUrl: './data-faker.component.scss'
})
export class DataFakerComponent {
  recordCount = signal<number>(10);
  exportFormat = signal<'json' | 'csv' | 'sql'>('json');
  generatedData = signal<FakePerson[]>([]);

  private firstNames = ['Alex', 'Emma', 'Liam', 'Olivia', 'Noah', 'Ava', 'Ethan', 'Sophia', 'Mason', 'Isabella', 'Lucas', 'Mia', 'Oliver', 'Charlotte', 'Aiden', 'Harper'];
  private lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson'];
  private domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'acme.io', 'cloudcorp.net', 'startup.dev'];
  private roles = ['Software Engineer', 'Product Designer', 'VP of Engineering', 'DevOps Architect', 'Data Scientist', 'Security Analyst', 'Product Manager', 'QA Lead'];
  private companies = ['Apex Dynamics', 'Starlight Labs', 'Quantum Software', 'Pulse Media', 'Echo Technologies', 'Vortex Systems', 'Prism Cloud'];
  private cities = ['San Francisco', 'New York', 'London', 'Berlin', 'Tokyo', 'Toronto', 'Sydney', 'Singapore', 'Amsterdam', 'Paris'];
  private countries = ['United States', 'United Kingdom', 'Germany', 'Japan', 'Canada', 'Australia', 'Singapore', 'Netherlands', 'France'];

  constructor() {
    this.generateDataset();
  }

  generateDataset() {
    const count = Math.min(500, Math.max(1, this.recordCount()));
    const list: FakePerson[] = [];

    for (let i = 0; i < count; i++) {
      const first = this.randItem(this.firstNames);
      const last = this.randItem(this.lastNames);
      const domain = this.randItem(this.domains);
      const email = `${first.toLowerCase()}.${last.toLowerCase()}@${domain}`;
      const phone = `+1 (${Math.floor(Math.random() * 800) + 200}) ${Math.floor(Math.random() * 899) + 100}-${Math.floor(Math.random() * 8999) + 1000}`;
      const year = 2021 + Math.floor(Math.random() * 4);
      const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
      const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');

      list.push({
        id: crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : String(Date.now() + i),
        name: `${first} ${last}`,
        email,
        role: this.randItem(this.roles),
        company: this.randItem(this.companies),
        phone,
        city: this.randItem(this.cities),
        country: this.randItem(this.countries),
        joinedDate: `${year}-${month}-${day}`
      });
    }

    this.generatedData.set(list);
  }

  private randItem<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  formattedOutput = computed(() => {
    const data = this.generatedData();
    const fmt = this.exportFormat();

    if (fmt === 'json') {
      return JSON.stringify(data, null, 2);
    }
    if (fmt === 'csv') {
      const headers = ['id', 'name', 'email', 'role', 'company', 'phone', 'city', 'country', 'joinedDate'];
      const rows = data.map(d =>
        `"${d.id}","${d.name}","${d.email}","${d.role}","${d.company}","${d.phone}","${d.city}","${d.country}","${d.joinedDate}"`
      );
      return [headers.join(','), ...rows].join('\n');
    }
    // SQL
    const statements = data.map(d =>
      `INSERT INTO users (id, name, email, role, company, phone, city, country, joined_date) VALUES ('${d.id}', '${d.name}', '${d.email}', '${d.role}', '${d.company}', '${d.phone}', '${d.city}', '${d.country}', '${d.joinedDate}');`
    );
    return statements.join('\n');
  });

  copyOutput() {
    navigator.clipboard.writeText(this.formattedOutput());
  }

  downloadOutput() {
    const ext = this.exportFormat();
    const blob = new Blob([this.formattedOutput()], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `fake_dataset.${ext}`;
    link.click();
  }
}

