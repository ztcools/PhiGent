import { IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { dtoValidationMiddleware } from './validation';

class ChildDto {
  @IsString()
  name!: string;
}

class ParentDto {
  @ValidateNested()
  @Type(() => ChildDto)
  child!: ChildDto;
}

describe('dtoValidationMiddleware', () => {
  it('forwards nested validation errors instead of throwing constraints errors', async () => {
    const middleware = dtoValidationMiddleware(ParentDto);
    const req = { body: { child: { name: 1 } } } as any;
    const res = {} as any;
    const next = jest.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = next.mock.calls[0][0];
    expect(error).toBeTruthy();
    expect(error.statusCode).toBe(400);
    expect(error.message).toContain('name must be a string');
  });

  it('sanitizes valid dto and replaces request body', async () => {
    const middleware = dtoValidationMiddleware(ParentDto);
    const req = { body: { child: { name: 'ok' } } } as any;
    const res = {} as any;
    const next = jest.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.body).toBeInstanceOf(ParentDto);
  });
});
