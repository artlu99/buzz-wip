import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "react-hot-toast";
import App from "./App.tsx";
import { SocketProvider } from "./providers/SocketProvider.tsx";
import "./index.css";
import invariant from "tiny-invariant";

const root = document.getElementById("root");
invariant(root, "Root element not found");
createRoot(root).render(
	<StrictMode>
		<SocketProvider>
			<Toaster />
			<App />
		</SocketProvider>
	</StrictMode>,
);
