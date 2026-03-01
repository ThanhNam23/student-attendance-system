import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { to: '/', label: '🏠 Tổng quan', roles: ['admin', 'teacher', 'student'] },
  { to: '/classes', label: '📚 Lớp học', roles: ['admin', 'teacher', 'student'] },
  { to: '/scan', label: '📷 Quét QR điểm danh', roles: ['student'] },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };

  const roleLabel = { admin: 'Admin', teacher: 'Giảng viên', student: 'Sinh viên' };
  const roleColor = { admin: 'bg-purple-100 text-purple-700', teacher: 'bg-blue-100 text-blue-700', student: 'bg-green-100 text-green-700' };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside
        className={`${collapsed ? 'w-16' : 'w-64'} bg-white shadow-md flex flex-col transition-all duration-300 ease-in-out flex-shrink-0`}
      >
        {/* Header + Toggle button */}
        <div className={`flex items-center border-b border-gray-100 ${collapsed ? 'justify-center p-3' : 'justify-between p-5'}`}>
          {!collapsed && (
            <div>
              <h1 className="text-lg font-bold text-blue-600">📋 EduManage</h1>
              <p className="text-xs text-gray-400 mt-0.5">Điểm danh & kiểm tra</p>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors flex-shrink-0"
            title={collapsed ? 'Mở rộng' : 'Thu gọn'}
          >
            {collapsed ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7M19 19l-7-7 7-7" />
              </svg>
            )}
          </button>
        </div>

        {/* Nav items */}
        <nav className={`flex-1 ${collapsed ? 'p-2' : 'p-4'} space-y-1`}>
          {navItems
            .filter(item => item.roles.includes(user?.role))
            .map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end
                title={collapsed ? item.label : undefined}
                className={({ isActive }) =>
                  `flex items-center rounded-lg text-sm font-medium transition-colors ${
                    collapsed ? 'justify-center px-2 py-2.5' : 'px-4 py-2.5'
                  } ${
                    isActive
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`
                }
              >
                <span className="text-base">{item.label.split(' ')[0]}</span>
                {!collapsed && (
                  <span className="ml-2">{item.label.split(' ').slice(1).join(' ')}</span>
                )}
              </NavLink>
            ))}
        </nav>

        {/* User info + Logout */}
        <div className={`border-t border-gray-100 ${collapsed ? 'p-2' : 'p-4'}`}>
          {collapsed ? (
            <div className="flex flex-col items-center gap-2">
              <div
                className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-sm"
                title={user?.name}
              >
                {user?.name?.[0]?.toUpperCase()}
              </div>
              <button
                onClick={handleLogout}
                title="Đăng xuất"
                className="w-9 h-9 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" />
                </svg>
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-sm">
                  {user?.name?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{user?.name}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${roleColor[user?.role]}`}>
                    {roleLabel[user?.role]}
                  </span>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full text-sm text-red-500 hover:text-red-700 hover:bg-red-50 py-2 rounded-lg transition-colors"
              >
                🚪 Đăng xuất
              </button>
            </>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
