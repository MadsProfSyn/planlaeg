import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { adminStrings } from '@/lib/i18n/admin';
import { UserRoleBadge } from '@/components/admin/UserRoleBadge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Search, UserPlus, UserMinus, Plus, Loader2, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { da } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

interface UserWithRoles {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  roles: string[];
}

export default function Users() {
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmAction, setConfirmAction] = useState<{
    type: 'promote' | 'demote';
    email: string;
  } | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createFullName, setCreateFullName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserWithRoles | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-delete-user', {
        body: { user_id: deleteTarget.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast({ title: adminStrings.common.success, description: `Bruger ${deleteTarget.email} er slettet` });
      setDeleteTarget(null);
    } catch (error: any) {
      toast({ title: adminStrings.common.error, description: error.message, variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-users', searchQuery],
    queryFn: async () => {
      // Fetch profiles
      let profileQuery = supabase
        .from('profiles')
        .select('id, email, full_name, created_at');
      
      if (searchQuery) {
        profileQuery = profileQuery.or(
          `email.ilike.%${searchQuery}%,full_name.ilike.%${searchQuery}%`
        );
      }
      
      const { data: profiles, error: profilesError } = await profileQuery;
      if (profilesError) throw profilesError;
      
      // Fetch all user roles
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');
      
      if (rolesError) throw rolesError;
      
      // Merge data
      const usersWithRoles: UserWithRoles[] = profiles.map(profile => ({
        ...profile,
        roles: userRoles
          .filter(r => r.user_id === profile.id)
          .map(r => r.role)
      }));
      
      return usersWithRoles;
    }
  });

  const handlePromote = async (email: string) => {
    try {
      const { error } = await supabase.rpc('promote_user', { 
        target_email: email 
      });
      
      if (error) throw error;
      
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      
      toast({
        title: adminStrings.common.success,
        description: adminStrings.users.promoted
      });
    } catch (error: any) {
      toast({
        title: adminStrings.common.error,
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setConfirmAction(null);
    }
  };

  const handleDemote = async (email: string) => {
    try {
      const { error } = await supabase.rpc('demote_admin', { 
        target_email: email 
      });
      
      if (error) throw error;
      
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      
      toast({
        title: adminStrings.common.success,
        description: adminStrings.users.demoted
      });
    } catch (error: any) {
      toast({
        title: adminStrings.common.error,
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setConfirmAction(null);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);

    try {
      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: {
          email: createEmail,
          password: createPassword,
          full_name: createFullName || '',
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });

      toast({
        title: adminStrings.common.success,
        description: `Bruger ${createEmail} er oprettet og kan logge ind med det samme`
      });

      // Reset form and close dialog
      setCreateEmail('');
      setCreatePassword('');
      setCreateFullName('');
      setShowCreateDialog(false);
    } catch (error: any) {
      toast({
        title: adminStrings.common.error,
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">{adminStrings.users.title}</h1>
          <p className="text-caption mt-2">
            Administrer brugere og deres roller
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Opret bruger
        </Button>
      </div>

      {/* Search */}
      <Card className="rounded-2xl shadow-sm">
        <CardContent className="p-6 bg-muted/20">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder={adminStrings.users.search}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11"
            />
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="border-b">
          <CardTitle className="text-lg">
            {users ? `${users.length} brugere` : adminStrings.common.loading}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-12 font-semibold">{adminStrings.users.name}</TableHead>
                  <TableHead className="h-12 font-semibold">{adminStrings.users.email}</TableHead>
                  <TableHead className="h-12 font-semibold">{adminStrings.users.roles}</TableHead>
                  <TableHead className="h-12 font-semibold">{adminStrings.users.created}</TableHead>
                  <TableHead className="text-right h-12 font-semibold">{adminStrings.users.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i} className="hover:bg-transparent">
                      <TableCell className="h-14"><Skeleton className="h-4 w-[150px]" /></TableCell>
                      <TableCell className="h-14"><Skeleton className="h-4 w-[200px]" /></TableCell>
                      <TableCell className="h-14"><Skeleton className="h-6 w-[80px]" /></TableCell>
                      <TableCell className="h-14"><Skeleton className="h-4 w-[100px]" /></TableCell>
                      <TableCell className="h-14"><Skeleton className="h-8 w-[100px] ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : users && users.length > 0 ? (
                  users.map((user) => {
                    const isAdmin = user.roles.includes('admin');
                    return (
                      <TableRow key={user.id} className="h-14 hover:bg-muted/30 transition-colors">
                        <TableCell className="font-medium">
                          {user.full_name || '-'}
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {isAdmin && (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                                Admin
                              </span>
                            )}
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-muted border border-muted-foreground/30">
                              Bruger
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {format(new Date(user.created_at), 'dd/MM/yyyy', { locale: da })}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                          {currentUser?.id !== user.id && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setDeleteTarget(user)}
                              className="gap-2 border-2 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                              <span className="hidden sm:inline">Slet</span>
                            </Button>
                          )}
                          {isAdmin ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setConfirmAction({ type: 'demote', email: user.email })}
                              className="gap-2 border-2"
                            >
                              <UserMinus className="h-4 w-4" />
                              <span className="hidden sm:inline">{adminStrings.users.removeAdmin}</span>
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setConfirmAction({ type: 'promote', email: user.email })}
                              className="gap-2 border-2"
                            >
                              <UserPlus className="h-4 w-4" />
                              <span className="hidden sm:inline">{adminStrings.users.makeAdmin}</span>
                            </Button>
                          )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-16 text-muted-foreground">
                      {adminStrings.users.noUsers}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === 'promote' 
                ? adminStrings.users.makeAdmin 
                : adminStrings.users.removeAdmin}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === 'promote'
                ? adminStrings.users.confirmPromote
                : adminStrings.users.confirmDemote}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{adminStrings.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmAction) {
                  confirmAction.type === 'promote'
                    ? handlePromote(confirmAction.email)
                    : handleDemote(confirmAction.email);
                }
              }}
            >
              {adminStrings.common.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete User Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && !isDeleting && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slet bruger</AlertDialogTitle>
            <AlertDialogDescription>
              Er du sikker på, at du vil slette {deleteTarget?.email}? Brugeren kan ikke længere logge ind. Dette kan ikke fortrydes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{adminStrings.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Slet
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create User Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Opret ny bruger</DialogTitle>
            <DialogDescription>
              Opret en ny brugerkonto manuelt. Brugeren vil modtage en bekræftelsesmail.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="create-name">Fulde navn</Label>
              <Input
                id="create-name"
                type="text"
                placeholder="Navn"
                value={createFullName}
                onChange={(e) => setCreateFullName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-email">Email *</Label>
              <Input
                id="create-email"
                type="email"
                placeholder="bruger@email.dk"
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-password">Kodeord *</Label>
              <Input
                id="create-password"
                type="password"
                placeholder="Minimum 6 tegn"
                value={createPassword}
                onChange={(e) => setCreatePassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreateDialog(false)}
              >
                Annuller
              </Button>
              <Button type="submit" disabled={isCreating}>
                {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Opret bruger
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
