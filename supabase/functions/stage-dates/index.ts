import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  withErrorHandler,
  success,
  errorFromCode,
  ErrorCodes,
  log,
} from "../_shared/response.ts";
import { isValidUuid, sanitizeString } from "../_shared/validation.ts";

const VALID_DATE_TYPES = ["meeting", "deadline", "start_planned", "end_planned", "milestone"] as const;
const VALID_ACTIONS = ["create", "propose", "confirm", "list", "list_events"] as const;

type Action = typeof VALID_ACTIONS[number];

function isValidISODatetime(s: string): boolean {
  return !isNaN(new Date(s).getTime());
}

function isFutureDate(s: string, types: string[]): boolean {
  // Only enforce future dates for meetings
  if (!types.includes("meeting")) return true;
  return new Date(s) > new Date();
}

async function getUserRole(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<string> {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (!data || data.length === 0) return "customer";
  const roles = data.map((r: { role: string }) => r.role);
  if (roles.includes("admin")) return "admin";
  if (roles.includes("manager")) return "manager";
  if (roles.includes("engineer")) return "engineer";
  return "customer";
}

async function logEvent(
  supabase: ReturnType<typeof createClient>,
  stageDateId: string,
  actorUserId: string,
  actorRole: string,
  action: string,
  oldValue: unknown,
  newValue: unknown
) {
  const { error } = await supabase.from("stage_date_events").insert({
    stage_date_id: stageDateId,
    actor_user_id: actorUserId,
    actor_role: actorRole,
    action,
    old_value: oldValue,
    new_value: newValue,
  });
  if (error) log("error", "Failed to log stage date event", { error });
}

const handler = withErrorHandler(async (req, correlationId) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization");

  if (!authHeader) {
    return errorFromCode(ErrorCodes.UNAUTHORIZED, correlationId);
  }

  // Create user-scoped client for RLS
  const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });

  // Get user from token
  const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
  if (authError || !user) {
    return errorFromCode(ErrorCodes.UNAUTHORIZED, correlationId);
  }

  // Service client for admin operations
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  const body = await req.json();
  const action = body.action as Action;

  if (!VALID_ACTIONS.includes(action)) {
    return errorFromCode(ErrorCodes.VALIDATION_ERROR, correlationId, "Ação inválida");
  }

  const role = await getUserRole(supabaseAdmin, user.id);
  const isStaff = ["admin", "manager", "engineer"].includes(role);

  // === LIST ===
  if (action === "list") {
    if (!body.project_id || !isValidUuid(body.project_id)) {
      return errorFromCode(ErrorCodes.VALIDATION_ERROR, correlationId, "project_id inválido");
    }

    let query = supabaseUser
      .from("stage_dates")
      .select("*")
      .eq("project_id", body.project_id)
      .order("created_at", { ascending: true });

    if (body.stage_key) {
      query = query.eq("stage_key", body.stage_key);
    }

    const { data, error } = await query;
    if (error) return errorFromCode(ErrorCodes.DATABASE_ERROR, correlationId, error.message);
    return success(data, correlationId);
  }

  // === LIST EVENTS ===
  if (action === "list_events") {
    if (!body.stage_date_id || !isValidUuid(body.stage_date_id)) {
      return errorFromCode(ErrorCodes.VALIDATION_ERROR, correlationId, "stage_date_id inválido");
    }

    const { data, error } = await supabaseUser
      .from("stage_date_events")
      .select("*")
      .eq("stage_date_id", body.stage_date_id)
      .order("created_at", { ascending: false });

    if (error) return errorFromCode(ErrorCodes.DATABASE_ERROR, correlationId, error.message);
    return success(data, correlationId);
  }

  // === CREATE ===
  if (action === "create") {
    if (!body.project_id || !isValidUuid(body.project_id)) {
      return errorFromCode(ErrorCodes.VALIDATION_ERROR, correlationId, "project_id inválido");
    }
    if (!body.stage_key || typeof body.stage_key !== "string") {
      return errorFromCode(ErrorCodes.VALIDATION_ERROR, correlationId, "stage_key obrigatório");
    }
    if (!body.date_type || !VALID_DATE_TYPES.includes(body.date_type)) {
      return errorFromCode(ErrorCodes.VALIDATION_ERROR, correlationId, "date_type inválido");
    }
    if (!body.title || typeof body.title !== "string") {
      return errorFromCode(ErrorCodes.VALIDATION_ERROR, correlationId, "title obrigatório");
    }

    const insertData: Record<string, unknown> = {
      project_id: body.project_id,
      stage_key: sanitizeString(body.stage_key, 100),
      date_type: body.date_type,
      title: sanitizeString(body.title, 200),
      notes: body.notes ? sanitizeString(body.notes, 500) : null,
      customer_proposed_by: user.id,
    };

    // If customer is proposing a datetime during creation
    if (body.customer_proposed_at) {
      if (!isValidISODatetime(body.customer_proposed_at)) {
        return errorFromCode(ErrorCodes.VALIDATION_ERROR, correlationId, "Data proposta inválida");
      }
      if (!isFutureDate(body.customer_proposed_at, [body.date_type])) {
        return errorFromCode(ErrorCodes.VALIDATION_ERROR, correlationId, "Data de reunião deve ser no futuro");
      }
      insertData.customer_proposed_at = body.customer_proposed_at;
    }

    const { data, error } = await supabaseUser.from("stage_dates").insert(insertData).select().single();
    if (error) return errorFromCode(ErrorCodes.DATABASE_ERROR, correlationId, error.message);

    await logEvent(supabaseAdmin, data.id, user.id, role, "created", null, insertData);
    return success(data, correlationId, 201);
  }

  // === PROPOSE (customer sets proposed date) ===
  if (action === "propose") {
    if (!body.stage_date_id || !isValidUuid(body.stage_date_id)) {
      return errorFromCode(ErrorCodes.VALIDATION_ERROR, correlationId, "stage_date_id inválido");
    }
    if (!body.datetime || !isValidISODatetime(body.datetime)) {
      return errorFromCode(ErrorCodes.VALIDATION_ERROR, correlationId, "datetime inválido (ISO 8601)");
    }

    // Fetch current record
    const { data: current, error: fetchErr } = await supabaseUser
      .from("stage_dates")
      .select("*")
      .eq("id", body.stage_date_id)
      .single();

    if (fetchErr || !current) {
      return errorFromCode(ErrorCodes.NOT_FOUND, correlationId);
    }

    if (!isFutureDate(body.datetime, [current.date_type])) {
      return errorFromCode(ErrorCodes.VALIDATION_ERROR, correlationId, "Data de reunião deve ser no futuro");
    }

    const updateData: Record<string, unknown> = {
      customer_proposed_at: body.datetime,
      customer_proposed_by: user.id,
    };
    if (body.notes !== undefined) {
      updateData.notes = body.notes ? sanitizeString(body.notes, 500) : null;
    }

    const { data, error } = await supabaseUser
      .from("stage_dates")
      .update(updateData)
      .eq("id", body.stage_date_id)
      .select()
      .single();

    if (error) return errorFromCode(ErrorCodes.DATABASE_ERROR, correlationId, error.message);

    await logEvent(
      supabaseAdmin, data.id, user.id, role, "proposed",
      { customer_proposed_at: current.customer_proposed_at },
      { customer_proposed_at: body.datetime, notes: body.notes }
    );

    return success(data, correlationId);
  }

  // === CONFIRM (staff only) ===
  if (action === "confirm") {
    if (!isStaff) {
      return errorFromCode(ErrorCodes.FORBIDDEN, correlationId, "Apenas staff pode confirmar datas");
    }
    if (!body.stage_date_id || !isValidUuid(body.stage_date_id)) {
      return errorFromCode(ErrorCodes.VALIDATION_ERROR, correlationId, "stage_date_id inválido");
    }
    if (!body.datetime || !isValidISODatetime(body.datetime)) {
      return errorFromCode(ErrorCodes.VALIDATION_ERROR, correlationId, "datetime inválido (ISO 8601)");
    }

    // Fetch current — use admin client since staff RLS applies
    const { data: current, error: fetchErr } = await supabaseUser
      .from("stage_dates")
      .select("*")
      .eq("id", body.stage_date_id)
      .single();

    if (fetchErr || !current) {
      return errorFromCode(ErrorCodes.NOT_FOUND, correlationId);
    }

    const updateData: Record<string, unknown> = {
      bwild_confirmed_at: body.datetime,
      bwild_confirmed_by: user.id,
    };
    if (body.notes !== undefined) {
      updateData.notes = body.notes ? sanitizeString(body.notes, 500) : null;
    }
    // Staff can also adjust proposed date if needed
    if (body.customer_proposed_at) {
      if (!isValidISODatetime(body.customer_proposed_at)) {
        return errorFromCode(ErrorCodes.VALIDATION_ERROR, correlationId, "customer_proposed_at inválido");
      }
      updateData.customer_proposed_at = body.customer_proposed_at;
      updateData.customer_proposed_by = user.id;
    }

    const { data, error } = await supabaseUser
      .from("stage_dates")
      .update(updateData)
      .eq("id", body.stage_date_id)
      .select()
      .single();

    if (error) return errorFromCode(ErrorCodes.DATABASE_ERROR, correlationId, error.message);

    await logEvent(
      supabaseAdmin, data.id, user.id, role, "confirmed",
      { bwild_confirmed_at: current.bwild_confirmed_at },
      { bwild_confirmed_at: body.datetime, notes: body.notes }
    );

    return success(data, correlationId);
  }

  return errorFromCode(ErrorCodes.VALIDATION_ERROR, correlationId, "Ação não suportada");
});

Deno.serve(handler);
