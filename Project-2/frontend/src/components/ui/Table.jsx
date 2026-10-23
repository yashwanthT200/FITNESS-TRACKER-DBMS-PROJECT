import React from 'react';

export const Table = ({ columns, data, keyField = 'id' }) => {
  return (
    <div className="overflow-x-auto w-full">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            {columns.map((col, i) => (
              <th 
                key={i} 
                className="px-6 py-3 text-xs font-semibold text-garmin-textMuted uppercase tracking-wider"
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {data.map((row, i) => (
            <tr key={row[keyField] || i} className="hover:bg-gray-50 transition-colors">
              {columns.map((col, j) => (
                <td key={j} className="px-6 py-4 whitespace-nowrap text-sm text-garmin-textDark">
                  {col.render ? col.render(row) : row[col.accessor]}
                </td>
              ))}
            </tr>
          ))}
          {data.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-6 py-8 text-center text-gray-500 text-sm">
                No data available
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};
