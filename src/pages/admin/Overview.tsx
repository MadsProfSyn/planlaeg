import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { StatCard } from '@/components/admin/StatCard';
import { UserRoleBadge } from '@/components/admin/UserRoleBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { adminStrings } from '@/lib/i18n/admin';
import { 
  Calendar, 
  FileText, 
  TrendingUp, 
  Clock,
  User,
  ArrowRight
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, startOfToday, startOfWeek, isWithinInterval, subWeeks } from 'date-fns';
import { da } from 'date-fns/locale';

export default function Overview() {
  const { user, profile, hasRole } = useAuth();

  const { data: vrpStats, isLoading } = useQuery({
    queryKey: ['admin-vrp-stats', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vrp_runs')
        .select('id, num_inspections_scheduled, created_at, status')
        .eq('requested_by', user!.id)
        .eq('status', 'COMPLETED');
      
      if (error) throw error;
      
      const today = startOfToday();
      const weekStart = startOfWeek(today, { locale: da });
      
      // Calculate weekly data for last 8 weeks
      const weeklyData = [];
      for (let i = 7; i >= 0; i--) {
        const weekEnd = subWeeks(today, i);
        const weekStartDate = startOfWeek(weekEnd, { locale: da });
        const count = data.filter(r => 
          isWithinInterval(new Date(r.created_at), { start: weekStartDate, end: weekEnd })
        ).reduce((sum, r) => sum + (r.num_inspections_scheduled || 0), 0);
        
        weeklyData.push({
          week: format(weekStartDate, 'dd/MM', { locale: da }),
          count
        });
      }
      
      const todayCount = data.filter(r => {
        const createdDate = new Date(r.created_at);
        return createdDate.toDateString() === today.toDateString();
      }).reduce((sum, r) => sum + (r.num_inspections_scheduled || 0), 0);
      
      const thisWeekCount = data.filter(r =>
        isWithinInterval(new Date(r.created_at), { start: weekStart, end: today })
      ).reduce((sum, r) => sum + (r.num_inspections_scheduled || 0), 0);
      
      const totalCount = data.reduce((sum, r) => sum + (r.num_inspections_scheduled || 0), 0);
      
      const latest = data.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0];
      
      return {
        today: todayCount,
        thisWeek: thisWeekCount,
        total: totalCount,
        latest: latest ? {
          count: latest.num_inspections_scheduled || 0,
          date: format(new Date(latest.created_at), 'dd/MM/yyyy HH:mm', { locale: da })
        } : null,
        weeklyData
      };
    }
  });

  return (
    <div className="space-y-8">
      {/* User Status Card */}
      <Card className="rounded-2xl shadow-sm border-2">
        <CardHeader className="border-b bg-muted/20">
          <CardTitle className="text-lg">{adminStrings.overview.loggedInAs}</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center ring-2 ring-primary/20">
              <User className="h-7 w-7 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-base">{profile?.full_name}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
            <div className="flex gap-2">
              {hasRole('admin') && <UserRoleBadge role="admin" />}
              <UserRoleBadge role="user" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title={adminStrings.overview.synToday}
          value={vrpStats?.today || 0}
          icon={Calendar}
          isLoading={isLoading}
        />
        <StatCard
          title={adminStrings.overview.synThisWeek}
          value={vrpStats?.thisWeek || 0}
          icon={TrendingUp}
          isLoading={isLoading}
        />
        <StatCard
          title={adminStrings.overview.totalSyn}
          value={vrpStats?.total || 0}
          icon={FileText}
          isLoading={isLoading}
        />
        <StatCard
          title={adminStrings.overview.latestSyn}
          value={vrpStats?.latest?.count || 0}
          icon={Clock}
          description={vrpStats?.latest?.date}
          isLoading={isLoading}
        />
      </div>

      {/* Weekly Chart */}
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="border-b">
          <CardTitle className="text-lg">{adminStrings.overview.synPerWeek}</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={vrpStats?.weeklyData || []}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="week" 
                  className="text-xs"
                />
                <YAxis className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Bar 
                  dataKey="count" 
                  fill="hsl(var(--primary))" 
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Quick Links */}
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="border-b">
          <CardTitle className="text-lg">{adminStrings.overview.quickLinks}</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link to="/admin/my-syn">
              <Button 
                variant="outline" 
                size="lg"
                className="w-full justify-between border-2 hover:bg-primary/5 hover:border-primary transition-all"
              >
                <span className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  {adminStrings.overview.mySyn}
                </span>
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <Link to="/admin/account">
              <Button 
                variant="outline" 
                size="lg"
                className="w-full justify-between border-2 hover:bg-primary/5 hover:border-primary transition-all"
              >
                <span className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  {adminStrings.overview.changePassword}
                </span>
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            {hasRole('admin') && (
              <Link to="/admin/users">
                <Button 
                  variant="outline" 
                  size="lg"
                  className="w-full justify-between border-2 hover:bg-primary/5 hover:border-primary transition-all"
                >
                  <span className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    {adminStrings.overview.users}
                  </span>
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
