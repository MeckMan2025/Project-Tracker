import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create a client with the caller's JWT to verify identity
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Service role. Used for the authorisation check below as well as the work
    // itself, because a caller cannot be trusted to report their own
    // permissions and RLS would hide the rows that settle it.
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const {
      data: { user: caller },
      error: authError,
    } = await supabaseUser.auth.getUser();

    if (authError || !caller) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is a lead
    const { data: profile, error: profileError } = await supabaseUser
      .from("profiles")
      .select("role")
      .eq("id", caller.id)
      .single();

    const isLead = !profileError && profile?.role === "lead";

    // A sister team's coach administers their own team's accounts. That login
    // carries the Team tag rather than a lead tag, so the check above says no
    // — correctly, because they are not one of our leads. What they are is the
    // controller of exactly one team, and that is the reach they get.
    //
    // full_access is required, so an ordinary visiting team's coach gains
    // nothing. Asked with the service role and keyed on the verified caller
    // id, because the caller does not get to say who they are.
    let callerTeam: string | null = null;
    if (!isLead) {
      const { data: controlled } = await supabaseAdmin
        .from("team_accounts")
        .select("team_number, full_access")
        .eq("user_id", caller.id)
        .limit(1);
      const row = controlled?.[0];
      if (row?.full_access && row.team_number) callerTeam = String(row.team_number);
    }

    if (!isLead && !callerTeam) {
      return new Response(
        JSON.stringify({ error: "Only leads can update roles" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse request body
    const { userId, functionTags } = await req.json();

    if (!userId || !Array.isArray(functionTags)) {
      return new Response(
        JSON.stringify({ error: "userId and functionTags array are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create admin client with service role key

    // Update the function_tags
    // The reach, enforced. A team controller acts on their own team's members
    // and nobody else — without this the authorisation above would let one
    // team's coach reach any account in the app, ours included.
    if (callerTeam) {
      const { data: target } = await supabaseAdmin
        .from("profiles")
        .select("team_number")
        .eq("id", userId)
        .limit(1);
      const targetTeam = target?.[0]?.team_number
        ? String(target[0].team_number)
        : null;
      if (targetTeam !== callerTeam) {
        return new Response(
          JSON.stringify({ error: "You can only change roles for your own team's members" }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({ function_tags: functionTags })
      .eq("id", userId);

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
