"use client";

import { useEffect, useState } from "react";
import {
  Settings,
  Save,
  User,
  Bell,
  Shield,
  Palette,
  Globe,
  Key,
  Building,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/dashboard/page-header";
import { ProtectedPage } from "@/components/dashboard/protected-page";
import { PERMISSIONS, useRBAC, PermissionGate } from "@/lib/rbac";
import { toast } from "sonner";

interface UserSettings {
  email: string;
  displayName: string;
  notifications: {
    email: boolean;
    slack: boolean;
    criticalAlerts: boolean;
    weeklyDigest: boolean;
  };
  appearance: {
    theme: "light" | "dark" | "system";
    compactMode: boolean;
  };
}

interface TeamSettings {
  name: string;
  defaultRole: string;
  requireMFA: boolean;
  sessionTimeout: number;
}

export default function SettingsPage() {
  const [userSettings, setUserSettings] = useState<UserSettings>({
    email: "",
    displayName: "",
    notifications: {
      email: true,
      slack: false,
      criticalAlerts: true,
      weeklyDigest: false,
    },
    appearance: {
      theme: "system",
      compactMode: false,
    },
  });

  const [teamSettings, setTeamSettings] = useState<TeamSettings>({
    name: "",
    defaultRole: "viewer",
    requireMFA: false,
    sessionTimeout: 30,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { can } = useRBAC();

  useEffect(() => {
    const fetchSettings = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // Fetch user profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        if (profile) {
          setUserSettings((prev) => ({
            ...prev,
            email: user.email || "",
            displayName: profile.display_name || user.email?.split("@")[0] || "",
          }));
        }

        // Fetch team settings
        const { data: membership } = await supabase
          .from("team_memberships")
          .select("team_id, teams(name)")
          .eq("user_id", user.id)
          .single();

        if (membership) {
          setTeamSettings((prev) => ({
            ...prev,
            name: (membership as any).teams?.name || "",
          }));
        }
      }

      setIsLoading(false);
    };

    fetchSettings();
  }, []);

  const handleSaveUserSettings = async () => {
    setIsSaving(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { error } = await supabase
          .from("profiles")
          .update({ display_name: userSettings.displayName })
          .eq("id", user.id);

        if (error) throw error;
        toast.success("Settings saved successfully");
      }
    } catch (error) {
      toast.error("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveTeamSettings = async () => {
    setIsSaving(true);
    try {
      toast.success("Team settings saved");
    } catch (error) {
      toast.error("Failed to save team settings");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <ProtectedPage permission={PERMISSIONS.SETTINGS_VIEW}>
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-64 bg-muted rounded" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </ProtectedPage>
    );
  }

  return (
    <ProtectedPage permission={PERMISSIONS.SETTINGS_VIEW}>
      <PageHeader
        title="Settings"
        description="Manage your account and team settings"
        icon={Settings}
      />

      <div className="space-y-8 max-w-3xl">
        {/* Profile Settings */}
        <section className="rounded-lg border bg-card p-6">
          <div className="flex items-center gap-2 mb-6">
            <User className="size-5 text-primary" />
            <h2 className="text-lg font-semibold">Profile</h2>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={userSettings.email} disabled />
              <p className="text-xs text-muted-foreground">
                Contact support to change your email address
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                value={userSettings.displayName}
                onChange={(e) =>
                  setUserSettings({ ...userSettings, displayName: e.target.value })
                }
              />
            </div>
          </div>
        </section>

        {/* Notification Settings */}
        <section className="rounded-lg border bg-card p-6">
          <div className="flex items-center gap-2 mb-6">
            <Bell className="size-5 text-primary" />
            <h2 className="text-lg font-semibold">Notifications</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Email Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Receive notifications via email
                </p>
              </div>
              <Switch
                checked={userSettings.notifications.email}
                onCheckedChange={(checked) =>
                  setUserSettings({
                    ...userSettings,
                    notifications: { ...userSettings.notifications, email: checked },
                  })
                }
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <Label>Critical Alerts</Label>
                <p className="text-sm text-muted-foreground">
                  Get notified for critical issues immediately
                </p>
              </div>
              <Switch
                checked={userSettings.notifications.criticalAlerts}
                onCheckedChange={(checked) =>
                  setUserSettings({
                    ...userSettings,
                    notifications: {
                      ...userSettings.notifications,
                      criticalAlerts: checked,
                    },
                  })
                }
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <Label>Weekly Digest</Label>
                <p className="text-sm text-muted-foreground">
                  Receive a weekly summary of cluster activity
                </p>
              </div>
              <Switch
                checked={userSettings.notifications.weeklyDigest}
                onCheckedChange={(checked) =>
                  setUserSettings({
                    ...userSettings,
                    notifications: {
                      ...userSettings.notifications,
                      weeklyDigest: checked,
                    },
                  })
                }
              />
            </div>
          </div>
        </section>

        {/* Appearance Settings */}
        <section className="rounded-lg border bg-card p-6">
          <div className="flex items-center gap-2 mb-6">
            <Palette className="size-5 text-primary" />
            <h2 className="text-lg font-semibold">Appearance</h2>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Theme</Label>
              <Select
                value={userSettings.appearance.theme}
                onValueChange={(value) =>
                  value && setUserSettings({
                    ...userSettings,
                    appearance: { ...userSettings.appearance, theme: value as "light" | "dark" | "system" },
                  })
                }
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <Label>Compact Mode</Label>
                <p className="text-sm text-muted-foreground">
                  Use smaller spacing and fonts
                </p>
              </div>
              <Switch
                checked={userSettings.appearance.compactMode}
                onCheckedChange={(checked) =>
                  setUserSettings({
                    ...userSettings,
                    appearance: { ...userSettings.appearance, compactMode: checked },
                  })
                }
              />
            </div>
          </div>
        </section>

        <div className="flex justify-end">
          <Button onClick={handleSaveUserSettings} disabled={isSaving}>
            <Save className="size-4 mr-2" />
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>

        <Separator className="my-8" />

        {/* Team Settings - Only for users with edit permissions */}
        <PermissionGate permission={PERMISSIONS.SETTINGS_EDIT}>
          <section className="rounded-lg border bg-card p-6">
            <div className="flex items-center gap-2 mb-6">
              <Building className="size-5 text-primary" />
              <h2 className="text-lg font-semibold">Team Settings</h2>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="teamName">Team Name</Label>
                <Input
                  id="teamName"
                  value={teamSettings.name}
                  onChange={(e) =>
                    setTeamSettings({ ...teamSettings, name: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Default Role for New Members</Label>
                <Select
                  value={teamSettings.defaultRole}
                  onValueChange={(value) =>
                    value && setTeamSettings({ ...teamSettings, defaultRole: value })
                  }
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="contributor">Contributor</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label>Require MFA</Label>
                  <p className="text-sm text-muted-foreground">
                    Require multi-factor authentication for all team members
                  </p>
                </div>
                <Switch
                  checked={teamSettings.requireMFA}
                  onCheckedChange={(checked) =>
                    setTeamSettings({ ...teamSettings, requireMFA: checked })
                  }
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Session Timeout (minutes)</Label>
                <Select
                  value={teamSettings.sessionTimeout.toString()}
                  onValueChange={(value) =>
                    value && setTeamSettings({
                      ...teamSettings,
                      sessionTimeout: parseInt(value),
                    })
                  }
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 minutes</SelectItem>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="60">1 hour</SelectItem>
                    <SelectItem value="120">2 hours</SelectItem>
                    <SelectItem value="480">8 hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <Button onClick={handleSaveTeamSettings} disabled={isSaving}>
                <Save className="size-4 mr-2" />
                {isSaving ? "Saving..." : "Save Team Settings"}
              </Button>
            </div>
          </section>
        </PermissionGate>

        {/* Security Section */}
        <section className="rounded-lg border bg-card p-6">
          <div className="flex items-center gap-2 mb-6">
            <Shield className="size-5 text-primary" />
            <h2 className="text-lg font-semibold">Security</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Change Password</Label>
                <p className="text-sm text-muted-foreground">
                  Update your account password
                </p>
              </div>
              <Button variant="outline">
                <Key className="size-4 mr-2" />
                Change Password
              </Button>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <Label>Two-Factor Authentication</Label>
                <p className="text-sm text-muted-foreground">
                  Add an extra layer of security to your account
                </p>
              </div>
              <Button variant="outline">Enable 2FA</Button>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <Label>API Keys</Label>
                <p className="text-sm text-muted-foreground">
                  Manage your API keys for programmatic access
                </p>
              </div>
              <Button variant="outline">Manage Keys</Button>
            </div>
          </div>
        </section>
      </div>
    </ProtectedPage>
  );
}
