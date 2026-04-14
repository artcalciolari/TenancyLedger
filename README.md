# 📚 Tenancy Ledger

**A robust Modular Monolith for precise rental and property management.**

![License](https://img.shields.io/badge/license-MIT-blue.svg) | ![Stack](https://img.shields.io/badge/stack-NestJS%20--%20TypeScript-3162FF.svg)

---

## 🎯 Overview
Tenancy Ledger is a disciplined property management system designed for landlords who require absolute financial transparency and auditability regarding rental payments and contractual obligations. It moves beyond simple tracking to function as an immutable ledger of all tenancy events.

The core focus is **Data Integrity**, ensuring that the state of a lease or invoice can never become ambiguous due to poor design choices.

## ⚙️ Architectural Philosophy (DDD)
This project utilizes the **Domain-Driven Design (DDD)** principles implemented via a **Modular Monolith**.

Instead of treating the system as one big application, we define distinct **Bounded Contexts**—logical boundaries where terms have precise meanings:

1.  **Tenant Management:** Manages identity and legal documentation ($\text{CPF/RG}$).
2.  **Contract Management:** Defines the rules of engagement (amount, due date, term).
3.  **Billing & Status Tracking (The Ledger):** The critical context responsible for creating invoices and managing the *State Machine* of payments. This module ensures every payment is a permanent, verifiable transaction record.

> **Key Design Principle:** Separation of Concerns. Logic related to *who* the tenant is should never influence the logic that determines if an invoice is overdue.

## ✨ Key Features
*   **Auditable Financial Ledger:** Tracks not just *if* a payment occurred, but *when*, *how much*, and links it directly to proof-of-payment documentation.
*   **Tenant Document Management:** Securely stores and manages legal documents ($\text{CPF}$, $\text{RG}$) per tenant record.
*   **Contract Lifecycle Tracking:** Defines lease terms and automatically calculates billing cycles and late fees based on defined business rules.
*   **Modular Structure:** Clear separation of Bounded Contexts using NestJS Modules for high maintainability and low coupling.

## 🛠️ Tech Stack
*   **Framework:** NestJS (TypeScript)
*   **Architecture:** Modular Monolith / DDD
*   **Database:** PostgreSQL (Chosen for strict relational integrity required by the ledger context)
*   **File Storage:** S3 compatible storage (for storing document proofs).

## 🚀 Getting Started
Follow these steps to set up the development environment.

### Prerequisites
*   Node.js (v18+)
*   NestJS CLI

### Installation
```bash
# Clone the repository
git clone https://github.com/artcalciolari/TenancyLedger.git
cd TenancyLedger

# Install dependencies
npm install

# Run the application in development mode
npm run start:dev 
