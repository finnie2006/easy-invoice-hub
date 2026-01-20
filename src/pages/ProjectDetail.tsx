import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { ArrowLeft, Plus, Clock, Trash2, Pencil, Download } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useProjects, useTimeEntries, CreateTimeEntryData, TimeEntry } from '@/hooks/useProjects';
import { useProfile } from '@/hooks/useProfile';
import { toast } from 'sonner';

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const printRef = useRef<HTMLDivElement>(null);
  
  const { projects, updateProject } = useProjects();
  const { timeEntries, createTimeEntry, updateTimeEntry, deleteTimeEntry } = useTimeEntries(id);
  const { profile } = useProfile();
  
  const project = projects.find(p => p.id === id);
  
  const [isAddEntryDialogOpen, setIsAddEntryDialogOpen] = useState(false);
  const [isEditEntryDialogOpen, setIsEditEntryDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [deleteEntryId, setDeleteEntryId] = useState<string | null>(null);
  
  // Time entry form
  const [workDate, setWorkDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [hours, setHours] = useState('');
  const [entryDescription, setEntryDescription] = useState('');
  const [useTimeRange, setUseTimeRange] = useState(false);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isOvernight, setIsOvernight] = useState(false);

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <p className="text-muted-foreground mb-4">Project niet gevonden</p>
        <Button variant="outline" onClick={() => navigate('/projects')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Terug naar projecten
        </Button>
      </div>
    );
  }

  const totalHours = timeEntries.reduce((sum, entry) => sum + Number(entry.hours), 0);
  const hourlyRate = project.hourly_rate || profile?.default_hourly_rate || 0;
  const totalAmount = totalHours * hourlyRate;

  // Calculate hours from time range
  const calculateHoursFromTimeRange = (start: string, end: string, overnight: boolean): number => {
    if (!start || !end) return 0;
    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    
    let startMinutes = startH * 60 + startM;
    let endMinutes = endH * 60 + endM;
    
    if (overnight || endMinutes < startMinutes) {
      endMinutes += 24 * 60; // Add 24 hours
    }
    
    return (endMinutes - startMinutes) / 60;
  };

  const getEffectiveHours = (): number => {
    if (useTimeRange && startTime && endTime) {
      return calculateHoursFromTimeRange(startTime, endTime, isOvernight);
    }
    return parseFloat(hours) || 0;
  };

  const handleAddTimeEntry = async () => {
    const effectiveHours = getEffectiveHours();
    if (effectiveHours <= 0) return;
    
    const entryData: CreateTimeEntryData = {
      project_id: project.id,
      work_date: workDate,
      hours: effectiveHours,
      start_time: useTimeRange ? startTime : undefined,
      end_time: useTimeRange ? endTime : undefined,
      is_overnight: useTimeRange ? isOvernight : undefined,
      description: entryDescription.trim() || undefined,
    };
    
    await createTimeEntry.mutateAsync(entryData);
    setIsAddEntryDialogOpen(false);
    resetEntryForm();
  };

  const handleEditTimeEntry = async () => {
    if (!editingEntry) return;
    const effectiveHours = getEffectiveHours();
    if (effectiveHours <= 0) return;
    
    await updateTimeEntry.mutateAsync({
      id: editingEntry.id,
      work_date: workDate,
      hours: effectiveHours,
      start_time: useTimeRange ? startTime : null,
      end_time: useTimeRange ? endTime : null,
      is_overnight: useTimeRange ? isOvernight : false,
      description: entryDescription.trim() || null,
    });
    
    setIsEditEntryDialogOpen(false);
    setEditingEntry(null);
    resetEntryForm();
  };

  const openEditDialog = (entry: TimeEntry) => {
    setEditingEntry(entry);
    setWorkDate(entry.work_date);
    setEntryDescription(entry.description || '');
    
    if (entry.start_time && entry.end_time) {
      setUseTimeRange(true);
      setStartTime(entry.start_time.slice(0, 5)); // Remove seconds
      setEndTime(entry.end_time.slice(0, 5));
      setIsOvernight(entry.is_overnight || false);
      setHours('');
    } else {
      setUseTimeRange(false);
      setHours(entry.hours.toString());
      setStartTime('');
      setEndTime('');
      setIsOvernight(false);
    }
    
    setIsEditEntryDialogOpen(true);
  };

  const resetEntryForm = () => {
    setWorkDate(format(new Date(), 'yyyy-MM-dd'));
    setHours('');
    setEntryDescription('');
    setUseTimeRange(false);
    setStartTime('');
    setEndTime('');
    setIsOvernight(false);
  };

  const handleDeleteEntry = async () => {
    if (deleteEntryId) {
      await deleteTimeEntry.mutateAsync(deleteEntryId);
      setDeleteEntryId(null);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    await updateProject.mutateAsync({
      id: project.id,
      status: newStatus,
    });
  };

  const formatCurrency = (amount: number) => {
    return `€${amount.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handleExportPdf = async () => {
    if (!printRef.current) return;
    
    try {
      const canvas = await html2canvas(printRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });
      
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`urenregistratie-${project.name.toLowerCase().replace(/\s+/g, '-')}.pdf`);
      toast.success('PDF gedownload');
    } catch (error) {
      toast.error('Fout bij exporteren PDF');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-emerald-500">Actief</Badge>;
      case 'completed':
        return <Badge variant="secondary">Afgerond</Badge>;
      case 'paused':
        return <Badge variant="outline">Gepauzeerd</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/projects')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{project.name}</h1>
            {getStatusBadge(project.status)}
          </div>
          {(project.client?.company_name || project.client_name) && (
            <p className="text-muted-foreground">{project.client?.company_name || project.client_name}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportPdf}>
            <Download className="mr-2 h-4 w-4" />
            Exporteren
          </Button>
          <Select value={project.status} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Actief</SelectItem>
              <SelectItem value="paused">Gepauzeerd</SelectItem>
              <SelectItem value="completed">Afgerond</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Totaal uren</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <span className="text-2xl font-bold">{totalHours.toFixed(1)}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Uurtarief</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">{formatCurrency(hourlyRate)}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Totaal bedrag</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">{formatCurrency(totalAmount)}</span>
          </CardContent>
        </Card>
      </div>

      {/* Time Entries */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Urenregistratie</CardTitle>
          <Dialog open={isAddEntryDialogOpen} onOpenChange={setIsAddEntryDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Uren toevoegen
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Uren registreren</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="workDate">Datum</Label>
                  <Input
                    id="workDate"
                    type="date"
                    value={workDate}
                    onChange={(e) => setWorkDate(e.target.value)}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="useTimeRange"
                    checked={useTimeRange}
                    onCheckedChange={(checked) => setUseTimeRange(checked === true)}
                  />
                  <Label htmlFor="useTimeRange" className="text-sm font-normal cursor-pointer">
                    Start- en eindtijd invoeren
                  </Label>
                </div>

                {useTimeRange ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="startTime">Starttijd</Label>
                        <Input
                          id="startTime"
                          type="time"
                          value={startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="endTime">Eindtijd</Label>
                        <Input
                          id="endTime"
                          type="time"
                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="isOvernight"
                        checked={isOvernight}
                        onCheckedChange={(checked) => setIsOvernight(checked === true)}
                      />
                      <Label htmlFor="isOvernight" className="text-sm font-normal cursor-pointer">
                        Eindtijd is de volgende dag (nachtwerk)
                      </Label>
                    </div>
                    {startTime && endTime && (
                      <p className="text-sm text-muted-foreground">
                        Berekend: <span className="font-medium">{getEffectiveHours().toFixed(2)} uur</span>
                      </p>
                    )}
                  </>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="hours">Aantal uren *</Label>
                    <Input
                      id="hours"
                      type="number"
                      step="0.25"
                      min="0"
                      value={hours}
                      onChange={(e) => setHours(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="entryDescription">Omschrijving</Label>
                  <Textarea
                    id="entryDescription"
                    value={entryDescription}
                    onChange={(e) => setEntryDescription(e.target.value)}
                    placeholder="Wat heb je gedaan?"
                    rows={3}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => { setIsAddEntryDialogOpen(false); resetEntryForm(); }}>
                    Annuleren
                  </Button>
                  <Button onClick={handleAddTimeEntry} disabled={getEffectiveHours() <= 0}>
                    Toevoegen
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {timeEntries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Nog geen uren geregistreerd</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead>Tijd</TableHead>
                  <TableHead>Omschrijving</TableHead>
                  <TableHead className="text-right">Uren</TableHead>
                  <TableHead className="text-right">Bedrag</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {timeEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{format(new Date(entry.work_date), 'd MMM yyyy', { locale: nl })}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {entry.start_time && entry.end_time 
                        ? `${entry.start_time.slice(0, 5)} - ${entry.end_time.slice(0, 5)}${entry.is_overnight ? ' (+1)' : ''}`
                        : '-'
                      }
                    </TableCell>
                    <TableCell className="text-muted-foreground">{entry.description || '-'}</TableCell>
                    <TableCell className="text-right font-medium">{Number(entry.hours).toFixed(2)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(entry.hours) * hourlyRate)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEditDialog(entry)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteEntryId(entry.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Entry Dialog */}
      <Dialog open={isEditEntryDialogOpen} onOpenChange={(open) => { if (!open) { setIsEditEntryDialogOpen(false); setEditingEntry(null); resetEntryForm(); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Uren bewerken</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editWorkDate">Datum</Label>
              <Input
                id="editWorkDate"
                type="date"
                value={workDate}
                onChange={(e) => setWorkDate(e.target.value)}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="editUseTimeRange"
                checked={useTimeRange}
                onCheckedChange={(checked) => setUseTimeRange(checked === true)}
              />
              <Label htmlFor="editUseTimeRange" className="text-sm font-normal cursor-pointer">
                Start- en eindtijd invoeren
              </Label>
            </div>

            {useTimeRange ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="editStartTime">Starttijd</Label>
                    <Input
                      id="editStartTime"
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editEndTime">Eindtijd</Label>
                    <Input
                      id="editEndTime"
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="editIsOvernight"
                    checked={isOvernight}
                    onCheckedChange={(checked) => setIsOvernight(checked === true)}
                  />
                  <Label htmlFor="editIsOvernight" className="text-sm font-normal cursor-pointer">
                    Eindtijd is de volgende dag (nachtwerk)
                  </Label>
                </div>
                {startTime && endTime && (
                  <p className="text-sm text-muted-foreground">
                    Berekend: <span className="font-medium">{getEffectiveHours().toFixed(2)} uur</span>
                  </p>
                )}
              </>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="editHours">Aantal uren *</Label>
                <Input
                  id="editHours"
                  type="number"
                  step="0.25"
                  min="0"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  placeholder="0"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="editEntryDescription">Omschrijving</Label>
              <Textarea
                id="editEntryDescription"
                value={entryDescription}
                onChange={(e) => setEntryDescription(e.target.value)}
                placeholder="Wat heb je gedaan?"
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => { setIsEditEntryDialogOpen(false); setEditingEntry(null); resetEntryForm(); }}>
                Annuleren
              </Button>
              <Button onClick={handleEditTimeEntry} disabled={getEffectiveHours() <= 0}>
                Opslaan
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Print/Export View (hidden) */}
      <div className="fixed left-[-9999px]">
        <div ref={printRef} className="bg-white p-10 w-[794px]" style={{ fontFamily: 'Arial, sans-serif' }}>
          <div className="mb-8 border-b pb-4">
            <h1 className="text-2xl font-bold">{profile?.company_name || 'Urenregistratie'}</h1>
            <p className="text-gray-500 text-sm mt-1">
              {profile?.company_address} · {profile?.company_postal_code} {profile?.company_city}
            </p>
          </div>
          
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-2">{project.name}</h2>
            {(project.client?.company_name || project.client_name) && (
              <p className="text-gray-600">Klant: {project.client?.company_name || project.client_name}</p>
            )}
            <p className="text-gray-600">
              Periode: {format(new Date(project.start_date), 'd MMM yyyy', { locale: nl })} - {format(new Date(), 'd MMM yyyy', { locale: nl })}
            </p>
          </div>

          <table className="w-full text-sm mb-6">
            <thead>
              <tr className="border-b-2">
                <th className="text-left py-2">Datum</th>
                <th className="text-left py-2">Omschrijving</th>
                <th className="text-right py-2">Uren</th>
                <th className="text-right py-2">Bedrag</th>
              </tr>
            </thead>
            <tbody>
              {timeEntries.map((entry) => (
                <tr key={entry.id} className="border-b">
                  <td className="py-2">{format(new Date(entry.work_date), 'd MMM yyyy', { locale: nl })}</td>
                  <td className="py-2 text-gray-600">{entry.description || '-'}</td>
                  <td className="py-2 text-right">{Number(entry.hours).toFixed(2)}</td>
                  <td className="py-2 text-right">{formatCurrency(Number(entry.hours) * hourlyRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between">
                <span>Totaal uren</span>
                <span className="font-semibold">{totalHours.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Uurtarief</span>
                <span>{formatCurrency(hourlyRate)}</span>
              </div>
              <div className="flex justify-between border-t pt-2 font-bold text-lg">
                <span>Totaal</span>
                <span>{formatCurrency(totalAmount)}</span>
              </div>
            </div>
          </div>

          <div className="mt-10 pt-4 border-t text-xs text-gray-400">
            <p>Gegenereerd op {format(new Date(), 'd MMMM yyyy', { locale: nl })}</p>
          </div>
        </div>
      </div>

      <AlertDialog open={!!deleteEntryId} onOpenChange={() => setDeleteEntryId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Uren verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je deze urenregistratie wilt verwijderen?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteEntry} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
