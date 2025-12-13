import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { getSupabaseClient, getSupabaseAdmin } from '../_shared/supabase.ts'

interface CreateTeamRequest {
  name: string
  description?: string
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = getSupabaseClient(authHeader)
    const supabaseAdmin = getSupabaseAdmin()

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const { name, description }: CreateTeamRequest = await req.json()

    if (!name || name.trim().length < 2) {
      return new Response(
        JSON.stringify({ error: 'Team name must be at least 2 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user already has a team (for onboarding)
    const { data: existingMembership } = await supabaseAdmin
      .from('team_memberships')
      .select('team_id')
      .eq('profile_id', user.id)
      .limit(1)
      .single()

    // Create the team using admin client to bypass RLS for initial creation
    const { data: team, error: teamError } = await supabaseAdmin
      .from('teams')
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        owner_id: user.id,
      })
      .select()
      .single()

    if (teamError) {
      console.error('Error creating team:', teamError)
      return new Response(
        JSON.stringify({ error: 'Failed to create team', details: teamError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update user's onboarding status if this is their first team
    if (!existingMembership) {
      await supabaseAdmin
        .from('profiles')
        .update({
          onboarding_status: 'completed',
          onboarding_completed_at: new Date().toISOString(),
        })
        .eq('id', user.id)
    }

    return new Response(
      JSON.stringify({
        success: true,
        team: {
          id: team.id,
          name: team.name,
          slug: team.slug,
          description: team.description,
        },
        isFirstTeam: !existingMembership,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
