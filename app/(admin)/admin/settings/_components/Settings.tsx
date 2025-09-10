"use client";

import { useState, useMemo, useEffect, useTransition } from "react";
import axios from "axios";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  UserPlus,
  Edit,
  Trash2,
  ShieldCheck,
  Users,
  Trophy,
  Newspaper,
  ShoppingCart,
  Crown,
  Loader2,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { FullLoader, Loader } from "@/components/Loader";

// Backend user interface matching your API response
interface BackendUser {
  user_id: number;
  username: string;
  email: string;
  role: "admin" | "player";
  status: "active" | "suspended";
  roles: string[];
}

// Frontend interface for admin users
interface AdminUser {
  id: string;
  username: string;
  email: string;
  roles: string[];
  permissions: string[];
  status: "active" | "suspended";
  lastLogin: string;
  createdAt: string;
  isPlayer: boolean;
}

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  color: string;
}

const availablePermissions = [
  {
    id: "shop_manage",
    name: "Shop Management",
    description: "Manage shop inventory, orders, and products",
  },
  {
    id: "news_manage",
    name: "News Management",
    description: "Create, edit, and publish news articles",
  },
  {
    id: "teams_manage",
    name: "Teams Management",
    description: "Manage teams, rosters, and team verification",
  },
  {
    id: "players_manage",
    name: "Players Management",
    description: "Manage player profiles and statistics",
  },
  {
    id: "leaderboards_manage",
    name: "Leaderboards Management",
    description: "Create and manage tournament leaderboards",
  },
  {
    id: "rankings_manage",
    name: "Rankings & Tiers Management",
    description: "Manage team rankings and tier systems",
  },
  {
    id: "events_manage",
    name: "Events Management",
    description: "Create and manage tournaments and scrims",
  },
  {
    id: "partner_manage",
    name: "Partner Management",
    description: "Manage partner relationships and verifications",
  },
  {
    id: "admin_manage",
    name: "Admin Management",
    description: "Manage other administrators and roles",
  },
  {
    id: "system_settings",
    name: "System Settings",
    description: "Access system-wide settings and configurations",
  },
];

const predefinedRoles: Role[] = [
  {
    id: "head_admin",
    name: "Head Admin",
    description: "Full system access with all permissions",
    permissions: availablePermissions.map((p) => p.id),
    color: "bg-red-100 text-red-800",
  },
  {
    id: "shop_admin",
    name: "Shop Admin",
    description: "Manages shop operations and inventory",
    permissions: ["shop_manage"],
    color: "bg-green-100 text-green-800",
  },
  {
    id: "news_admin",
    name: "News Admin",
    description: "Manages news and announcements",
    permissions: ["news_manage"],
    color: "bg-blue-100 text-blue-800",
  },
  {
    id: "teams_admin",
    name: "Teams Admin",
    description: "Manages teams and players",
    permissions: ["teams_manage", "players_manage"],
    color: "bg-purple-100 text-purple-800",
  },
  {
    id: "events_admin",
    name: "Events Admin",
    description: "Manages tournaments, scrims, and leaderboards",
    permissions: ["events_manage", "leaderboards_manage", "rankings_manage"],
    color: "bg-yellow-100 text-yellow-800",
  },
  {
    id: "partner_admin",
    name: "Partner Admin",
    description: "Manages partner relationships",
    permissions: ["partner_manage"],
    color: "bg-indigo-100 text-indigo-800",
  },
];

