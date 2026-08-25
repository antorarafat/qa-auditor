import React, { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Command } from 'cmdk';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { Button } from './ui';

export function SingleSelect({ id, value, options, placeholder, searchPlaceholder, emptyText, disabled, onChange }) {
  const [open, setOpen] = useState(false);
  return <Popover.Root open={open} onOpenChange={setOpen}>
    <Popover.Trigger asChild>
      <Button id={id} type="button" variant="outline" className="single-select-trigger" disabled={disabled} aria-expanded={open}>
        <span className={!value ? 'placeholder' : ''}>{value || placeholder}</span><ChevronsUpDown size={16} />
      </Button>
    </Popover.Trigger>
    <Popover.Portal>
      <Popover.Content className="multi-select-popover" sideOffset={6} align="start">
        <Command className="multi-select-command">
          <div className="multi-select-search"><Search size={15} /><Command.Input placeholder={searchPlaceholder} /></div>
          <Command.List><Command.Empty>{emptyText}</Command.Empty>{options.map(option => <Command.Item key={option} value={option} onSelect={() => { onChange(option); setOpen(false); }}><span className={`multi-select-check ${value === option ? 'selected' : ''}`}>{value === option && <Check size={13} />}</span><span className="multi-select-option"><strong>{option}</strong></span></Command.Item>)}</Command.List>
        </Command>
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>;
}
