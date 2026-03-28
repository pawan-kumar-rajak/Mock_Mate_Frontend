import { Button, Dropdown, Avatar, Typography } from "antd";
import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  UserOutlined,
  LogoutOutlined,
  SunOutlined,
  MoonFilled,
  MenuOutlined,
  CloseOutlined,
} from "@ant-design/icons";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import axios from "axios";

const { Text } = Typography;

interface NavLink {
  name: string;
  href: string;
}

const links: NavLink[] = [
  { name: "Home", href: "/" },
  { name: "Quiz", href: "/quizselector" },
  { name: "Interview", href: "/interview" },
  { name: "GD", href: "/gd" },
  { name: "About", href: "/about" },
];

const Header = () => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { userEmail, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  const handleLogout = async () => {
    try {
      await axios.post(
        `${import.meta.env.VITE_BACKEND_URL}/auth/logout`,
        {},
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
          },
        },
      );
      logout();
      navigate("/");
    } catch {
      logout();
      navigate("/");
    }
  };

  const profileMenu = {
    items: [
      {
        key: "email",
        label: (
          <div className="px-2 py-1">
            <Text className="block text-[10px]! font-black! uppercase! tracking-widest! text-slate-400!">
              Logged in as
            </Text>
            <Text className="font-bold! text-slate-700! dark:text-slate-200!">
              {userEmail}
            </Text>
          </div>
        ),
        disabled: true,
      },
      { type: "divider" as const },
      {
        key: "profile",
        label: "My Profile",
        icon: <UserOutlined />,
        onClick: () => navigate("/profile"),
      },
      {
        key: "logout",
        label: "Sign Out",
        icon: <LogoutOutlined />,
        danger: true,
        onClick: handleLogout,
      },
    ],
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/80 backdrop-blur-xl transition-all duration-300 dark:border-slate-800/80 dark:bg-slate-950/75">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="flex h-20 items-center justify-between">
          <div
            className="group flex cursor-pointer items-center gap-3"
            onClick={() => navigate("/")}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-indigo-600 to-purple-600 shadow-lg shadow-indigo-500/20 transition-transform group-hover:rotate-6">
              <span className="text-lg font-black text-white">M</span>
            </div>
            <span className="bg-linear-to-r from-indigo-600 to-purple-600 bg-clip-text text-xl font-black tracking-tighter text-transparent dark:from-indigo-400 dark:to-purple-300">
              MockMate
            </span>
          </div>

          <div className="hidden items-center rounded-2xl border border-slate-200/80 bg-slate-100/80 p-1.5 dark:border-slate-800/70 dark:bg-slate-900/60 md:flex">
            {links.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className={`rounded-xl px-5 py-2 text-xs font-bold uppercase tracking-widest transition-all duration-200 ${
                  isActive(link.href)
                    ? "bg-white text-indigo-600 shadow-sm dark:bg-slate-800 dark:text-indigo-400"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                {link.name}
              </a>
            ))}
          </div>

          <div className="hidden items-center gap-4 md:flex">
            <button
              onClick={toggleTheme}
              aria-label={`Switch to ${isDark ? "light" : "dark"} theme`}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition-all hover:border-indigo-500 hover:text-indigo-600 active:scale-90 dark:border-slate-800 dark:bg-slate-900 dark:text-amber-400 dark:hover:border-indigo-500 dark:hover:text-amber-300"
            >
              {isDark ? (
                <SunOutlined className="text-lg" />
              ) : (
                <MoonFilled className="text-lg" />
              )}
            </button>

            {userEmail ? (
              <Dropdown
                menu={profileMenu}
                trigger={["click"]}
                placement="bottomRight"
                arrow
              >
                <div className="group flex cursor-pointer items-center gap-3 pl-2">
                  <Avatar
                    icon={<UserOutlined />}
                    className="bg-linear-to-br! from-indigo-500! to-purple-600! shadow-md transition-transform group-hover:scale-105"
                    size={40}
                  />
                </div>
              </Dropdown>
            ) : (
              <div className="flex items-center gap-3">
                <Button
                  type="text"
                  onClick={() => navigate("/signin")}
                  className="font-bold! text-slate-600! hover:text-indigo-600! dark:text-slate-400!"
                >
                  Log In
                </Button>
                <Button
                  type="primary"
                  onClick={() => navigate("/signup")}
                  className="h-11 rounded-xl! border-none! bg-indigo-600! px-6 font-bold! shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
                >
                  Sign Up
                </Button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 md:hidden">
            <button
              onClick={toggleTheme}
              className="text-xl text-slate-500 dark:text-amber-400"
            >
              {isDark ? <SunOutlined /> : <MoonFilled />}
            </button>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300"
            >
              {isOpen ? <CloseOutlined /> : <MenuOutlined />}
            </button>
          </div>
        </div>
      </div>

      {isOpen && (
        <div className="animate-in slide-in-from-top-4 space-y-4 border-t border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-950 md:hidden">
          {links.map((link) => (
            <a
              key={link.name}
              href={link.href}
              className={`block rounded-2xl p-4 text-sm font-bold uppercase tracking-widest ${
                isActive(link.href)
                  ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400"
                  : "text-slate-600 dark:text-slate-400"
              }`}
            >
              {link.name}
            </a>
          ))}
          <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
            {userEmail ? (
              <Button
                danger
                block
                size="large"
                onClick={handleLogout}
                className="rounded-xl! font-bold!"
              >
                Sign Out
              </Button>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <Button
                  size="large"
                  onClick={() => navigate("/signin")}
                  className="rounded-xl! font-bold! dark:border-slate-800! dark:bg-slate-900! dark:text-white!"
                >
                  Log In
                </Button>
                <Button
                  size="large"
                  type="primary"
                  onClick={() => navigate("/signup")}
                  className="rounded-xl! border-none! bg-indigo-600! font-bold!"
                >
                  Join Free
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Header;
