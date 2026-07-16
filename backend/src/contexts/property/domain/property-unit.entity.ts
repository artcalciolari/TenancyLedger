import { Check, Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { ValidationError } from '../../../core/domain/errors/validation.error';

export interface UpdatePropertyUnitFields {
  neighborhood?: string;
  type?: UnitType;
  unitNumber?: string;
}

export enum UnitType {
  KITNET = 'KITNET',
  ROOM = 'ROOM',
  APARTMENT = 'APARTMENT',
  HOUSE = 'HOUSE',
  COMMERCIAL = 'COMMERCIAL',
}

@Entity('property_units')
@Index('UQ_property_units_building_unit_ci', { synchronize: false })
@Index('UQ_property_units_location_ci', { synchronize: false })
@Check('CHK_property_units_neighborhood_not_blank', 'char_length(trim(neighborhood)) > 0')
@Check('CHK_property_units_unit_number_not_blank', 'char_length(trim(unit_number)) > 0')
export class PropertyUnit {
  @PrimaryGeneratedColumn('uuid')
  readonly id!: string;

  @Column({ name: 'neighborhood', type: 'varchar', length: 120 })
  private _neighborhood!: string;

  @Column({ name: 'type', type: 'enum', enum: UnitType, enumName: 'property_unit_type' })
  private _type!: UnitType;

  @Column({ name: 'unit_number', type: 'varchar', length: 40 })
  private _unitNumber!: string;

  @Column({ name: 'building_id', type: 'uuid', nullable: true })
  private _buildingId!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  readonly createdAt!: Date;

  private constructor() {}

  static create(
    neighborhood: string,
    type: UnitType,
    unitNumber: string,
    buildingId?: string | null,
  ): PropertyUnit {
    const normalizedNeighborhood = PropertyUnit.requiredText(neighborhood, 'bairro', 120);
    const normalizedUnitNumber = PropertyUnit.requiredText(unitNumber, 'número da unidade', 40);
    if (!Object.values(UnitType).includes(type)) {
      throw new ValidationError('O tipo da unidade é inválido.');
    }

    const unit = new PropertyUnit();
    unit._neighborhood = normalizedNeighborhood;
    unit._type = type;
    unit._unitNumber = normalizedUnitNumber;
    unit._buildingId = buildingId ?? null;
    return unit;
  }

  update(fields: UpdatePropertyUnitFields): void {
    if (fields.neighborhood !== undefined) {
      this._neighborhood = PropertyUnit.requiredText(fields.neighborhood, 'bairro', 120);
    }
    if (fields.unitNumber !== undefined) {
      this._unitNumber = PropertyUnit.requiredText(fields.unitNumber, 'número da unidade', 40);
    }
    if (fields.type !== undefined) {
      if (!Object.values(UnitType).includes(fields.type)) {
        throw new ValidationError('O tipo da unidade é inválido.');
      }
      this._type = fields.type;
    }
  }

  private static requiredText(value: string, field: string, maxLength: number): string {
    const normalized = value?.trim().replace(/\s+/g, ' ');
    if (!normalized) {
      throw new ValidationError(`O ${field} é obrigatório.`);
    }
    if (normalized.length > maxLength) {
      throw new ValidationError(`O ${field} deve ter no máximo ${maxLength} caracteres.`);
    }
    return normalized;
  }

  get neighborhood(): string {
    return this._neighborhood;
  }
  get type(): UnitType {
    return this._type;
  }
  get unitNumber(): string {
    return this._unitNumber;
  }
  get buildingId(): string | null {
    return this._buildingId;
  }
}
