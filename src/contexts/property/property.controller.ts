import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { UnitType } from './domain/property-unit.entity';
import { PropertyService } from './property.service';
import type { PaginatedPropertiesView, PropertyView } from './property.service';
import { UserRole } from '../auth/domain/entities/user.entity';
import { Roles } from '../auth/infrastructure/security/roles.decorator';

export class CreatePropertyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  neighborhood!: string;

  @IsEnum(UnitType)
  type!: UnitType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  unitNumber!: string;
}

export class PropertyPaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}

@Controller('properties')
export class PropertyController {
  constructor(private readonly service: PropertyService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async create(@Body() dto: CreatePropertyDto): Promise<PropertyView> {
    return PropertyService.toView(await this.service.create(dto));
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER)
  list(@Query() query: PropertyPaginationDto): Promise<PaginatedPropertiesView> {
    return this.service.list(query.page, query.limit);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER)
  async get(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<PropertyView> {
    return PropertyService.toView(await this.service.getById(id));
  }
}
