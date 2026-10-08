

type ErrorMessageProps = {
  id: string;
  message?: string;
};

export function ErrorMessage({ id, message }: ErrorMessageProps) {
  if (!message) return null;
  return (
    <div id={id} className="field-error-message" role="alert">
      {message}
    </div>
  );
}
