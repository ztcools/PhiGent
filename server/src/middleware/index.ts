import { Request, Response, NextFunction } from 'express';
import morgan from 'morgan';
import chalk from 'chalk';
import {
  ATTU_DATABASE_HEADER,
  HTTP_STATUS_CODE,
  MAX_CLIENT_ID_LENGTH,
  MILVUS_CLIENT_ID,
} from '../utils';
import { HttpError } from 'http-errors';
import HttpErrors from 'http-errors';
import { clientCache } from '../app';

declare global {
  namespace Express {
    interface Request {
      clientId?: string;
      db_name?: string;
    }
  }
}

export const ReqHeaderMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // 所有 API 请求都需要在 Header 中设置 Milvus 地址。
  // server 会在 milvus service 中设置当前活跃地址。
  const milvusClientId = (req.headers[MILVUS_CLIENT_ID] as string) || '';
  req.clientId = req.headers[MILVUS_CLIENT_ID] as string;

  // 合并 Header 中的 database
  const database = req.headers[ATTU_DATABASE_HEADER] as string;
  if (database) {
    req.db_name = database;
  }

  const bypassURLs = [`/api/v1/milvus/connect`, `/api/v1/milvus/version`];
  const shouldBypass = bypassURLs.some(url => req.path.startsWith(url));

  if (milvusClientId.length > MAX_CLIENT_ID_LENGTH) {
    throw HttpErrors(HTTP_STATUS_CODE.BAD_REQUEST, 'Invalid client id.');
  }

  if (shouldBypass === false && milvusClientId && !clientCache.get(milvusClientId)) {
    throw HttpErrors(
      HTTP_STATUS_CODE.UNAUTHORIZED,
      'Can not find your connection, please reconnect.'
    );
  }
  next();
};

export const TransformResMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const oldSend = res.json;
  res.json = data => {
    const statusCode = data?.statusCode;
    const message = data?.message;
    const error = data?.error;
    res.json = oldSend; // 还原函数，避免重复发送响应
    if (statusCode || message || error) {
      return res.json({ statusCode, message, error });
    }
    return res.json({ data, statusCode: 200 }); // 按常规方式返回 data
  };
  next();
};

/**
 * 在此处处理错误。
 * 通常取决于 milvus service 返回的状态。
 */
const sanitizeErrorMessage = (message: string = '') => {
  return message
    .replace(/(password|token|authorization)([\s:=]+)[^\s,;]+/gi, '$1$2[REDACTED]')
    .replace(/Bearer\s+[^\s,;]+/gi, 'Bearer [REDACTED]');
};

export const ErrorMiddleware = (
  err: HttpError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let statusCode = err.statusCode || 500;
  console.log(
    chalk.blue.bold(req.method, req.url),
    chalk.magenta.bold(statusCode),
    chalk.red.bold(sanitizeErrorMessage(`${err}`))
  );
  // 布尔属性，表示应用是否已为响应发送过 HTTP Header。
  // 在此判断是为了避免在 Header 已发送后再发送响应。
  if (res.headersSent) {
    return next(err);
  }

  // 处理来自 milvus service 的错误
  switch (err.code) {
    case 7:
      statusCode = HTTP_STATUS_CODE.FORBIDDEN;
      break;
  }

  if (err) {
    res
      .status(statusCode)
      .json({
        message: sanitizeErrorMessage(`${err.details || err.message}`),
        statusCode,
      });
  }
  next();
};

export const LoggingMiddleware = morgan((tokens, req, res) => {
  return [
    '\n',
    chalk.blue.bold(tokens.method(req, res)),
    chalk.magenta.bold(tokens.status(req, res)),
    chalk.green.bold(tokens.url(req, res)),
    chalk.green.bold(tokens['response-time'](req, res) + ' ms'),
    chalk.green.bold('@ ' + tokens.date(req, res)),
    chalk.yellow(tokens['remote-addr'](req, res)),
    chalk.hex('#fffa65').bold('from ' + tokens.referrer(req, res)),
    chalk.hex('#1e90ff')(tokens['user-agent'](req, res)),
    '\n',
  ].join(' ');
});
