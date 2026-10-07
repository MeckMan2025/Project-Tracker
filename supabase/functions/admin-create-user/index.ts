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

    // Verify caller is a lead (has a lead-level function tag)
    const LEAD_TAGS = ['Co-Founder', 'Mentor', 'Coach', 'Team Lead', 'Business Lead', 'Technical Lead'];
    const { data: profile, error: profileError } = await supabaseUser
      .from("profiles")
      .select("function_tags")
      .eq("id", caller.id)
      .single();

    const callerTags = profile?.function_tags || [];
    const isLead = callerTags.some((t: string) => LEAD_TAGS.includes(t));

    // A sister team's coach adds people to their own roster. That login
    // carries the Team tag rather than a lead tag, so the check above says no
    // — correctly, because they are not one of our leads. What they are is the
    // controller of exactly one team, and the account they create lands on
    // that team rather than on ours.
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
        JSON.stringify({ error: "Only leads can create accounts" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse request body
    const { email, password, displayName, role } = await req.json();

    if (!email || !password || !displayName) {
      return new Response(
        JSON.stringify({
          error: "email, password, and displayName are required",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: "Password must be at least 6 characters" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }


    // Create the user account (email_confirm: true skips email verification)
    const { data: newUser, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email: email.toLowerCase().trim(),
        password,
        email_confirm: true,
      });

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create profile row with must_change_password flag
    const authorityTier = role === 'guest' ? 'guest' : 'teammate';
    const functionTags = role === 'guest' ? ['Guest'] : [];
    const { error: profileInsertError } = await supabaseAdmin
      .from("profiles")
      .insert({
        id: newUser.user.id,
        display_name: displayName.trim(),
        role: role || "member",
        authority_tier: authorityTier,
        function_tags: functionTags,
        must_change_password: true,
        // Created by a team's own coach, so it is their member, not ours.
        // A lead creating from our side leaves this null, which means us.
        ...(callerTeam ? { team_number: callerTeam } : {}),
      });

    if (profileInsertError) {
      return new Response(
        JSON.stringify({ error: profileInsertError.message }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        userId: newUser.user.id,
        displayName: displayName.trim(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
