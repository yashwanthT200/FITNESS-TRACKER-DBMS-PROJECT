import React, { useContext, useState, useRef, useEffect } from 'react';
import { Bell, Search, User, LogOut, UserCircle } from 'lucide-react';
import { AuthContext } from '../../contexts/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';

const SEARCH_ROUTES = [
  { label: 'Activities', path: '/activities', keywords: ['activity', 'activities', 'run', 'running', 'walk', 'cycling', 'swim', 'workout', 'exercise'] },
  { label: 'Nutrition', path: '/nutrition', keywords: ['nutrition', 'food', 'meal', 'calories', 'diet', 'eat', 'breakfast', 'lunch', 'dinner'] },
  { label: 'Goals', path: '/goals', keywords: ['goal', 'goals', 'target', 'objective', 'progress'] },
  { label: 'Health Metrics', path: '/health', keywords: ['health', 'metric', 'metrics', 'weight', 'heart', 'rate', 'sleep', 'bmi'] },
  { label: 'Devices', path: '/devices', keywords: ['device', 'devices', 'watch', 'smartwatch', 'band', 'garmin', 'tracker'] },
  { label: 'Achievements', path: '/achievements', keywords: ['achievement', 'achievements', 'badge', 'award', 'trophy'] },
  { label: 'Social & Friends', path: '/social', keywords: ['social', 'follow', 'following', 'follower', 'friends', 'users', 'people'] },
  { label: 'Trainers', path: '/trainers', keywords: ['trainer', 'trainers', 'coach', 'client', 'athletes'] },
  { label: 'Notifications', path: '/notifications', keywords: ['notification', 'notifications', 'alert', 'alerts', 'bell'] },
  { label: 'Profile', path: '/profile', keywords: ['profile', 'account', 'me', 'user', 'settings', 'details'] },
  { label: 'Dashboard', path: '/', keywords: ['dashboard', 'home', 'overview', 'stats', 'summary'] },
  { label: 'SQL Terminal', path: '/sql-terminal', keywords: ['sql', 'terminal', 'query', 'database', 'console'] }
];

export const Header = () => {
  const { user, logout } = useContext(AuthContext);
  const location = useLocation();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const searchRef = useRef(null);
  const profileMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowSearchResults(false);
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/') return 'Dashboard';
    const clean = path.replace('/', '').replace('-', ' ');
    return clean.charAt(0).toUpperCase() + clean.slice(1);
  };

  const query = searchQuery.trim().toLowerCase();
  const filteredRoutes = query
    ? SEARCH_ROUTES.filter((route) => {
        return (
          route.label.toLowerCase().includes(query) ||
          route.path.toLowerCase().includes(query) ||
          route.keywords.some((k) => k.includes(query))
        );
      })
    : [];

  const handleSelectRoute = (path) => {
    navigate(path);
    setSearchQuery('');
    setShowSearchResults(false);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (filteredRoutes.length > 0) {
      handleSelectRoute(filteredRoutes[0].path);
    } else if (query) {
      const direct = SEARCH_ROUTES.find((r) => r.label.toLowerCase().startsWith(query) || r.path.slice(1).startsWith(query));
      if (direct) {
        handleSelectRoute(direct.path);
      }
    }
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') handleSearchSubmit(e);
  };

  return (
    <div className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 shadow-sm">
      <h1 className="text-xl font-semibold text-garmin-textDark">{getPageTitle()}</h1>

      <div className="flex items-center space-x-6">
        <div className="relative" ref={searchRef}>
          <form onSubmit={handleSearchSubmit}>
            <input
              type="text"
              placeholder="Search features..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSearchResults(true);
              }}
              onFocus={() => setShowSearchResults(true)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-full text-sm focus:outline-none border-garmin-blue focus:ring-1 focus:ring-garmin-blue bg-garmin-gray transition-colors w-52"
            />
            <button
              type="submit"
              className="absolute left-3 top-2.5 text-gray-400 hover:text-garmin-blue transition-colors"
              title="Search"
            >
              <Search className="h-4 w-4" />
            </button>
          </form>

          {showSearchResults && filteredRoutes.length > 0 && (
            <div className="absolute left-0 top-11 w-64 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50">
              <div className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Quick Navigation
              </div>
              {filteredRoutes.slice(0, 6).map((route) => (
                <button
                  key={route.path}
                  onClick={() => handleSelectRoute(route.path)}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-garmin-blue transition-colors flex items-center justify-between"
                >
                  <span className="font-medium">{route.label}</span>
                  <span className="text-xs text-gray-400">{route.path}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => navigate('/notifications')}
          className="text-gray-500 hover:text-garmin-blue transition-colors relative p-1.5 rounded-full hover:bg-gray-100"
          title="Notifications"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute top-1 right-1 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"></span>
        </button>

        <div className="flex items-center space-x-3 border-l border-gray-200 pl-6 relative" ref={profileMenuRef}>
          <div className="text-right hidden sm:block">
            <div className="text-sm font-medium text-garmin-textDark">
              {user?.FirstName ? `${user.FirstName} ${user.LastName || ''}` : 'User Account'}
            </div>
            <div className="text-xs text-garmin-textMuted">
              {user?.Email || 'user@fittrack.com'}
            </div>
          </div>
          <button
            onClick={() => setShowProfileMenu((prev) => !prev)}
            className="h-9 w-9 rounded-full bg-garmin-blue flex items-center justify-center text-white hover:bg-blue-600 transition-all cursor-pointer shadow-sm focus:outline-none focus:ring-2 focus:ring-garmin-blue focus:ring-offset-2 active:scale-95"
            title="Account Menu"
          >
            <User className="h-5 w-5" />
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 top-12 w-52 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 z-50">
              <div className="px-4 py-2 border-b border-gray-100">
                <p className="text-xs text-gray-400">Signed in as</p>
                <p className="text-sm font-semibold text-gray-800 truncate">
                  {user?.Email || 'user@fittrack.com'}
                </p>
              </div>

              <button
                onClick={() => {
                  navigate('/profile');
                  setShowProfileMenu(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <UserCircle className="h-4 w-4 text-garmin-blue" />
                My Profile
              </button>

              <button
                onClick={() => {
                  navigate('/notifications');
                  setShowProfileMenu(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Bell className="h-4 w-4 text-garmin-blue" />
                Notifications
              </button>

              <hr className="my-1 border-gray-100" />

              <button
                onClick={() => {
                  logout();
                  navigate('/login');
                  setShowProfileMenu(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};