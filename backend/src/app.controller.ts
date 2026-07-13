import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';
import { Public } from './contexts/auth/infrastructure/security/public.decorator';
import { AppInfoResponseDto } from './core/infrastructure/http/openapi.dto';

@Public()
@ApiTags('App')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Consultar informações básicas da API' })
  @ApiOkResponse({ type: AppInfoResponseDto })
  getInfo(): ReturnType<AppService['getInfo']> {
    return this.appService.getInfo();
  }
}
