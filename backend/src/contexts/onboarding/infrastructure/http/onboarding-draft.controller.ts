import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../../auth/application/auth.service';
import { UserRole } from '../../../auth/domain/entities/user.entity';
import { CurrentUser } from '../../../auth/infrastructure/security/current-user.decorator';
import { Roles } from '../../../auth/infrastructure/security/roles.decorator';
import {
  ApiConflictProblem,
  ApiNotFoundProblem,
  ApiProtected,
  ApiUnprocessableProblem,
} from '../../../../core/infrastructure/http/openapi.decorators';
import { OnboardingDraftService } from '../../application/onboarding-draft.service';
import { CompleteOnboardingService } from '../../application/complete-onboarding.service';
import {
  CompleteOnboardingResponseDto,
  OnboardingDraftPaginationDto,
  OnboardingDraftPhotoUrlResponseDto,
  OnboardingDraftResponseDto,
  PaginatedOnboardingDraftsResponseDto,
  SaveOnboardingDraftDto,
} from './onboarding-draft.dto';

@ApiTags('Rascunhos de onboarding')
@ApiProtected()
@Roles(UserRole.ADMIN, UserRole.MANAGER)
@Controller('onboarding-drafts')
export class OnboardingDraftController {
  constructor(
    private readonly drafts: OnboardingDraftService,
    private readonly completion: CompleteOnboardingService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Criar rascunho de onboarding' })
  @ApiCreatedResponse({ type: OnboardingDraftResponseDto })
  @ApiUnprocessableProblem('O payload deve ser JSON válido com no máximo 64 KiB.')
  async create(
    @Body() dto: SaveOnboardingDraftDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OnboardingDraftResponseDto> {
    return OnboardingDraftResponseDto.from(await this.drafts.create(dto.payload, user.id));
  }

  @Get()
  @ApiOperation({ summary: 'Listar rascunhos acessíveis ao usuário autenticado' })
  @ApiOkResponse({ type: PaginatedOnboardingDraftsResponseDto })
  async list(
    @Query() query: OnboardingDraftPaginationDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaginatedOnboardingDraftsResponseDto> {
    const result = await this.drafts.list(user.id, user.role === UserRole.ADMIN, query);
    return {
      ...result,
      data: result.data.map((draft) => OnboardingDraftResponseDto.from(draft)),
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar rascunho de onboarding' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: OnboardingDraftResponseDto })
  @ApiNotFoundProblem('Rascunho não encontrado ou não acessível.')
  async get(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OnboardingDraftResponseDto> {
    return OnboardingDraftResponseDto.from(
      await this.drafts.get(id, user.id, user.role === UserRole.ADMIN),
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar o payload de um rascunho' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: OnboardingDraftResponseDto })
  @ApiNotFoundProblem('Rascunho não encontrado ou não acessível.')
  @ApiConflictProblem('O rascunho não está mais editável.')
  @ApiUnprocessableProblem('O payload deve ser JSON válido com no máximo 64 KiB.')
  async update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: SaveOnboardingDraftDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OnboardingDraftResponseDto> {
    return OnboardingDraftResponseDto.from(
      await this.drafts.update(id, dto.payload, user.id, user.role === UserRole.ADMIN),
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Descartar rascunho de onboarding' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  @ApiNotFoundProblem('Rascunho não encontrado ou não acessível.')
  @ApiConflictProblem('Um rascunho concluído não pode ser descartado.')
  async discard(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.drafts.discard(id, user.id, user.role === UserRole.ADMIN);
  }

  @Post(':id/photo')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Enviar ou substituir a foto temporária do rascunho' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['photo'],
      properties: {
        photo: {
          type: 'string',
          format: 'binary',
          description: 'JPEG, PNG ou HEIC/HEIF; até 10 MiB.',
        },
      },
    },
  })
  @ApiNoContentResponse()
  @ApiNotFoundProblem('Rascunho não encontrado ou não acessível.')
  @ApiConflictProblem('O rascunho não está mais editável.')
  @ApiUnprocessableProblem()
  @UseInterceptors(
    FileInterceptor('photo', {
      limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 2 },
    }),
  )
  async uploadPhoto(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() photo?: Express.Multer.File,
  ): Promise<void> {
    if (!photo) throw new BadRequestException('A foto do rascunho é obrigatória.');
    await this.drafts.uploadPhoto(id, user.id, user.role === UserRole.ADMIN, {
      contentType: photo.mimetype,
      body: photo.buffer,
    });
  }

  @Delete(':id/photo')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remover a foto temporária do rascunho' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  @ApiNotFoundProblem('Rascunho não encontrado ou não acessível.')
  @ApiConflictProblem('O rascunho não está mais editável.')
  async removePhoto(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.drafts.removePhoto(id, user.id, user.role === UserRole.ADMIN);
  }

  @Get(':id/photo/download')
  @ApiOperation({ summary: 'Gerar URL temporária para baixar a foto do rascunho' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: OnboardingDraftPhotoUrlResponseDto })
  @ApiNotFoundProblem('Rascunho ou foto não encontrado.')
  getPhotoDownloadUrl(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OnboardingDraftPhotoUrlResponseDto> {
    return this.drafts.getPhotoDownloadUrl(id, user.id, user.role === UserRole.ADMIN);
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Concluir onboarding e criar locatário, contrato e primeira fatura' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: CompleteOnboardingResponseDto })
  @ApiNotFoundProblem('Rascunho ou unidade imobiliária não encontrado.')
  @ApiConflictProblem('Rascunho já concluído, cadastro duplicado ou unidade ocupada.')
  @ApiUnprocessableProblem('O payload salvo está incompleto ou inválido.')
  complete(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CompleteOnboardingResponseDto> {
    return this.completion.complete(id, user.id, user.role === UserRole.ADMIN);
  }
}
