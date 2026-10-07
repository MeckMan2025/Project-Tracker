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

    // Service role. Used for the authorisation check below as well as the
    // reset itself, because a caller cannot be trusted to report their own
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

    // A sister team's coach administers their own team's accounts. That login
    // carries the Team tag rather than a lead tag, so the check above says no
    // — correctly, because they are not one of our leads. What they are is the
    // controller of exactly one team, and that is the reach they get: this
    // authorises them for members of that team and for nobody else.
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

    if (profileError && !callerTeam) {
      return new Response(
        JSON.stringify({ error: "Could not read your permissions" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!isLead && !callerTeam) {
      return new Response(
        JSON.stringify({ error: "Only leads can reset passwords" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse request body. newEmail is optional and is how a team gets a new
    // coach: the address IS the login, so it has to move with the person or
    // the new coach cannot get in and the old one still can.
    const { userId, newPassword, newEmail } = await req.json();

    if (!userId || (!newPassword && !newEmail)) {
      return new Response(
        JSON.stringify({ error: "userId and one of newPassword or newEmail are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // The reach, enforced. A team controller acts on their own team's members
    // and nothing else — without this the authorisation above would let one
    // team's coach reset any account in the app, ours included.
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
          JSON.stringify({ error: "You can only reset passwords for your own team" }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      // Moving a login to a new address is how a team changes coach. That
      // stays with our leads: a coach must not be able to reassign the
      // account they are signed in as.
      if (newEmail) {
        return new Response(
          JSON.stringify({ error: "Only leads can change a login email" }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    if (newPassword && newPassword.length < 6) {
      return new Response(
        JSON.stringify({
          error: "Password must be at least 6 characters",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Whichever was asked for. Both go through the same call, so changing a
    // team's coach and resetting their password are one round trip when both
    // are needed.
    const changes: Record<string, unknown> = {};
    if (newPassword) changes.password = newPassword;
    if (newEmail) {
      changes.email = String(newEmail).trim().toLowerCase();
      // Admin-set, so there is nobody to click a confirmation link.
      changes.email_confirm = true;
    }

    const { error: resetError } =
      await supabaseAdmin.auth.admin.updateUserById(userId, changes);

    if (resetError) {
      return new Response(JSON.stringify({ error: resetError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Force password change on next login
    await supabaseAdmin
      .from("profiles")
      .update({ must_change_password: !!newPassword })
      .eq("id", userId);

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
