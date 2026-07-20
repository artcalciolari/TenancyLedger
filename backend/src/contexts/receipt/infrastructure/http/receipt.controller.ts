import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { UserRole } from '../../../auth/domain/entities/user.entity';
import { Roles } from '../../../auth/infrastructure/security/roles.decorator';
import {
  ApiNotFoundProblem,
  ApiProtected,
} from '../../../../core/infrastructure/http/openapi.decorators';
import { ReceiptService } from '../../application/receipt.service';
import { ReceiptDownloadUrlDto, ReceiptResponseDto } from './receipt.dto';

@ApiTags('Recibos')
@ApiProtected()
@Roles(UserRole.ADMIN, UserRole.MANAGER)
@Controller('receipts')
export class ReceiptController {
  constructor(private readonly receipts: ReceiptService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Consultar recibo' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ReceiptResponseDto })
  @ApiNotFoundProblem('Recibo não encontrado.')
  async get(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<ReceiptResponseDto> {
    return ReceiptResponseDto.from(await this.receipts.get(id));
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Gerar URL temporária para baixar o recibo' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ReceiptDownloadUrlDto })
  @ApiNotFoundProblem('Recibo não encontrado.')
  download(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<ReceiptDownloadUrlDto> {
    return this.receipts.getDownloadUrl(id);
  }
}
