import React from 'react';

export const Card = ({ title, children, className = '', action }) => {
  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden ${className}`}>
      {(title || action) && (
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-white">
          {title && <h3 className="text-lg font-medium text-garmin-textDark">{title}</h3>}
          {action && <div>{action}</div>}
        </div>
      )}
      <div className="p-6">
        {children}
      </div>
    </div>
  );
};

export const MetricCard = ({ title, value, unit, icon: Icon, trend }) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-5 flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-garmin-textMuted mb-1">{title}</p>
        <div className="flex items-baseline space-x-1">
          <span className="text-2xl font-bold text-garmin-textDark">{value}</span>
          {unit && <span className="text-sm text-garmin-textMuted font-medium">{unit}</span>}
        </div>
        {trend && (
          <p className={`text-xs mt-1 font-medium ${trend.positive ? 'text-green-600' : 'text-red-600'}`}>
            {trend.positive ? '↑' : '↓'} {trend.value}
          </p>
        )}
      </div>
      {Icon && (
        <div className="h-12 w-12 rounded-full bg-blue-50 flex items-center justify-center text-garmin-blue">
          <Icon size={24} />
        </div>
      )}
    </div>
  );
};
