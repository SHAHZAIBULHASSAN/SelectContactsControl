Building a Dynamic Contacts Dashboard in Power Apps Using PCF and Chart.js
Overview

Power Apps Component Framework (PCF) allows developers to create custom, interactive components for model-driven apps. One common use case is displaying and analyzing contact data. The SelectContactsControl PCF control provides a searchable contacts list, detailed contact view, and interactive charts using Chart.js.

This blog will explain how the control works, its features, and its internal structure, making it easy for developers to replicate or extend for their own dashboards.

Why Use PCF for a Contacts Dashboard?

PCF offers several advantages over standard form components:

Highly interactive and responsive

Customizable in look and feel

Direct access to Dataverse Web API for live data

Reusable across multiple apps

Supports modern JavaScript frameworks and libraries like Chart.js

With SelectContactsControl, we combine a searchable contact list with dynamic charts to create a modern, user-friendly dashboard.

Key Features

Search Contacts – Real-time filtering by name or email.

Contact Details – Click on a contact to see details including email, city, and job title.

Interactive Charts – Pie, bar, doughnut, or polar area charts to visualize contacts by city or job title.

Responsive Design – Automatically adjusts chart sizes to container dimensions.

Fallback Data – Provides default contacts if API retrieval fails.

Control Structure
Imports and Setup
import { IInputs, IOutputs } from "./generated/ManifestTypes";
import "./CSS/style.css";
import { Chart, registerables } from "chart.js";

try { 
    Chart.register(...registerables); 
} catch (err) { 
    console.warn("Chart.js register failed", err); 
}


IInputs & IOutputs: PCF interfaces for input/output parameters.

Chart.js: Used for all chart rendering.

CSS: Styles dashboard, contact cards, and charts.

Data Interfaces
interface Contact { id: string; name: string; email: string; city: string; job: string; }
interface RawContact { contactid: string; fullname: string; emailaddress1: string; jobtitle?: string; address1_city?: string; }


Contact – simplified structure for internal usage.

RawContact – matches Dataverse contact entity fields.

Initialization
public init(context: ComponentFramework.Context<IInputs>, notifyOutputChanged: () => void, state: ComponentFramework.Dictionary, container: HTMLDivElement): void {
    this.context = context;
    this.container = container;
    this.container.classList.add("contact-dashboard");
    this.renderLayout();
    this.attachListeners();
    this.loadContacts();
}


Sets up the container, renders layout, attaches listeners, and loads contact data.

Rendering the Layout

Header with search box

Contact List showing name, email, and city

Contact Detail panel for selected contact

Chart Section with chart type selector and group toggle

This ensures a user-friendly interface for viewing and interacting with contacts.

Loading Contacts
private async loadContacts(): Promise<void> {
    const result = await this.context.webAPI.retrieveMultipleRecords(
        "contact",
        "?$select=fullname,emailaddress1,contactid,jobtitle,address1_city"
    );
    this.contacts = result.entities.map(c => ({
        id: c.contactid,
        name: c.fullname,
        email: c.emailaddress1,
        city: c.address1_city || "Unknown",
        job: c.jobtitle || "Not Specified"
    }));
}


Fetches live contact records from Dataverse.

Includes fallback sample data for testing or if API fails.

Searching Contacts
private onSearch(value: string): void {
    const term = value.trim().toLowerCase();
    this.filtered = this.contacts.filter(c => c.name.toLowerCase().includes(term) || c.email.toLowerCase().includes(term));
    this.renderContacts();
    this.drawChart();
}


Filters contacts in real-time.

Updates both the contact list and chart dynamically.

Contact Detail View

Clicking a contact displays a detail card:

Large avatar

Name and job title

Email and city

Close button

Interactive Charts

Group by city or job title

Chart types: Pie, Bar, Doughnut, Polar Area

Responsive using ResizeObserver

private drawChart(): void { ... }


Destroys existing chart before creating a new one.

Groups data and prepares labels, counts, and colors.

Configures chart options and animations.

Lifecycle Management
public updateView(context: ComponentFramework.Context<IInputs>): void { this.context = context; }
public getOutputs(): IOutputs { return {}; }
public destroy(): void { if (this.chart) { this.chart.destroy(); this.chart = null; } }


Updates the view when context changes.

Cleans up chart resources on destroy to prevent memory leaks.

Summary

SelectContactsControl is a modern, interactive contacts dashboard that enhances Dynamics 365 with:

Real-time search

Detailed contact cards

Dynamic and responsive charts

It’s a perfect example of combining PCF and Chart.js to build dashboards that are both functional and visually appealing.

Developers can extend this control to include features like:

Advanced filtering and sorting

Exporting charts to Excel/PDF

Drag-and-drop task assignments
