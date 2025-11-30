import { formatDistanceToNow } from "date-fns";
import { useState } from "react";

export const ClickableDateSpan = ({ timestamp }: { timestamp: number }) => {
  const [isRaw, setIsRaw] = useState(false);

  const date = new Date(timestamp);

  return (
    <span onClick={() => setIsRaw((prev) => !prev)}>
      {isRaw
        ? date.toLocaleTimeString()
        : formatDistanceToNow(date, {
            addSuffix: true,
          })}
    </span>
  );
};
