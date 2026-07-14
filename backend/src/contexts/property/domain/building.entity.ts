import { Check, Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { ValidationError } from '../../../core/domain/errors/validation.error';

@Entity('buildings')
@Index('UQ_buildings_name_ci', { synchronize: false })
@Check('CHK_buildings_name_not_blank', 'char_length(trim(name)) BETWEEN 1 AND 120')
@Check(
  'CHK_buildings_neighborhood_not_blank',
  'char_length(trim(neighborhood)) BETWEEN 1 AND 120',
)
@Check(
  'CHK_buildings_address_not_blank',
  'address IS NULL OR char_length(trim(address)) BETWEEN 1 AND 200',
)
export class Building {
  @PrimaryGeneratedColumn('uuid')
  readonly id!: string;

  @Column({ name: 'name', type: 'varchar', length: 120 })
  private _name!: string;

  @Column({ name: 'neighborhood', type: 'varchar', length: 120 })
  private _neighborhood!: string;

  @Column({ name: 'address', type: 'varchar', length: 200, nullable: true })
  private _address!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  readonly createdAt!: Date;

  private constructor() {}

  static create(name: string, neighborhood: string, address?: string | null): Building {
    const normalizedName = Building.requiredText(name, 'nome do prédio', 120);
    const normalizedNeighborhood = Building.requiredText(neighborhood, 'bairro', 120);
    const normalizedAddress = Building.optionalText(address, 'endereço', 200);

    const building = new Building();
    building._name = normalizedName;
    building._neighborhood = normalizedNeighborhood;
    building._address = normalizedAddress;
    return building;
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

  private static optionalText(
    value: string | null | undefined,
    field: string,
    maxLength: number,
  ): string | null {
    if (value === undefined || value === null) return null;
    const normalized = value.trim().replace(/\s+/g, ' ');
    if (!normalized) return null;
    if (normalized.length > maxLength) {
      throw new ValidationError(`O ${field} deve ter no máximo ${maxLength} caracteres.`);
    }
    return normalized;
  }

  get name(): string {
    return this._name;
  }
  get neighborhood(): string {
    return this._neighborhood;
  }
  get address(): string | null {
    return this._address;
  }
}
