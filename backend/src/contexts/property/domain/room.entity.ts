import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  ForeignKey,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ValidationError } from '../../../core/domain/errors/validation.error';

export interface UpdateRoomFields {
  number?: string;
}

@Entity('rooms')
@Index('UQ_rooms_building_number_ci', { synchronize: false })
@Check('CHK_rooms_number_not_blank', 'char_length(trim(number)) > 0')
export class Room {
  @PrimaryGeneratedColumn('uuid')
  readonly id!: string;

  @Column({ name: 'building_id', type: 'uuid' })
  @ForeignKey('Building', {
    name: 'FK_rooms_building',
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT',
  })
  private _buildingId!: string;

  @Column({ name: 'number', type: 'varchar', length: 40 })
  private _number!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  readonly createdAt!: Date;

  private constructor() {}

  static create(buildingId: string, number: string): Room {
    const room = new Room();
    room._buildingId = Room.requiredBuildingId(buildingId);
    room._number = Room.requiredText(number, 'número do quarto', 40);
    return room;
  }

  update(fields: UpdateRoomFields): void {
    if (fields.number !== undefined) {
      this._number = Room.requiredText(fields.number, 'número do quarto', 40);
    }
  }

  private static requiredBuildingId(value: string): string {
    if (!value || !value.trim()) {
      throw new ValidationError('O prédio é obrigatório.');
    }
    return value;
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

  get buildingId(): string {
    return this._buildingId;
  }
  get number(): string {
    return this._number;
  }
}
