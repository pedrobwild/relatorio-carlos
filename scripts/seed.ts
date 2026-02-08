/**
 * Seed Script for E2E Tests
 * 
 * Creates test data for automated testing.
 * Run: npx tsx scripts/seed.ts
 * 
 * Requires: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env
 */

import { createClient } from '@supabase/supabase-js';

// Environment configuration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing environment variables:');
  console.error('   VITE_SUPABASE_URL or SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Test user configurations
const TEST_USERS = {
  customer: {
    email: 'customer.test@bwild.com.br',
    password: 'test123456',
    role: 'customer',
    displayName: 'Cliente Teste'
  },
  staff: {
    email: 'staff.test@bwild.com.br', 
    password: 'test123456',
    role: 'engineer',
    displayName: 'Staff Teste'
  }
};

async function createOrGetUser(config: typeof TEST_USERS.customer) {
  // Check if user exists
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const existing = existingUsers?.users?.find(u => u.email === config.email);
  
  if (existing) {
    console.warn(`✓ User ${config.email} already exists`);
    return existing;
  }

  // Create user
  const { data, error } = await supabase.auth.admin.createUser({
    email: config.email,
    password: config.password,
    email_confirm: true,
    user_metadata: {
      display_name: config.displayName,
      role: config.role
    }
  });

  if (error) {
    console.error(`❌ Failed to create user ${config.email}:`, error.message);
    return null;
  }

  console.warn(`✓ Created user ${config.email}`);
  return data.user;
}

async function ensureUserRole(userId: string, role: string) {
  // Check if role exists
  const { data: existing } = await supabase
    .from('user_roles')
    .select('id')
    .eq('user_id', userId)
    .eq('role', role)
    .single();

  if (existing) {
    console.warn(`✓ Role ${role} already assigned`);
    return;
  }

  // Assign role
  const { error } = await supabase
    .from('user_roles')
    .insert({ user_id: userId, role });

  if (error) {
    console.error(`❌ Failed to assign role ${role}:`, error.message);
    return;
  }

  console.warn(`✓ Assigned role ${role}`);
}

async function createTestProject(customerUserId: string, staffUserId: string) {
  // Check if test project exists
  const { data: existing } = await supabase
    .from('projects')
    .select('id')
    .eq('name', 'Projeto Teste E2E')
    .single();

  if (existing) {
    console.warn(`✓ Test project already exists: ${existing.id}`);
    return existing.id;
  }

  // Get or create org
  let orgId: string;
  const { data: orgData } = await supabase
    .from('orgs')
    .select('id')
    .eq('name', 'Org Teste')
    .single();

  if (orgData) {
    orgId = orgData.id;
  } else {
    const { data: newOrg, error: orgError } = await supabase
      .from('orgs')
      .insert({ name: 'Org Teste', slug: 'org-teste' })
      .select('id')
      .single();

    if (orgError) {
      console.error('❌ Failed to create org:', orgError.message);
      return null;
    }
    orgId = newOrg.id;
    console.warn(`✓ Created org: ${orgId}`);
  }

  // Create project
  const { data: project, error } = await supabase
    .from('projects')
    .insert({
      name: 'Projeto Teste E2E',
      customer_org_id: orgId,
      status: 'active',
      planned_start_date: new Date().toISOString().split('T')[0],
      planned_end_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    })
    .select('id')
    .single();

  if (error) {
    console.error('❌ Failed to create project:', error.message);
    return null;
  }

  console.warn(`✓ Created project: ${project.id}`);

  // Add customer as project member
  await supabase.from('project_members').insert({
    project_id: project.id,
    user_id: customerUserId,
    role: 'customer'
  });

  // Add staff as project engineer
  await supabase.from('project_engineers').insert({
    project_id: project.id,
    engineer_user_id: staffUserId,
    is_primary: true
  });

  console.warn(`✓ Added project members`);

  return project.id;
}

async function main() {
  console.warn('🌱 Starting seed...\n');

  // Create test users
  const customerUser = await createOrGetUser(TEST_USERS.customer);
  const staffUser = await createOrGetUser(TEST_USERS.staff);

  if (!customerUser || !staffUser) {
    console.error('\n❌ Failed to create test users');
    process.exit(1);
  }

  // Assign roles
  await ensureUserRole(customerUser.id, 'customer');
  await ensureUserRole(staffUser.id, 'engineer');

  // Create test project
  const projectId = await createTestProject(customerUser.id, staffUser.id);

  console.warn('\n✅ Seed completed!');
  console.warn('\n📋 Test credentials:');
  console.warn(`   Customer: ${TEST_USERS.customer.email} / ${TEST_USERS.customer.password}`);
  console.warn(`   Staff: ${TEST_USERS.staff.email} / ${TEST_USERS.staff.password}`);
  if (projectId) {
    console.warn(`   Test Project ID: ${projectId}`);
  }
}

main().catch(console.error);
