import { messagesTestFixture, profilePictures } from "../lib/helpers";
import { ClickableDateSpan } from "./ClickableDateSpan";

export const Bubbles = () => {
  return messagesTestFixture.map((item, index) => {
    const isEven = index % 2 === 0;

    const [name, picture] = profilePictures[item.message.uuid ?? "unknown"];

    return (
      <div
        key={`${item.uid}-${new Date(item.date).getTime()}`}
        className={`chat ${isEven ? "chat-start" : "chat-end"}`}
      >
        <div className="chat-image">
          <div className="w-10 rounded-full">
            <img alt="Tailwind CSS chat bubble component" src={picture} />
          </div>
        </div>
        <div className="chat-header">
          {name}
          <time className="text-xs opacity-50 ml-2">
            <ClickableDateSpan timestamp={item.date} />
          </time>
        </div>
        <div
          className={`chat-bubble ${
            isEven ? "chat-bubble-success" : "chat-bubble-info"
          }`}
        >
          {item.message.content}
        </div>
        <div className="chat-footer opacity-50">
          Last seen <ClickableDateSpan timestamp={item.date} />
        </div>
      </div>
    );
  });
};
