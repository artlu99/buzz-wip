import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "react-hot-toast";
import App from "./App.tsx";
import { SocketProvider } from "./providers/SocketProvider.tsx";
import "./index.css";
import invariant from "tiny-invariant";

// Unregister any existing service workers from previous PWA setup
// This prevents errors when old service workers try to update non-existent sw.js files
if ("serviceWorker" in navigator) {
	navigator.serviceWorker.getRegistrations().then((registrations) => {
		for (const registration of registrations) {
			registration.unregister().catch(() => {
				// Ignore errors during unregistration
			});
		}
	});

	// Clear service worker caches
	// This is safe because:
	// - Your app data is in Evolu's IndexedDB (not service worker cache)
	// - User preferences are in localStorage (not service worker cache)
	// - Static assets will be re-downloaded (they're versioned by Vite anyway)
	// - Your app is real-time/websocket-based (no critical cached API responses)
	if ("caches" in window) {
		caches.keys().then((cacheNames) => {
			return Promise.all(
				cacheNames.map((cacheName) => {
					// Only clear caches that look like they're from the old PWA setup
					// This avoids clearing other potential caches
					if (
						cacheName.includes("workbox") ||
						cacheName.includes("pwa") ||
						cacheName.includes("vite-pwa")
					) {
						return caches.delete(cacheName);
					}
					return Promise.resolve(false);
				}),
			);
		});
	}
}

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
