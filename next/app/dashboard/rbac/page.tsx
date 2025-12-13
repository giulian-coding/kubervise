"use client";

import { useEffect, useState } from "react";
import {
  Users,
  RefreshCw,
  MoreHorizontal,
  UserPlus,
  Trash2,
  Shield,
  Mail,
  Crown,
  UserCog,
  User,
  Eye,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/dashboard/page-header";
import { ProtectedPage } from "@/components/dashboard/protected-page";
import {
  PERMISSIONS,
  ROLE_DISPLAY_NAMES,
  ROLE_DESCRIPTIONS,
  useRBAC,
  PermissionButton,
} from "@/lib/rbac";
import { toast } from "sonner";
import type { TeamRoleType } from "@/lib/types/database";

interface TeamMember {
  id: string;
  user_id: string;
  email: string;
  role: TeamRoleType;
  joined_at: string;
}

export default function RBACPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<TeamRoleType>("viewer");
  const { can, role: currentUserRole } = useRBAC();

  const fetchMembers = async () => {
    const supabase = createClient();

    // Get current user's team
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: membership } = await supabase
      .from("team_memberships")
      .select("team_id")
      .eq("user_id", user.id)
      .single();

    if (!membership) return;

    // Get all members of the team
    const { data: memberships } = await supabase
      .from("team_memberships")
      .select("*, profiles(email)")
      .eq("team_id", membership.team_id);

    if (memberships) {
      setMembers(
        memberships.map((m) => ({
          id: m.id,
          user_id: m.user_id,
          email: (m as any).profiles?.email || "Unknown",
          role: m.role,
          joined_at: m.created_at,
        }))
      );
    }

    setIsLoading(false);
    setIsRefreshing(false);
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchMembers();
  };

  const handleInvite = async () => {
    if (!inviteEmail) {
      toast.error("Please enter an email address");
      return;
    }

    toast.success(`Invitation sent to ${inviteEmail}`);
    setIsInviteDialogOpen(false);
    setInviteEmail("");
    setInviteRole("viewer");
  };

  const handleRoleChange = async (memberId: string, newRole: TeamRoleType) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("team_memberships")
      .update({ role: newRole })
      .eq("id", memberId);

    if (error) {
      toast.error("Failed to update role");
    } else {
      toast.success("Role updated successfully");
      fetchMembers();
    }
  };

  const handleRemoveMember = async (memberId: string, email: string) => {
    if (!confirm(`Are you sure you want to remove ${email} from the team?`)) return;

    const supabase = createClient();
    const { error } = await supabase
      .from("team_memberships")
      .delete()
      .eq("id", memberId);

    if (error) {
      toast.error("Failed to remove member");
    } else {
      toast.success("Member removed");
      fetchMembers();
    }
  };

  const getRoleIcon = (role: TeamRoleType) => {
    switch (role) {
      case "owner":
        return <Crown className="size-4 text-yellow-500" />;
      case "admin":
        return <Shield className="size-4 text-blue-500" />;
      case "contributor":
        return <UserCog className="size-4 text-green-500" />;
      case "viewer":
        return <Eye className="size-4 text-gray-500" />;
    }
  };

  const getRoleBadge = (role: TeamRoleType) => {
    const variants: Record<TeamRoleType, "default" | "secondary" | "outline"> = {
      owner: "default",
      admin: "secondary",
      contributor: "outline",
      viewer: "outline",
    };
    return (
      <Badge variant={variants[role]} className="gap-1">
        {getRoleIcon(role)}
        {ROLE_DISPLAY_NAMES[role]}
      </Badge>
    );
  };

  const canEditRole = (memberRole: TeamRoleType) => {
    if (currentUserRole === "owner") return memberRole !== "owner";
    if (currentUserRole === "admin") return memberRole !== "owner" && memberRole !== "admin";
    return false;
  };

  return (
    <ProtectedPage
      permission={PERMISSIONS.TEAM_CHANGE_ROLES}
      title="Access Denied"
      description="You need owner permissions to manage team access."
    >
      <PageHeader
        title="Access Control"
        description="Manage team members and their roles"
        icon={Users}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw
                className={`size-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
            <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
              <DialogTrigger asChild>
                <PermissionButton
                  permission={PERMISSIONS.TEAM_INVITE}
                  toastMessage="You need invite permissions to add members"
                >
                  <Button size="sm">
                    <UserPlus className="size-4 mr-2" />
                    Invite Member
                  </Button>
                </PermissionButton>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite Team Member</DialogTitle>
                  <DialogDescription>
                    Send an invitation to add a new member to your team.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="member@example.com"
                        className="pl-10"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Role</Label>
                    <Select
                      value={inviteRole}
                      onValueChange={(value) => value && setInviteRole(value as TeamRoleType)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">
                          <div className="flex items-center gap-2">
                            <Shield className="size-4 text-blue-500" />
                            Admin
                          </div>
                        </SelectItem>
                        <SelectItem value="contributor">
                          <div className="flex items-center gap-2">
                            <UserCog className="size-4 text-green-500" />
                            Contributor
                          </div>
                        </SelectItem>
                        <SelectItem value="viewer">
                          <div className="flex items-center gap-2">
                            <Eye className="size-4 text-gray-500" />
                            Viewer
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {ROLE_DESCRIPTIONS[inviteRole]}
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsInviteDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleInvite}>Send Invitation</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {/* Role Legend */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        {(["owner", "admin", "contributor", "viewer"] as TeamRoleType[]).map((role) => (
          <div key={role} className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 mb-2">
              {getRoleIcon(role)}
              <span className="font-medium">{ROLE_DISPLAY_NAMES[role]}</span>
            </div>
            <p className="text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[role]}</p>
          </div>
        ))}
      </div>

      {/* Members Table */}
      {isLoading ? (
        <div className="rounded-lg border">
          <div className="p-4 space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-12 bg-muted rounded animate-pulse" />
            ))}
          </div>
        </div>
      ) : members.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] rounded-lg border bg-card">
          <Users className="size-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">No team members</h2>
          <p className="text-muted-foreground">Invite your first team member to get started</p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="w-[70px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="size-4 text-primary" />
                      </div>
                      <span className="font-medium">{member.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {canEditRole(member.role) ? (
                      <Select
                        value={member.role}
                        onValueChange={(value) =>
                          value && handleRoleChange(member.id, value as TeamRoleType)
                        }
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {member.role !== "owner" && (
                            <>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="contributor">Contributor</SelectItem>
                              <SelectItem value="viewer">Viewer</SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    ) : (
                      getRoleBadge(member.role)
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(member.joined_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {member.role !== "owner" && can(PERMISSIONS.TEAM_REMOVE_MEMBER) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleRemoveMember(member.id, member.email)}
                          >
                            <Trash2 className="size-4 mr-2" />
                            Remove from team
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </ProtectedPage>
  );
}
