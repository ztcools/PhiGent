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
const flattenValidationErrors = (errors: ValidationError[]): string[] => {
  return errors.flatMap(error => {
    const messages = Object.values(error.constraints || {});
    const childMessages = error.children?.length
      ? flattenValidationErrors(error.children)
      : [];
    return [...messages, ...childMessages];
  });
};

export const dtoValidationMiddleware = (
  type: any,
  skipMissingProperties = false
): RequestHandler => {
  return async (req, res, next) => {
    try {
      const dtoObj = plainToInstance(type, req.body);
      const errors = await validate(dtoObj, { skipMissingProperties });

      if (errors.length > 0) {
        const dtoErrors = flattenValidationErrors(errors).join(', ');
        return next(new HttpException(400, dtoErrors));
      }

      // 清洗对象并调用下一个中间件
      sanitize(dtoObj);
      req.body = dtoObj;
      next();
    } catch (error) {
      next(error);
    }
  };
};
