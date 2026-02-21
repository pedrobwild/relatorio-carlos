// deno-lint-ignore no-explicit-any
export async function logSystemError(
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: any,
  functionName: string,
  errorCode: string,
  errorMessage: string,
  context: {
    requestId: string;
    userId?: string;
    projectId?: string;
    errorStack?: string;
    requestPath?: string;
    requestMethod?: string;
    metadata?: Record<string, unknown>;
  },
) {
  try {
    await supabaseAdmin.rpc('log_system_error', {
      p_error_code: errorCode,
      p_error_message: errorMessage,
      p_source: 'edge_function',
      p_function_name: functionName,
      p_request_id: context.requestId,
      p_user_id: context.userId || null,
      p_project_id: context.projectId || null,
      p_error_stack: context.errorStack || null,
      p_request_path: context.requestPath || null,
      p_request_method: context.requestMethod || null,
      p_metadata: context.metadata || {},
    });
  } catch (err) {
    console.error('Failed to log error to system_errors:', err);
  }
}
