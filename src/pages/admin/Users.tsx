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
        <h1 className="page-title">{adminStrings.users.title}</h1>
        <p className="text-caption mt-2">
          Administrer brugere og deres roller
        </p>
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
    </div>
  );
}
