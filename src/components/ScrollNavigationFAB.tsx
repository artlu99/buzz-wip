import { useEffect, useRef, useState } from "react";

interface ScrollNavigationFABProps {
	firstMessageRef: React.RefObject<HTMLDivElement | null>;
	lastMessageRef: React.RefObject<HTMLDivElement | null>;
}

export const ScrollNavigationFAB = ({
	firstMessageRef,
	lastMessageRef,
}: ScrollNavigationFABProps) => {
	const [showTopButton, setShowTopButton] = useState(false);
	const [showBottomButton, setShowBottomButton] = useState(false);
	const fabRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const checkScrollPosition = () => {
			if (!firstMessageRef.current || !lastMessageRef.current) return;

			const firstRect = firstMessageRef.current.getBoundingClientRect();
			const lastRect = lastMessageRef.current.getBoundingClientRect();
			const viewportHeight = window.innerHeight;

			// Show top button if first message is not visible
			setShowTopButton(firstRect.bottom < 0 || firstRect.top > viewportHeight);

			// Show bottom button if last message is not visible
			setShowBottomButton(lastRect.top > viewportHeight || lastRect.bottom < 0);
		};

		// Check on mount and scroll
		checkScrollPosition();
		window.addEventListener("scroll", checkScrollPosition, { passive: true });
		window.addEventListener("resize", checkScrollPosition, { passive: true });

		// Also check periodically in case messages are added
		const interval = setInterval(checkScrollPosition, 1000);

		return () => {
			window.removeEventListener("scroll", checkScrollPosition);
			window.removeEventListener("resize", checkScrollPosition);
			clearInterval(interval);
		};
	}, [firstMessageRef, lastMessageRef]);

	const scrollToTop = () => {
		firstMessageRef.current?.scrollIntoView({
			behavior: "smooth",
			block: "start",
		});
	};

	const scrollToBottom = () => {
		lastMessageRef.current?.scrollIntoView({
			behavior: "smooth",
			block: "end",
		});
	};

	if (!showTopButton && !showBottomButton) return null;

	return (
		<div
			ref={fabRef}
			className="fixed bottom-20 right-4 z-40 flex flex-col gap-2"
		>
			{showTopButton && (
				<button
					type="button"
					className="btn btn-circle btn-primary shadow-lg"
					onClick={scrollToTop}
					title="Scroll to top"
					aria-label="Scroll to top of conversation"
				>
					<i className="ph-bold ph-arrow-up text-xl"></i>
				</button>
			)}
			{showBottomButton && (
				<button
					type="button"
					className="btn btn-circle btn-primary shadow-lg"
					onClick={scrollToBottom}
					title="Scroll to bottom"
					aria-label="Scroll to bottom of conversation"
				>
					<i className="ph-bold ph-arrow-down text-xl"></i>
				</button>
			)}
		</div>
	);
};
