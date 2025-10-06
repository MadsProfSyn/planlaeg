import { Badge } from '@/components/ui/badge';
import { Shield, User } from 'lucide-react';
import { adminStrings } from '@/lib/i18n/admin';

interface UserRoleBadgeProps {
  role: 'admin' | 'user';
}

export function UserRoleBadge({ role }: UserRoleBadgeProps) {
  if (role === 'admin') {
    return (
      <Badge variant="default" className="gap-1">
        <Shield className="h-3 w-3" />
        {adminStrings.common.admin}
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className="gap-1">
      <User className="h-3 w-3" />
      {adminStrings.common.user}
    </Badge>
  );
}
