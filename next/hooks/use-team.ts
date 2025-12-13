"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Team, TeamMembership, Profile, TeamInvitation } from "@/lib/types/team";

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const supabase = createClient();

  const fetchProfile = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setProfile(null);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (fetchError) throw fetchError;
      setProfile(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch profile"));
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return { profile, isLoading, error, refetch: fetchProfile };
}

export function useTeams() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const supabase = createClient();

  const fetchTeams = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data, error: fetchError } = await supabase
        .from("teams")
        .select("*")
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;
      setTeams(data || []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch teams"));
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  return { teams, isLoading, error, refetch: fetchTeams };
}

export function useTeamMembers(teamId: string) {
  const [members, setMembers] = useState<TeamMembership[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const supabase = createClient();

  const fetchMembers = useCallback(async () => {
    if (!teamId) return;

    try {
      setIsLoading(true);
      const { data, error: fetchError } = await supabase
        .from("team_memberships")
        .select(`
          *,
          profile:profiles(*),
          team_roles(*)
        `)
        .eq("team_id", teamId);

      if (fetchError) throw fetchError;
      setMembers(data || []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch team members"));
    } finally {
      setIsLoading(false);
    }
  }, [teamId, supabase]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  return { members, isLoading, error, refetch: fetchMembers };
}

export function useTeamInvitations(teamId: string) {
  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const supabase = createClient();

  const fetchInvitations = useCallback(async () => {
    if (!teamId) return;

    try {
      setIsLoading(true);
      const { data, error: fetchError } = await supabase
        .from("team_invitations")
        .select(`
          *,
          inviter:profiles!invited_by(*)
        `)
        .eq("team_id", teamId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;
      setInvitations(data || []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch invitations"));
    } finally {
      setIsLoading(false);
    }
  }, [teamId, supabase]);

  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations]);

  return { invitations, isLoading, error, refetch: fetchInvitations };
}

export function useCreateTeam() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const supabase = createClient();

  const createTeam = useCallback(async (name: string, description?: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("Not authenticated");
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-team`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ name, description }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create team");
      }

      return data;
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to create team");
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  return { createTeam, isLoading, error };
}

export function useInviteMember() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const supabase = createClient();

  const inviteMember = useCallback(async (
    teamId: string,
    email: string,
    role: "admin" | "member" | "viewer"
  ) => {
    try {
      setIsLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("Not authenticated");
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/invite-member`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ teamId, email, role }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to invite member");
      }

      return data;
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to invite member");
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  return { inviteMember, isLoading, error };
}

export function useAcceptInvitation() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const supabase = createClient();

  const acceptInvitation = useCallback(async (token: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("Not authenticated");
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/accept-invitation`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ token }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to accept invitation");
      }

      return data;
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to accept invitation");
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  return { acceptInvitation, isLoading, error };
}
