import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { code, state } = await req.json();

    const AUTHENTIK_ISSUER = Deno.env.get("AUTHENTIK_ISSUER");
    const AUTHENTIK_CLIENT_ID = Deno.env.get("AUTHENTIK_CLIENT_ID");
    const AUTHENTIK_CLIENT_SECRET = Deno.env.get("AUTHENTIK_CLIENT_SECRET");
    const REDIRECT_URI = Deno.env.get("AUTHENTIK_REDIRECT_URI");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!AUTHENTIK_ISSUER || !AUTHENTIK_CLIENT_ID || !AUTHENTIK_CLIENT_SECRET || !REDIRECT_URI) {
      return new Response(
        JSON.stringify({ error: "Authentik niet geconfigureerd" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Exchange authorization code for tokens
    const tokenResponse = await fetch(`${AUTHENTIK_ISSUER}/application/o/token/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
        client_id: AUTHENTIK_CLIENT_ID,
        client_secret: AUTHENTIK_CLIENT_SECRET,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Token exchange failed:", errorText);
      return new Response(
        JSON.stringify({ error: "Token exchange mislukt" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tokens = await tokenResponse.json();

    // Get user info from Authentik
    const userInfoResponse = await fetch(`${AUTHENTIK_ISSUER}/application/o/userinfo/`, {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    if (!userInfoResponse.ok) {
      return new Response(
        JSON.stringify({ error: "Gebruikersinfo ophalen mislukt" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userInfo = await userInfoResponse.json();
    console.log("User info from Authentik:", userInfo);

    // Create Supabase admin client
    const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Check if user exists by email
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    let existingUser = existingUsers?.users?.find(u => u.email === userInfo.email);

    let userId: string;

    if (existingUser) {
      // User exists, update their metadata
      userId = existingUser.id;
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: {
          full_name: userInfo.name || userInfo.preferred_username,
          avatar_url: userInfo.picture,
          authentik_sub: userInfo.sub,
        },
      });
    } else {
      // Create new user
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: userInfo.email,
        email_confirm: true,
        user_metadata: {
          full_name: userInfo.name || userInfo.preferred_username,
          avatar_url: userInfo.picture,
          authentik_sub: userInfo.sub,
        },
      });

      if (createError) {
        console.error("Error creating user:", createError);
        return new Response(
          JSON.stringify({ error: "Gebruiker aanmaken mislukt" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      userId = newUser.user.id;
    }

    // Generate a session for the user using a magic link approach
    // We'll generate a one-time token that the client can use
    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: userInfo.email,
      options: {
        redirectTo: '/',
      },
    });

    if (sessionError) {
      console.error("Error generating session:", sessionError);
      return new Response(
        JSON.stringify({ error: "Sessie aanmaken mislukt" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract the token from the magic link
    const magicLinkUrl = new URL(sessionData.properties.action_link);
    const token = magicLinkUrl.searchParams.get('token');
    const tokenType = magicLinkUrl.searchParams.get('type');

    return new Response(
      JSON.stringify({ 
        success: true,
        token,
        tokenType,
        email: userInfo.email,
        redirectUrl: sessionData.properties.action_link,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in authentik-callback:", error);
    const errorMessage = error instanceof Error ? error.message : "Onbekende fout";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
