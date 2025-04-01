import { useAuth } from "@/context/auth-provider";
import { useTheme } from "@/context/theme-provider";
import { Avatar, AvatarFallback } from "./ui/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "./ui/dropdown-menu";
import { Button } from "./ui/button";
import { Toggle } from "./ui/toggle";
import { Bell, BellDot, Moon, Sun } from "lucide-react";
import { Link } from "react-router-dom";
import NotificationCard from "./notification-card";
import { useNotifications } from "@/context/notification-provider";

export default function Navbar() {
  const { userName, logout } = useAuth();
  const { notificationLength } = useNotifications();
  const { isDark, toggleTheme } = useTheme();

  return (
    <header
      className="
        w-full
        flex items-center justify-between
        px-4 py-4
        border-grid sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60
      "
    >
      <Link
        to="/"
        className="text-2xl font-black text-inherit cursor-pointer select-none"
      >
        LööP
      </Link>

      <nav className="flex items-center space-x-4">
        <Toggle
          pressed={isDark}
          variant="outline"
          onPressedChange={toggleTheme}
          className="w-10 h-10 rounded-full"
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Toggle>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="w-10 h-10 p-0 rounded-full bg-accent"
            >
              {notificationLength ? (
                <BellDot className="h-8 w-8" />
              ) : (
                <Bell className="h-8 w-8" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="p-0">
            <NotificationCard className="border-none rounded-none" />
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="p-0 rounded-full">
              <Avatar className="h-10 w-10">
                <AvatarFallback>
                  {userName?.charAt(0).toUpperCase() ?? "U"}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => console.log("Navigate to profile...")}
            >
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => console.log("Open settings...")}>
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={logout}>Logout</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>
    </header>
  );
}
