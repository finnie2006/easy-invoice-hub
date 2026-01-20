import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface TimeInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string;
  onChange: (value: string) => void;
}

const TimeInput = React.forwardRef<HTMLInputElement, TimeInputProps>(
  ({ className, value, onChange, ...props }, ref) => {
    // Parse hours and minutes from HH:mm format
    const [hours, minutes] = value ? value.split(':') : ['', ''];
    
    const handleHoursChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let h = e.target.value.replace(/\D/g, '');
      if (h.length > 2) h = h.slice(0, 2);
      if (parseInt(h) > 23) h = '23';
      const newValue = `${h.padStart(2, '0')}:${minutes || '00'}`;
      if (h.length === 2 || h === '') {
        onChange(h ? newValue : '');
      } else {
        onChange(`${h}:${minutes || '00'}`);
      }
    };

    const handleMinutesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let m = e.target.value.replace(/\D/g, '');
      if (m.length > 2) m = m.slice(0, 2);
      if (parseInt(m) > 59) m = '59';
      const newValue = `${hours || '00'}:${m.padStart(2, '0')}`;
      if (m.length === 2 || m === '') {
        onChange(newValue);
      } else {
        onChange(`${hours || '00'}:${m}`);
      }
    };

    const handleHoursBlur = () => {
      if (hours && hours.length === 1) {
        onChange(`${hours.padStart(2, '0')}:${minutes || '00'}`);
      }
    };

    const handleMinutesBlur = () => {
      if (minutes && minutes.length === 1) {
        onChange(`${hours || '00'}:${minutes.padStart(2, '0')}`);
      }
    };

    return (
      <div className={cn("flex items-center gap-1", className)}>
        <Input
          ref={ref}
          type="text"
          inputMode="numeric"
          maxLength={2}
          placeholder="00"
          value={hours || ''}
          onChange={handleHoursChange}
          onBlur={handleHoursBlur}
          className="w-14 text-center"
          {...props}
        />
        <span className="text-muted-foreground font-medium">:</span>
        <Input
          type="text"
          inputMode="numeric"
          maxLength={2}
          placeholder="00"
          value={minutes || ''}
          onChange={handleMinutesChange}
          onBlur={handleMinutesBlur}
          className="w-14 text-center"
          {...props}
        />
      </div>
    );
  }
);

TimeInput.displayName = "TimeInput";

export { TimeInput };
