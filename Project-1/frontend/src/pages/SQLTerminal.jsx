import { useEffect, useRef, useState } from "react";
import axios from "axios";
import {
  Terminal,
  Play,
  Trash2,
  Database,
  History,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Copy,
} from "lucide-react";

const examples = [
  "SELECT UserID, FirstName, LastName, Email, DOB, Gender FROM USERS",
  "SELECT * FROM ACTIVITY",
  "SELECT * FROM HEALTH_METRIC",
  "SELECT * FROM WEARABLE_DEVICE",
];



export default function SQLTerminal() {
  const [sql, setSql] = useState("SELECT * FROM USERS");
  const [rows, setRows] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const textareaRef = useRef(null);
const [tables, setTables] = useState([]);
  useEffect(() => {
  const savedHistory = localStorage.getItem("garminSqlHistory");

  if (savedHistory) {
    try {
      setHistory(JSON.parse(savedHistory));
    } catch {
      setHistory([]);
    }
  }

  const loadTables = async () => {
    try {
      const response = await axios.get("/api/sql/tables");
      setTables(response.data.tables || []);
    } catch (err) {
      console.error("Failed to load database tables:", err);
    }
  };

  loadTables();
}, []);

  const runQuery = async () => {
  if (loading) return;

  const query = sql.trim();

  if (!query) {
    setError("Enter a SQL query first.");
    return;
  }

  setLoading(true);
  setError("");
  setMessage("");
  setRows([]);

  try {
    const response = await axios.post("/api/sql", {
      sql: query,
    });

    const resultRows = response.data.rows || [];

    setRows(resultRows);

    if (/^\s*SELECT\b/i.test(query)) {
      setMessage(
        `Query executed successfully — ${response.data.rowCount || 0} rows returned`
      );
    } else {
      setMessage(
        `Query executed successfully — ${response.data.rowsAffected || 0} rows affected`
      );
    }

    const newHistory = [
      query,
      ...history.filter((item) => item !== query),
    ].slice(0, 10);

    setHistory(newHistory);

    localStorage.setItem(
      "garminSqlHistory",
      JSON.stringify(newHistory)
    );
  } catch (err) {
    setError(
      err.response?.data?.error ||
        err.message ||
        "Failed to execute query"
    );
  } finally {
    setLoading(false);
  }
};
  const clearTerminal = () => {
    setSql("");
    setRows([]);
    setMessage("");
    setError("");
    textareaRef.current?.focus();
  };

  const copyQuery = async () => {
    if (!sql.trim()) return;

    await navigator.clipboard.writeText(sql.trim());
    setMessage("Query copied to clipboard");
    setError("");
  };

  const loadQuery = (query) => {
    setSql(query);
    setRows([]);
    setMessage("");
    setError("");
    textareaRef.current?.focus();
  };

  const handleEditorKeyDown = (e) => {
    if (e.ctrlKey && e.key === "Enter") {
      e.preventDefault();
      runQuery();
    }

    if (e.key === "Tab") {
      e.preventDefault();

      const start = e.target.selectionStart;
      const end = e.target.selectionEnd;

      const newValue =
        sql.substring(0, start) +
        "  " +
        sql.substring(end);

      setSql(newValue);

      setTimeout(() => {
        e.target.selectionStart = start + 2;
        e.target.selectionEnd = start + 2;
      }, 0);
    }
  };

  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

  return (
    <div className="min-h-screen bg-[#f5f7fa] px-4 py-6 md:px-8">
      <div className="mx-auto max-w-7xl">

        {/* Page Header */}
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-garmin-blue text-white shadow-sm">
                <Terminal size={22} />
              </div>

              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  SQL Terminal
                </h1>

                <p className="text-sm text-gray-500">
                  Run SQL queries against your Garmin Oracle database
                </p>
              </div>
            </div>
          </div>

          {/* Connection Status */}
          <div className="flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-4 py-2 text-sm font-medium text-green-700">
            <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
            Oracle Connected
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_280px]">

          {/* Main Terminal */}
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-[#0b1118] shadow-xl">

            {/* Terminal Header */}
            <div className="flex items-center justify-between border-b border-gray-700 bg-[#151e28] px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-red-500" />
                  <span className="h-3 w-3 rounded-full bg-yellow-500" />
                  <span className="h-3 w-3 rounded-full bg-green-500" />
                </div>

                <div className="flex items-center gap-2 text-sm font-medium text-gray-300">
                  <Database size={16} />
                  GARMIN_DATABASE
                </div>
              </div>

              <button
                onClick={clearTerminal}
                className="flex items-center gap-2 rounded-lg border border-gray-600 px-3 py-2 text-sm text-gray-300 transition hover:bg-gray-700 hover:text-white"
              >
                <Trash2 size={15} />
                Clear
              </button>
            </div>

            {/* Editor */}
            <div className="border-b border-gray-700 bg-[#0b1118]">
              <div className="flex min-h-[250px]">

                {/* Line Numbers */}
                <div className="select-none border-r border-gray-800 bg-[#0d141c] px-4 py-5 text-right font-mono text-sm leading-6 text-gray-600">
                  {sql.split("\n").map((_, index) => (
                    <div key={index}>{index + 1}</div>
                  ))}
                </div>

                {/* SQL Editor */}
                <div className="flex flex-1">
                  <div className="px-4 pt-5 font-mono text-sm font-bold text-blue-400">
                    SQL&gt;
                  </div>

                  <textarea
                    ref={textareaRef}
                    value={sql}
                    onChange={(e) => setSql(e.target.value)}
                    onKeyDown={handleEditorKeyDown}
                    spellCheck="false"
                    placeholder="Enter your SQL query..."
                    className="min-h-[250px] flex-1 resize-none bg-transparent p-5 pl-2 font-mono text-sm leading-6 text-gray-100 outline-none placeholder:text-gray-600"
                  />
                </div>
              </div>

              {/* Editor Footer */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-800 bg-[#0d141c] px-4 py-3">
                <div className="text-xs text-gray-500">
                  Ctrl + Enter to execute
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={copyQuery}
                    className="flex items-center gap-2 rounded-lg border border-gray-700 px-3 py-2 text-xs text-gray-300 transition hover:bg-gray-800"
                  >
                    <Copy size={14} />
                    Copy
                  </button>

                  <button
                    onClick={runQuery}
                    disabled={loading}
                    className="flex items-center gap-2 rounded-lg bg-garmin-blue px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Play size={15} />

                    {loading ? "Running..." : "Run Query"}
                  </button>
                </div>
              </div>
            </div>

            {/* Status */}
            {(message || error) && (
              <div className="border-b border-gray-700 px-5 py-4">
                {message && (
                  <div className="flex items-center gap-2 text-sm text-green-400">
                    <CheckCircle2 size={17} />
                    {message}
                  </div>
                )}

                {error && (
                  <div className="flex items-start gap-2 text-sm text-red-400">
                    <AlertCircle size={17} className="mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
              </div>
            )}

            {/* Results */}
            <div className="bg-[#0b1118]">

              <div className="flex items-center justify-between border-b border-gray-700 px-5 py-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-200">
                  <Database size={16} />
                  Query Results
                </div>

                {rows.length > 0 && (
                  <span className="rounded-full bg-gray-800 px-3 py-1 text-xs text-gray-400">
                    {rows.length} rows
                  </span>
                )}
              </div>

              {rows.length > 0 ? (
                <div className="max-h-[520px] overflow-auto">
                  <table className="min-w-full text-left font-mono text-sm">
                    <thead className="sticky top-0 z-10 bg-[#1b2633]">
                      <tr>
                        {columns.map((column) => (
                          <th
                            key={column}
                            className="whitespace-nowrap border-b border-gray-700 px-4 py-3 font-semibold text-blue-300"
                          >
                            {column}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      {rows.map((row, rowIndex) => (
                        <tr
                          key={rowIndex}
                          className="transition hover:bg-[#151e28]"
                        >
                          {columns.map((column) => (
                            <td
                              key={column}
                              className="whitespace-nowrap border-b border-gray-800 px-4 py-3 text-gray-300"
                            >
                              {row[column] === null
                                ? "NULL"
                                : String(row[column])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex min-h-[180px] flex-col items-center justify-center px-6 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-800 text-gray-500">
                    <Terminal size={20} />
                  </div>

                  <p className="text-sm font-medium text-gray-400">
                    No results to display
                  </p>

                  <p className="mt-1 text-xs text-gray-600">
                    Execute a SELECT query to view database records
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">

            {/* Examples */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <Terminal size={17} className="text-garmin-blue" />

                <h3 className="font-semibold text-gray-900">
                  Quick Queries
                </h3>
              </div>

              <div className="space-y-2">
                {examples.map((query) => (
                  <button
                    key={query}
                    onClick={() => loadQuery(query)}
                    className="group flex w-full items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 text-left font-mono text-xs text-gray-600 transition hover:border-garmin-blue hover:bg-blue-50 hover:text-garmin-blue"
                  >
                    <ChevronRight
                      size={14}
                      className="shrink-0 transition group-hover:translate-x-1"
                    />

                    <span className="truncate">
                      {query}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            {/* Schema Explorer */}
<div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
  <div className="mb-4 flex items-center justify-between">
    <div className="flex items-center gap-2">
      <Database size={17} className="text-garmin-blue" />

      <h3 className="font-semibold text-gray-900">
        Database Schema
      </h3>
    </div>

    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-garmin-blue">
      {tables.length} tables
    </span>
  </div>

  <div className="max-h-[360px] space-y-1 overflow-y-auto pr-1">
    {tables.map((table) => (
      <button
        key={table}
        onClick={() => loadQuery(`SELECT * FROM ${table}`)}
        className="group flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left transition hover:bg-blue-50"
      >
        <Database
          size={14}
          className="shrink-0 text-gray-400 group-hover:text-garmin-blue"
        />

        <span className="truncate font-mono text-xs text-gray-600 group-hover:text-garmin-blue">
          {table}
        </span>

        <ChevronRight
          size={13}
          className="ml-auto shrink-0 text-gray-300 transition group-hover:translate-x-1 group-hover:text-garmin-blue"
        />
      </button>
    ))}
  </div>

  <p className="mt-3 border-t border-gray-100 pt-3 text-xs text-gray-400">
    Click a table to load a SELECT query.
  </p>
</div>
            {/* History */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <History size={17} className="text-gray-600" />

                <h3 className="font-semibold text-gray-900">
                  Query History
                </h3>
              </div>

              {history.length > 0 ? (
                <div className="space-y-2">
                  {history.map((query, index) => (
                    <button
                      key={`${query}-${index}`}
                      onClick={() => loadQuery(query)}
                      className="w-full truncate rounded-lg bg-gray-50 px-3 py-2 text-left font-mono text-xs text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
                      title={query}
                    >
                      {query}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">
                  Your executed queries will appear here.
                </p>
              )}
            </div>

            {/* Database Info */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="mb-4 font-semibold text-gray-900">
                Database
              </h3>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Engine</span>
                  <span className="font-medium text-gray-800">
                    Oracle
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-500">Environment</span>
                  <span className="font-medium text-gray-800">
                    Local
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-500">Access</span>
                  <span className="font-medium text-gray-800">
                    Read / Write
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}