import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Upload, X, FileSpreadsheet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CSVData {
  headers: string[];
  rows: any[][];
  rowCount: number;
}

interface DataTabProps {
  csvData: CSVData | null;
  onUploadCSV: (file: File) => void;
  onClearCSV: () => void;
}

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

export function DataTab({ csvData, onUploadCSV, onClearCSV }: DataTabProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: 'Fil for stor',
        description: 'Maks filstørrelse er 2MB',
        variant: 'destructive',
      });
      return;
    }

    if (!file.name.endsWith('.csv')) {
      toast({
        title: 'Ugyldig filtype',
        description: 'Upload kun CSV-filer',
        variant: 'destructive',
      });
      return;
    }

    onUploadCSV(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      {!csvData ? (
        <Card className="border-dashed border-2 p-8">
          <div className="flex flex-col items-center gap-4 text-center">
            <Upload className="h-12 w-12 text-muted-foreground" />
            <div>
              <h3 className="font-semibold mb-1">Upload CSV-fil</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Træk og slip eller klik for at uploade
              </p>
              <p className="text-xs text-muted-foreground">Maks 2MB</p>
            </div>
            <Button onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" />
              Vælg fil
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card className="p-4 bg-primary/5">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-primary" />
                <span className="font-semibold">CSV uploadet</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearCSV}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium">Kolonner:</span>{' '}
                <span className="text-muted-foreground">
                  {csvData.headers.join(', ')}
                </span>
              </div>
              <div>
                <span className="font-medium">Antal rækker:</span>{' '}
                <span className="text-muted-foreground">{csvData.rowCount}</span>
              </div>
            </div>
          </Card>

          <div className="text-sm text-muted-foreground">
            <p>CSV-data er uploadet. Stil spørgsmål om dine data.</p>
          </div>

          <Button variant="outline" onClick={onClearCSV} className="w-full">
            <X className="h-4 w-4 mr-2" />
            Ryd data
          </Button>
        </div>
      )}
    </div>
  );
}
