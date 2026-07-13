import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getInfo(): {
    name: 'Tenancy Ledger API';
    status: 'ok';
    documentation: '/docs';
  } {
    return {
      name: 'Tenancy Ledger API',
      status: 'ok',
      documentation: '/docs',
    };
  }
}
