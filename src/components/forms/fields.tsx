import { useId, useState } from "react";
import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { isValidEtPhone, PHONE_ERROR } from "@/lib/phone";

export const EMAIL_ERROR = "Please enter a valid email address (e.g. name@tvet.com).";

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

/** Strips anything that can never belong to a telephone number (letters, @, etc). */
export function sanitizePhoneInput(value: string) {
  return value.replace(/[^\d+\s\-()]/g, "");
}

function FieldShell({
  id,
  label,
  required,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-medium">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

type BaseProps = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  disabled?: boolean;
};

export function TextField({ label, value, onChange, required, placeholder, hint, disabled }: BaseProps) {
  const id = useId();
  const [touched, setTouched] = useState(false);
  const error = touched && required && !value.trim() ? `${label} is required.` : null;
  return (
    <FieldShell id={id} label={label} required={required} hint={hint} error={error}>
      <Input
        id={id}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onBlur={() => setTouched(true)}
        onChange={(e) => onChange(e.target.value)}
        className={cn(error && "border-destructive")}
      />
    </FieldShell>
  );
}

/** Email only — never accepts a telephone number. */
export function EmailField({ label = "Email address", value, onChange, required, placeholder = "e.g. abdi@tvet.edu.et", hint, disabled }: Partial<BaseProps> & { value: string; onChange: (v: string) => void }) {
  const id = useId();
  const [touched, setTouched] = useState(false);
  const empty = !value.trim();
  const error = touched
    ? required && empty
      ? "Email address is required."
      : !empty && !isValidEmail(value)
        ? EMAIL_ERROR
        : null
    : null;
  return (
    <FieldShell id={id} label={label} required={required} hint={hint} error={error}>
      <Input
        id={id}
        type="email"
        inputMode="email"
        autoComplete="email"
        spellCheck={false}
        disabled={disabled}
        placeholder={placeholder}
        value={value}
        onBlur={() => setTouched(true)}
        onChange={(e) => onChange(e.target.value)}
        className={cn(error && "border-destructive")}
      />
    </FieldShell>
  );
}

/** Ethiopian telephone only — letters and "@" can never be typed in. */
export function PhoneField({ label = "Telephone number", value, onChange, required, placeholder = "e.g. 0912345678", hint, disabled }: Partial<BaseProps> & { value: string; onChange: (v: string) => void }) {
  const id = useId();
  const [touched, setTouched] = useState(false);
  const empty = !value.trim();
  const error = touched
    ? required && empty
      ? "Telephone number is required."
      : !empty && !isValidEtPhone(value)
        ? PHONE_ERROR
        : null
    : !empty && !isValidEtPhone(value)
      ? PHONE_ERROR
      : null;
  return (
    <FieldShell id={id} label={label} required={required} hint={hint} error={error}>
      <Input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        disabled={disabled}
        placeholder={placeholder}
        value={value}
        onBlur={() => setTouched(true)}
        onChange={(e) => onChange(sanitizePhoneInput(e.target.value))}
        className={cn(error && "border-destructive")}
      />
    </FieldShell>
  );
}

export function PasswordField({ label = "Password", value, onChange, required, placeholder = "min 8 characters", hint, disabled, reveal = true }: Partial<BaseProps> & { value: string; onChange: (v: string) => void; reveal?: boolean }) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} required={required} hint={hint}>
      <Input
        id={id}
        type={reveal ? "text" : "password"}
        autoComplete="new-password"
        disabled={disabled}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </FieldShell>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  required,
  placeholder = "Select…",
  hint,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  required?: boolean;
  placeholder?: string;
  hint?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} required={required} hint={hint}>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={id}><SelectValue placeholder={placeholder} /></SelectTrigger>
        <SelectContent>
          {options.length === 0 && <SelectItem value="__none" disabled>No options available</SelectItem>}
          {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </FieldShell>
  );
}
