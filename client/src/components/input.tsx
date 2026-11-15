// src/components/input.tsx
import type { ChangeEvent } from "react";
import { Eye, EyeOff } from "lucide-react";

interface InputProps {
  label: string;
  type?: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  required?: boolean;
  isPasswordVisible?: boolean;
  togglePasswordVisibility?: () => void;
}

export function Input({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  required = false,
  isPasswordVisible = false,
  togglePasswordVisibility,
}: InputProps) {
  return (
    <div className="flex flex-col gap-2 w-full">
      <label className="text-sm font-medium text-text">
        {label}
      </label>

      <div className="relative flex w-full items-center">
        <input
          type={type === "password" && isPasswordVisible ? "text" : type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          className="
            w-full px-4 py-3
            rounded-lg outline-none
            text-sm transition-all duration-200
            bg-background text-text-h placeholder:text-muted
            border border-border focus:border-primary
            focus:ring-2 focus:ring-primary/30
          "
        />

        {type === "password" && togglePasswordVisibility && (
          <button
            type="button"
            onClick={togglePasswordVisibility}
            aria-label={isPasswordVisible ? "Hide password" : "Show password"}
            className="absolute right-3 text-muted hover:text-text-h transition-colors cursor-pointer"
          >
            {isPasswordVisible ? (
              <Eye className="h-5 w-5" />
            ) : (
              <EyeOff className="h-5 w-5" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}