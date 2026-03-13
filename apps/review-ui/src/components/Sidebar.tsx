import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ClipboardList,
  CheckSquare,
  LogOut,
  Activity,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Orders', href: '/orders', icon: ClipboardList },
  { name: 'Review Queue', href: '/reviews', icon: CheckSquare },
];

export default function Sidebar() {
  const { user, logout } = useAuth();

  return (
    <aside className="flex flex-col w-64 bg-clinical-950 text-white min-h-screen">
      <div className="flex items-center gap-3 px-5 py-5 border-b border-clinical-800">
        <Activity className="w-7 h-7 text-clinical-400" />
        <div>
          <h1 className="text-base font-semibold leading-tight">RadPlatform</h1>
          <p className="text-xs text-clinical-400">Radiology Interop</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            end={item.href === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-clinical-800 text-white'
                  : 'text-clinical-300 hover:bg-clinical-900 hover:text-white'
              }`
            }
          >
            <item.icon className="w-5 h-5" />
            {item.name}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-clinical-800">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-clinical-700 flex items-center justify-center text-sm font-medium">
            {user?.name?.charAt(0) || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.name}</p>
            <p className="text-xs text-clinical-400 truncate capitalize">{user?.role}</p>
          </div>
          <button
            onClick={logout}
            className="p-1.5 rounded-lg text-clinical-400 hover:text-white hover:bg-clinical-800 transition-colors"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
