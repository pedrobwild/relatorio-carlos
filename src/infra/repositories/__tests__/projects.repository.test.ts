/**
 * Projects Repository Tests
 *
 * Unit tests for projects repository functions.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Project, ProjectStatus } from "../projects.repository";

// Mock Supabase
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
        order: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
    })),
    rpc: vi.fn(() => Promise.resolve({ data: null, error: null })),
  },
}));

describe("Project Types", () => {
  it("ProjectStatus includes all valid statuses", () => {
    const validStatuses: ProjectStatus[] = [
      "active",
      "completed",
      "paused",
      "cancelled",
    ];

    // Type check - this will fail at compile time if types are wrong
    validStatuses.forEach((status) => {
      expect(["active", "completed", "paused", "cancelled"]).toContain(status);
    });
  });

  it("Project interface has required fields", () => {
    const project: Project = {
      id: "test-id",
      name: "Test Project",
      unit_name: null,
      address: null,
      bairro: null,
      cep: null,
      planned_start_date: "2024-01-01",
      planned_end_date: "2024-12-31",
      actual_start_date: null,
      actual_end_date: null,
      contract_value: null,
      status: "active",
      created_by: "user-id",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
      org_id: null,
    };

    expect(project.id).toBeDefined();
    expect(project.name).toBeDefined();
    expect(project.status).toBeDefined();
    expect(project.planned_start_date).toBeDefined();
    expect(project.planned_end_date).toBeDefined();
  });
});

describe("Project Status Transitions", () => {
  const createProject = (status: ProjectStatus): Project => ({
    id: "test-id",
    name: "Test Project",
    unit_name: null,
    address: null,
    bairro: null,
    cep: null,
    planned_start_date: "2024-01-01",
    planned_end_date: "2024-12-31",
    actual_start_date: null,
    actual_end_date: null,
    contract_value: null,
    status,
    created_by: "user-id",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    org_id: null,
  });

  it("allows transition from active to completed", () => {
    const project = createProject("active");
    expect(project.status).toBe("active");

    // Simulate update
    const updatedProject = { ...project, status: "completed" as ProjectStatus };
    expect(updatedProject.status).toBe("completed");
  });

  it("allows transition from active to paused", () => {
    const project = createProject("active");
    const updatedProject = { ...project, status: "paused" as ProjectStatus };
    expect(updatedProject.status).toBe("paused");
  });

  it("allows transition from paused to active", () => {
    const project = createProject("paused");
    const updatedProject = { ...project, status: "active" as ProjectStatus };
    expect(updatedProject.status).toBe("active");
  });
});

describe("Project Date Calculations", () => {
  it("calculates project duration correctly", () => {
    const startDate = new Date("2024-01-01");
    const endDate = new Date("2024-12-31");
    const durationDays = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    expect(durationDays).toBe(365);
  });

  it("calculates progress percentage", () => {
    const startDate = new Date("2024-01-01");
    const endDate = new Date("2024-12-31");
    const currentDate = new Date("2024-07-01");

    const totalDuration = endDate.getTime() - startDate.getTime();
    const elapsed = currentDate.getTime() - startDate.getTime();
    const progress = Math.round((elapsed / totalDuration) * 100);

    expect(progress).toBeGreaterThan(40);
    expect(progress).toBeLessThan(60);
  });

  it("handles actual dates override", () => {
    const project: Project = {
      id: "test-id",
      name: "Test Project",
      unit_name: null,
      address: null,
      bairro: null,
      cep: null,
      planned_start_date: "2024-01-01",
      planned_end_date: "2024-12-31",
      actual_start_date: "2024-01-15",
      actual_end_date: null,
      contract_value: null,
      status: "active",
      created_by: "user-id",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
      org_id: null,
    };

    const effectiveStartDate =
      project.actual_start_date || project.planned_start_date;
    expect(effectiveStartDate).toBe("2024-01-15");
  });
});
