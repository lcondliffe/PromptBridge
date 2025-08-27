import type { ComponentType } from "react";
import { Home, Settings, Clock } from "lucide-react";

export type NavItem = {
  key: string;
  label: string;
  href: string;
  icon?: ComponentType<{ className?: string }>;
};

export const navItems: NavItem[] = [
  { key: "home", label: "Home", href: "/", icon: Home },
  { key: "history", label: "Chat history", href: "/history", icon: Clock },
  { key: "settings", label: "Settings", href: "/settings", icon: Settings },
];
