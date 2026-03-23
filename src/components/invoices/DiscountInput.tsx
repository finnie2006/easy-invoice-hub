import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Percent, Euro } from 'lucide-react';

interface DiscountInputProps {
  discountType: string | null;
  discountValue: number;
  onTypeChange: (type: string | null) => void;
  onValueChange: (value: number) => void;
  label?: string;
}

export function DiscountInput({ discountType, discountValue, onTypeChange, onValueChange, label = 'Korting' }: DiscountInputProps) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Select
          value={discountType || 'none'}
          onValueChange={(v) => {
            if (v === 'none') {
              onTypeChange(null);
              onValueChange(0);
            } else {
              onTypeChange(v);
            }
          }}
        >
          <SelectTrigger className="w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Geen</SelectItem>
            <SelectItem value="percentage">%</SelectItem>
            <SelectItem value="amount">€</SelectItem>
          </SelectContent>
        </Select>
        {discountType && (
          <Input
            type="number"
            step="0.01"
            min="0"
            value={discountValue || ''}
            onChange={(e) => onValueChange(parseFloat(e.target.value) || 0)}
            placeholder={discountType === 'percentage' ? 'Bijv. 10' : 'Bijv. 50'}
            className="w-24"
          />
        )}
      </div>
    </div>
  );
}
