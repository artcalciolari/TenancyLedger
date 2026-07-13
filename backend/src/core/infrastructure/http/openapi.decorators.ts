import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiResponse,
  ApiUnprocessableEntityResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { ProblemDetailsDto } from './openapi.dto';

const problemContent = {
  'application/problem+json': {
    schema: { $ref: getSchemaPath(ProblemDetailsDto) },
  },
};

export function ApiProtected(): MethodDecorator & ClassDecorator {
  return applyDecorators(ApiBearerAuth('bearer'));
}

export function ApiNotFoundProblem(description = 'Recurso não encontrado.'): MethodDecorator {
  return ApiNotFoundResponse({ description, content: problemContent });
}

export function ApiConflictProblem(description = 'Conflito com o estado atual.'): MethodDecorator {
  return ApiConflictResponse({ description, content: problemContent });
}

export function ApiUnprocessableProblem(
  description = 'Regra de negócio ou valor de domínio inválido.',
): MethodDecorator {
  return ApiUnprocessableEntityResponse({ description, content: problemContent });
}

export function ApiProblemResponse(status: number, description: string): MethodDecorator {
  return ApiResponse({ status, description, content: problemContent });
}
