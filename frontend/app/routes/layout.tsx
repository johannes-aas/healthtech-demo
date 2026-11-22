import { Button } from "@/components/ui/button.tsx";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { useTheme } from "@/features/dark-mode/use-theme.ts";
import { useDate } from "@/features/date-picker/use-date.ts";
import { BellPopup } from "@/features/popups/bell-popup.tsx";
import { PrivacySettingsPopup } from "@/features/popups/privacy-settings-popup.tsx";
import { ProfilePopup } from "@/features/popups/profile-popup.tsx";
import { usePopup } from "@/features/popups/use-popup.ts";
import { useUser } from "@/features/user/user-context.tsx";
import { KARI_NORDMANN_ID, OLA_NORDMANN_ID } from "@/features/user/user-utils.ts";
import { useView } from "@/features/views/use-view.ts";
import { useFormatDate } from "@/hooks/use-format-date.ts";
import type { TranslateFn } from "@/i18n/config.ts";
import { usersQueryOptions } from "@/lib/api.ts";
import { DemoUserHint } from "@/lib/demo/demo-user-hint.tsx";
import { ResetDemoDataButton } from "@/lib/demo/reset-demo-data-button.tsx";
import { IS_DEMO_MODE } from "@/lib/demo/storage.ts";
import { type User, UserRoleSchema } from "@/lib/dto/user.ts";
import { cn, shorthandName, userRoleToString } from "@/lib/utils.ts";
import { useQuery } from "@tanstack/react-query";
import {
	Bell,
	HatGlassesIcon,
	House,
	Languages,
	LayoutDashboard,
	type LucideIcon,
	Monitor,
	Moon,
	Palette,
	Radio,
	Sun,
	User as UserIcon,
	Users,
} from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { href, NavLink, Outlet, type To, useLocation, useNavigate } from "react-router";

const Logo = () => (
	<svg width="44" height="40" viewBox="0 0 44 40" fill="none" xmlns="http://www.w3.org/2000/svg">
		<title>{"HealthTech Logo"}</title>
		<path
			d="M42.8334 20H34.5001L28.2501 38.75L15.7501 1.25L9.50008 20H1.16675"
			stroke="#A4D4DB"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
	</svg>
);

function HomeLink() {
	return (
		<NavLink
			to={href("/")}
			className="flex cursor-pointer items-center space-x-2 text-foreground transition-colors hover:text-primary/90"
		>
			<div className="text-2xl">
				<Logo />
			</div>
			<span className="hidden text-xl sm:inline-block">{"HealthTech"}</span>
		</NavLink>
	);
}

type NavRoute = {
	to: To;
	label: string;
	icon?: LucideIcon;
	/** Additional pathnames for which this link should be shown as active. */
	activePaths?: Array<string>;
};

function getLinks(t: TranslateFn, role: User["role"] | null): Array<NavRoute> {
	switch (role) {
		case null: {
			return [];
		}

		case "operator": {
			return [
				{ to: href("/operator/live"), label: t(($) => $.layout.live), icon: Radio },
				{
					to: href("/operator"),
					label: t(($) => $.layout.overview),
					icon: LayoutDashboard,
					// The exposure type pages are filters of the overview, navigated to from within the page.
					activePaths: [href("/operator/dust"), href("/operator/noise"), href("/operator/vibration")],
				},
			];
		}

		case "foreman": {
			return [
				{
					to: href("/foreman"),
					label: t(($) => $.layout.home),
					icon: House,
				},
				{
					to: href("/foreman/team"),
					label: t(($) => $.layout.team),
					icon: Users,
				},
			];
		}

		default: {
			return [];
		}
	}
}

