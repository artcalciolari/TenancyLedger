import type { Room } from './room.entity';
import type { Building } from './building.entity';

export function describeRoom(room: Room, building: Building): string {
  return `Quarto ${room.number} — ${building.name}, ${building.neighborhood}`;
}
