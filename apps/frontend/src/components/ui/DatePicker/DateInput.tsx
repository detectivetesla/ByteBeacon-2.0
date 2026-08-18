import React from 'react';
import { Input, InputProps } from '../Input/Input.js';
import { Calendar } from 'lucide-react';

export interface DateInputProps extends Omit<InputProps, 'type' | 'leftIcon'> {
  showCalendarIcon?: boolean;
}

export const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(
  ({ showCalendarIcon = true, ...props }, ref) => {
    return (
      <Input
        ref={ref}
        type="date"
        leftIcon={showCalendarIcon ? <Calendar size={15} color="var(--color-text-muted)" /> : undefined}
        {...props}
      />
    );
  },
);

DateInput.displayName = 'DateInput';
