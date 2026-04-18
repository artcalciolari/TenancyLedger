import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

export enum UnitType {
  KITNET = 'Kitnet',
  ROOM = 'Room',
  APARTMENT = 'Apartment',
}

@Entity('property_units')
export class PropertyUnit
{
  @PrimaryGeneratedColumn('uuid')
  readonly id!: string;

  @Column()
  private _neighborhood!: string;

  @Column({ type: 'enum', enum: UnitType })
  private _type!: UnitType;

  @Column()
  private _unitNumber!: string;

  private constructor() {}

  static create(neighborhood: string, type: UnitType, unitNumber: string): PropertyUnit
  {
    const unit = new PropertyUnit();
    unit._neighborhood = neighborhood;
    unit._type = type;
    unit._unitNumber = unitNumber;
    return unit;
  }
}
