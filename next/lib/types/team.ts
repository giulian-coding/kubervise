// Team types

export type TeamRoleType = "owner" | "admin" | "member" | "viewer";
export type OnboardingStatus = "pending" | "completed" | "skipped";
export type InvitationStatus = "pending" | "accepted" | "declined" | "expired";

export interface Profile {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  website: string | null;
  onboarding_status: OnboardingStatus;
  onboarding_completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Team {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  avatar_url: string | null;
  owner_id: string;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface TeamRole {
  id: string;
  role: TeamRoleType;
  name: string;
  permissions: string[];
  created_at: string;
}

export interface TeamMembership {
  id: number;
  profile_id: string;
  team_id: string;
  role_id: string;
  created_at: string;
  // Joined data
  profile?: Profile;
  team?: Team;
  team_roles?: TeamRole;
}

export interface TeamInvitation {
  id: string;
  team_id: string;
  email: string;
  role: TeamRoleType;
  invited_by: string;
  status: InvitationStatus;
  token: string;
  expires_at: string;
  created_at: string;
  accepted_at: string | null;
  // Joined data
  team?: Team;
  inviter?: Profile;
}

export interface TeamWithMembership extends Team {
  membership?: TeamMembership;
  memberCount?: number;
}
