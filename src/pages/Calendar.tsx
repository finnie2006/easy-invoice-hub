import { useState } from 'react';
import { useCalendarEvents, useLabels, useExternalFeeds } from '@/hooks/useCalendar';
import { calendar as calendarApi } from '@/api/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label as UILabel } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { 
  Calendar as CalendarIcon, 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  Loader2, 
  Tag, 
  Trash2,
  Rss,
  Clock,
  MapPin,
  Download,
  Copy,
} from 'lucide-react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths,
  startOfWeek,
  endOfWeek,
  isToday,
  parseISO,
  parse,
  setHours,
  setMinutes,
} from 'date-fns';
import { nl } from 'date-fns/locale';

const LABEL_COLORS = [
  '#10B981', '#3B82F6', '#F59E0B', '#8B5CF6', '#EF4444', 
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
];

export default function Calendar() {
  const { user } = useAuth();
  const { events, isLoading: loadingEvents, createEvent, deleteEvent } = useCalendarEvents();
  const { labels, isLoading: loadingLabels, createLabel, deleteLabel } = useLabels();
  const { feeds, createFeed, deleteFeed } = useExternalFeeds();

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [labelDialogOpen, setLabelDialogOpen] = useState(false);
  const [feedDialogOpen, setFeedDialogOpen] = useState(false);
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [startDatePickerOpen, setStartDatePickerOpen] = useState(false);
  const [endDatePickerOpen, setEndDatePickerOpen] = useState(false);


  // Event form
  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    start_time: '',
    end_time: '',
    all_day: false,
    location: '',
    label_id: '',
  });

  // Label form
  const [labelForm, setLabelForm] = useState({ name: '', color: LABEL_COLORS[0] });

  // Feed form
  const [feedForm, setFeedForm] = useState({ name: '', url: '', label_id: '' });

  // Calendar grid
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Filter events by selected labels
  const filteredEvents = selectedLabels.length > 0
    ? events.filter(e => e.label_id && selectedLabels.includes(e.label_id))
    : events;

  const getEventsForDay = (day: Date) => {
    return filteredEvents.filter(event => {
      const eventDate = parseISO(event.start_time);
      return isSameDay(eventDate, day);
    });
  };

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  const handleDayClick = (day: Date) => {
    setSelectedDate(day);
    const dateStr = format(day, 'yyyy-MM-dd');
    setEventForm({
      ...eventForm,
      start_time: `${dateStr}T09:00`,
      end_time: `${dateStr}T10:00`,
    });
    setEventDialogOpen(true);
  };


  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    await createEvent({
      title: eventForm.title,
      description: eventForm.description || null,
      start_time: new Date(eventForm.start_time).toISOString(),
      end_time: new Date(eventForm.end_time).toISOString(),
      all_day: eventForm.all_day,
      location: eventForm.location || null,
      label_id: eventForm.label_id || null,
      external_id: null,
      external_feed_id: null,
    });
    setEventDialogOpen(false);
    setEventForm({ title: '', description: '', start_time: '', end_time: '', all_day: false, location: '', label_id: '' });
  };

  const handleCreateLabel = async (e: React.FormEvent) => {
    e.preventDefault();
    await createLabel({ name: labelForm.name, color: labelForm.color, is_system: false });
    setLabelDialogOpen(false);
    setLabelForm({ name: '', color: LABEL_COLORS[0] });
  };

  const handleCreateFeed = async (e: React.FormEvent) => {
    e.preventDefault();
    await createFeed({ 
      name: feedForm.name, 
      url: feedForm.url, 
      label_id: feedForm.label_id || null,
      last_synced_at: null,
      is_active: true,
    });
    setFeedDialogOpen(false);
    setFeedForm({ name: '', url: '', label_id: '' });
  };

  const toggleLabelFilter = (labelId: string) => {
    setSelectedLabels(prev => 
      prev.includes(labelId) 
        ? prev.filter(id => id !== labelId)
        : [...prev, labelId]
    );
  };

  const getICalUrl = () => {
    if (!user) return '';
    return calendarApi.getIcalUrl();
  };

  const handleCopyICalUrl = async () => {
    const url = getICalUrl();
    try {
      await navigator.clipboard.writeText(url);
      toast.success('iCal URL gekopieerd naar klembord');
    } catch (err) {
      toast.error('Kon URL niet kopiëren');
    }
  };

  const handleDownloadICal = () => {
    const url = getICalUrl();
    window.open(url, '_blank');
  };

  const isLoading = loadingEvents || loadingLabels;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Agenda</h1>
          <p className="text-muted-foreground">
            Beheer je afspraken en taken
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                iCal exporteren
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 bg-popover" align="end">
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-1">Agenda exporteren</h4>
                  <p className="text-sm text-muted-foreground">
                    Gebruik deze iCal URL om je agenda te abonneren in andere apps zoals Google Agenda of Outlook.
                  </p>
                </div>
                <div className="space-y-2">
                  <Input 
                    value={getICalUrl()} 
                    readOnly 
                    className="text-xs"
                  />
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      onClick={handleCopyICalUrl}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Kopieer URL
                    </Button>
                    <Button 
                      size="sm" 
                      className="flex-1"
                      onClick={handleDownloadICal}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <Dialog open={labelDialogOpen} onOpenChange={setLabelDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Tag className="h-4 w-4 mr-2" />
                Labels beheren
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card">
              <DialogHeader>
                <DialogTitle>Labels beheren</DialogTitle>
                <DialogDescription>Maak en beheer je agenda labels</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  {labels.map(label => (
                    <div key={label.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-4 h-4 rounded-full" 
                          style={{ backgroundColor: label.color }}
                        />
                        <span>{label.name}</span>
                        {label.is_system && (
                          <Badge variant="secondary" className="text-xs">Systeem</Badge>
                        )}
                      </div>
                      {!label.is_system && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteLabel(label.id)}
                          className="text-destructive h-8 w-8"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                <form onSubmit={handleCreateLabel} className="border-t pt-4 space-y-3">
                  <h4 className="font-medium">Nieuw label</h4>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Labelnaam"
                      value={labelForm.name}
                      onChange={(e) => setLabelForm({ ...labelForm, name: e.target.value })}
                      required
                    />
                    <Select 
                      value={labelForm.color} 
                      onValueChange={(v) => setLabelForm({ ...labelForm, color: v })}
                    >
                      <SelectTrigger className="w-20">
                        <div 
                          className="w-4 h-4 rounded-full" 
                          style={{ backgroundColor: labelForm.color }}
                        />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        {LABEL_COLORS.map(color => (
                          <SelectItem key={color} value={color}>
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-4 h-4 rounded-full" 
                                style={{ backgroundColor: color }}
                              />
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" size="sm">Toevoegen</Button>
                </form>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={feedDialogOpen} onOpenChange={setFeedDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Rss className="h-4 w-4 mr-2" />
                Externe feeds
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card">
              <DialogHeader>
                <DialogTitle>Externe agenda feeds</DialogTitle>
                <DialogDescription>Importeer agenda's van externe bronnen (iCal URL)</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                {feeds.length > 0 && (
                  <div className="space-y-2">
                    {feeds.map(feed => (
                      <div key={feed.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                        <div>
                          <p className="font-medium">{feed.name}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">{feed.url}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteFeed(feed.id)}
                          className="text-destructive h-8 w-8"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <form onSubmit={handleCreateFeed} className="border-t pt-4 space-y-3">
                  <h4 className="font-medium">Nieuwe feed toevoegen</h4>
                  <Input
                    placeholder="Naam (bijv. Google Agenda)"
                    value={feedForm.name}
                    onChange={(e) => setFeedForm({ ...feedForm, name: e.target.value })}
                    required
                  />
                  <Input
                    placeholder="iCal URL"
                    value={feedForm.url}
                    onChange={(e) => setFeedForm({ ...feedForm, url: e.target.value })}
                    required
                  />
                  <Select 
                    value={feedForm.label_id} 
                    onValueChange={(v) => setFeedForm({ ...feedForm, label_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Kies een label" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      {labels.map(label => (
                        <SelectItem key={label.id} value={label.id}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: label.color }}
                            />
                            {label.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="submit" size="sm">Feed toevoegen</Button>
                </form>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={eventDialogOpen} onOpenChange={setEventDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => {
                const now = new Date();
                const dateStr = format(now, 'yyyy-MM-dd');
                setEventForm({
                  ...eventForm,
                  start_time: `${dateStr}T09:00`,
                  end_time: `${dateStr}T10:00`,
                });
              }}>
                <Plus className="h-4 w-4 mr-2" />
                Nieuwe afspraak
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card">
              <DialogHeader>
                <DialogTitle>Nieuwe afspraak</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateEvent} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <UILabel htmlFor="title">Titel *</UILabel>
                  <Input
                    id="title"
                    value={eventForm.title}
                    onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                    required
                  />
                </div>
                <div className="grid gap-4 grid-cols-2">
                  <div className="space-y-2">
                    <UILabel>Start *</UILabel>
                    <Popover open={startDatePickerOpen} onOpenChange={setStartDatePickerOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !eventForm.start_time && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {eventForm.start_time 
                            ? format(parse(eventForm.start_time, "yyyy-MM-dd'T'HH:mm", new Date()), "dd/MM/yyyy, HH:mm")
                            : "Kies datum"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 bg-popover" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={eventForm.start_time ? parse(eventForm.start_time, "yyyy-MM-dd'T'HH:mm", new Date()) : undefined}
                          onSelect={(date) => {
                            if (date) {
                              const currentTime = eventForm.start_time 
                                ? parse(eventForm.start_time, "yyyy-MM-dd'T'HH:mm", new Date())
                                : setMinutes(setHours(new Date(), 9), 0);
                              const newDate = setMinutes(setHours(date, currentTime.getHours()), currentTime.getMinutes());
                              setEventForm({ ...eventForm, start_time: format(newDate, "yyyy-MM-dd'T'HH:mm") });
                            }
                          }}
                          locale={nl}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                        <div className="p-3 border-t flex items-center gap-2">
                          <Input
                            type="time"
                            value={eventForm.start_time ? eventForm.start_time.split('T')[1] : '09:00'}
                            onChange={(e) => {
                              const datePart = eventForm.start_time ? eventForm.start_time.split('T')[0] : format(new Date(), 'yyyy-MM-dd');
                              setEventForm({ ...eventForm, start_time: `${datePart}T${e.target.value}` });
                            }}
                            className="flex-1"
                          />
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setEventForm({ ...eventForm, start_time: '' });
                            }}
                          >
                            Clear
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <UILabel>Eind *</UILabel>
                    <Popover open={endDatePickerOpen} onOpenChange={setEndDatePickerOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !eventForm.end_time && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {eventForm.end_time 
                            ? format(parse(eventForm.end_time, "yyyy-MM-dd'T'HH:mm", new Date()), "dd/MM/yyyy, HH:mm")
                            : "Kies datum"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 bg-popover" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={eventForm.end_time ? parse(eventForm.end_time, "yyyy-MM-dd'T'HH:mm", new Date()) : undefined}
                          onSelect={(date) => {
                            if (date) {
                              const currentTime = eventForm.end_time 
                                ? parse(eventForm.end_time, "yyyy-MM-dd'T'HH:mm", new Date())
                                : setMinutes(setHours(new Date(), 10), 0);
                              const newDate = setMinutes(setHours(date, currentTime.getHours()), currentTime.getMinutes());
                              setEventForm({ ...eventForm, end_time: format(newDate, "yyyy-MM-dd'T'HH:mm") });
                            }
                          }}
                          locale={nl}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                        <div className="p-3 border-t flex items-center gap-2">
                          <Input
                            type="time"
                            value={eventForm.end_time ? eventForm.end_time.split('T')[1] : '10:00'}
                            onChange={(e) => {
                              const datePart = eventForm.end_time ? eventForm.end_time.split('T')[0] : format(new Date(), 'yyyy-MM-dd');
                              setEventForm({ ...eventForm, end_time: `${datePart}T${e.target.value}` });
                            }}
                            className="flex-1"
                          />
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setEventForm({ ...eventForm, end_time: '' });
                            }}
                          >
                            Clear
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="all_day"
                    checked={eventForm.all_day}
                    onCheckedChange={(checked) => setEventForm({ ...eventForm, all_day: !!checked })}
                  />
                  <UILabel htmlFor="all_day">Hele dag</UILabel>
                </div>
                <div className="space-y-2">
                  <UILabel htmlFor="label">Label</UILabel>
                  <Select 
                    value={eventForm.label_id} 
                    onValueChange={(v) => setEventForm({ ...eventForm, label_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecteer een label" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      {labels.map(label => (
                        <SelectItem key={label.id} value={label.id}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: label.color }}
                            />
                            {label.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <UILabel htmlFor="location">Locatie</UILabel>
                  <Input
                    id="location"
                    value={eventForm.location}
                    onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <UILabel htmlFor="description">Omschrijving</UILabel>
                  <Textarea
                    id="description"
                    value={eventForm.description}
                    onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                    rows={3}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setEventDialogOpen(false)}>
                    Annuleren
                  </Button>
                  <Button type="submit">Aanmaken</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Sidebar with labels filter */}
        <div className="lg:col-span-1 space-y-4">
          {/* Labels Filter */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Filter op label</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {labels.map(label => (
                <button
                  key={label.id}
                  onClick={() => toggleLabelFilter(label.id)}
                  className={`w-full flex items-center gap-2 p-2 rounded-lg text-left transition-colors ${
                    selectedLabels.length === 0 || selectedLabels.includes(label.id)
                      ? 'bg-muted/50 hover:bg-muted'
                      : 'opacity-40 hover:opacity-60'
                  }`}
                >
                  <div 
                    className="w-3 h-3 rounded-full flex-shrink-0" 
                    style={{ backgroundColor: label.color }}
                  />
                  <span className="text-sm">{label.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {events.filter(e => e.label_id === label.id).length}
                  </span>
                </button>
              ))}
              {selectedLabels.length > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full mt-2"
                  onClick={() => setSelectedLabels([])}
                >
                  Filters wissen
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main Calendar */}
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              {format(currentMonth, 'MMMM yyyy', { locale: nl })}
            </CardTitle>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" onClick={handlePrevMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setCurrentMonth(new Date())}
              >
                Vandaag
              </Button>
              <Button variant="outline" size="icon" onClick={handleNextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Weekdays header */}
            <div className="grid grid-cols-7 mb-2">
              {['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'].map(day => (
                <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map(day => {
                const dayEvents = getEventsForDay(day);
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const isCurrentDay = isToday(day);
                const isSelected = selectedDate && isSameDay(day, selectedDate);

                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => handleDayClick(day)}
                    className={cn(
                      "min-h-[100px] p-1.5 rounded-lg text-left transition-all relative",
                      isCurrentMonth ? 'bg-card hover:bg-muted/50' : 'bg-muted/30 text-muted-foreground',
                      isCurrentDay && 'ring-2 ring-primary',
                      isSelected && 'bg-primary/10'
                    )}
                  >
                    <div className={cn(
                      "text-sm font-medium mb-1 w-7 h-7 flex items-center justify-center rounded-full",
                      isCurrentDay && 'bg-primary text-primary-foreground'
                    )}>
                      {format(day, 'd')}
                    </div>
                    <div className="space-y-0.5">
                      {dayEvents.slice(0, 3).map(event => (
                        <div
                          key={event.id}
                          className="text-xs px-1.5 py-0.5 rounded truncate"
                          style={{ 
                            backgroundColor: event.label?.color ? `${event.label.color}20` : 'hsl(var(--muted))',
                            borderLeft: `3px solid ${event.label?.color || 'hsl(var(--primary))'}`
                          }}
                        >
                          {event.title}
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <div className="text-xs text-muted-foreground px-1">
                          +{dayEvents.length - 3} meer
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Today's events */}
      <Card>
        <CardHeader>
          <CardTitle>Vandaag</CardTitle>
          <CardDescription>
            {format(new Date(), 'EEEE d MMMM yyyy', { locale: nl })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {getEventsForDay(new Date()).length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Geen afspraken vandaag
            </p>
          ) : (
            <div className="space-y-3">
              {getEventsForDay(new Date()).map(event => (
                <div 
                  key={event.id}
                  className="flex items-start gap-4 p-3 rounded-lg bg-muted/50"
                >
                  <div 
                    className="w-1 h-12 rounded-full flex-shrink-0"
                    style={{ backgroundColor: event.label?.color || 'hsl(var(--primary))' }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{event.title}</h4>
                      {event.label && (
                        <Badge 
                          variant="secondary"
                          style={{ 
                            backgroundColor: `${event.label.color}20`,
                            color: event.label.color,
                          }}
                        >
                          {event.label.name}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {event.all_day 
                          ? 'Hele dag' 
                          : `${format(parseISO(event.start_time), 'HH:mm')} - ${format(parseISO(event.end_time), 'HH:mm')}`
                        }
                      </span>
                      {event.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {event.location}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteEvent(event.id)}
                    className="text-destructive h-8 w-8"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
