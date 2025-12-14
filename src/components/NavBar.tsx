import { EvoluIdenticon } from "@evolu/react-web";
import {
	Menu,
	MenuButton,
	MenuItem,
	MenuItems,
	Transition,
} from "@headlessui/react";
import { Fragment } from "react";
import { Link, useLocation } from "wouter";
import { useZustand } from "../hooks/use-zustand";
import { chosenIdenticonStyle } from "../lib/helpers";
import { AutoResponderToggle } from "./ui/AutoResponderToggle";

export const NavBar = () => {
	const { user, uuid } = useZustand();
	const [location, navigate] = useLocation();

	const isProfilePage = location === "/profile";

	return (
		<div className="navbar bg-base-100">
			<div className="flex-1">
				<div className="flex flex-row items-center gap-2">
					<Menu as="div" className="relative">
						<MenuButton type="button" className="btn btn-ghost">
							<i className="ph-bold ph-list text-2xl mr-1" />
						</MenuButton>
						<Transition
							as={Fragment}
							enter="transition ease-out duration-100"
							enterFrom="transform opacity-0 scale-95"
							enterTo="transform opacity-100 scale-100"
							leave="transition ease-in duration-75"
							leaveFrom="transform opacity-100 scale-100"
							leaveTo="transform opacity-0 scale-95"
						>
							<MenuItems className="absolute left-0 mt-3 w-52 origin-top-left rounded-box bg-base-100 bg-opacity-100 shadow-lg ring-1 ring-base-300 focus:outline-none z-50 p-2">
								<div className="menu menu-sm">
									<MenuItem>
										{({ focus }) => (
											<Link
												to="/"
												className={`${
													focus || location === "/" ? "bg-base-200" : ""
												} block rounded-md px-2 py-2`}
											>
												Chat
											</Link>
										)}
									</MenuItem>
									<MenuItem>
										{({ focus }) => (
											<Link
												to="/profile"
												className={`${
													focus || location === "/profile" ? "bg-base-200" : ""
												} block rounded-md px-2 py-2`}
											>
												Profile
											</Link>
										)}
									</MenuItem>
									<MenuItem>
										{({ focus }) => (
											<Link
												to="/settings"
												className={`${
													focus || location === "/settings" ? "bg-base-200" : ""
												} block rounded-md px-2 py-2`}
											>
												Settings
											</Link>
										)}
									</MenuItem>
									<MenuItem>
										{({ focus }) => (
											<Link
												to="/about"
												className={`${
													focus || location === "/about" ? "bg-base-200" : ""
												} block rounded-md px-2 py-2`}
											>
												Help
											</Link>
										)}
									</MenuItem>
								</div>
							</MenuItems>
						</Transition>
					</Menu>

					<a
						href="https://github.com/artlu99/buzz-wip"
						target="_blank"
						rel="noopener noreferrer"
					>
						<i className="ph-bold ph-github-logo"></i>
					</a>
				</div>
			</div>
			<div className="flex-none">
				<div className="flex flex-row gap-2">
					<AutoResponderToggle />

					<button
						type="button"
						className="btn btn-ghost btn-circle avatar"
						onClick={() => {
							navigate(isProfilePage ? "/" : "/profile");
						}}
					>
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
				</div>
			</div>
		</div>
	);
};
