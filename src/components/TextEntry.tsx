import { useState } from "react";
import { useZustand } from "../hooks/use-zustand";

interface TextEntryProps {
  onTyping?: () => void;
  onStopTyping?: () => void;
  onSend?: () => void;
}

export const TextEntry = ({
  onTyping,
  onStopTyping,
  onSend,
}: TextEntryProps) => {
  const [message, setMessage] = useState("");
  const { displayName } = useZustand();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(e.target.value);
  };
  const handleSubmit = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    onSend?.();
    setMessage("");
  };
  return (
    <form className="form-control flex flex-col gap-2 items-center justify-center">
      <div className="flex flex-row gap-2 w-full">
        <input
          type="text"
          placeholder="Type here"
          className="input input-bordered"
          value={message}
          onChange={handleChange}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "Escape") {
              onStopTyping?.();
            } else {
              onTyping?.();
            }
          }}
        />
        <button
          className="btn btn-primary"
          type="submit"
          disabled={!message}
          onClick={(e) => {
            e.preventDefault();
            handleSubmit(e);
          }}
        >
          <i className="ph-bold ph-paper-plane-right" />
        </button>
      </div>
      <div className="flex flex-col gap-2 flex-1 w-full">
        <label htmlFor="text-entry" className="text-sm text-left text-base-content/70">
          <span className="font-semibold">You are:</span> {displayName}
        </label>
      </div>
    </form>
  );
};