export default function Layout() {
	const { t, i18n } = useTranslation();
	const {
		visible: notificationPopupVisible,
		openPopup: openNotificationPopup,
		closePopup: closeNotificationPopup,
	} = usePopup();

	const { user, setUser, isLoading: isUserLoading } = useUser();
	const { data: users } = useQuery(usersQueryOptions());

	// Sort Ola and Kari to the top, as they are the main demo users
	const priorityUserIds: Array<string> = [OLA_NORDMANN_ID, KARI_NORDMANN_ID];

	const sortedUsers = (users ?? []).toSorted((a, b) => {
		const aPriority = priorityUserIds.indexOf(a.id);
		const bPriority = priorityUserIds.indexOf(b.id);

		if (aPriority === bPriority) {
			return a.name.localeCompare(b.name);
		}

		if (aPriority === -1) {
			return 1;
		}

		if (bPriority === -1) {
			return -1;
		}

		return aPriority - bPriority;
	});

	const links = getLinks(t, user?.role ?? null);

	const location = useLocation();
	const navigate = useNavigate();
	// Redirect users to the appropriate base route if they try to access a route that doesn't match their role
	useEffect(() => {
		if (!user?.role || isUserLoading) {
			return;
		}

		const pathname = location.pathname;

		const isOperatorRoute = pathname.startsWith("/operator");
		const isForemanRoute = pathname.startsWith("/foreman");

		if (user.role === "operator" && isForemanRoute) {
			navigate("/operator", { replace: true });
		}

		if (user.role === "foreman" && isOperatorRoute) {
			navigate("/foreman", { replace: true });
		}
	}, [user?.role, location.pathname, navigate, isUserLoading]);

	const desktopHeader = (
		<>
			<HomeLink />

			<nav className="flex list-none items-center rounded-full">
				<NavTabs routes={links} />
			</nav>
		</>
	);

	return (
		<SidebarProvider defaultOpen={false}>
			<SidebarInset>
				<div className="mx-auto flex w-full max-w-[90rem] flex-1 flex-col">
					<header className="sticky top-0 z-40 mx-4 flex items-center justify-between gap-2 bg-background/95 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:mx-5">
						{desktopHeader}

						<div className="flex shrink-0 flex-row items-center gap-1 sm:gap-4">
							<Button
								variant="ghost"
								size="icon"
								onClick={openNotificationPopup}
								className="cursor-pointer rounded-full"
							>
								<div className="relative">
									<Bell className="size-5" />
									<span className="absolute -top-2 -right-2 flex size-4.75 items-center justify-center rounded-full border-2 border-background bg-red-600 text-[0.625rem] text-white">
										{"4"}
									</span>
								</div>
							</Button>

							<UserDropdown user={user} users={sortedUsers} setUser={setUser} i18n={i18n} />
						</div>
					</header>

					<BellPopup
						open={notificationPopupVisible}
						onClose={closeNotificationPopup}
						title={t(($) => $.common.notifications)}
					/>

					<main className="m-4 flex flex-1 flex-col sm:m-5">
						<Outlet />
					</main>
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
}

function UserDropdown({
	user,
	users,
	setUser,
	i18n,
}: {
	user: User | null;
	users: Array<User>;
	setUser: (user: User) => void;
	i18n: ReturnType<typeof useTranslation>["i18n"];
}) {
	const { t } = useTranslation();
	const { theme, setTheme } = useTheme();

	const { visible: profilePopupVisible, openPopup: openProfilePopup, closePopup: closeProfilePopup } = usePopup();

	const {
		visible: privacySettingsPopupVisible,
		openPopup: openPrivacySettingsPopup,
		closePopup: closePrivacySettingsPopup,
	} = usePopup();

	// Shown on every page load until dismissed or the menu is opened
	const [showHint, setShowHint] = useState(true);
	const dismissHint = () => setShowHint(false);

	if (!user) return null;

	const currentLanguage = i18n.language || "en";

	return (
		<>
			<DropdownMenu
				onOpenChange={(open) => {
					// Opening the menu is what the hint asks for, so it has done its job
					if (open) dismissHint();
				}}
			>
				<div className="relative">
					<DropdownMenuTrigger asChild={true}>
						<Button
							variant="ghost"
							title={t(($) => $.demo.switchUser)}
							className="h-11 max-w-[14rem] cursor-pointer gap-2 rounded-full px-1 md:pr-3"
						>
							<div className="relative shrink-0">
								<div className="flex size-9 items-center justify-center rounded-full bg-primary ring-2 ring-amber-500 dark:ring-amber-700">
									<UserIcon className="size-5 text-primary-foreground" />
								</div>
								{/* Same amber as the DEMO box in the menu, so the two read as related */}
								<span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-full border border-amber-500 bg-amber-100 px-1 font-semibold text-[0.5rem] text-amber-900 uppercase leading-3 tracking-wider dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
									{t(($) => $.demo.badge)}
								</span>
							</div>
							{/* Avatar only on small screens, where the header has no room for the name */}
							<div className="hidden min-w-0 grow text-left leading-tight md:block">
								<p className="truncate font-medium">{shorthandName(user.name)}</p>
								<p className="truncate text-foreground/60 text-xs">{user.location.site}</p>
							</div>
						</Button>
					</DropdownMenuTrigger>

					{showHint && <DemoUserHint onDismiss={dismissHint} />}
				</div>

				<DropdownMenuContent align="end" sideOffset={10}>
					<DropdownMenuItem onSelect={openProfilePopup}>
						<UserIcon className="size-4" />
						<span>{t(($) => $.profile.title)}</span>
					</DropdownMenuItem>

					<DropdownMenuSeparator />

					<DropdownMenuItem onSelect={openPrivacySettingsPopup}>
						<HatGlassesIcon className="size-4" />
						<span>{t(($) => $.profile.privacySettings)}</span>
					</DropdownMenuItem>

					<DropdownMenuSeparator />

					<div className="flex items-center gap-4 pl-2 text-sm">
						<div className="flex gap-2">
							<Palette className="size-4 text-muted-foreground" />
							<span>{t(($) => $.layout.theme)}</span>
						</div>

						<div className="inline-flex rounded-full p-1">
							<Button
								variant="ghost"
								size="icon"
								onClick={() => setTheme("light")}
								className={cn(
									"inline-flex cursor-pointer items-center justify-center rounded-full p-2 transition-colors",
									theme === "light" && "bg-accent",
								)}
							>
								<Sun className="size-4" />
							</Button>
							<Button
								variant="ghost"
								size="icon"
								onClick={() => setTheme("dark")}
								className={cn(
									"inline-flex cursor-pointer items-center justify-center rounded-full p-2 transition-colors",
									theme === "dark" && "bg-accent",
								)}
							>
								<Moon className="size-4" />
							</Button>
							<Button
								variant="ghost"
								size="icon"
								onClick={() => setTheme("system")}
								className={cn(
									"inline-flex cursor-pointer items-center justify-center rounded-full p-2 transition-colors",
									theme === "system" && "bg-accent",
								)}
							>
								<Monitor className="size-4" />
							</Button>
						</div>
					</div>

					<DropdownMenuSub>
						<DropdownMenuSubTrigger>
							<Languages className="mr-2 size-4 text-muted-foreground" />
							<span>{t(($) => $.layout.language)}</span>
						</DropdownMenuSubTrigger>
						<DropdownMenuSubContent>
							<DropdownMenuRadioGroup
								value={currentLanguage}
								onValueChange={(value) => {
									i18n.changeLanguage(value);
									localStorage.setItem("i18nextLng", value);
								}}
							>
								<DropdownMenuRadioItem value="en">{t(($) => $.language.english)}</DropdownMenuRadioItem>
								<DropdownMenuRadioItem value="no">
									{t(($) => $.language.norwegian)}
								</DropdownMenuRadioItem>
							</DropdownMenuRadioGroup>
						</DropdownMenuSubContent>
					</DropdownMenuSub>

					<div className="m-1 mt-3">
						{/* Tab-shaped label: overlaps the box's top border so the two read as one shape */}
						<span className="relative z-10 -mb-[1.5px] block w-fit rounded-t-md border-[1.5px] border-amber-500 border-b-0 bg-amber-100 px-2.5 pt-0.5 font-semibold text-[11px] text-amber-900 uppercase leading-3 tracking-widest dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
							{"Demo"}
						</span>

						<div className="rounded-lg rounded-tl-none border-[1.5px] border-amber-500 bg-amber-100 p-2.5 dark:border-amber-800 dark:bg-amber-950">
							<p className="mb-2 font-medium text-amber-950 text-xs dark:text-amber-50">
								{t(($) => $.demo.switchUser)}
							</p>

							<div className="flex gap-2">
								{users.length > 0 ? (
									Object.keys(UserRoleSchema.enum).map((role) => {
										const roleValue = role as User["role"];
										const isActive = user.role === roleValue;

										return (
											<Button
												key={role}
												type="button"
												size="sm"
												aria-pressed={isActive}
												className={cn(
													"flex-1 border border-transparent text-amber-800 dark:text-amber-200",
													"bg-amber-200 hover:bg-amber-300 dark:bg-amber-900/40 dark:hover:bg-amber-900/70",
													isActive &&
														"border-amber-600 bg-amber-300 font-semibold text-amber-950 shadow-xs dark:border-amber-600 dark:bg-amber-900 dark:text-amber-100",
												)}
												onClick={() => {
													const userWithRole = users.find((u) => u.role === roleValue);
													if (userWithRole) {
														setUser(userWithRole);
													}
												}}
											>
												{userRoleToString(roleValue, t)}
											</Button>
										);
									})
								) : (
									<Skeleton className="h-8 w-36 bg-amber-200 dark:bg-amber-900/40" />
								)}
							</div>

							{IS_DEMO_MODE && (
								<>
									<div className="-mx-2.5 my-2.5 border-amber-500 border-t-[1.5px] dark:border-amber-800" />
									<ResetDemoDataButton />
								</>
							)}
						</div>
					</div>
				</DropdownMenuContent>
			</DropdownMenu>

			<ProfilePopup
				user={user}
				open={profilePopupVisible}
				onClose={closeProfilePopup}
				users={users}
				setUser={setUser}
			/>

			<PrivacySettingsPopup open={privacySettingsPopupVisible} onClose={closePrivacySettingsPopup} />
		</>
	);
}

function NavTabs({ routes }: { routes: Array<NavRoute> }) {
	const { view } = useView();
	const { date } = useDate();
	const location = useLocation();
	const pathname = location.pathname;
	const formatDate = useFormatDate();

	const navLinkRefs = useRef<Array<HTMLElement>>([]);
	const [pillWidth, setPillWidth] = useState<number>();
	const [pillLeft, setPillLeft] = useState<number>();

	function normalizePathname(path: string) {
		if (path === "/") return path;
		return path.replace(/\/+$/, "");
	}

	const normalizedPathname = normalizePathname(pathname);
	const isRouteActive = (route: NavRoute) =>
		[route.to.toString(), ...(route.activePaths ?? [])].some(
			(path) => normalizePathname(path) === normalizedPathname,
		);

	const activeNavIndex = routes.findIndex(isRouteActive);

	// update pill whenever the active route changes,
	useLayoutEffect(() => {
		const el = navLinkRefs.current[activeNavIndex];
		if (!el) return;

		const observer = new ResizeObserver(() => {
			setPillWidth(el.offsetWidth);
			setPillLeft(el.offsetLeft);
		});
		observer.observe(el);
		return () => observer.disconnect();
	}, [activeNavIndex]);

	return (
		<div className="relative mx-auto flex h-11 flex-row rounded-full bg-background px-1 sm:px-2">
			<div
				className="absolute top-0 bottom-0 z-10 flex overflow-hidden rounded-full py-1 transition-all duration-300"
				style={{ left: pillLeft, width: pillWidth }}
			>
				<span className="h-full w-full rounded-full bg-primary shadow-sm" />
			</div>

			{routes.map((route, i) => {
				const className = cn(
					"z-20 flex cursor-pointer select-none items-center whitespace-nowrap rounded-full px-3 py-2 sm:px-5",
					"text-center font-medium text-muted-foreground text-sm hover:text-foreground",
					i === activeNavIndex && "text-primary-foreground hover:text-primary-foreground",
				);

				return (
					<NavLink
						end={true}
						to={{
							pathname: route.to.toString(),
							search: `?view=${view}&date=${formatDate(date, "yyyy-MM-dd")}`,
						}}
						key={route.to.toString()}
						ref={(el) => {
							if (!el) return;
							navLinkRefs.current[i] = el;
						}}
						className={className}
						prefetch="intent"
					>
						<span className="inline-flex items-center gap-2">
							{route.icon && <route.icon className="hidden size-4 min-[400px]:block" />}
							{route.label}
						</span>
					</NavLink>
				);
			})}
		</div>
	);
}
