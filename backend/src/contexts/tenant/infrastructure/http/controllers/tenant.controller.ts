import {
  BadRequestException,
  Controller,
  Post,
  Body,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Query,
  NotFoundException,
  Patch,
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
import { CreateTenantUseCase } from '../../../application/use-cases/create-tenant.use-case';
import { TenantQueries } from '../../../application/queries/tenant.queries';
import { UserRole } from '../../../../auth/domain/entities/user.entity';
import { Roles } from '../../../../auth/infrastructure/security/roles.decorator';
import { CurrentUser } from '../../../../auth/infrastructure/security/current-user.decorator';
import type { AuthenticatedUser } from '../../../../auth/application/auth.service';
import { CreateTenantDto } from '../dtos/create-tenant.dto';
import { UpdateTenantDto } from '../dtos/update-tenant.dto';
import { PaginationDto } from '../dtos/pagination.dto';
import {
  PaginatedTenantResponseDto,
  TenantResponseDto,
  toPaginatedTenantResponse,
} from '../dtos/tenant-response.dto';
import {
  ApiConflictProblem,
  ApiNotFoundProblem,
  ApiProtected,
  ApiUnprocessableProblem,
} from '../../../../../core/infrastructure/http/openapi.decorators';
import { UpdateTenantUseCase } from '../../../application/use-cases/update-tenant.use-case';
import { TenantPhotoUseCase } from '../../../application/use-cases/tenant-photo.use-case';
import { TenantReferencesUseCase } from '../../../application/use-cases/tenant-references.use-case';
import {
  CreateTenantReferenceDto,
  TenantPhotoUrlResponseDto,
  TenantReferenceResponseDto,
  UpdateTenantReferenceDto,
} from '../dtos/tenant-reference.dto';

@Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER)
@ApiProtected()
@ApiTags('Locatários')
@Controller('tenants')
export class TenantController {
  constructor(
    private readonly createTenantUseCase: CreateTenantUseCase,
    private readonly updateTenantUseCase: UpdateTenantUseCase,
    private readonly tenantQueries: TenantQueries,
    private readonly tenantPhoto: TenantPhotoUseCase,
    private readonly tenantReferences: TenantReferencesUseCase,
  ) {}

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Post()
  @ApiOperation({ summary: 'Cadastrar locatário' })
  @ApiCreatedResponse({ type: TenantResponseDto })
  @ApiConflictProblem('CPF ou e-mail já cadastrado.')
  @ApiUnprocessableProblem()
  async create(
    @Body() dto: CreateTenantDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TenantResponseDto> {
    const tenant = await this.createTenantUseCase.execute(dto);
    return TenantResponseDto.from(tenant, user.role);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Patch(':id')
  @ApiOperation({ summary: 'Editar locatário' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: TenantResponseDto })
  @ApiNotFoundProblem('Locatário não encontrado.')
  @ApiConflictProblem('Já existe um locatário com este e-mail ou telefone.')
  @ApiUnprocessableProblem()
  async update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateTenantDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TenantResponseDto> {
    return TenantResponseDto.from(await this.updateTenantUseCase.execute(id, dto), user.role);
  }

  @Get()
  @ApiOperation({ summary: 'Listar locatários' })
  @ApiOkResponse({ type: PaginatedTenantResponseDto })
  async findAll(
    @Query() query: PaginationDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaginatedTenantResponseDto> {
    return toPaginatedTenantResponse(await this.tenantQueries.findAll(query), user.role);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar locatário' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: TenantResponseDto })
  @ApiNotFoundProblem('Locatário não encontrado.')
  async findById(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TenantResponseDto> {
    const tenant = await this.tenantQueries.findById(id);
    if (!tenant) {
      throw new NotFoundException('Inquilino não encontrado.');
    }
    return TenantResponseDto.from(tenant, user.role);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Post(':id/photo')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cadastrar ou substituir a foto do locatário' })
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
  @ApiNotFoundProblem('Locatário não encontrado.')
  @ApiUnprocessableProblem()
  @UseInterceptors(
    FileInterceptor('photo', {
      limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 2 },
    }),
  )
  async uploadPhoto(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @UploadedFile() photo?: Express.Multer.File,
  ): Promise<void> {
    if (!photo) throw new BadRequestException('A foto do locatário é obrigatória.');
    await this.tenantPhoto.upload(id, { contentType: photo.mimetype, body: photo.buffer });
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Get(':id/photo/download')
  @ApiOperation({ summary: 'Gerar URL temporária para baixar a foto do locatário' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: TenantPhotoUrlResponseDto })
  @ApiNotFoundProblem('Locatário ou foto não encontrado.')
  getPhotoDownloadUrl(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<TenantPhotoUrlResponseDto> {
    return this.tenantPhoto.getDownloadUrl(id);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Post(':tenantId/references')
  @ApiOperation({ summary: 'Cadastrar referência do locatário' })
  @ApiParam({ name: 'tenantId', format: 'uuid' })
  @ApiCreatedResponse({ type: TenantReferenceResponseDto })
  @ApiNotFoundProblem('Locatário não encontrado.')
  @ApiUnprocessableProblem()
  async createReference(
    @Param('tenantId', new ParseUUIDPipe({ version: '4' })) tenantId: string,
    @Body() dto: CreateTenantReferenceDto,
  ): Promise<TenantReferenceResponseDto> {
    return TenantReferenceResponseDto.from(await this.tenantReferences.create(tenantId, dto));
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Get(':tenantId/references')
  @ApiOperation({ summary: 'Listar referências do locatário' })
  @ApiParam({ name: 'tenantId', format: 'uuid' })
  @ApiOkResponse({ type: [TenantReferenceResponseDto] })
  @ApiNotFoundProblem('Locatário não encontrado.')
  async listReferences(
    @Param('tenantId', new ParseUUIDPipe({ version: '4' })) tenantId: string,
  ): Promise<TenantReferenceResponseDto[]> {
    return (await this.tenantReferences.list(tenantId)).map((reference) =>
      TenantReferenceResponseDto.from(reference),
    );
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Get(':tenantId/references/:referenceId')
  @ApiOperation({ summary: 'Consultar referência do locatário' })
  @ApiParam({ name: 'tenantId', format: 'uuid' })
  @ApiParam({ name: 'referenceId', format: 'uuid' })
  @ApiOkResponse({ type: TenantReferenceResponseDto })
  @ApiNotFoundProblem('Referência do locatário não encontrada.')
  async getReference(
    @Param('tenantId', new ParseUUIDPipe({ version: '4' })) tenantId: string,
    @Param('referenceId', new ParseUUIDPipe({ version: '4' })) referenceId: string,
  ): Promise<TenantReferenceResponseDto> {
    return TenantReferenceResponseDto.from(await this.tenantReferences.get(tenantId, referenceId));
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Patch(':tenantId/references/:referenceId')
  @ApiOperation({ summary: 'Editar referência do locatário' })
  @ApiParam({ name: 'tenantId', format: 'uuid' })
  @ApiParam({ name: 'referenceId', format: 'uuid' })
  @ApiOkResponse({ type: TenantReferenceResponseDto })
  @ApiNotFoundProblem('Referência do locatário não encontrada.')
  @ApiUnprocessableProblem()
  async updateReference(
    @Param('tenantId', new ParseUUIDPipe({ version: '4' })) tenantId: string,
    @Param('referenceId', new ParseUUIDPipe({ version: '4' })) referenceId: string,
    @Body() dto: UpdateTenantReferenceDto,
  ): Promise<TenantReferenceResponseDto> {
    return TenantReferenceResponseDto.from(
      await this.tenantReferences.update(tenantId, referenceId, dto),
    );
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Delete(':tenantId/references/:referenceId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Excluir referência do locatário' })
  @ApiParam({ name: 'tenantId', format: 'uuid' })
  @ApiParam({ name: 'referenceId', format: 'uuid' })
  @ApiNoContentResponse()
  @ApiNotFoundProblem('Referência do locatário não encontrada.')
  async deleteReference(
    @Param('tenantId', new ParseUUIDPipe({ version: '4' })) tenantId: string,
    @Param('referenceId', new ParseUUIDPipe({ version: '4' })) referenceId: string,
  ): Promise<void> {
    await this.tenantReferences.remove(tenantId, referenceId);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Patch(':tenantId/references/:referenceId/verify')
  @ApiOperation({ summary: 'Marcar referência do locatário como verificada' })
  @ApiParam({ name: 'tenantId', format: 'uuid' })
  @ApiParam({ name: 'referenceId', format: 'uuid' })
  @ApiOkResponse({ type: TenantReferenceResponseDto })
  @ApiNotFoundProblem('Referência do locatário não encontrada.')
  async verifyReference(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tenantId', new ParseUUIDPipe({ version: '4' })) tenantId: string,
    @Param('referenceId', new ParseUUIDPipe({ version: '4' })) referenceId: string,
  ): Promise<TenantReferenceResponseDto> {
    return TenantReferenceResponseDto.from(
      await this.tenantReferences.verify(tenantId, referenceId, user.id),
    );
  }
}
