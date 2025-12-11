import { EvoluIdenticon } from "@evolu/react-web";
import { Link, useLocation } from "wouter";
import { useZustand } from "../hooks/use-zustand";
import { chosenIdenticonStyle } from "../lib/helpers";
import { AutoResponderToggle } from "./ui/AutoResponderToggle";

export const NavBar = () => {
	const { user, uuid } = useZustand();
	const [location] = useLocation();

	return (
		<div className="navbar bg-base-100">
			<div className="flex-1">
				<a
					href="https://github.com/artlu99/buzz-wip"
					target="_blank"
					rel="noopener noreferrer"
				>
					<i className="ph-bold ph-github-logo"></i>
				</a>
			</div>
			<div className="flex-none">
				<AutoResponderToggle />
				<div className="dropdown dropdown-end">
					<button type="button" className="btn btn-ghost btn-circle avatar">
						<div className="w-10 rounded-full">
							{user.pfpUrl ? (
								<img
									src={user.pfpUrl}
									alt="Profile"
									className="w-10 rounded-full"
								/>
							) : uuid ? (
								<EvoluIdenticon
									id={uuid}
									size={40}
									style={chosenIdenticonStyle}
								/>
							) : (
								<img
									alt="Tailwind CSS Navbar component"
									src="https://img.daisyui.com/images/stock/photo-1534528741775-53994a69daeb.webp"
								/>
							)}
						</div>
					</button>
					<button
						type="button"
						tabIndex={0}
						className="menu menu-sm dropdown-content bg-base-100 bg-opacity-100 rounded-box z-50 mt-3 w-52 p-2 shadow"
					>
						<li className={location === "/" ? "bg-base-200" : ""}>
							<Link to="/">Chat</Link>
						</li>
						<li className={location === "/db" ? "bg-base-200" : ""}>
							<Link to="/db" className="justify-between">
								Profile
							</Link>
						</li>
						<li className={location === "/settings" ? "bg-base-200" : ""}>
							<Link to="/settings">Settings</Link>
						</li>
						<li className={location === "/about" ? "bg-base-200" : ""}>
							<Link to="/about">Help</Link>
						</li>
					</button>
				</div>
			</div>
		</div>
	);
};
