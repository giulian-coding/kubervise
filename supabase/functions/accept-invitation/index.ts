import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { getSupabaseClient, getSupabaseAdmin } from '../_shared/supabase.ts'

interface AcceptInvitationRequest {
  token: string
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
    const { token }: AcceptInvitationRequest = await req.json()

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Missing invitation token' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Find the invitation
    const { data: invitation, error: inviteError } = await supabaseAdmin
      .from('team_invitations')
      .select('*, teams(name, slug)')
      .eq('token', token)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .single()

    if (inviteError || !invitation) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired invitation' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user email matches invitation
    if (user.email?.toLowerCase() !== invitation.email.toLowerCase()) {
      return new Response(
        JSON.stringify({
          error: 'This invitation was sent to a different email address',
          invitedEmail: invitation.email,
          yourEmail: user.email,
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user is already a member
    const { data: existingMembership } = await supabaseAdmin
      .from('team_memberships')
      .select('id')
      .eq('profile_id', user.id)
      .eq('team_id', invitation.team_id)
      .single()

    if (existingMembership) {
      // Mark invitation as accepted anyway
      await supabaseAdmin
        .from('team_invitations')
        .update({ status: 'accepted', accepted_at: new Date().toISOString() })
        .eq('id', invitation.id)

      return new Response(
        JSON.stringify({
          success: true,
          message: 'You are already a member of this team',
          team: invitation.teams,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get or create role
    const { data: role } = await supabaseAdmin
      .from('team_roles')
      .select('id')
      .eq('role', invitation.role)
      .single()

    if (!role) {
      return new Response(
        JSON.stringify({ error: 'Invalid role configuration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Add user to team
    const { error: membershipError } = await supabaseAdmin
      .from('team_memberships')
      .insert({
        profile_id: user.id,
        team_id: invitation.team_id,
        role_id: role.id,
      })

    if (membershipError) {
      console.error('Error creating membership:', membershipError)
      return new Response(
        JSON.stringify({ error: 'Failed to join team' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update invitation status
    await supabaseAdmin
      .from('team_invitations')
      .update({ status: 'accepted', accepted_at: new Date().toISOString() })
      .eq('id', invitation.id)

    // Update onboarding status if needed
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('onboarding_status')
      .eq('id', user.id)
      .single()

    if (profile?.onboarding_status === 'pending') {
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
        message: `You have joined ${invitation.teams.name}`,
        team: {
          id: invitation.team_id,
          name: invitation.teams.name,
          slug: invitation.teams.slug,
        },
        role: invitation.role,
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
