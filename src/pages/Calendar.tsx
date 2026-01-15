import { useState } from 'react';
import { useCalendarEvents, useLabels, useExternalFeeds } from '@/hooks/useCalendar';
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
} from 'date-fns';
import { nl } from 'date-fns/locale';

const LABEL_COLORS = [
  '#10B981', '#3B82F6', '#F59E0B', '#8B5CF6', '#EF4444', 
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
];

export default function Calendar() {
  const { events, isLoading: loadingEvents, createEvent, deleteEvent } = useCalendarEvents();
  const { labels, isLoading: loadingLabels, createLabel, deleteLabel } = useLabels();
  const { feeds, createFeed, deleteFeed } = useExternalFeeds();

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [labelDialogOpen, setLabelDialogOpen] = useState(false);
  const [feedDialogOpen, setFeedDialogOpen] = useState(false);
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

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

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setCurrentMonth(date);
      setSelectedDate(date);
      setDatePickerOpen(false);
    }
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
        <div className="flex gap-2">
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
                    <UILabel htmlFor="start_time">Start *</UILabel>
                    <Input
                      id="start_time"
                      type="datetime-local"
                      value={eventForm.start_time}
                      onChange={(e) => setEventForm({ ...eventForm, start_time: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <UILabel htmlFor="end_time">Eind *</UILabel>
                    <Input
                      id="end_time"
                      type="datetime-local"
                      value={eventForm.end_time}
                      onChange={(e) => setEventForm({ ...eventForm, end_time: e.target.value })}
                      required
                    />
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
        {/* Sidebar with date picker and labels */}
        <div className="lg:col-span-1 space-y-4">
          {/* Mini Calendar Date Picker */}
          <Card>
            <CardContent className="p-3">
              <CalendarComponent
                mode="single"
                selected={selectedDate}
                onSelect={handleDateSelect}
                month={currentMonth}
                onMonthChange={setCurrentMonth}
                locale={nl}
                className={cn("rounded-md pointer-events-auto")}
                modifiers={{
                  hasEvents: (date) => getEventsForDay(date).length > 0,
                }}
                modifiersStyles={{
                  hasEvents: {
                    fontWeight: 'bold',
                    textDecoration: 'underline',
                    textDecorationColor: 'hsl(var(--primary))',
                  },
                }}
              />
            </CardContent>
          </Card>

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
            <div className="flex items-center gap-3">
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                {format(currentMonth, 'MMMM yyyy', { locale: nl })}
              </CardTitle>
              
              {/* Jump to date picker */}
              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8">
                    Ga naar datum
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-popover" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={selectedDate}
                    onSelect={handleDateSelect}
                    locale={nl}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
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
