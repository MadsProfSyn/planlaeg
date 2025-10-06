import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
import { Search, UserPlus, UserMinus } from 'lucide-react';
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
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{adminStrings.users.title}</h1>
        <p className="text-muted-foreground mt-2">
          Administrer brugere og deres roller
        </p>
      </div>

      {/* Search */}
      <Card className="rounded-2xl shadow-sm">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={adminStrings.users.search}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle>
            {users ? `${users.length} brugere` : adminStrings.common.loading}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{adminStrings.users.name}</TableHead>
                  <TableHead>{adminStrings.users.email}</TableHead>
                  <TableHead>{adminStrings.users.roles}</TableHead>
                  <TableHead>{adminStrings.users.created}</TableHead>
                  <TableHead className="text-right">{adminStrings.users.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[200px]" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-[80px]" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-[100px] ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : users && users.length > 0 ? (
                  users.map((user) => {
                    const isAdmin = user.roles.includes('admin');
                    return (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          {user.full_name || '-'}
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {isAdmin && <UserRoleBadge role="admin" />}
                            <UserRoleBadge role="user" />
                          </div>
                        </TableCell>
                        <TableCell>
                          {format(new Date(user.created_at), 'dd/MM/yyyy', { locale: da })}
                        </TableCell>
                        <TableCell className="text-right">
                          {isAdmin ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setConfirmAction({ type: 'demote', email: user.email })}
                              className="gap-2"
                            >
                              <UserMinus className="h-4 w-4" />
                              {adminStrings.users.removeAdmin}
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setConfirmAction({ type: 'promote', email: user.email })}
                              className="gap-2"
                            >
                              <UserPlus className="h-4 w-4" />
                              {adminStrings.users.makeAdmin}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
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
    </div>
  );
}
