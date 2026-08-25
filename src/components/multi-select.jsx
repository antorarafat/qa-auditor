import React, { useMemo, useState } from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { Command as CommandPrimitive } from 'cmdk';
import { Check, ChevronsUpDown, Search, X } from 'lucide-react';
import { Button, cn } from './ui';

export function MultiSelect({
  id,
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyText,
  selectedText,
  clearText,
  disabled = false
}) {
  const [open, setOpen] = useState(false);
  const normalizedOptions = useMemo(() => options.map(option => typeof option === 'string'
    ? { value: option, label: option }
    : option), [options]);
  const selectedOptions = normalizedOptions.filter(option => value.includes(option.value));

  function toggle(optionValue) {
    onChange(value.includes(optionValue)
      ? value.filter(item => item !== optionValue)
      : [...value, optionValue]);
  }

  return <div className="shadcn-multi-select">
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <Button id={id} type="button" variant="outline" className="multi-select-trigger" role="combobox" aria-expanded={open} aria-controls={`${id}-list`} disabled={disabled}>
          <span className={cn(!selectedOptions.length && 'placeholder')}>{selectedOptions.length ? selectedText.replace('{count}', selectedOptions.length) : placeholder}</span>
          <ChevronsUpDown size={16} aria-hidden="true" />
        </Button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content className="multi-select-popover" align="start" sideOffset={6} collisionPadding={12}>
          <CommandPrimitive className="multi-select-command">
            <div className="multi-select-search"><Search size={15} aria-hidden="true" /><CommandPrimitive.Input placeholder={searchPlaceholder} /></div>
            <CommandPrimitive.List id={`${id}-list`} aria-multiselectable="true">
              <CommandPrimitive.Empty>{emptyText}</CommandPrimitive.Empty>
              <CommandPrimitive.Group>
                {normalizedOptions.map(option => {
                  const selected = value.includes(option.value);
                  return <CommandPrimitive.Item key={option.value} value={`${option.label} ${option.description || ''}`} onSelect={() => toggle(option.value)}>
                    <span className={cn('multi-select-check', selected && 'selected')}><Check size={14} /></span>
                    <span className="multi-select-option"><strong>{option.label}</strong>{option.description && <small>{option.description}</small>}</span>
                  </CommandPrimitive.Item>;
                })}
              </CommandPrimitive.Group>
            </CommandPrimitive.List>
            {selectedOptions.length > 0 && <button type="button" className="multi-select-clear" onClick={() => onChange([])}>{clearText}</button>}
          </CommandPrimitive>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
    {selectedOptions.length > 0 && <div className="multi-select-chips">{selectedOptions.map(option => <button type="button" key={option.value} onClick={() => toggle(option.value)} disabled={disabled} title={`${clearText}: ${option.label}`}><span>{option.label}</span><X size={13} aria-hidden="true" /></button>)}</div>}
  </div>;
}
