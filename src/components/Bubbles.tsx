import type { OwnerId } from "@evolu/common";
import { useQuery } from "@evolu/react";
import { EvoluIdenticon } from "@evolu/react-web";
import { alphabetical, unique } from "radash";
import { useZustand } from "../hooks/use-zustand";
import {
	chosenIdenticonStyle,
	messagesTestFixture,
	profilePictures,
} from "../lib/helpers";
import { messagesQuery } from "../lib/local-first";
import { ClickableDateSpan } from "./ClickableDateSpan";

const INCLUDE_SAMPLE_MESSAGES = false;

export const Bubbles = () => {
	const { displayName } = useZustand();

	const savedMessages = useQuery(messagesQuery());
	const newMessages = INCLUDE_SAMPLE_MESSAGES ? messagesTestFixture : [];
	const messages = alphabetical(
		unique(
			[...(savedMessages ?? []), ...newMessages],
			(m) => `${m.createdBy}-${m.createdAt}`,
		),
		(m) => m.createdAt,
		"asc",
	);

	return messages.map((item, index) => {
		const isEven = index % 2 === 0;

		const [name, picture] = profilePictures[item.createdBy ?? "unknown"] ?? [
			undefined,
			undefined,
		];

		const timestamp = new Date(item.createdAt).getTime();
		return (
			<div
				key={`${item.createdBy}-${new Date(item.createdAt).getTime()}`}
				className={`chat ${item.createdBy === displayName ? "chat-end" : "chat-start"}`}
			>
				<div className="chat-image">
					<div className="w-10 rounded-full">
						{picture ? (
							<img alt="Tailwind CSS chat bubble component" src={picture} />
						) : (
							<EvoluIdenticon
								id={item.createdBy as OwnerId}
								size={40}
								style={chosenIdenticonStyle}
							/>
						)}
					</div>
				</div>
				<div className="chat-header">{name ?? item.createdBy}</div>
				<div
					className={`chat-bubble ${
						item.createdBy === displayName
							? "chat-bubble-success"
							: isEven
								? "chat-bubble-info"
								: "chat-bubble-primary"
					}`}
				>
					{item.content}
				</div>
				<div className="chat-footer opacity-50">
					<ClickableDateSpan timestamp={timestamp} />
				</div>
			</div>
		);
	});
};
