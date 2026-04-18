import { ExceptionFilter, Catch, ArgumentsHost, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { DomainError } from '../../domain/errors/domain.error';
import { ConflictError } from '../../domain/errors/conflict.error';
import { ValidationError } from '../../domain/errors/validation.error';

@Catch(DomainError)
export class DomainExceptionFilter implements ExceptionFilter
{
  catch(exception: DomainError, host: ArgumentsHost)
  {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.BAD_REQUEST; // Fallback padrão

    if (exception instanceof ConflictError)
    {
      status = HttpStatus.CONFLICT;
    }
    else if (exception instanceof ValidationError)
    {
      status = HttpStatus.UNPROCESSABLE_ENTITY;
    }
    // if (exception instanceof NotFoundError) status = HttpStatus.NOT_FOUND;

    response.status(status).json({
      statusCode: status,
      message: exception.message,
      error: exception.name,
    });
  }
}
