import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { adminStrings } from '@/lib/i18n/admin';
import { StatCard } from '@/components/admin/StatCard';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { FileText, Calendar, Download, Search } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { da } from 'date-fns/locale';
import Papa from 'papaparse';
import { Skeleton } from '@/components/ui/skeleton';

export default function MySyn() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data: mySyn, isLoading } = useQuery({
    queryKey: ['admin-my-syn', user?.id, searchQuery, dateFrom, dateTo],
    queryFn: async () => {
      let query = supabase
        .from('vrp_runs')
        .select(`
          id,
          created_at,
          num_inspections_scheduled,
          inspection_ids,
          target_dates,
          status
        `)
        .eq('requested_by', user!.id)
        .order('created_at', { ascending: false });
      
      if (dateFrom) {
        query = query.gte('created_at', dateFrom);
      }
      if (dateTo) {
        query = query.lte('created_at', dateTo);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      // Enrich with inspection details
      const enrichedData = await Promise.all(
        data.map(async (run) => {
          const { data: inspections } = await supabase
            .from('inspection_queue')
            .select('customer_name, address')
            .in('id', run.inspection_ids);
          
          return {
            ...run,
            inspections: inspections || []
          };
        })
      );
      
      // Apply search filter
      if (searchQuery) {
        return enrichedData.filter(run =>
          run.inspections.some(i =>
            i.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            i.address?.toLowerCase().includes(searchQuery.toLowerCase())
          ) || run.id.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }
      
      return enrichedData;
    }
  });

  const stats = {
    total: mySyn?.length || 0,
    thisMonth: mySyn?.filter(run => {
      const created = new Date(run.created_at);
      const now = new Date();
      return created >= startOfMonth(now) && created <= endOfMonth(now);
    }).length || 0,
    latest: mySyn && mySyn.length > 0 
      ? format(new Date(mySyn[0].created_at), 'dd/MM/yyyy HH:mm', { locale: da })
      : '-'
  };

  const exportToCSV = () => {
    if (!mySyn) return;
    
    const csvData = mySyn.flatMap(run =>
      run.inspections.map(inspection => ({
        'Dato': format(new Date(run.created_at), 'dd-MM-yyyy HH:mm'),
        'Kunde': inspection.customer_name || '-',
        'Adresse': inspection.address || '-',
        'Status': run.status
      }))
    );
    
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mine-syn-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">{adminStrings.mySyn.title}</h1>
          <p className="text-caption mt-2">
            Se og administrer dine planlagte syn
          </p>
        </div>
        <Button onClick={exportToCSV} variant="outline" size="lg" className="gap-2 border-2 w-full sm:w-auto">
          <Download className="h-5 w-5" />
          {adminStrings.mySyn.export}
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title={adminStrings.mySyn.totalFound}
          value={stats.total}
          icon={FileText}
          isLoading={isLoading}
        />
        <StatCard
          title={adminStrings.mySyn.thisMonth}
          value={stats.thisMonth}
          icon={Calendar}
          isLoading={isLoading}
        />
        <StatCard
          title={adminStrings.mySyn.latest}
          value={stats.latest}
          icon={Calendar}
          isLoading={isLoading}
        />
      </div>

      {/* Filters */}
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="border-b bg-muted/20">
          <CardTitle className="text-lg">Filtrer syn</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">{adminStrings.mySyn.search}</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder="Søg efter kunde eller adresse..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-11"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{adminStrings.mySyn.dateFrom}</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{adminStrings.mySyn.dateTo}</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-11"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="border-b">
          <CardTitle className="text-lg">{adminStrings.mySyn.inspections}</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-12 font-semibold">{adminStrings.mySyn.date}</TableHead>
                  <TableHead className="h-12 font-semibold">{adminStrings.mySyn.customer}</TableHead>
                  <TableHead className="h-12 font-semibold">{adminStrings.mySyn.address}</TableHead>
                  <TableHead className="h-12 font-semibold">{adminStrings.mySyn.status}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i} className="hover:bg-transparent">
                      <TableCell className="h-14"><Skeleton className="h-4 w-[100px]" /></TableCell>
                      <TableCell className="h-14"><Skeleton className="h-4 w-[150px]" /></TableCell>
                      <TableCell className="h-14"><Skeleton className="h-4 w-[200px]" /></TableCell>
                      <TableCell className="h-14"><Skeleton className="h-4 w-[80px]" /></TableCell>
                    </TableRow>
                  ))
                ) : mySyn && mySyn.length > 0 ? (
                  mySyn.flatMap((run) =>
                    run.inspections.map((inspection, idx) => (
                      <TableRow key={`${run.id}-${idx}`} className="h-14 hover:bg-muted/30 transition-colors">
                        <TableCell>
                          {format(new Date(run.created_at), 'dd/MM/yyyy', { locale: da })}
                        </TableCell>
                        <TableCell>{inspection.customer_name || '-'}</TableCell>
                        <TableCell>{inspection.address || '-'}</TableCell>
                        <TableCell>
                          {run.status === 'COMPLETED' ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-[hsl(var(--success))]/10 text-[hsl(var(--success))] border border-[hsl(var(--success))]/20">
                              Fuldført
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                              {run.status}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-16 text-muted-foreground">
                      <div className="flex flex-col items-center">
                        <FileText className="h-12 w-12 text-muted-foreground/50 mb-3" />
                        <p className="text-base font-medium">{adminStrings.mySyn.noResults}</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
