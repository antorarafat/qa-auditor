import React, { useState } from "react";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import * as SelectPrimitive from "@radix-ui/react-select";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { DayPicker } from "react-day-picker";
import { format, parseISO } from "date-fns";
import { CalendarDays, Check, ChevronDown, ChevronUp } from "lucide-react";
import "react-day-picker/style.css";

export function cn(...values) {
  return values.filter(Boolean).join(" ");
}

export const Button = React.forwardRef(function Button(
  { variant = "default", size = "md", className = "", children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        "ui-button",
        `button-${variant}`,
        `button-${size}`,
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
});
export const Card = React.forwardRef(function Card(
  { className = "", children, ...props },
  ref,
) {
  return (
    <div ref={ref} className={cn("ui-card", className)} {...props}>
      {children}
    </div>
  );
});
export function CardHeader({ className = "", children }) {
  return <div className={cn("card-header", className)}>{children}</div>;
}
export function CardTitle({ className = "", children }) {
  return <h2 className={cn("card-title", className)}>{children}</h2>;
}
export function CardDescription({ className = "", children }) {
  return <p className={cn("card-description", className)}>{children}</p>;
}
export function CardContent({ className = "", children }) {
  return <div className={cn("card-content", className)}>{children}</div>;
}
export const Input = React.forwardRef(function Input(
  { className = "", ...props },
  ref,
) {
  return <input ref={ref} className={cn("ui-input", className)} {...props} />;
});
export const Textarea = React.forwardRef(function Textarea(
  { className = "", ...props },
  ref,
) {
  return (
    <textarea ref={ref} className={cn("ui-textarea", className)} {...props} />
  );
});
export function Label({ className = "", children, ...props }) {
  return (
    <label className={cn("ui-label", className)} {...props}>
      {children}
    </label>
  );
}

export function Select({
  value,
  onValueChange,
  options = [],
  placeholder = "Select an option",
  className = "",
  disabled,
  id,
  "aria-label": ariaLabel,
}) {
  return (
    <SelectPrimitive.Root
      value={value ?? ""}
      onValueChange={onValueChange}
      disabled={disabled}
    >
      <SelectPrimitive.Trigger
        id={id}
        aria-label={ariaLabel}
        className={cn("ui-select-trigger", className)}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon className="ui-select-icon">
          <ChevronDown size={15} />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          className="ui-select-content"
          position="popper"
          sideOffset={5}
          collisionPadding={12}
        >
          <SelectPrimitive.ScrollUpButton className="ui-select-scroll">
            <ChevronUp size={15} />
          </SelectPrimitive.ScrollUpButton>
          <SelectPrimitive.Viewport className="ui-select-viewport">
            {options.map((option) => {
              const item =
                typeof option === "string"
                  ? { value: option, label: option }
                  : option;
              return (
                <SelectPrimitive.Item
                  key={item.value}
                  value={String(item.value)}
                  className="ui-select-item"
                  disabled={item.disabled}
                >
                  <SelectPrimitive.ItemText>
                    {item.label}
                  </SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator className="ui-select-check">
                    <Check size={14} />
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              );
            })}
          </SelectPrimitive.Viewport>
          <SelectPrimitive.ScrollDownButton className="ui-select-scroll">
            <ChevronDown size={15} />
          </SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  id,
  "aria-label": ariaLabel,
  disabled,
}) {
  const [open, setOpen] = useState(false);
  const selected = value ? parseISO(value) : undefined;
  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          className={cn("date-picker-trigger", !value && "placeholder")}
          aria-label={ariaLabel}
          disabled={disabled}
        >
          <CalendarDays size={16} />
          <span>
            {selected ? format(selected, "dd MMM yyyy") : placeholder}
          </span>
          <ChevronDown size={15} />
        </Button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          className="date-picker-popover"
          align="start"
          sideOffset={6}
          collisionPadding={12}
        >
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={(date) => {
              onChange(date ? format(date, "yyyy-MM-dd") : "");
              if (date) setOpen(false);
            }}
            defaultMonth={selected}
            showOutsideDays
          />
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="date-picker-clear"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              Clear date
            </Button>
          )}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

