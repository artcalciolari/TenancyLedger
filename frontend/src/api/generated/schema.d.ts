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
        patch?: never;
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
        patch?: never;
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
        ChangePasswordDto: {
            /** Format: password */
            currentPassword: string;
            /**
             * Format: password
             * @description Deve conter minúscula, maiúscula, número e símbolo.
             */
            newPassword: string;
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
            /** Format: uuid */
            propertyUnitId: string;
            status: components["schemas"]["ContractStatus"];
            /** Format: uuid */
            tenantId: string;
            /** Format: date-time */
            updatedAt: string;
        };
        /** @enum {string} */
        ContractStatus: "ACTIVE" | "EXPIRED" | "TERMINATED";
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
            /** @example Centro */
            neighborhood: string;
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
        InvoiceResponseDto: {
            /** @example 50000 */
            approvedAmountCents: number;
            /** @example 2026-07 */
            competence: string;
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
        PaginatedContractsResponseDto: {
            data: components["schemas"]["ContractResponseDto"][];
            meta: components["schemas"]["PageMetaDto"];
        };
        PaginatedInvoicesResponseDto: {
            data: components["schemas"]["InvoiceResponseDto"][];
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
            status: components["schemas"]["PaymentStatus"];
            /** Format: date-time */
            submittedAt: string;
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
            /** Format: date-time */
            createdAt: string;
            /** Format: uuid */
            id: string;
            /** @example Centro */
            neighborhood: string;
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
             * @description CPF mascarado.
             * @example ***.***.***-09
             */
            cpf: string;
            /**
             * @description E-mail mascarado.
             * @example l***@example.com
             */
            email: string;
            /** Format: uuid */
            id: string;
            /**
             * @description Telefone mascarado.
             * @example (**) *****-9999
             */
            mobilePhone: string;
            /** @example Engenheiro civil */
            profession: string;
        };
        /** @enum {string} */
        UnitType: "KITNET" | "ROOM" | "APARTMENT" | "HOUSE" | "COMMERCIAL";
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
    ContractController_list: {
        parameters: {
            query?: {
                limit?: number;
                page?: number;
                propertyUnitId?: string;
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
                limit?: number;
                page?: number;
                status?: components["schemas"]["InvoiceStatus"];
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
    PropertyController_list: {
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
            /** @description Já existe uma unidade com este bairro e número. */
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
    TenantController_findAll: {
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
}
