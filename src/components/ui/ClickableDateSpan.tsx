import { formatDistanceToNow } from "date-fns";
import { useState } from "react";

export const ClickableDateSpan = ({ timestamp }: { timestamp: number }) => {
	const [isRaw, setIsRaw] = useState(false);

	const date = new Date(timestamp);
	if (Number.isNaN(date.getTime())) {
		return <span></span>;
	}

	return (
		<button
			type="button"
			tabIndex={0}
			onClick={() => setIsRaw((prev) => !prev)}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					setIsRaw((prev) => !prev);
				}
			}}
		>
			{isRaw
				? date.toLocaleTimeString()
				: formatDistanceToNow(date, {
						addSuffix: true,
					})}
		</button>
	);
};