export function Settings() {
  const { token } = useAuth();

  const [suspendPending, startSuspendTransition] = useTransition();
  const [editPending, startEditTransition] = useTransition();

  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    username: "",
    email: "",
    roles: [] as string[],
    permissions: [] as string[],
  });

  // Transform backend user data to frontend format
  const transformBackendUser = (backendUser: BackendUser): AdminUser => {
    // If the user has specific admin roles, use those, otherwise default based on role
    let roles =
      backendUser.roles && backendUser.roles.length > 0
        ? backendUser.roles
        : backendUser.role === "admin"
        ? ["Head Admin"]
        : [];

    const permissions = calculatePermissionsFromRoles(roles);

    return {
      id: backendUser.user_id.toString(),
      username: backendUser.username || `User${backendUser.user_id}`,
      email: backendUser.email,
      roles: roles,
      permissions: permissions,
      status: backendUser.status,
      lastLogin: "Unknown", // This data isn't in your backend response
      createdAt: "Unknown", // This data isn't in your backend response
      isPlayer: backendUser.role === "player",
    };
  };

  // Fetch users from backend
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/get-all-user-and-user-roles/`
      );

      if (response.data && response.data.users) {
        const transformedUsers = response.data.users.map(transformBackendUser);
        setAdminUsers(transformedUsers);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Failed to fetch users from server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Filter users - show both admins and players, but highlight admins
  const filteredUsers = useMemo(() => {
    return adminUsers.filter(
      (user) =>
        user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.roles.some((role) =>
          role.toLowerCase().includes(searchTerm.toLowerCase())
        )
    );
  }, [adminUsers, searchTerm]);

  // Separate admin users for the admin-specific view
  const adminOnlyUsers = useMemo(() => {
    return filteredUsers.filter(
      (user) => !user.isPlayer || user.roles.length > 0
    );
  }, [filteredUsers]);

  const calculatePermissionsFromRoles = (roles: string[]): string[] => {
    const allPermissions = new Set<string>();
    roles.forEach((roleName) => {
      const role = predefinedRoles.find((r) => r.name === roleName);
      if (role) {
        role.permissions.forEach((permission) =>
          allPermissions.add(permission)
        );
      }
    });
    return Array.from(allPermissions);
  };

  const handleRoleChange = (
    roleName: string,
    checked: boolean,
    isNewUser = false
  ) => {
    if (isNewUser) {
      const updatedRoles = checked
        ? [...newUser.roles, roleName]
        : newUser.roles.filter((role) => role !== roleName);

      const updatedPermissions = calculatePermissionsFromRoles(updatedRoles);

      setNewUser({
        ...newUser,
        roles: updatedRoles,
        permissions: updatedPermissions,
      });
    } else if (selectedUser) {
      const updatedRoles = checked
        ? [...selectedUser.roles, roleName]
        : selectedUser.roles.filter((role) => role !== roleName);

      const updatedPermissions = calculatePermissionsFromRoles(updatedRoles);

      setSelectedUser({
        ...selectedUser,
        roles: updatedRoles,
        permissions: updatedPermissions,
      });
    }
  };

  const handleAddUser = async () => {
    if (!newUser.username || !newUser.email || newUser.roles.length === 0) {
      toast.error(
        "Please fill in all required fields and select at least one role."
      );
      return;
    }

    try {
      // You'll need to implement the create user endpoint
      const response = await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/create-admin-user/`,
        {
          username: newUser.username,
          email: newUser.email,
          roles: newUser.roles,
          role: "admin", // Set as admin since they have roles
        }
      );

      if (response.data.success) {
        await fetchUsers(); // Refresh the user list
        setNewUser({ username: "", email: "", roles: [], permissions: [] });
        setIsAddUserOpen(false);
        toast.success(
          `Admin user ${newUser.username} has been created with ${newUser.roles.length} role(s).`
        );
      }
    } catch (error) {
      console.error("Error creating user:", error);
      toast.error("Failed to create admin user.");
    }
  };

  // Helper function to convert role names to role IDs
  const getRoleIds = (roleNames: string[]): string[] => {
    return roleNames
      .map((roleName) => {
        const role = predefinedRoles.find((r) => r.name === roleName);
        return role?.id || "";
      })
      .filter((id) => id !== "");
  };

  const handleEditUser = async () => {
    startEditTransition(async () => {
      if (!selectedUser) return;

      try {
        const roleIds = getRoleIds(selectedUser.roles);

        console.log({
          username: selectedUser.username,
          email: selectedUser.email,
          role_ids: roleIds,
        });

        const response = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/edit-user-roles/`,
          {
            username: selectedUser.username,
            email: selectedUser.email,
            role_ids: roleIds,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.data.success || response.status === 200) {
          await fetchUsers(); // Refresh the user list
          setIsEditUserOpen(false);
          setSelectedUser(null);
          toast.success("User has been updated successfully.");
        } else {
          toast.error(response.data.message || "Failed to update user");
        }
      } catch (error: any) {
        console.error("Error updating user:", error);
        toast.error(error.response?.data?.message || "Failed to update user.");
      }
    });
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      // You'll need to implement the delete user endpoint
      const response = await axios.delete(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/delete-user/${userId}/`
      );

      if (response.data.success) {
        await fetchUsers(); // Refresh the user list
        toast.success("User has been removed.");
      }
    } catch (error) {
      console.error("Error deleting user:", error);
      toast.error("Failed to delete user.");
    }
  };

  const handleSuspendUser = async (userId: string) => {
    startSuspendTransition(async () => {
      const user = adminUsers.find((u) => u.id === userId);
      if (!user) return;

      const isSuspending = user.status === "active";
      const endpoint = isSuspending ? "suspend-user" : "activate-user";
      const action = isSuspending ? "suspended" : "activated";

      try {
        const response = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/${endpoint}/`,
          {
            user_id: userId,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.data.success || response.status === 200) {
          await fetchUsers(); // Refresh the user list
          toast.success(`User has been ${action}.`);
        } else {
          toast.error(
            response.data.message || `Failed to ${action.slice(0, -1)} user`
          );
        }
      } catch (error: any) {
        console.error(`Error ${action.slice(0, -1)}ing user:`, error);
        toast.error(
          error.response?.data?.message ||
            `Failed to ${action.slice(0, -1)} user.`
        );
      }
    });
  };

  const getRoleColor = (roleName: string) => {
    const role = predefinedRoles.find((r) => r.name === roleName);
    return role?.color || "bg-gray-100 text-gray-800";
  };

  const getPermissionName = (permissionId: string) => {
    const permission = availablePermissions.find((p) => p.id === permissionId);
    return permission?.name || permissionId;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading users...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {suspendPending && <FullLoader />}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Settings</h1>
          <p className="text-muted-foreground">
            Manage administrator roles and permissions ({adminUsers.length}{" "}
            total users, {adminOnlyUsers.length} admins)
          </p>
        </div>
        <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Add Admin
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[700px]">
            <DialogHeader>
              <DialogTitle>Add New Admin</DialogTitle>
              <DialogDescription>
                Create a new administrator account with specific roles and
                permissions. You can assign multiple roles.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="username" className="text-right">
                  Username
                </Label>
                <Input
                  id="username"
                  value={newUser.username}
                  onChange={(e) =>
                    setNewUser({ ...newUser, username: e.target.value })
                  }
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="email" className="text-right">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={newUser.email}
                  onChange={(e) =>
                    setNewUser({ ...newUser, email: e.target.value })
                  }
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-start gap-4">
                <Label className="text-right pt-2">Roles</Label>
                <div className="col-span-3 space-y-3">
                  {predefinedRoles.map((role) => (
                    <div key={role.id} className="flex items-start space-x-3">
                      <Checkbox
                        id={`new-role-${role.id}`}
                        checked={newUser.roles.includes(role.name)}
                        onCheckedChange={(checked) =>
                          handleRoleChange(role.name, checked as boolean, true)
                        }
                      />
                      <div className="grid gap-1.5 leading-none">
                        <Label
                          htmlFor={`new-role-${role.id}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {role.name}
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {role.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {newUser.permissions.length > 0 && (
                <div className="grid grid-cols-4 items-start gap-4">
                  <Label className="text-right pt-2">Permissions</Label>
                  <div className="col-span-3 space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Based on selected roles ({newUser.roles.length} role(s)):
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {newUser.permissions.map((permissionId) => (
                        <Badge
                          key={permissionId}
                          variant="secondary"
                          className="text-xs"
                        >
                          {getPermissionName(permissionId)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="submit" onClick={handleAddUser}>
                Create Admin
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="admins" className="space-y-4">
        <TabsList>
          <TabsTrigger value="admins">Admin Users</TabsTrigger>
          <TabsTrigger value="all-users">All Users</TabsTrigger>
          <TabsTrigger value="roles">Roles & Permissions</TabsTrigger>
        </TabsList>

        <TabsContent value="admins" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Administrator Management</CardTitle>
              <CardDescription>
                Manage administrator accounts, roles, and access permissions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2 mb-4">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search admins..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-sm"
                />
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {adminOnlyUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        {user.username}
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge
                          variant={user.isPlayer ? "secondary" : "default"}
                        >
                          {user.isPlayer ? "Player" : "Admin"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {user.roles.length > 0 ? (
                            user.roles.map((role) => (
                              <Badge key={role} className={getRoleColor(role)}>
                                {role}
                              </Badge>
                            ))
                          ) : (
                            <Badge variant="outline">No roles assigned</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            user.status === "active" ? "default" : "destructive"
                          }
                        >
                          {user.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Dialog
                            open={
                              isEditUserOpen && selectedUser?.id === user.id
                            }
                            onOpenChange={setIsEditUserOpen}
                          >
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedUser(user)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[700px]">
                              <DialogHeader>
                                <DialogTitle>Edit User</DialogTitle>
                                <DialogDescription>
                                  Update user roles and permissions.
                                </DialogDescription>
                              </DialogHeader>
                              {selectedUser && (
                                <div className="grid gap-4 py-4">
                                  <div className="grid grid-cols-4 items-center gap-4">
                                    <Label className="text-right">
                                      Username
                                    </Label>
                                    <Input
                                      value={selectedUser.username}
                                      onChange={(e) =>
                                        setSelectedUser({
                                          ...selectedUser,
                                          username: e.target.value,
                                        })
                                      }
                                      className="col-span-3"
                                    />
                                  </div>
                                  <div className="grid grid-cols-4 items-center gap-4">
                                    <Label className="text-right">Email</Label>
                                    <Input
                                      value={selectedUser.email}
                                      onChange={(e) =>
                                        setSelectedUser({
                                          ...selectedUser,
                                          email: e.target.value,
                                        })
                                      }
                                      className="col-span-3"
                                    />
                                  </div>
                                  <div className="grid grid-cols-4 items-start gap-4">
                                    <Label className="text-right pt-2">
                                      Roles
                                    </Label>
                                    <div className="col-span-3 space-y-3">
                                      {predefinedRoles.map((role) => (
                                        <div
                                          key={role.id}
                                          className="flex items-start space-x-3"
                                        >
                                          <Checkbox
                                            id={`edit-role-${role.id}`}
                                            checked={selectedUser.roles.includes(
                                              role.name
                                            )}
                                            onCheckedChange={(checked) =>
                                              handleRoleChange(
                                                role.name,
                                                checked as boolean
                                              )
                                            }
                                          />
                                          <div className="grid gap-1.5 leading-none">
                                            <Label
                                              htmlFor={`edit-role-${role.id}`}
                                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                            >
                                              {role.name}
                                            </Label>
                                            <p className="text-xs text-muted-foreground">
                                              {role.description}
                                            </p>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-4 items-start gap-4">
                                    <Label className="text-right pt-2">
                                      Permissions
                                    </Label>
                                    <div className="col-span-3 space-y-2">
                                      <p className="text-sm text-muted-foreground">
                                        Based on selected roles (
                                        {selectedUser.roles.length} role(s)):
                                      </p>
                                      <div className="flex flex-wrap gap-1">
                                        {selectedUser.permissions.map(
                                          (permissionId) => (
                                            <Badge
                                              key={permissionId}
                                              variant="secondary"
                                              className="text-xs"
                                            >
                                              {getPermissionName(permissionId)}
                                            </Badge>
                                          )
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                              <DialogFooter>
                                <Button
                                  disabled={editPending}
                                  onClick={handleEditUser}
                                >
                                  {editPending ? <Loader /> : "Update User"}
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSuspendUser(user.id)}
                            disabled={suspendPending}
                          >
                            {user.status === "active" ? "Suspend" : "Activate"}
                          </Button>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete User</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete{" "}
                                  {user.username}? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteUser(user.id)}
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all-users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>All Users</CardTitle>
              <CardDescription>
                View all users in the system (admins and players)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2 mb-4">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search all users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-sm"
                />
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        {user.username}
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            user.isPlayer && user.roles.length === 0
                              ? "secondary"
                              : "default"
                          }
                        >
                          {user.isPlayer && user.roles.length === 0
                            ? "Player"
                            : "Admin"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            user.status === "active" ? "default" : "destructive"
                          }
                        >
                          {user.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedUser(user);
                              setIsEditUserOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSuspendUser(user.id)}
                          >
                            {user.status === "active" ? "Suspend" : ""}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roles" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {predefinedRoles.map((role) => (
              <Card key={role.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {role.name === "Head Admin" && (
                      <Crown className="h-5 w-5" />
                    )}
                    {role.name === "Shop Admin" && (
                      <ShoppingCart className="h-5 w-5" />
                    )}
                    {role.name === "News Admin" && (
                      <Newspaper className="h-5 w-5" />
                    )}
                    {role.name === "Teams Admin" && (
                      <Users className="h-5 w-5" />
                    )}
                    {role.name === "Events Admin" && (
                      <Trophy className="h-5 w-5" />
                    )}
                    {role.name === "Partner Admin" && (
                      <ShieldCheck className="h-5 w-5" />
                    )}
                    {role.name}
                  </CardTitle>
                  <CardDescription>{role.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Permissions:</Label>
                    <div className="flex flex-wrap gap-1">
                      {role.permissions.map((permissionId) => (
                        <Badge
                          key={permissionId}
                          variant="outline"
                          className="text-xs"
                        >
                          {getPermissionName(permissionId)}
                        </Badge>
                      ))}
                    </div>
                    <div className="mt-3 pt-3 border-t">
                      <Label className="text-sm font-medium text-muted-foreground">
                        Users with this role:
                      </Label>
                      <div className="mt-1">
                        {adminUsers.filter((user) =>
                          user.roles.includes(role.name)
                        ).length > 0 ? (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {adminUsers
                              .filter((user) => user.roles.includes(role.name))
                              .slice(0, 3)
                              .map((user) => (
                                <Badge
                                  key={user.id}
                                  variant="secondary"
                                  className="text-xs"
                                >
                                  {user.username}
                                </Badge>
                              ))}
                            {adminUsers.filter((user) =>
                              user.roles.includes(role.name)
                            ).length > 3 && (
                              <Badge variant="secondary" className="text-xs">
                                +
                                {adminUsers.filter((user) =>
                                  user.roles.includes(role.name)
                                ).length - 3}{" "}
                                more
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground mt-1">
                            No users assigned
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
