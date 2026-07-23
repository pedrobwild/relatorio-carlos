/**
 * Inspection Checklist Templates Repository (Onda D1 — Qualidade)
 *
 * Reusable inspection checklist templates: staff-only CRUD.
 * Additive; does not touch existing inspections / non_conformities flow.
 */

import { supabase, executeListQuery, executeQuery } from "./base.repository";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type ChecklistTemplate = Tables<"inspection_checklist_templates">;
export type ChecklistTemplateItem = Tables<"inspection_checklist_template_items">;

export type ChecklistTemplateWithItems = ChecklistTemplate & {
  items: ChecklistTemplateItem[];
};

export const inspectionChecklistTemplatesRepo = {
  async list(includeArchived = false) {
    return executeListQuery<ChecklistTemplate>(async () => {
      let query = supabase
        .from("inspection_checklist_templates")
        .select("*")
        .order("category", { ascending: true, nullsFirst: false })
        .order("name", { ascending: true });
      if (!includeArchived) query = query.eq("is_active", true);
      return await query;
    });
  },

  async getWithItems(id: string) {
    return executeQuery<ChecklistTemplateWithItems>(async () => {
      const { data, error } = await supabase
        .from("inspection_checklist_templates")
        .select("*, items:inspection_checklist_template_items(*)")
        .eq("id", id)
        .maybeSingle();
      if (error || !data) return { data: null, error };
      const items = ((data as unknown as ChecklistTemplateWithItems).items ?? [])
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order);
      return { data: { ...(data as ChecklistTemplate), items }, error: null };
    });
  },

  async create(payload: {
    name: string;
    description?: string | null;
    category?: string | null;
    is_active?: boolean;
  }) {
    const { data: userData } = await supabase.auth.getUser();
    const insert: TablesInsert<"inspection_checklist_templates"> = {
      name: payload.name.trim(),
      description: payload.description?.trim() || null,
      category: payload.category?.trim() || null,
      is_active: payload.is_active ?? true,
      created_by: userData.user?.id ?? null,
    };
    return executeQuery<ChecklistTemplate>(async () => {
      return await supabase
        .from("inspection_checklist_templates")
        .insert(insert)
        .select()
        .single();
    });
  },

  async update(
    id: string,
    payload: Partial<
      Pick<ChecklistTemplate, "name" | "description" | "category" | "is_active">
    >,
  ) {
    const update: TablesUpdate<"inspection_checklist_templates"> = {};
    if (payload.name !== undefined) update.name = payload.name.trim();
    if (payload.description !== undefined)
      update.description = payload.description?.trim() || null;
    if (payload.category !== undefined)
      update.category = payload.category?.trim() || null;
    if (payload.is_active !== undefined) update.is_active = payload.is_active;
    return executeQuery<ChecklistTemplate>(async () => {
      return await supabase
        .from("inspection_checklist_templates")
        .update(update)
        .eq("id", id)
        .select()
        .single();
    });
  },

  async remove(id: string) {
    return executeQuery<{ id: string }>(async () => {
      const { error } = await supabase
        .from("inspection_checklist_templates")
        .delete()
        .eq("id", id);
      return { data: error ? null : { id }, error };
    });
  },

  async duplicate(id: string) {
    const { data: original, error } = await this.getWithItems(id);
    if (error || !original) return { data: null, error };
    const created = await this.create({
      name: `${original.name} (cópia)`,
      description: original.description,
      category: original.category,
      is_active: original.is_active,
    });
    if (created.error || !created.data) return created;
    if (original.items.length > 0) {
      const insertItems: TablesInsert<"inspection_checklist_template_items">[] =
        original.items.map((it, i) => ({
          template_id: created.data!.id,
          description: it.description,
          category: it.category,
          sort_order: i,
        }));
      const { error: itemsError } = await supabase
        .from("inspection_checklist_template_items")
        .insert(insertItems);
      if (itemsError) return { data: null, error: itemsError as never };
    }
    return created;
  },

  async replaceItems(
    templateId: string,
    items: { description: string; category?: string | null }[],
  ) {
    const { error: delError } = await supabase
      .from("inspection_checklist_template_items")
      .delete()
      .eq("template_id", templateId);
    if (delError) return { data: null, error: delError };
    const clean = items
      .map((it) => ({ ...it, description: it.description.trim() }))
      .filter((it) => it.description.length > 0);
    if (clean.length === 0) return { data: [], error: null };
    const insertItems: TablesInsert<"inspection_checklist_template_items">[] =
      clean.map((it, i) => ({
        template_id: templateId,
        description: it.description,
        category: it.category?.trim() || null,
        sort_order: i,
      }));
    const { data, error } = await supabase
      .from("inspection_checklist_template_items")
      .insert(insertItems)
      .select();
    return { data, error };
  },
};
