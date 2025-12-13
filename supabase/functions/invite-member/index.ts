import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { getSupabaseClient, getSupabaseAdmin } from '../_shared/supabase.ts'

interface InviteMemberRequest {
  teamId: string
  email: string
  role: 'admin' | 'member' | 'viewer'
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
    const { teamId, email, role }: InviteMemberRequest = await req.json()

    if (!teamId || !email || !role) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: teamId, email, role' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user has permission to invite (owner or admin)
    const { data: membership } = await supabaseAdmin
      .from('team_memberships')
      .select(`
        *,
        team_roles!inner(role)
      `)
      .eq('profile_id', user.id)
      .eq('team_id', teamId)
      .single()

    if (!membership || !['owner', 'admin'].includes(membership.team_roles.role)) {
      return new Response(
        JSON.stringify({ error: 'You do not have permission to invite members to this team' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user is already a member
    const { data: existingUser } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', (
        await supabaseAdmin.auth.admin.listUsers()
      ).data.users.find(u => u.email === email)?.id)
      .single()

    if (existingUser) {
      const { data: existingMembership } = await supabaseAdmin
        .from('team_memberships')
        .select('id')
        .eq('profile_id', existingUser.id)
        .eq('team_id', teamId)
        .single()

      if (existingMembership) {
        return new Response(
          JSON.stringify({ error: 'User is already a member of this team' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Check for existing pending invitation
    const { data: existingInvitation } = await supabaseAdmin
      .from('team_invitations')
      .select('id')
      .eq('team_id', teamId)
      .eq('email', email.toLowerCase())
      .eq('status', 'pending')
      .single()

    if (existingInvitation) {
      return new Response(
        JSON.stringify({ error: 'An invitation is already pending for this email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create invitation
    const { data: invitation, error: inviteError } = await supabaseAdmin
      .from('team_invitations')
      .insert({
        team_id: teamId,
        email: email.toLowerCase(),
        role: role,
        invited_by: user.id,
      })
      .select()
      .single()

    if (inviteError) {
      console.error('Error creating invitation:', inviteError)
      return new Response(
        JSON.stringify({ error: 'Failed to create invitation' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get team name for the email
    const { data: team } = await supabaseAdmin
      .from('teams')
      .select('name')
      .eq('id', teamId)
      .single()

    // TODO: Send invitation email using Supabase Auth or external email service
    // For now, we'll just return the invitation token
    // In production, you would send an email with a link like:
    // https://your-app.com/invite?token=${invitation.token}

    return new Response(
      JSON.stringify({
        success: true,
        invitation: {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          expiresAt: invitation.expires_at,
          // Include token for testing - in production, only send via email
          token: invitation.token,
          inviteUrl: `${Deno.env.get('PUBLIC_SITE_URL') || 'http://localhost:3000'}/invite?token=${invitation.token}`,
        },
        teamName: team?.name,
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
