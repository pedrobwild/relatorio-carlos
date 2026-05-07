/**
 * Standardized Response Helpers for Edge Functions
 * 
 * Provides consistent JSON responses with:
 * - CORS headers
 * - Correlation IDs for tracing
 * - Structured error formats
 * - Logging utilities
 */
/* eslint-disable no-console */
import { corsHeaders } from './cors.ts';
export { corsHeaders };

/**
 * Generate a correlation ID for request tracing
 */
export function generateCorrelationId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Extract correlation ID from request or generate new one
 */
export function getCorrelationId(req: Request): string {
  return req.headers.get('x-correlation-id') || generateCorrelationId();
}

/**
 * Structured log with context
 */
export function log(
  level: 'info' | 'warn' | 'error',
  message: string,
  context: Record<string, unknown> = {}
): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  };
  
  if (level === 'error') {
    console.error(JSON.stringify(entry));
  } else if (level === 'warn') {
    console.warn(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  correlationId: string;
}

/**
 * Standard success response
 */
export function success<T>(data: T, correlationId: string, status = 200): Response {
  const body: ApiResponse<T> = {
    success: true,
    data,
    correlationId,
  };

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'X-Correlation-Id': correlationId,
    },
  });
}

/**
 * Standard error response with consistent structure
 */
export function error(
  code: string,
  message: string,
  correlationId: string,
  status = 400,
  details?: unknown
): Response {
  const body: ApiResponse = {
    success: false,
    error: { code, message, details },
    correlationId,
  };

  log('error', message, { code, correlationId, details });

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'X-Correlation-Id': correlationId,
    },
  });
}

/**
 * Handle CORS preflight
 */
export function handleCors(): Response {
  return new Response(null, { headers: corsHeaders });
}

/**
 * Common error codes and their HTTP status
 */
export const ErrorCodes = {
  // Auth errors (401)
  UNAUTHORIZED: { code: 'UNAUTHORIZED', status: 401, message: 'Não autenticado' },
  INVALID_TOKEN: { code: 'INVALID_TOKEN', status: 401, message: 'Token inválido ou expirado' },
  
  // Permission errors (403)
  FORBIDDEN: { code: 'FORBIDDEN', status: 403, message: 'Acesso negado' },
  ADMIN_REQUIRED: { code: 'ADMIN_REQUIRED', status: 403, message: 'Acesso de administrador requerido' },
  
  // Validation errors (400)
  VALIDATION_ERROR: { code: 'VALIDATION_ERROR', status: 400, message: 'Dados inválidos' },
  MISSING_FIELD: { code: 'MISSING_FIELD', status: 400, message: 'Campo obrigatório ausente' },
  INVALID_FORMAT: { code: 'INVALID_FORMAT', status: 400, message: 'Formato inválido' },
  
  // Resource errors (404, 409)
  NOT_FOUND: { code: 'NOT_FOUND', status: 404, message: 'Recurso não encontrado' },
  ALREADY_EXISTS: { code: 'ALREADY_EXISTS', status: 409, message: 'Recurso já existe' },
  
  // Server errors (500)
  INTERNAL_ERROR: { code: 'INTERNAL_ERROR', status: 500, message: 'Erro interno do servidor' },
  DATABASE_ERROR: { code: 'DATABASE_ERROR', status: 500, message: 'Erro de banco de dados' },
} as const;

/**
 * Helper to create error response from ErrorCodes
 */
export function errorFromCode(
  errorDef: typeof ErrorCodes[keyof typeof ErrorCodes],
  correlationId: string,
  customMessage?: string,
  details?: unknown
): Response {
  return error(
    errorDef.code,
    customMessage || errorDef.message,
    correlationId,
    errorDef.status,
    details
  );
}

/**
 * Wrap handler with error catching and correlation ID
 */
export function withErrorHandler(
  handler: (req: Request, correlationId: string) => Promise<Response>
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    if (req.method === 'OPTIONS') {
      return handleCors();
    }

    const correlationId = getCorrelationId(req);
    
    try {
      log('info', 'Request started', {
        correlationId,
        method: req.method,
        url: req.url,
      });

      const response = await handler(req, correlationId);
      
      log('info', 'Request completed', {
        correlationId,
        status: response.status,
      });

      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      const errorStack = err instanceof Error ? err.stack : undefined;
      
      log('error', 'Unhandled exception', {
        correlationId,
        error: errorMessage,
        stack: errorStack,
      });

      return errorFromCode(ErrorCodes.INTERNAL_ERROR, correlationId, undefined, {
        message: errorMessage,
      });
    }
  };
}
