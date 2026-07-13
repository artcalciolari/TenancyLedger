// This file runs before AppModule is evaluated. The E2E suite invokes the
// invoice worker explicitly and must never register its background cron job.
process.env.NODE_ENV = 'test';
process.env.INVOICE_CRON_ENABLED = 'false';
process.env.LOG_LEVEL ??= 'silent';
process.env.SWAGGER_ENABLED ??= 'false';
