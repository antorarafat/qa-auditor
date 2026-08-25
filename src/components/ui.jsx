import React from 'react';

export function cn(...values) { return values.filter(Boolean).join(' '); }
export function Button({ variant = 'default', size = 'md', className = '', children, ...props }) { return <button className={cn('ui-button', `button-${variant}`, `button-${size}`, className)} {...props}>{children}</button>; }
export const Card = React.forwardRef(function Card({ className = '', children, ...props }, ref) { return <div ref={ref} className={cn('ui-card', className)} {...props}>{children}</div>; });
export function CardHeader({ className = '', children }) { return <div className={cn('card-header', className)}>{children}</div>; }
export function CardTitle({ className = '', children }) { return <h2 className={cn('card-title', className)}>{children}</h2>; }
export function CardDescription({ className = '', children }) { return <p className={cn('card-description', className)}>{children}</p>; }
export function CardContent({ className = '', children }) { return <div className={cn('card-content', className)}>{children}</div>; }
export function Input(props) { return <input className={cn('ui-input', props.className)} {...props} />; }
export function Textarea(props) { return <textarea className={cn('ui-textarea', props.className)} {...props} />; }
export function Label({ className = '', children, ...props }) { return <label className={cn('ui-label', className)} {...props}>{children}</label>; }
export function Select({ className = '', children, ...props }) { return <select className={cn('ui-select', className)} {...props}>{children}</select>; }
export function Separator() { return <div className="ui-separator" />; }
export function Switch({ checked, onChange, className = '', ...props }) { return <button type="button" className={cn('ui-switch', checked && 'checked', className)} role="switch" aria-checked={checked} onClick={() => onChange(!checked)} {...props}><span /></button>; }
