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
```

## 🗺️ Roadmap & Architecture Plan

### Fase 1: Foundation & Identity (Concluído)
* Implementação do Bounded Context de Inquilinos (Tenant Module).
* Definição da entidade principal focada exclusivamente na representação da pessoa física e seus dados de identidade.  

### Fase 2: Asset & Contract Management (Próximos Passos)
* Criação da entidade Property Unit para mapear o ativo físico e sua localização de forma independente.
* Construção do módulo de Contratos (Contract Module) para gerenciar o vínculo e as regras do jogo entre a pessoa e o ativo.
* Implementação das regras do ciclo de vida contratual, definindo valor base, duração e possibilidade de renovação.  

### Fase 3: Financial Ledger & Billing Engine (Em Planejamento)
* Estruturação do Invoice Module focado em isolar a lógica de faturamento do resto do sistema.
* Desenvolvimento de um mecanismo automatizado (Cron job) no Invoice Service para buscar ativamente contratos próximos ao vencimento e gerar as faturas correspondentes.
* Criação da sub-entidade de transações de pagamento para registrar datas, métodos (Pix, dinheiro) e vincular a URL do comprovante.
* Integração do armazenamento de arquivos de comprovantes e documentos em buckets do MinIO.

### Fase 4: Payment State Machine (Em Planejamento)
* Implementação da máquina de estados para garantir a transição segura e auditável do status das faturas.
* Mapeamento do estado inicial Pending para aguardar a ação do inquilino.
* Configuração do estado Under Review, acionado quando um comprovante é anexado, travando a fatura para evitar o status de atraso indevido durante a análise.
* Definição dos estados finais de conciliação financeira, separando liquidações parciais (Partially Paid) e integrais (Paid).  
