import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { adminStrings } from '@/lib/i18n/admin';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, User, Mail, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { da } from 'date-fns/locale';

export default function Account() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  
  const [passwordForm, setPasswordForm] = useState({
    current: '',
    new: '',
    confirm: ''
  });
  const [emailForm, setEmailForm] = useState({ email: '' });
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passwordForm.new.length < 8) {
      toast({
        title: adminStrings.common.error,
        description: adminStrings.account.passwordTooShort,
        variant: 'destructive'
      });
      return;
    }
    
    if (passwordForm.new !== passwordForm.confirm) {
      toast({
        title: adminStrings.common.error,
        description: adminStrings.account.passwordMismatch,
        variant: 'destructive'
      });
      return;
    }
    
    setIsUpdatingPassword(true);
    
    try {
      // Re-authenticate first
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user!.email!,
        password: passwordForm.current
      });
      
      if (signInError) {
        throw new Error(adminStrings.account.wrongPassword);
      }
      
      // Update password
      const { error } = await supabase.auth.updateUser({
        password: passwordForm.new
      });
      
      if (error) throw error;
      
      toast({
        title: adminStrings.common.success,
        description: adminStrings.account.passwordUpdated
      });
      
      setPasswordForm({ current: '', new: '', confirm: '' });
    } catch (error: any) {
      toast({
        title: adminStrings.common.error,
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingEmail(true);
    
    try {
      const { error } = await supabase.auth.updateUser({
        email: emailForm.email
      });
      
      if (error) throw error;
      
      toast({
        title: adminStrings.common.success,
        description: adminStrings.account.emailUpdated
      });
      
      setEmailForm({ email: '' });
    } catch (error: any) {
      toast({
        title: adminStrings.common.error,
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsUpdatingEmail(false);
    }
  };

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="page-title">{adminStrings.account.title}</h1>
        <p className="text-caption mt-2">
          Administrer din konto og sikkerhedsindstillinger
        </p>
      </div>

      {/* Profile Info */}
      <Card className="rounded-2xl shadow-sm border-2">
        <CardHeader className="border-b bg-muted/20">
          <CardTitle className="text-lg">{adminStrings.account.profileInfo}</CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-base">{profile?.full_name}</p>
              <p className="text-xs text-muted-foreground">Navn</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Mail className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-base">{user?.email}</p>
              <p className="text-xs text-muted-foreground">Email</p>
            </div>
          </div>
          {user?.last_sign_in_at && (
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Clock className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-base">
                  {format(new Date(user.last_sign_in_at), 'dd. MMMM yyyy HH:mm', { locale: da })}
                </p>
                <p className="text-xs text-muted-foreground">{adminStrings.account.lastSignIn}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card className="rounded-2xl shadow-sm border-2">
        <CardHeader className="border-b bg-muted/20">
          <CardTitle className="text-lg">{adminStrings.account.changePassword}</CardTitle>
          <CardDescription>
            Sørg for at din adgangskode er mindst 8 tegn lang
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handlePasswordChange} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="current" className="text-sm font-medium">{adminStrings.account.currentPassword}</Label>
              <Input
                id="current"
                type="password"
                value={passwordForm.current}
                onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
                className="h-11"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new" className="text-sm font-medium">{adminStrings.account.newPassword}</Label>
              <Input
                id="new"
                type="password"
                value={passwordForm.new}
                onChange={(e) => setPasswordForm({ ...passwordForm, new: e.target.value })}
                className="h-11"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm" className="text-sm font-medium">{adminStrings.account.confirmPassword}</Label>
              <Input
                id="confirm"
                type="password"
                value={passwordForm.confirm}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                className="h-11"
                required
              />
            </div>
            <Button type="submit" size="lg" disabled={isUpdatingPassword} className="w-full md:w-auto">
              {isUpdatingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {adminStrings.account.changePassword}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Change Email */}
      <Card className="rounded-2xl shadow-sm border-2">
        <CardHeader className="border-b bg-muted/20">
          <CardTitle className="text-lg">{adminStrings.account.changeEmail}</CardTitle>
          <CardDescription>
            Du skal bekræfte din nye email efter ændringen
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleEmailChange} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">{adminStrings.account.newEmail}</Label>
              <Input
                id="email"
                type="email"
                value={emailForm.email}
                onChange={(e) => setEmailForm({ email: e.target.value })}
                placeholder={user?.email}
                className="h-11"
                required
              />
            </div>
            <Button type="submit" size="lg" disabled={isUpdatingEmail} className="w-full md:w-auto">
              {isUpdatingEmail && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {adminStrings.account.changeEmail}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
