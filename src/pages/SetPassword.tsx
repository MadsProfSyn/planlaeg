import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function SetPassword() {
  const { user, loading, clearPasswordRecovery } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="h-6 w-6 text-primary" />
              <CardTitle className="text-2xl">Linket er ugyldigt eller udløbet</CardTitle>
            </div>
            <CardDescription>Bed en administrator om at sende en ny invitation.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => navigate('/')}>Til login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('Kodeordet skal være mindst 8 tegn.');
      return;
    }
    if (password !== confirm) {
      setError('Kodeordene er ikke ens.');
      return;
    }
    setIsSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({
      password,
      data: { needs_password: false },
    });
    setIsSubmitting(false);
    if (updateError) {
      const msg = updateError.message || '';
      if (/weak|pwned|leaked/i.test(msg)) {
        setError('Kodeordet er for svagt eller har været lækket på nettet – vælg et andet.');
      } else {
        setError(msg);
      }
      return;
    }
    clearPasswordRecovery();
    toast({ title: 'Dit kodeord er gemt – velkommen!' });
    navigate('/alle-syn');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="h-6 w-6 text-primary" />
            <CardTitle className="text-2xl">Velkommen til Ruteplanlæggeren</CardTitle>
          </div>
          <CardDescription>
            Vælg et kodeord til {user.email}. Du bruger det sammen med din email, når du logger ind.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">Kodeord</Label>
              <Input
                id="new-password"
                type="password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Gentag kodeord</Label>
              <Input
                id="confirm-password"
                type="password"
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Gem kodeord
            </Button>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
