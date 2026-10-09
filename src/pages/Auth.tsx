import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Loader2 } from 'lucide-react';

export default function Auth() {
  const { user, loading, signIn, resetPassword, isPasswordRecovery } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);

  // Sign-in form
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');

  // Reset password form
  const [resetEmail, setResetEmail] = useState('');

  useEffect(() => {
    if (!loading && isPasswordRecovery) {
      navigate('/reset-password');
      return;
    }
    if (user && !loading && user.user_metadata?.needs_password === true) {
      navigate('/set-password');
      return;
    }
    if (user && !loading) {
      navigate('/alle-syn');
    }
  }, [user, loading, navigate, isPasswordRecovery]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const { error } = await signIn(signInEmail, signInPassword);
    
    if (!error) {
      navigate('/alle-syn');
    }
    
    setIsSubmitting(false);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    await resetPassword(resetEmail);
    setShowResetPassword(false);
    setResetEmail('');
    
    setIsSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (showResetPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="h-6 w-6 text-primary" />
              <CardTitle className="text-2xl">Nulstil kodeord</CardTitle>
            </div>
            <CardDescription>
              Indtast din email for at modtage et link til at nulstille dit kodeord
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-email">Email</Label>
                <Input
                  id="reset-email"
                  type="email"
                  placeholder="din@email.dk"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowResetPassword(false)}
                  className="flex-1"
                >
                  Annuller
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Send link
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="h-6 w-6 text-primary" />
            <CardTitle className="text-2xl">Syns planlægger</CardTitle>
          </div>
          <CardDescription>
            Log ind for at komme i gang
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="signin-email">Email</Label>
              <Input
                id="signin-email"
                type="email"
                placeholder="din@email.dk"
                value={signInEmail}
                onChange={(e) => setSignInEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signin-password">Kodeord</Label>
              <Input
                id="signin-password"
                type="password"
                value={signInPassword}
                onChange={(e) => setSignInPassword(e.target.value)}
                required
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Log ind
            </Button>
            <Button
              type="button"
              variant="link"
              className="w-full"
              onClick={() => setShowResetPassword(true)}
            >
              Glemt kodeord?
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
