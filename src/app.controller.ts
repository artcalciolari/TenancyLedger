import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './contexts/auth/infrastructure/security/public.decorator';

@Public()
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getInfo(): ReturnType<AppService['getInfo']> {
    return this.appService.getInfo();
  }
}
