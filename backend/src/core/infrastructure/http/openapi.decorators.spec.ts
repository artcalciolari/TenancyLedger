import { ApiConflictProblem, ApiNotFoundProblem } from './openapi.decorators';

describe('OpenAPI problem decorators', () => {
  it('provides default descriptions', () => {
    expect(ApiNotFoundProblem()).toEqual(expect.any(Function));
    expect(ApiConflictProblem()).toEqual(expect.any(Function));
  });
});
