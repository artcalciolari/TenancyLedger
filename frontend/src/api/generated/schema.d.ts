export type paths = {
    "/": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Consultar informações básicas da API */
        get: operations["AppController_getInfo"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/change-password": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Alterar a própria senha */
        post: operations["AuthController_changePassword"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/login": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Autenticar e obter um JWT de acesso */
        post: operations["AuthController_login"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/logout": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Encerrar e revogar a família da sessão atual */
        post: operations["AuthController_logout"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/refresh": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Rotacionar a sessão e obter um novo JWT de acesso */
        post: operations["AuthController_refresh"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/users": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Listar usuários */
        get: operations["AuthController_listUsers"];
        put?: never;
        /** Criar usuário */
        post: operations["AuthController_createUser"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/users/{id}/access": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Alterar papel e estado de acesso de um usuário */
        patch: operations["AuthController_updateUserAccess"];
        trace?: never;
    };
    "/buildings": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Listar prédios */
        get: operations["BuildingController_list"];
        put?: never;
        /** Cadastrar prédio */
        post: operations["BuildingController_create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/buildings/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Consultar prédio */
        get: operations["BuildingController_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Editar prédio */
        patch: operations["BuildingController_update"];
        trace?: never;
    };
    "/client-errors": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Registrar uma falha sanitizada do frontend */
        post: operations["ClientObservabilityController_report"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/contracts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Listar contratos */
        get: operations["ContractController_list"];
        put?: never;
        /** Criar contrato */
        post: operations["ContractController_create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/contracts/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Consultar contrato */
        get: operations["ContractController_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/contracts/{id}/renew": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Renovar contrato */
        patch: operations["ContractController_renew"];
        trace?: never;
    };
    "/contracts/export.csv": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Exportar contratos filtrados em CSV */
        get: operations["ContractController_exportCsv"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/dashboard/summary": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Consultar agregados globais do dashboard */
        get: operations["DashboardController_summary"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["HealthController_live"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/health/live": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["HealthController_liveness"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/health/ready": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["HealthController_ready"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/invoices": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Listar faturas */
        get: operations["BillingController_list"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/invoices/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Consultar fatura e seus pagamentos */
        get: operations["BillingController_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/invoices/{id}/payments": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Submeter pagamento para revisão */
        post: operations["BillingController_submitPayment"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/invoices/{id}/payments/by-idempotency-key": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Recuperar o resultado de uma submissão idempotente */
        get: operations["BillingController_getPaymentByIdempotencyKey"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/invoices/{invoiceId}/payments/{paymentId}/approve": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Aprovar pagamento submetido */
        patch: operations["BillingController_approvePayment"];
        trace?: never;
    };
    "/invoices/{invoiceId}/payments/{paymentId}/proof": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Gerar URL temporária de um comprovante */
        get: operations["BillingController_getPaymentProof"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/invoices/{invoiceId}/payments/{paymentId}/reject": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Rejeitar pagamento submetido */
        patch: operations["BillingController_rejectPayment"];
        trace?: never;
    };
    "/invoices/export.csv": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Exportar faturas filtradas em CSV */
        get: operations["BillingController_exportCsv"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/metrics": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["MetricsController_metrics"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/notifications": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Listar as notificações do usuário autenticado */
        get: operations["NotificationController_list"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/notifications/{id}/read": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Marcar uma notificação do usuário como lida */
        patch: operations["NotificationController_markRead"];
        trace?: never;
    };
    "/notifications/read-all": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Marcar todas as notificações do usuário como lidas */
        patch: operations["NotificationController_markAllRead"];
        trace?: never;
    };
    "/payments/review": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Listar pagamentos submetidos aguardando revisão */
        get: operations["PaymentReviewController_list"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/properties": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Listar imóveis */
        get: operations["PropertyController_list"];
        put?: never;
        /** Cadastrar imóvel */
        post: operations["PropertyController_create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/properties/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Consultar imóvel */
        get: operations["PropertyController_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Editar imóvel */
        patch: operations["PropertyController_update"];
        trace?: never;
    };
    "/tenants": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Listar locatários */
        get: operations["TenantController_findAll"];
        put?: never;
        /** Cadastrar locatário */
        post: operations["TenantController_create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/tenants/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Consultar locatário */
        get: operations["TenantController_findById"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Editar locatário */
        patch: operations["TenantController_update"];
        trace?: never;
    };
};
export type webhooks = Record<string, never>;
export type components = {
    schemas: {
        AppInfoResponseDto: {
            /** @example /docs */
            documentation: string;
            /** @example Tenancy Ledger API */
            name: string;
            /**
             * @example ok
             * @enum {string}
             */
            status: "ok";
        };
        BuildingDetailResponseDto: {
            /** @example Rua das Flores, 123 */
            address?: string | null;
            /** Format: date-time */
            createdAt: string;
            /** Format: uuid */
            id: string;
            /** @example Edifício Aurora */
            name: string;
            /** @example Centro */
            neighborhood: string;
            /** @example 8 */
            occupiedUnits: number;
            /** @example 12 */
            totalUnits: number;
            units: components["schemas"]["BuildingUnitResponseDto"][];
        };
        BuildingResponseDto: {
            /** @example Rua das Flores, 123 */
            address?: string | null;
            /** Format: date-time */
            createdAt: string;
            /** Format: uuid */
            id: string;
            /** @example Edifício Aurora */
            name: string;
            /** @example Centro */
            neighborhood: string;
            /** @example 8 */
            occupiedUnits: number;
            /** @example 12 */
            totalUnits: number;
        };
        BuildingUnitResponseDto: {
            /** Format: uuid */
            id: string;
            /** @example Centro */
            neighborhood: string;
            occupied: boolean;
            type: components["schemas"]["UnitType"];
            /** @example 101-A */
            unitNumber: string;
        };
        ChangePasswordDto: {
            /** Format: password */
            currentPassword: string;
            /**
             * Format: password
             * @description Deve conter minúscula, maiúscula, número e símbolo.
             */
            newPassword: string;
        };
        ClientErrorDto: {
            /**
             * @description Impressão digital opaca; mensagens e stacks nunca são recebidas.
             * @example 5f9c6bb1a4438e12
             */
            fingerprint: string;
            kind: components["schemas"]["ClientErrorKind"];
            release?: string;
            requestId?: string;
            /** @description Somente o pathname, sem query string ou fragmento. */
            route: string;
            status?: number;
        };
        /** @enum {string} */
        ClientErrorKind: "RUNTIME" | "RENDER" | "NETWORK";
        ContractPropertySummaryDto: {
            /** Format: uuid */
            id: string;
            /** @example Centro */
            neighborhood: string;
            type: components["schemas"]["UnitType"];
            /** @example 101-A */
            unitNumber: string;
        };
        ContractResponseDto: {
            /** @example 10 */
            billingDay: number;
            /** Format: date-time */
            createdAt: string;
            /** @example 12 */
            durationInMonths: number;
            /**
             * Format: date
             * @example 2027-06-30
             */
            endDate: string;
            /** Format: uuid */
            id: string;
            isRenewable: boolean;
            /** @example 150000 */
            monthlyBaseValueCents: number;
            /**
             * Format: date
             * @example 2026-07-01
             */
            moveInDate: string;
            propertyUnit: components["schemas"]["ContractPropertySummaryDto"];
            /** Format: uuid */
            propertyUnitId: string;
            status: components["schemas"]["ContractStatus"];
            tenant: components["schemas"]["ContractTenantSummaryDto"];
            /** Format: uuid */
            tenantId: string;
            /** Format: date-time */
            updatedAt: string;
        };
        /** @enum {string} */
        ContractStatus: "ACTIVE" | "EXPIRED" | "TERMINATED";
        ContractTenantSummaryDto: {
            civilStatus: components["schemas"]["TenantCivilStatus"];
            /** @example ***.***.***-09 */
            cpf: string;
            /** @example l***@example.com */
            email: string;
            /** Format: uuid */
            id: string;
            /** @example (**) *****-9999 */
            mobilePhone: string;
            /** @example Maria da Silva */
            name: string;
            /** @example Engenheiro civil */
            profession: string;
        };
        CreateBuildingDto: {
            /** @example Rua das Flores, 123 */
            address?: string;
            /** @example Edifício Aurora */
            name: string;
            /** @example Centro */
            neighborhood: string;
        };
        CreateContractDto: {
            /** @example 10 */
            billingDay?: number;
            /** @example 12 */
            durationInMonths: number;
            isRenewable: boolean;
            /** @example 150000 */
            monthlyBaseValueCents: number;
            /**
             * Format: date
             * @example 2026-07-01
             */
            moveInDate: string;
            /** Format: uuid */
            propertyUnitId: string;
            /** Format: uuid */
            tenantId: string;
        };
        CreatePropertyDto: {
            /** Format: uuid */
            buildingId?: string;
            /**
             * @description Obrigatório para unidade sem prédio. Quando buildingId é informado, o bairro é derivado do prédio e este valor é ignorado.
             * @example Centro
             */
            neighborhood?: string;
            type: components["schemas"]["UnitType"];
            /** @example 101-A */
            unitNumber: string;
        };
        CreateTenantDto: {
            civilStatus: components["schemas"]["TenantCivilStatus"];
            /** @example 123.456.789-09 */
            cpf: string;
            /**
             * Format: email
             * @example locatario@example.com
             */
            email: string;
            /** @example +55 11 99999-9999 */
            mobilePhone: string;
            /** @example Maria da Silva */
            name: string;
            /** @example Engenheiro civil */
            profession: string;
            /** @example 12.345.678-9 */
            rg: string;
        };
        CreateUserDto: {
            /**
             * Format: email
             * @example gestor@example.com
             */
            email: string;
            /**
             * Format: password
             * @description Deve conter minúscula, maiúscula, número e símbolo.
             */
            password: string;
            /** @example MANAGER */
            role: components["schemas"]["UserRole"];
        };
        DashboardContractSummaryDto: {
            active: number;
            expired: number;
            /** @description Contratos ativos que vencem nos próximos 30 dias. */
            expiringNext30Days: number;
            terminated: number;
            total: number;
        };
        DashboardInvoiceSummaryDto: {
            approvedAmountCents: number;
            outstandingAmountCents: number;
            overdueAmountCents: number;
            total: number;
            totalValueCents: number;
            underReview: number;
        };
        DashboardPaymentSummaryDto: {
            submitted: number;
        };
        DashboardSummaryResponseDto: {
            /** Format: date */
            asOf: string;
            contracts: components["schemas"]["DashboardContractSummaryDto"];
            invoices: components["schemas"]["DashboardInvoiceSummaryDto"];
            payments: components["schemas"]["DashboardPaymentSummaryDto"];
        };
        IdempotentPaymentLookupResponseDto: {
            invoice: components["schemas"]["InvoiceResponseDto"];
            payment: components["schemas"]["PaymentResponseDto"];
        };
        InvoiceContractSummaryDto: {
            /** Format: uuid */
            id: string;
            propertyUnit: components["schemas"]["ContractPropertySummaryDto"];
            /** Format: uuid */
            propertyUnitId: string;
            status: components["schemas"]["ContractStatus"];
            tenant: components["schemas"]["ContractTenantSummaryDto"];
            /** Format: uuid */
            tenantId: string;
        };
        InvoiceResponseDto: {
            /** @example 50000 */
            approvedAmountCents: number;
            /** @example 2026-07 */
            competence: string;
            contract: components["schemas"]["InvoiceContractSummaryDto"];
            /** Format: uuid */
            contractId: string;
            /** Format: date-time */
            createdAt: string;
            /**
             * Format: date
             * @example 2026-07-10
             */
            dueDate: string;
            /** Format: uuid */
            id: string;
            /** @example 100000 */
            outstandingAmountCents: number;
            payments: components["schemas"]["PaymentResponseDto"][];
            status: components["schemas"]["InvoiceStatus"];
            /** @example 150000 */
            totalValueCents: number;
            /** Format: date-time */
            updatedAt: string;
        };
        /** @enum {string} */
        InvoiceStatus: "OPEN" | "UNDER_REVIEW" | "PARTIALLY_PAID" | "PAID" | "OVERDUE";
        LoginDto: {
            /**
             * Format: email
             * @example admin@example.com
             */
            email: string;
            /** Format: password */
            password: string;
        };
        LoginResponseDto: {
            /**
             * @description JWT de acesso.
             * @example eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…
             */
            accessToken: string;
            user: components["schemas"]["UserResponseDto"];
        };
        NotificationResponseDto: {
            /** Format: date-time */
            createdAt: string;
            /** Format: uuid */
            id: string;
            message: string;
            /** Format: date-time */
            readAt: string | null;
            /** Format: uuid */
            resourceId: string;
            /** @example INVOICE */
            resourceType: string;
            title: string;
            type: components["schemas"]["NotificationType"];
        };
        /** @enum {string} */
        NotificationType: "PAYMENT_SUBMITTED" | "PAYMENT_APPROVED" | "PAYMENT_REJECTED";
        PageMetaDto: {
            /** @example 20 */
            limit: number;
            /** @example 1 */
            page: number;
            /** @example 42 */
            total: number;
            /** @example 3 */
            totalPages: number;
        };
        PaginatedBuildingsResponseDto: {
            data: components["schemas"]["BuildingResponseDto"][];
            meta: components["schemas"]["PageMetaDto"];
        };
        PaginatedContractsResponseDto: {
            data: components["schemas"]["ContractResponseDto"][];
            meta: components["schemas"]["PageMetaDto"];
        };
        PaginatedInvoicesResponseDto: {
            data: components["schemas"]["InvoiceResponseDto"][];
            meta: components["schemas"]["PageMetaDto"];
        };
        PaginatedNotificationsResponseDto: {
            data: components["schemas"]["NotificationResponseDto"][];
            meta: components["schemas"]["PageMetaDto"];
            unreadCount: number;
        };
        PaginatedPaymentReviewResponseDto: {
            data: components["schemas"]["PaymentReviewItemResponseDto"][];
            meta: components["schemas"]["PageMetaDto"];
        };
        PaginatedPropertiesResponseDto: {
            data: components["schemas"]["PropertyResponseDto"][];
            meta: components["schemas"]["PageMetaDto"];
        };
        PaginatedTenantResponseDto: {
            data: components["schemas"]["TenantResponseDto"][];
            meta: components["schemas"]["PageMetaDto"];
        };
        PaginatedUsersResponseDto: {
            data: components["schemas"]["UserResponseDto"][];
            meta: components["schemas"]["PageMetaDto"];
        };
        /** @enum {string} */
        PaymentMethod: "PIX" | "CASH" | "BANK_TRANSFER";
        PaymentProofUrlResponseDto: {
            /** @example 300 */
            expiresInSeconds: number;
            /**
             * Format: uri
             * @description URL assinada e temporária do comprovante.
             */
            url: string;
        };
        PaymentResponseDto: {
            /** @example 50000 */
            amountCents: number;
            hasProof: boolean;
            /** Format: uuid */
            id: string;
            method: components["schemas"]["PaymentMethod"];
            proofType: components["schemas"]["ProofType"] | null;
            rejectionReason: string | null;
            /** Format: date-time */
            reviewedAt: string | null;
            /** Format: uuid */
            reviewedByUserId: string | null;
            status: components["schemas"]["PaymentStatus"];
            /** Format: date-time */
            submittedAt: string;
            /** Format: uuid */
            submittedByUserId: string | null;
        };
        PaymentReviewInvoiceSummaryDto: {
            approvedAmountCents: number;
            competence: string;
            /** Format: date */
            dueDate: string;
            /** Format: uuid */
            id: string;
            outstandingAmountCents: number;
            status: components["schemas"]["InvoiceStatus"];
            totalValueCents: number;
        };
        PaymentReviewItemResponseDto: {
            contract: components["schemas"]["InvoiceContractSummaryDto"];
            invoice: components["schemas"]["PaymentReviewInvoiceSummaryDto"];
            payment: components["schemas"]["PaymentResponseDto"];
        };
        /** @enum {string} */
        PaymentStatus: "SUBMITTED" | "APPROVED" | "REJECTED";
        ProblemDetailsDto: {
            /** @example A requisição contém dados inválidos. */
            detail: string;
            /** @description Demais mensagens de validação, quando houver mais de uma. */
            errors?: string[];
            /** @example /contracts?page=0 */
            instance: string;
            /** @example 0f2a9a56-b0d5-4ac5-8f1e-791e9fc92347 */
            requestId: string | null;
            /** @example 400 */
            status: number;
            /**
             * Format: date-time
             * @example 2026-07-12T18:30:00.000Z
             */
            timestamp: string;
            /** @example BadRequestException */
            title: string;
            /**
             * Format: uri
             * @example https://tenancy-ledger.local/problems/http-400
             */
            type: string;
        };
        /** @enum {string} */
        ProofType: "DIGITAL_SLIP" | "SIGNED_RECEIPT" | "BANK_STATEMENT";
        PropertyResponseDto: {
            /** Format: uuid */
            buildingId?: string | null;
            /** @example Edifício Aurora */
            buildingName?: string | null;
            /** Format: date-time */
            createdAt: string;
            /** Format: uuid */
            id: string;
            /** @example Centro */
            neighborhood: string;
            /** @example false */
            occupied: boolean;
            type: components["schemas"]["UnitType"];
            /** @example 101-A */
            unitNumber: string;
        };
        RejectPaymentDto: {
            /** @example Comprovante ilegível. */
            reason: string;
        };
        RenewContractDto: {
            /** @example 12 */
            extraMonths: number;
        };
        SubmitPaymentMultipartDto: {
            /** @example 50000 */
            amountCents: number;
            /** @description PIX e BANK_TRANSFER exigem comprovante; CASH não aceita comprovante digital. */
            method: components["schemas"]["PaymentMethod"];
            /**
             * Format: binary
             * @description Obrigatório para PIX e transferência. PDF, JPEG, PNG ou WebP; até 10 MiB.
             */
            proof?: string;
            /** @description Obrigatório para PIX e BANK_TRANSFER; deve ser omitido para CASH. */
            proofType?: components["schemas"]["ProofType"];
        };
        /** @enum {string} */
        TenantCivilStatus: "SINGLE" | "MARRIED" | "DIVORCED" | "WIDOWED" | "STABLE_UNION";
        TenantResponseDto: {
            civilStatus: components["schemas"]["TenantCivilStatus"];
            /**
             * @description CPF mascarado para VIEWER.
             * @example ***.***.***-09
             */
            cpf: string;
            /**
             * @description E-mail mascarado para VIEWER.
             * @example l***@example.com
             */
            email: string;
            /** Format: uuid */
            id: string;
            /**
             * @description Telefone mascarado para VIEWER.
             * @example (**) *****-9999
             */
            mobilePhone: string;
            /** @example Maria da Silva */
            name: string;
            /** @example Engenheiro civil */
            profession: string;
        };
        /** @enum {string} */
        UnitType: "KITNET" | "ROOM" | "APARTMENT" | "HOUSE" | "COMMERCIAL";
        UpdateBuildingDto: {
            /** @example Rua das Flores, 123 */
            address?: string;
            /** @example Edifício Aurora */
            name?: string;
            /** @example Centro */
            neighborhood?: string;
        };
        UpdatePropertyDto: {
            /**
             * Format: uuid
             * @description Campo imutável; presente apenas para explicitar a rejeição de alterações.
             */
            buildingId?: string;
            /**
             * @description Editável apenas para unidade avulsa. Em unidade vinculada, o bairro é derivado do prédio e alterações retornam 422; buildingId é imutável.
             * @example Centro
             */
            neighborhood?: string;
            type?: components["schemas"]["UnitType"];
            /** @example 101-A */
            unitNumber?: string;
        };
        UpdateTenantDto: {
            civilStatus?: components["schemas"]["TenantCivilStatus"];
            /** @description Campo imutável; presente apenas para explicitar a rejeição de alterações. */
            cpf?: string;
            /**
             * Format: email
             * @example locatario@example.com
             */
            email?: string;
            /** @example +55 11 99999-9999 */
            mobilePhone?: string;
            /** @example Maria da Silva */
            name?: string;
            /** @example Engenheiro civil */
            profession?: string;
            /** @description Campo imutável; presente apenas para explicitar a rejeição de alterações. */
            rg?: string;
        };
        UpdateUserAccessDto: {
            /** @description Define se o usuário pode autenticar e usar tokens existentes. */
            active: boolean;
            role: components["schemas"]["UserRole"];
        };
        UserResponseDto: {
            /** @description Indica se o usuário pode autenticar. */
            active: boolean;
            /**
             * Format: email
             * @example gestor@example.com
             */
            email: string;
            /** Format: uuid */
            id: string;
            role: components["schemas"]["UserRole"];
        };
        /** @enum {string} */
        UserRole: "ADMIN" | "MANAGER" | "VIEWER";
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
};
export type $defs = Record<string, never>;
export interface operations {
    AppController_getInfo: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AppInfoResponseDto"];
                };
            };
            /** @description Requisição inválida. */
            400: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Limite de requisições excedido. */
            429: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Erro interno inesperado. */
            500: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
        };
    };
    AuthController_changePassword: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ChangePasswordDto"];
            };
        };
        responses: {
            /** @description Senha alterada e tokens anteriores invalidados. */
            204: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Requisição inválida. */
            400: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Senha atual inválida. */
            401: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Papel sem permissão para a operação. */
            403: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description A nova senha deve ser diferente da senha atual. */
            409: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Limite de requisições excedido. */
            429: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Erro interno inesperado. */
            500: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
        };
    };
    AuthController_login: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LoginDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    /** @description Define o refresh token opaco em cookie HttpOnly e SameSite=Strict. */
                    "Set-Cookie"?: string;
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LoginResponseDto"];
                };
            };
            /** @description Requisição inválida. */
            400: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description E-mail ou senha inválidos. */
            401: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Limite de requisições excedido. */
            429: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Erro interno inesperado. */
            500: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
        };
    };
    AuthController_logout: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Sessão revogada e cookie removido. */
            204: {
                headers: {
                    /** @description Expira o cookie de refresh. */
                    "Set-Cookie"?: string;
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Requisição inválida. */
            400: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Limite de requisições excedido. */
            429: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Erro interno inesperado. */
            500: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
        };
    };
    AuthController_refresh: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    /** @description Rotaciona o refresh token opaco no cookie HttpOnly. */
                    "Set-Cookie"?: string;
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LoginResponseDto"];
                };
            };
            /** @description Requisição inválida. */
            400: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Refresh token ausente, inválido, expirado ou reutilizado. */
            401: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Limite de requisições excedido. */
            429: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Erro interno inesperado. */
            500: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
        };
    };
    AuthController_listUsers: {
        parameters: {
            query?: {
                limit?: number;
                page?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PaginatedUsersResponseDto"];
                };
            };
            /** @description Requisição inválida. */
            400: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Token ausente, inválido ou expirado. */
            401: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Papel sem permissão para a operação. */
            403: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Limite de requisições excedido. */
            429: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Erro interno inesperado. */
            500: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
        };
    };
    AuthController_createUser: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateUserDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UserResponseDto"];
                };
            };
            /** @description Requisição inválida. */
            400: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Token ausente, inválido ou expirado. */
            401: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Papel sem permissão para a operação. */
            403: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Já existe um usuário com este e-mail. */
            409: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Limite de requisições excedido. */
            429: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Erro interno inesperado. */
            500: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
        };
    };
    AuthController_updateUserAccess: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateUserAccessDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UserResponseDto"];
                };
            };
            /** @description Requisição inválida. */
            400: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Token ausente, inválido ou expirado. */
            401: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Papel sem permissão para a operação. */
            403: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Usuário não encontrado. */
            404: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description A alteração removeria o próprio acesso ou o último administrador ativo. */
            409: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Limite de requisições excedido. */
            429: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Erro interno inesperado. */
            500: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
        };
    };
    BuildingController_list: {
        parameters: {
            query?: {
                limit?: number;
                page?: number;
                /** @description Busca parcial por nome, bairro ou endereço. */
                q?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PaginatedBuildingsResponseDto"];
                };
            };
            /** @description Requisição inválida. */
            400: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Token ausente, inválido ou expirado. */
            401: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Papel sem permissão para a operação. */
            403: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Limite de requisições excedido. */
            429: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Erro interno inesperado. */
            500: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
        };
    };
    BuildingController_create: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateBuildingDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BuildingResponseDto"];
                };
            };
            /** @description Requisição inválida. */
            400: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Token ausente, inválido ou expirado. */
            401: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Papel sem permissão para a operação. */
            403: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Já existe um prédio com este nome. */
            409: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Regra de negócio ou valor de domínio inválido. */
            422: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Limite de requisições excedido. */
            429: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Erro interno inesperado. */
            500: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
        };
    };
    BuildingController_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BuildingDetailResponseDto"];
                };
            };
            /** @description Requisição inválida. */
            400: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Token ausente, inválido ou expirado. */
            401: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Papel sem permissão para a operação. */
            403: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Prédio não encontrado. */
            404: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Limite de requisições excedido. */
            429: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Erro interno inesperado. */
            500: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
        };
    };
    BuildingController_update: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateBuildingDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BuildingDetailResponseDto"];
                };
            };
            /** @description Requisição inválida. */
            400: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Token ausente, inválido ou expirado. */
            401: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Papel sem permissão para a operação. */
            403: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Prédio não encontrado. */
            404: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Já existe um prédio com este nome. */
            409: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Regra de negócio ou valor de domínio inválido. */
            422: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Limite de requisições excedido. */
            429: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Erro interno inesperado. */
            500: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
        };
    };
    ClientObservabilityController_report: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ClientErrorDto"];
            };
        };
        responses: {
            /** @description Falha aceita para correlação operacional. */
            202: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Requisição inválida. */
            400: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Token ausente, inválido ou expirado. */
            401: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Papel sem permissão para a operação. */
            403: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Limite de requisições excedido. */
            429: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Erro interno inesperado. */
            500: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
        };
    };
    ContractController_list: {
        parameters: {
            query?: {
                endFrom?: string;
                endTo?: string;
                limit?: number;
                moveInFrom?: string;
                moveInTo?: string;
                page?: number;
                propertyUnitId?: string;
                /** @description Busca por contrato, locatário, CPF, e-mail, bairro ou unidade. */
                q?: string;
                status?: components["schemas"]["ContractStatus"];
                tenantId?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PaginatedContractsResponseDto"];
                };
            };
            /** @description Requisição inválida. */
            400: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Token ausente, inválido ou expirado. */
            401: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Papel sem permissão para a operação. */
            403: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Limite de requisições excedido. */
            429: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Erro interno inesperado. */
            500: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
        };
    };
    ContractController_create: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateContractDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ContractResponseDto"];
                };
            };
            /** @description Requisição inválida. */
            400: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Token ausente, inválido ou expirado. */
            401: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Papel sem permissão para a operação. */
            403: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Locatário ou imóvel não encontrado. */
            404: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description A unidade possui contrato com vigência sobreposta. */
            409: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Regra de negócio ou valor de domínio inválido. */
            422: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Limite de requisições excedido. */
            429: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Erro interno inesperado. */
            500: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
        };
    };
    ContractController_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ContractResponseDto"];
                };
            };
            /** @description Requisição inválida. */
            400: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Token ausente, inválido ou expirado. */
            401: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Papel sem permissão para a operação. */
            403: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Contrato não encontrado. */
            404: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Limite de requisições excedido. */
            429: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Erro interno inesperado. */
            500: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
        };
    };
    ContractController_renew: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RenewContractDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ContractResponseDto"];
                };
            };
            /** @description Requisição inválida. */
            400: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Token ausente, inválido ou expirado. */
            401: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Papel sem permissão para a operação. */
            403: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Contrato não encontrado. */
            404: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Contrato não renovável ou renovação sobreposta. */
            409: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Regra de negócio ou valor de domínio inválido. */
            422: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Limite de requisições excedido. */
            429: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Erro interno inesperado. */
            500: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
        };
    };
    ContractController_exportCsv: {
        parameters: {
            query?: {
                endFrom?: string;
                endTo?: string;
                limit?: number;
                moveInFrom?: string;
                moveInTo?: string;
                page?: number;
                propertyUnitId?: string;
                /** @description Busca por contrato, locatário, CPF, e-mail, bairro ou unidade. */
                q?: string;
                status?: components["schemas"]["ContractStatus"];
                tenantId?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Arquivo CSV UTF-8 com os contratos que atendem aos filtros. */
            200: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "text/csv": string;
                };
            };
            /** @description Requisição inválida. */
            400: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Token ausente, inválido ou expirado. */
            401: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Papel sem permissão para a operação. */
            403: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Limite de requisições excedido. */
            429: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Erro interno inesperado. */
            500: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
        };
    };
    DashboardController_summary: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DashboardSummaryResponseDto"];
                };
            };
            /** @description Requisição inválida. */
            400: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Token ausente, inválido ou expirado. */
            401: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Papel sem permissão para a operação. */
            403: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Limite de requisições excedido. */
            429: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Erro interno inesperado. */
            500: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
        };
    };
    HealthController_live: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Requisição inválida. */
            400: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Limite de requisições excedido. */
            429: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Erro interno inesperado. */
            500: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
        };
    };
    HealthController_liveness: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Requisição inválida. */
            400: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Limite de requisições excedido. */
            429: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Erro interno inesperado. */
            500: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
        };
    };
    HealthController_ready: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The Health Check is successful */
            200: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /**
                         * @example {
                         *       "database": {
                         *         "status": "up"
                         *       }
                         *     }
                         */
                        details?: {
                            [key: string]: {
                                status: string;
                            } & {
                                [key: string]: unknown;
                            };
                        };
                        /** @example {} */
                        error?: {
                            [key: string]: {
                                status: string;
                            } & {
                                [key: string]: unknown;
                            };
                        } | null;
                        /**
                         * @example {
                         *       "database": {
                         *         "status": "up"
                         *       }
                         *     }
                         */
                        info?: {
                            [key: string]: {
                                status: string;
                            } & {
                                [key: string]: unknown;
                            };
                        } | null;
                        /** @example ok */
                        status?: string;
                    };
                };
            };
            /** @description Requisição inválida. */
            400: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Limite de requisições excedido. */
            429: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Erro interno inesperado. */
            500: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description The Health Check is not successful */
            503: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /**
                         * @example {
                         *       "database": {
                         *         "status": "up"
                         *       },
                         *       "redis": {
                         *         "message": "Could not connect",
                         *         "status": "down"
                         *       }
                         *     }
                         */
                        details?: {
                            [key: string]: {
                                status: string;
                            } & {
                                [key: string]: unknown;
                            };
                        };
                        /**
                         * @example {
                         *       "redis": {
                         *         "message": "Could not connect",
                         *         "status": "down"
                         *       }
                         *     }
                         */
                        error?: {
                            [key: string]: {
                                status: string;
                            } & {
                                [key: string]: unknown;
                            };
                        } | null;
                        /**
                         * @example {
                         *       "database": {
                         *         "status": "up"
                         *       }
                         *     }
                         */
                        info?: {
                            [key: string]: {
                                status: string;
                            } & {
                                [key: string]: unknown;
                            };
                        } | null;
                        /** @example error */
                        status?: string;
                    };
                };
            };
        };
    };
    BillingController_list: {
        parameters: {
            query?: {
                competence?: string;
                contractId?: string;
                dueFrom?: string;
                dueTo?: string;
                limit?: number;
                page?: number;
                paymentMethod?: components["schemas"]["PaymentMethod"];
                paymentStatus?: components["schemas"]["PaymentStatus"];
                propertyUnitId?: string;
                /** @description Busca por fatura, contrato, locatário, CPF, e-mail, bairro ou unidade. */
                q?: string;
                status?: components["schemas"]["InvoiceStatus"];
                tenantId?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PaginatedInvoicesResponseDto"];
                };
            };
            /** @description Requisição inválida. */
            400: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Token ausente, inválido ou expirado. */
            401: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Papel sem permissão para a operação. */
            403: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Limite de requisições excedido. */
            429: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Erro interno inesperado. */
            500: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
        };
    };
    BillingController_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["InvoiceResponseDto"];
                };
            };
            /** @description Requisição inválida. */
            400: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Token ausente, inválido ou expirado. */
            401: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Papel sem permissão para a operação. */
            403: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Fatura não encontrada. */
            404: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Limite de requisições excedido. */
            429: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Erro interno inesperado. */
            500: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
        };
    };
    BillingController_submitPayment: {
        parameters: {
            query?: never;
            header: {
                /** @description Chave opaca e única por fatura (8 a 128 caracteres ASCII visíveis). */
                "Idempotency-Key": string;
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        /** @description Comprovante obrigatório para PIX/transferência e proibido para dinheiro. */
        requestBody: {
            content: {
                "multipart/form-data": components["schemas"]["SubmitPaymentMultipartDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["InvoiceResponseDto"];
                };
            };
            /** @description Requisição inválida. */
            400: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Token ausente, inválido ou expirado. */
            401: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Papel sem permissão para a operação. */
            403: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Fatura não encontrada. */
            404: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Chave de idempotência reutilizada ou estado conflitante da fatura. */
            409: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Regra de negócio ou valor de domínio inválido. */
            422: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Limite de requisições excedido. */
            429: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Erro interno inesperado. */
            500: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
        };
    };
    BillingController_getPaymentByIdempotencyKey: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IdempotentPaymentLookupResponseDto"];
                };
            };
            /** @description Requisição inválida. */
            400: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Token ausente, inválido ou expirado. */
            401: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Papel sem permissão para a operação. */
            403: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Fatura ou pagamento não encontrado para a chave informada. */
            404: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Limite de requisições excedido. */
            429: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Erro interno inesperado. */
            500: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
        };
    };
    BillingController_approvePayment: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                invoiceId: string;
                paymentId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["InvoiceResponseDto"];
                };
            };
            /** @description Requisição inválida. */
            400: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Token ausente, inválido ou expirado. */
            401: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Papel sem permissão para a operação. */
            403: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Fatura não encontrada. */
            404: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Pagamento já revisado ou aprovação inválida. */
            409: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Limite de requisições excedido. */
            429: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Erro interno inesperado. */
            500: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
        };
    };
    BillingController_getPaymentProof: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                invoiceId: string;
                paymentId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PaymentProofUrlResponseDto"];
                };
            };
            /** @description Requisição inválida. */
            400: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Token ausente, inválido ou expirado. */
            401: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Papel sem permissão para a operação. */
            403: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Fatura, pagamento ou comprovante não encontrado. */
            404: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Limite de requisições excedido. */
            429: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Erro interno inesperado. */
            500: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
        };
    };
    BillingController_rejectPayment: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                invoiceId: string;
                paymentId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RejectPaymentDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["InvoiceResponseDto"];
                };
            };
            /** @description Requisição inválida. */
            400: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Token ausente, inválido ou expirado. */
            401: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Papel sem permissão para a operação. */
            403: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Fatura não encontrada. */
            404: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Pagamento já revisado ou rejeição inválida. */
            409: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Regra de negócio ou valor de domínio inválido. */
            422: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Limite de requisições excedido. */
            429: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Erro interno inesperado. */
            500: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
        };
    };
    BillingController_exportCsv: {
        parameters: {
            query?: {
                competence?: string;
                contractId?: string;
                dueFrom?: string;
                dueTo?: string;
                limit?: number;
                page?: number;
                paymentMethod?: components["schemas"]["PaymentMethod"];
                paymentStatus?: components["schemas"]["PaymentStatus"];
                propertyUnitId?: string;
                /** @description Busca por fatura, contrato, locatário, CPF, e-mail, bairro ou unidade. */
                q?: string;
                status?: components["schemas"]["InvoiceStatus"];
                tenantId?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Arquivo CSV UTF-8 com as faturas que atendem aos filtros. */
            200: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "text/csv": string;
                };
            };
            /** @description Requisição inválida. */
            400: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Token ausente, inválido ou expirado. */
            401: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Papel sem permissão para a operação. */
            403: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Limite de requisições excedido. */
            429: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Erro interno inesperado. */
            500: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
        };
    };
    MetricsController_metrics: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Requisição inválida. */
            400: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Limite de requisições excedido. */
            429: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Erro interno inesperado. */
            500: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
        };
    };
    NotificationController_list: {
        parameters: {
            query?: {
                limit?: number;
                page?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PaginatedNotificationsResponseDto"];
                };
            };
            /** @description Requisição inválida. */
            400: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Token ausente, inválido ou expirado. */
            401: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Papel sem permissão para a operação. */
            403: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Limite de requisições excedido. */
            429: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Erro interno inesperado. */
            500: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
        };
    };
    NotificationController_markRead: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotificationResponseDto"];
                };
            };
            /** @description Requisição inválida. */
            400: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Token ausente, inválido ou expirado. */
            401: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Papel sem permissão para a operação. */
            403: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Notificação não encontrada. */
            404: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Limite de requisições excedido. */
            429: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Erro interno inesperado. */
            500: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
        };
    };
    NotificationController_markAllRead: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            204: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Requisição inválida. */
            400: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Token ausente, inválido ou expirado. */
            401: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Papel sem permissão para a operação. */
            403: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Limite de requisições excedido. */
            429: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Erro interno inesperado. */
            500: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
        };
    };
    PaymentReviewController_list: {
        parameters: {
            query?: {
                competence?: string;
                limit?: number;
                method?: components["schemas"]["PaymentMethod"];
                page?: number;
                propertyUnitId?: string;
                /** @description Busca por fatura, contrato, locatário, CPF, bairro ou unidade. */
                q?: string;
                submittedFrom?: string;
                submittedTo?: string;
                tenantId?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PaginatedPaymentReviewResponseDto"];
                };
            };
            /** @description Requisição inválida. */
            400: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Token ausente, inválido ou expirado. */
            401: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Papel sem permissão para a operação. */
            403: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Limite de requisições excedido. */
            429: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Erro interno inesperado. */
            500: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
        };
    };
    PropertyController_list: {
        parameters: {
            query?: {
                buildingId?: string;
                limit?: number;
                page?: number;
                /** @description Busca parcial por bairro ou número da unidade. */
                q?: string;
                type?: components["schemas"]["UnitType"];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PaginatedPropertiesResponseDto"];
                };
            };
            /** @description Requisição inválida. */
            400: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Token ausente, inválido ou expirado. */
            401: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Papel sem permissão para a operação. */
            403: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Limite de requisições excedido. */
            429: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Erro interno inesperado. */
            500: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
        };
    };
    PropertyController_create: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreatePropertyDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PropertyResponseDto"];
                };
            };
            /** @description Requisição inválida. */
            400: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Token ausente, inválido ou expirado. */
            401: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Papel sem permissão para a operação. */
            403: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Já existe uma unidade com este número no mesmo prédio ou bairro. */
            409: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Regra de negócio ou valor de domínio inválido. */
            422: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Limite de requisições excedido. */
            429: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Erro interno inesperado. */
            500: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
        };
    };
    PropertyController_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PropertyResponseDto"];
                };
            };
            /** @description Requisição inválida. */
            400: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Token ausente, inválido ou expirado. */
            401: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Papel sem permissão para a operação. */
            403: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Unidade imobiliária não encontrada. */
            404: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Limite de requisições excedido. */
            429: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Erro interno inesperado. */
            500: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
        };
    };
    PropertyController_update: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdatePropertyDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PropertyResponseDto"];
                };
            };
            /** @description Requisição inválida. */
            400: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Token ausente, inválido ou expirado. */
            401: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Papel sem permissão para a operação. */
            403: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Unidade imobiliária não encontrada. */
            404: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Já existe uma unidade com este número no mesmo prédio ou bairro. */
            409: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Regra de negócio ou valor de domínio inválido. */
            422: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Limite de requisições excedido. */
            429: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Erro interno inesperado. */
            500: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
        };
    };
    TenantController_findAll: {
        parameters: {
            query?: {
                civilStatus?: components["schemas"]["TenantCivilStatus"];
                limit?: number;
                page?: number;
                /** @description Busca parcial por nome, CPF, profissão, e-mail ou telefone. */
                q?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PaginatedTenantResponseDto"];
                };
            };
            /** @description Requisição inválida. */
            400: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Token ausente, inválido ou expirado. */
            401: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Papel sem permissão para a operação. */
            403: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Limite de requisições excedido. */
            429: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Erro interno inesperado. */
            500: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
        };
    };
    TenantController_create: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateTenantDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TenantResponseDto"];
                };
            };
            /** @description Requisição inválida. */
            400: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Token ausente, inválido ou expirado. */
            401: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Papel sem permissão para a operação. */
            403: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description CPF ou e-mail já cadastrado. */
            409: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Regra de negócio ou valor de domínio inválido. */
            422: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Limite de requisições excedido. */
            429: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Erro interno inesperado. */
            500: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
        };
    };
    TenantController_findById: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TenantResponseDto"];
                };
            };
            /** @description Requisição inválida. */
            400: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Token ausente, inválido ou expirado. */
            401: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Papel sem permissão para a operação. */
            403: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Locatário não encontrado. */
            404: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Limite de requisições excedido. */
            429: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Erro interno inesperado. */
            500: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
        };
    };
    TenantController_update: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateTenantDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TenantResponseDto"];
                };
            };
            /** @description Requisição inválida. */
            400: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Token ausente, inválido ou expirado. */
            401: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Papel sem permissão para a operação. */
            403: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Locatário não encontrado. */
            404: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Já existe um locatário com este e-mail ou telefone. */
            409: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Regra de negócio ou valor de domínio inválido. */
            422: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Limite de requisições excedido. */
            429: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
            /** @description Erro interno inesperado. */
            500: {
                headers: {
                    /** @description Identificador de correlação da requisição. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetailsDto"];
                };
            };
        };
    };
}
