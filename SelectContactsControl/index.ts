import { IInputs, IOutputs } from "./generated/ManifestTypes";
import "./CSS/style.css";
// Chart import - keep as dependency in package.json
import { Chart, registerables, ChartConfiguration, ChartType, ChartOptions } from "chart.js";
try { Chart.register(...registerables); } catch (err) { console.warn("Chart.js register failed", err); }

interface Contact { id: string; name: string; email: string; city: string; job: string; }
interface RawContact { contactid: string; fullname: string; emailaddress1: string; jobtitle?: string; address1_city?: string; }

export class SelectContactsControl implements ComponentFramework.StandardControl<IInputs, IOutputs> {
  private container: HTMLDivElement;
  private context: ComponentFramework.Context<IInputs>;
  private contacts: Contact[] = [];
  private filtered: Contact[] = [];
  private chart: Chart | null = null;
  private chartGroupBy: "city" | "jobtitle" = "city";
  private chartTypeSelector: ChartType = "pie";

  public init(context: ComponentFramework.Context<IInputs>, notifyOutputChanged: () => void, state: ComponentFramework.Dictionary, container: HTMLDivElement): void {
    this.context = context;
    this.container = container;
    this.container.classList.add("contact-dashboard");
    this.renderLayout();
    this.attachListeners();
    this.loadContacts();
  }

  private renderLayout(): void {
    this.container.innerHTML = `
      <div class="header"><h2>Contacts Dashboard</h2><input type="text" id="searchBox" placeholder="Search by name or email" /></div>
      <div class="main-content">
        <div id="contactList" class="contact-list"></div>
        <div id="contactDetail" class="contact-detail hidden"></div>
      </div>
      <div class="chart-section">
        <div class="chart-header">
          <h3>Contact Distribution</h3>
          <div class="chart-controls">
            <select id="chartTypeSelector" aria-label="Select chart type">
              <option value="pie">Pie</option><option value="bar">Bar</option><option value="doughnut">Doughnut</option><option value="polarArea">Polar Area</option>
            </select>
            <div class="toggle-buttons" role="tablist" aria-label="Group by">
              <button id="byCity" class="active" role="tab">By City</button>
              <button id="byJob" role="tab">By Job Title</button>
            </div>
          </div>
        </div>
        <div class="chart-canvas"><canvas id="contactChart" height="260" aria-label="Contact chart"></canvas></div>
      </div>
    `;
  }

  private attachListeners(): void {
    this.container.querySelector("#searchBox")?.addEventListener("input", (e) => this.onSearch((e.target as HTMLInputElement).value));
    this.container.querySelector("#byCity")?.addEventListener("click", () => this.changeChartGroup("city"));
    this.container.querySelector("#byJob")?.addEventListener("click", () => this.changeChartGroup("jobtitle"));
    this.container.querySelector("#chartTypeSelector")?.addEventListener("change", (e) => this.updateChartType((e.target as HTMLSelectElement).value as ChartType));

    const chartCanvas = this.container.querySelector("#contactChart") as HTMLCanvasElement | null;
    if (chartCanvas) {
      try {
        const ro = new ResizeObserver(() => this.drawChart());
        ro.observe(chartCanvas);
      } catch (err) {
        console.warn("ResizeObserver not available", err);
      }
    }
  }

  private async loadContacts(): Promise<void> {
    try {
      const result = await this.context.webAPI.retrieveMultipleRecords(
        "contact",
        "?$select=fullname,emailaddress1,contactid,jobtitle,address1_city"
      );
      this.contacts = result.entities.map((c) => {
        const contact = c as RawContact;
        return { id: contact.contactid, name: contact.fullname, email: contact.emailaddress1, city: contact.address1_city || "Unknown", job: contact.jobtitle || "Not Specified" };
      });
    } catch (err) {
      console.warn("WebAPI fetch failed, using fallback data", err);
      this.contacts = [
        { id: "1", name: "Amina Yusuf", email: "amina@example.com", city: "Manama", job: "Manager" },
        { id: "2", name: "Omar Khalid", email: "omar@example.com", city: "Riffa", job: "Engineer" },
        { id: "3", name: "Sara Ahmed", email: "sara@example.com", city: "Isa Town", job: "Designer" }
      ];
    }

    this.filtered = [...this.contacts];
    this.renderContacts();
    this.drawChart();
  }