export function Separator() {
  return <div className="ui-separator" />;
}
export function Switch({ checked, onChange, className = "", ...props }) {
  return (
    <SwitchPrimitive.Root
      className={cn("ui-switch", className)}
      checked={checked}
      onCheckedChange={onChange}
      {...props}
    >
      <SwitchPrimitive.Thumb className="ui-switch-thumb" />
    </SwitchPrimitive.Root>
  );
}

export const RadioGroup = React.forwardRef(function RadioGroup(
  { className = "", ...props },
  ref,
) {
  return (
    <RadioGroupPrimitive.Root
      ref={ref}
      className={cn("ui-radio-group", className)}
      {...props}
    />
  );
});
export const RadioGroupItem = React.forwardRef(function RadioGroupItem(
  { className = "", children, ...props },
  ref,
) {
  return (
    <RadioGroupPrimitive.Item
      ref={ref}
      className={cn("ui-radio-item", className)}
      {...props}
    >
      {children}
    </RadioGroupPrimitive.Item>
  );
});

export const Tabs = TabsPrimitive.Root;
export const TabsList = React.forwardRef(function TabsList(
  { className = "", ...props },
  ref,
) {
  return (
    <TabsPrimitive.List
      ref={ref}
      className={cn("ui-tabs-list", className)}
      {...props}
    />
  );
});
export const TabsTrigger = React.forwardRef(function TabsTrigger(
  { className = "", ...props },
  ref,
) {
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn("ui-tabs-trigger", className)}
      {...props}
    />
  );
});
export const TabsContent = React.forwardRef(function TabsContent(
  { className = "", ...props },
  ref,
) {
  return (
    <TabsPrimitive.Content
      ref={ref}
      className={cn("ui-tabs-content", className)}
      {...props}
    />
  );
});

export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = "Continue",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
}) {
  return (
    <AlertDialogPrimitive.Root>
      <AlertDialogPrimitive.Trigger asChild>
        {trigger}
      </AlertDialogPrimitive.Trigger>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay className="ui-dialog-overlay" />
        <AlertDialogPrimitive.Content className="ui-dialog-content">
          <AlertDialogPrimitive.Title className="ui-dialog-title">
            {title}
          </AlertDialogPrimitive.Title>
          <AlertDialogPrimitive.Description className="ui-dialog-description">
            {description}
          </AlertDialogPrimitive.Description>
          <div className="ui-dialog-actions">
            <AlertDialogPrimitive.Cancel asChild>
              <Button type="button" variant="outline">
                {cancelLabel}
              </Button>
            </AlertDialogPrimitive.Cancel>
            <AlertDialogPrimitive.Action asChild>
              <Button
                type="button"
                variant={destructive ? "destructive" : "default"}
                onClick={onConfirm}
              >
                {confirmLabel}
              </Button>
            </AlertDialogPrimitive.Action>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
}

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
export const DropdownMenuContent = React.forwardRef(
  function DropdownMenuContent(
    { className = "", sideOffset = 7, ...props },
    ref,
  ) {
    return (
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          ref={ref}
          sideOffset={sideOffset}
          collisionPadding={12}
          className={cn("ui-dropdown-content", className)}
          {...props}
        />
      </DropdownMenuPrimitive.Portal>
    );
  },
);
export const DropdownMenuLabel = React.forwardRef(function DropdownMenuLabel(
  { className = "", ...props },
  ref,
) {
  return (
    <DropdownMenuPrimitive.Label
      ref={ref}
      className={cn("ui-dropdown-label", className)}
      {...props}
    />
  );
});
export const DropdownMenuItem = React.forwardRef(function DropdownMenuItem(
  { className = "", destructive = false, ...props },
  ref,
) {
  return (
    <DropdownMenuPrimitive.Item
      ref={ref}
      className={cn(
        "ui-dropdown-item",
        destructive && "destructive",
        className,
      )}
      {...props}
    />
  );
});
export const DropdownMenuSeparator = React.forwardRef(
  function DropdownMenuSeparator({ className = "", ...props }, ref) {
    return (
      <DropdownMenuPrimitive.Separator
        ref={ref}
        className={cn("ui-dropdown-separator", className)}
        {...props}
      />
    );
  },
);
