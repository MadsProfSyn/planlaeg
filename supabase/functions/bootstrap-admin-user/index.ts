// One-time bootstrap: creates a single user with admin role, then should be deleted.
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }
  const token = req.headers.get("x-bootstrap-token");
  const expected = Deno.env.get("BOOTSTRAP_TOKEN");
  if (!expected || token !== expected) {
    return new Response(JSON.stringify({ error: "forbidden" }), { status: 403 });
  }
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data, error } = await admin.auth.admin.createUser({
    email: "august@profsyn.dk",
    password: "Skyttebjerg2007",
    email_confirm: true,
    user_metadata: { full_name: "August" },
  });
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }
  const { error: roleError } = await admin
    .from("user_roles")
    .insert({ user_id: data.user.id, role: "admin" });
  if (roleError) {
    return new Response(JSON.stringify({ error: roleError.message, user_id: data.user.id }), { status: 500 });
  }
  return new Response(JSON.stringify({ success: true, user_id: data.user.id, email: data.user.email }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
