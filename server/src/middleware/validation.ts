import { RequestHandler } from 'express';
import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { sanitize } from 'class-sanitizer';
import HttpException from '../exception/HttpException';

/**
 * 只校验 req.body
 * 使用 req.query 或 req.params 时无法用 DTO 校验，
 * 因为 req.query 中的数据都是字符串。
 * @param type
 * @param skipMissingProperties
 * @returns
 */
export const dtoValidationMiddleware = (
  type: any,
  skipMissingProperties = false
): RequestHandler => {
  return (req, res, next) => {
    const dtoObj = plainToInstance(type, req.body);
    validate(dtoObj, { skipMissingProperties }).then(
      (errors: ValidationError[]) => {
        if (errors.length > 0) {
          const dtoErrors = errors
            .map((error: ValidationError) =>
              (Object as any).values(error.constraints)
            )
            .join(', ');
          next(new HttpException(400, dtoErrors));
        } else {
          // 清洗对象并调用下一个中间件
          sanitize(dtoObj);
          req.body = dtoObj;
          next();
        }
      }
    );
  };
};