  private renderContacts(): void {
    const listDiv = this.container.querySelector("#contactList") as HTMLDivElement;
    if (!listDiv) return;
    listDiv.innerHTML = "";
    if (this.filtered.length === 0) { listDiv.innerHTML = `<div class="no-data">No contacts found</div>`; return; }
    this.filtered.forEach((contact) => {
      const item = document.createElement("div");
      item.className = "contact-card";
      item.innerHTML = `<div class="left"><div class="avatar">${contact.name.charAt(0)}</div><div class="details"><div class="name">${contact.name}</div><div class="email">${contact.email || "—"}</div></div></div><div class="right"><div class="city">${contact.city}</div></div>`;
      item.onclick = () => this.showContactDetail(contact.id);
      listDiv.appendChild(item);
    });
  }

  private showContactDetail(id: string): void {
    const contact = this.contacts.find((c) => c.id === id); if (!contact) return;
    const detailDiv = this.container.querySelector("#contactDetail") as HTMLDivElement;
    detailDiv.innerHTML = `<div class="detail-card"><div class="detail-header"><div class="avatar-large">${contact.name.charAt(0)}</div><div><h3>${contact.name}</h3><div class="muted">${contact.job}</div></div></div><div class="detail-body"><p><strong>Email</strong><br/>${contact.email}</p><p><strong>City</strong><br/>${contact.city}</p></div><div class="detail-actions"><button id="closeDetail" class="btn-primary">Close</button></div></div>`;
    detailDiv.classList.remove("hidden");
    this.container.querySelector("#closeDetail")?.addEventListener("click", () => { detailDiv.classList.add("hidden"); });
  }

  private onSearch(value: string): void {
    const term = value.trim().toLowerCase();
    this.filtered = this.contacts.filter((c) => c.name.toLowerCase().includes(term) || c.email.toLowerCase().includes(term));
    this.renderContacts();
    this.drawChart();
  }

  private changeChartGroup(type: "city" | "jobtitle"): void {
    this.chartGroupBy = type;
    (this.container.querySelector("#byCity") as HTMLButtonElement).classList.toggle("active", type === "city");
    (this.container.querySelector("#byJob") as HTMLButtonElement).classList.toggle("active", type === "jobtitle");
    this.drawChart();
  }

  private updateChartType(type: ChartType): void { this.chartTypeSelector = type; this.drawChart(); }

  private drawChart(): void {
    const canvas = this.container.querySelector("#contactChart") as HTMLCanvasElement | null;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    try {
      if (this.chart) { this.chart.destroy(); this.chart = null; }
      const grouped = this.filtered.reduce<Record<string, number>>((acc, item) => { const key = this.chartGroupBy === "city" ? item.city : item.job; acc[key] = (acc[key] || 0) + 1; return acc; }, {});
      const labels = Object.keys(grouped); const values = Object.values(grouped);
      const colors = ["#60A5FA","#F59E0B","#34D399","#F87171","#A78BFA","#FBBF24","#10B981","#7DD3FC","#FBCFE8","#C7D2FE"];
      const dataset = { label: this.chartGroupBy === "city" ? "Contacts by city" : "Contacts by job title", data: values, backgroundColor: colors.slice(0, values.length), borderWidth: 1 } as ChartConfiguration["data"]["datasets"][0];

      const config: ChartConfiguration = { type: this.chartTypeSelector, data: { labels, datasets: [dataset] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" }, tooltip: { enabled: true } }, animation: { duration: 700 } } };
      if (this.chartTypeSelector === "bar") { (config.options as ChartOptions<'bar'>).scales = { x: { ticks: { autoSkip: false }, grid: { display: false } }, y: { beginAtZero: true, grid: { color: "rgba(0,0,0,0.05)" } } }; }
      this.chart = new Chart(ctx, config);
    } catch (err) {
      console.warn("Chart draw failed, skipping chart", err);
    }
  }

  public updateView(context: ComponentFramework.Context<IInputs>): void { this.context = context; }
  public getOutputs(): IOutputs { return {}; }
  public destroy(): void { 
    if (this.chart) { 
        try { this.chart.destroy(); } catch (e) {
            // ignore
        } this.chart = null; } }
}
