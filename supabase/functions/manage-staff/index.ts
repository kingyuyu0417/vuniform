import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "POST required" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: "Function is not configured" }, 500);

  const authorization = request.headers.get("Authorization");
  if (!authorization) return json({ error: "Login required" }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return json({ error: "Login required" }, 401);

  const { data: actor, error: actorError } = await userClient
    .from("staff_profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (actorError || actor?.role !== "admin") return json({ error: "Admin role required" }, 403);

  const body = await request.json();
  const action = body.action;
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  if (action === "list") {
    const { data, error } = await adminClient.from("staff_profiles").select("id, display_name, role, created_at").order("created_at");
    if (error) return json({ error: error.message }, 400);
    return json({ staff: data || [] });
  }

  if (action === "invite") {
    const email = String(body.email || "").trim().toLowerCase();
    const displayName = String(body.display_name || "").trim();
    const role = String(body.role || "staff");
    if (!email || !displayName || !["admin", "manager", "staff"].includes(role)) return json({ error: "Invalid staff details" }, 400);
    const { data: users, error: listError } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
    if (listError) return json({ error: listError.message }, 400);
    const existingUser = users.users.find((candidate) => candidate.email?.toLowerCase() === email);
    let userId = existingUser?.id;
    if (!userId) {
      const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email);
      if (error || !data.user) return json({ error: error?.message || "Unable to invite user" }, 400);
      userId = data.user.id;
    }
    const { error: profileError } = await adminClient.from("staff_profiles").upsert({ id: userId, display_name: displayName, role });
    if (profileError) return json({ error: profileError.message }, 400);
    return json({ id: userId, display_name: displayName, role });
  }

  if (action === "create_password") {
    const email = String(body.email || "").trim().toLowerCase();
    const displayName = String(body.display_name || "").trim();
    const password = String(body.password || "");
    const role = String(body.role || "staff");
    if (!email || !displayName || password.length < 8 || !["admin", "manager", "staff"].includes(role)) return json({ error: "請提供姓名、有效電郵、最少 8 字元密碼及角色" }, 400);
    const { data: users, error: listError } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
    if (listError) return json({ error: listError.message }, 400);
    const existingUser = users.users.find((candidate) => candidate.email?.toLowerCase() === email);
    let userId = existingUser?.id;
    if (userId) {
      const { error } = await adminClient.auth.admin.updateUserById(userId, { password, email_confirm: true, ban_duration: "none" });
      if (error) return json({ error: error.message }, 400);
    } else {
      const { data, error } = await adminClient.auth.admin.createUser({ email, password, email_confirm: true });
      if (error || !data.user) return json({ error: error?.message || "Unable to create user" }, 400);
      userId = data.user.id;
    }
    const { error: profileError } = await adminClient.from("staff_profiles").upsert({ id: userId, display_name: displayName, role });
    if (profileError) return json({ error: profileError.message }, 400);
    return json({ id: userId, display_name: displayName, role });
  }

  if (action === "update_role") {
    const id = String(body.id || "");
    const role = String(body.role || "");
    if (!id || !["admin", "manager", "staff"].includes(role)) return json({ error: "Invalid staff role" }, 400);
    if (id === user.id && role !== "admin") return json({ error: "You cannot remove your own admin role" }, 400);
    const { error } = await adminClient.from("staff_profiles").update({ role, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  }

  if (action === "disable") {
    const id = String(body.id || "");
    if (!id || id === user.id) return json({ error: "Invalid staff account" }, 400);
    const { error } = await adminClient.auth.admin.updateUserById(id, { ban_duration: "876000h" });
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  }

  return json({ error: "Unknown action" }, 400);
});
