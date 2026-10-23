import React, { useContext } from 'react';
import { Bell, Search, User } from 'lucide-react';
import { AuthContext } from '../../contexts/AuthContext';
import { useLocation } from 'react-router-dom';

export const Header = () => {
  const { user } = useContext(AuthContext);
  const location = useLocation();
  
  // Format the path to a title
  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/') return 'Dashboard';
    return path.charAt(1).toUpperCase() + path.slice(2).replace('-', ' ');
  };

  return (
    <div className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 shadow-sm">
      <h1 className="text-xl font-semibold text-garmin-textDark">{getPageTitle()}</h1>
      
      <div className="flex items-center space-x-6">
        <div className="relative">
          <input 
            type="text" 
            placeholder="Search..." 
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-full text-sm focus:outline-none focus:border-garmin-blue focus:ring-1 focus:ring-garmin-blue bg-garmin-gray transition-colors"
          />
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
        </div>
        
        <button className="text-gray-500 hover:text-garmin-blue transition-colors relative">
          <Bell className="h-5 w-5" />
          <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"></span>
        </button>
        
        <div className="flex items-center space-x-3 border-l border-gray-200 pl-6">
          <div className="text-right hidden sm:block">
            <div className="text-sm font-medium text-garmin-textDark">{user?.FirstName} {user?.LastName}</div>
            <div className="text-xs text-garmin-textMuted">{user?.Email}</div>
          </div>
          <div className="h-9 w-9 rounded-full bg-garmin-blue flex items-center justify-center text-white">
            <User className="h-5 w-5" />
          </div>
        </div>
      </div>
    </div>
  );
};
