import { validate } from 'class-validator';
import { BuildingDetailQueryDto, BuildingPaginationDto } from './building.controller';
import { RoomPaginationDto } from './room.controller';

describe('property date query validation', () => {
  it.each([
    () => Object.assign(new RoomPaginationDto(), { date: '2026-07-20T12:00:00.000Z' }),
    () => Object.assign(new RoomPaginationDto(), { date: '2026-02-29' }),
    () => Object.assign(new BuildingPaginationDto(), { date: '2026-07-20T00:00:00Z' }),
    () => Object.assign(new BuildingDetailQueryDto(), { date: '2026-13-01' }),
  ])('rejects timestamps and invalid civil dates', async (query) => {
    await expect(validate(query())).resolves.not.toHaveLength(0);
  });

  it.each([
    () => Object.assign(new RoomPaginationDto(), { date: '2024-02-29' }),
    () => Object.assign(new BuildingPaginationDto(), { date: '2026-07-20' }),
    () => Object.assign(new BuildingDetailQueryDto(), { date: '2026-12-31' }),
  ])('accepts valid YYYY-MM-DD civil dates', async (query) => {
    await expect(validate(query())).resolves.toHaveLength(0);
  });
});
