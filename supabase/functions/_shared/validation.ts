/**
 * Validation Helpers for Edge Functions
 * 
 * Lightweight validation that mirrors frontend Zod schemas
 * for consistent validation across frontend and backend.
 */

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: Array<{ field: string; message: string }>;
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
}

/**
 * Validate UUID format
 */
export function isValidUuid(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

/**
 * Validate date string (YYYY-MM-DD)
 */
export function isValidDate(dateStr: string): boolean {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateStr)) return false;
  
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

/**
 * Validate phone format (Brazilian)
 */
export function isValidPhone(phone: string): boolean {
  const phoneRegex = /^[\d\s()+-]+$/;
  return phoneRegex.test(phone) && phone.length >= 10 && phone.length <= 20;
}

/**
 * Sanitize string input
 */
export function sanitizeString(input: string, maxLength = 1000): string {
  return input
    .trim()
    .substring(0, maxLength)
    .replace(/[<>]/g, ''); // Basic XSS prevention
}

/**
 * Validate create-user request body
 */
export function validateCreateUser(body: unknown): ValidationResult<{
  email: string;
  password: string;
  display_name?: string;
  role: string;
  cpf?: string;
  project_ids?: string[];
}> {
  const errors: Array<{ field: string; message: string }> = [];
  
  if (!body || typeof body !== 'object') {
    return { success: false, errors: [{ field: 'body', message: 'Corpo da requisição inválido' }] };
  }
  
  const data = body as Record<string, unknown>;
  
  // Required: email
  if (!data.email || typeof data.email !== 'string') {
    errors.push({ field: 'email', message: 'Email é obrigatório' });
  } else if (!isValidEmail(data.email)) {
    errors.push({ field: 'email', message: 'Email inválido' });
  }
  
  // Required: password
  if (!data.password || typeof data.password !== 'string') {
    errors.push({ field: 'password', message: 'Senha é obrigatória' });
  } else if (data.password.length < 6) {
    errors.push({ field: 'password', message: 'Senha deve ter no mínimo 6 caracteres' });
  } else if (data.password.length > 128) {
    errors.push({ field: 'password', message: 'Senha muito longa' });
  }
  
  // Required: role
  const validRoles = ['admin', 'engineer', 'customer', 'manager', 'suprimentos', 'financeiro', 'gestor'];
  if (!data.role || typeof data.role !== 'string') {
    errors.push({ field: 'role', message: 'Perfil é obrigatório' });
  } else if (!validRoles.includes(data.role)) {
    errors.push({ field: 'role', message: 'Perfil inválido' });
  }
  
  // Optional: display_name
  if (data.display_name && typeof data.display_name === 'string' && data.display_name.length > 200) {
    errors.push({ field: 'display_name', message: 'Nome muito longo' });
  }
  
  // Optional: project_ids
  if (data.project_ids) {
    if (!Array.isArray(data.project_ids)) {
      errors.push({ field: 'project_ids', message: 'project_ids deve ser um array' });
    } else {
      const invalidIds = data.project_ids.filter((id: unknown) => 
        typeof id !== 'string' || !isValidUuid(id)
      );
      if (invalidIds.length > 0) {
        errors.push({ field: 'project_ids', message: 'IDs de projeto inválidos' });
      }
    }
  }
  
  if (errors.length > 0) {
    return { success: false, errors };
  }
  
  return {
    success: true,
    data: {
      email: sanitizeString(data.email as string, 255),
      password: data.password as string,
      display_name: data.display_name ? sanitizeString(data.display_name as string, 200) : undefined,
      role: data.role as string,
      cpf: data.cpf ? sanitizeString(data.cpf as string, 14) : undefined,
      project_ids: data.project_ids as string[] | undefined,
    },
  };
}

/**
 * Validate update-user request body
 */
export function validateUpdateUser(body: unknown): ValidationResult<{
  user_id: string;
  display_name?: string;
  role?: string;
  cpf?: string;
}> {
  const errors: Array<{ field: string; message: string }> = [];
  
  if (!body || typeof body !== 'object') {
    return { success: false, errors: [{ field: 'body', message: 'Corpo da requisição inválido' }] };
  }
  
  const data = body as Record<string, unknown>;
  
  // Required: user_id
  if (!data.user_id || typeof data.user_id !== 'string') {
    errors.push({ field: 'user_id', message: 'ID do usuário é obrigatório' });
  } else if (!isValidUuid(data.user_id)) {
    errors.push({ field: 'user_id', message: 'ID do usuário inválido' });
  }
  
  // Optional: role
  const validRoles = ['admin', 'engineer', 'customer', 'manager', 'suprimentos', 'financeiro', 'gestor'];
  if (data.role && (typeof data.role !== 'string' || !validRoles.includes(data.role))) {
    errors.push({ field: 'role', message: 'Perfil inválido' });
  }
  
  // Optional: display_name
  if (data.display_name && typeof data.display_name === 'string' && data.display_name.length > 200) {
    errors.push({ field: 'display_name', message: 'Nome muito longo' });
  }
  
  if (errors.length > 0) {
    return { success: false, errors };
  }
  
  return {
    success: true,
    data: {
      user_id: data.user_id as string,
      display_name: data.display_name ? sanitizeString(data.display_name as string, 200) : undefined,
      role: data.role as string | undefined,
      cpf: data.cpf ? sanitizeString(data.cpf as string, 14) : undefined,
    },
  };
}
