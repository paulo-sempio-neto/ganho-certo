import { FormEvent, useState } from "react";

export function useFormValidation() {
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleInvalid(event: FormEvent<HTMLFormElement | HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    // Only handle form elements
    const target = event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
    if (target.name) {
      setErrors(prev => ({ ...prev, [target.name]: target.validationMessage }));
    }
  }

  function clearError(name: string) {
    setErrors(prev => {
      if (!prev[name]) return prev;
      const newErrors = { ...prev };
      delete newErrors[name];
      return newErrors;
    });
  }

  function clearAllErrors() {
    setErrors({});
  }

  return { errors, handleInvalid, clearError, clearAllErrors, setErrors };
}
