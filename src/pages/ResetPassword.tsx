import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Building2, Loader2, AlertCircle } from 'lucide-react';

export default function ResetPassword() {
  const { isPasswordRecovery, clearPasswordRecovery } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isPasswordRecovery) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-6 w-6 text-destructive" />
              <CardTitle className="text-2xl">Ugyldigt link</CardTitle>
            </div>
            <CardDescription>
              Dette link til nulstilling af kodeord er ugyldigt eller udløbet. Anmod venligst om et nyt.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => navigate('/')}>
              Tilbage til login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('Kodeord skal være mindst 6 tegn');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Kodeordene matcher ikke');
      return;
    }

    setIsSubmitting(true);

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      setError(updateError.message);
      setIsSubmitting(false);
      return;
    }

    clearPasswordRecovery();

    toast({
      title: 'Kodeord opdateret',
      description: 'Dit kodeord er blevet ændret. Du kan nu logge ind.',
    });

    await supabase.auth.signOut();
    navigate('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="h-6 w-6 text-primary" />
            <CardTitle className="text-2xl">Nyt kodeord</CardTitle>
          </div>
          <CardDescription>
            Indtast dit nye kodeord herunder
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">Nyt kodeord</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Bekræft kodeord</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Opdater kodeord
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
