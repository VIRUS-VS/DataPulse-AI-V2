import React, { useState, useRef } from 'react';
import { Database, Sparkles, Send, Table as TableIcon, AlertCircle, Loader2, Copy, CheckCircle2, Terminal, UploadCloud, FileText, Zap, ShieldCheck, Users, BarChart3, LayoutList, PieChart as PieIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

// Use localhost for V2 local testing with the upgraded backend
const API_BASE_URL = 'https://datapulse-v2-backend.onrender.com'; 

export default function App() {
  const [prompt, setPrompt] = useState('');
  const [sqlQuery, setSqlQuery] = useState('');
  const [queryResult, setQueryResult] = useState(null);
  
  // State for dynamic charts
  const [chartConfig, setChartConfig] = useState(null);
  const [activeView, setActiveView] = useState('table'); 
  
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  
  const [dbColumns, setDbColumns] = useState([]);
  const [visibleRows, setVisibleRows] = useState(100);
  const fileInputRef = useRef(null);

  const handleCopy = () => {
    navigator.clipboard.writeText(sqlQuery);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    setError('');
    
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_BASE_URL}/api/upload-csv`, {
        method: 'POST',
        body: formData,
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Upload failed');
      
      setDbColumns(data.columns);
      setQueryResult(null);
      setSqlQuery('');
      setChartConfig(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleGenerateAndExecute = async () => {
    if (!prompt.trim()) return;

    setLoading(true);
    setError('');
    setSqlQuery('');
    setQueryResult(null);
    setChartConfig(null);
    setVisibleRows(100);
    setActiveView('table');

    try {
      const genResponse = await fetch(`${API_BASE_URL}/api/generate-sql`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_prompt: prompt }),
      });
      
      const genData = await genResponse.json();
      if (!genResponse.ok) throw new Error(genData.detail || 'SQL Generation failed. Did you upload a database?');
      
      // Update from V2 Backend JSON response
      setSqlQuery(genData.sql_query);
      setChartConfig({
        type: genData.chart_type,
        xAxis: genData.x_axis,
        yAxis: genData.y_axis
      });

      const execResponse = await fetch(`${API_BASE_URL}/api/execute-sql`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql_query: genData.sql_query }),
      });

      const execData = await execResponse.json();
      if (!execResponse.ok) throw new Error(execData.detail || 'SQL Execution failed');

      setQueryResult(execData.data);
      
      // Auto-switch to chart view if a valid chart type was recommended
      if (genData.chart_type && genData.chart_type !== 'none') {
        setActiveView('chart');
      }

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Dynamic Chart Renderer for Light Mode Area
  const renderChart = () => {
    if (!chartConfig || chartConfig.type === 'none' || !queryResult || queryResult.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2">
          <BarChart3 className="w-10 h-10 opacity-40 text-slate-500" />
          <p className="font-medium text-slate-500">No visualization recommended for this specific text query.</p>
        </div>
      );
    }

    const { type, xAxis, yAxis } = chartConfig;
    const data = queryResult.slice(0, 50); // Limit to 50 for clean charting
    const COLORS = ['#0284c7', '#8b5cf6', '#2563eb', '#ec4899', '#059669', '#d97706'];

    if (type === 'pie') {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey={yAxis} nameKey={xAxis} cx="50%" cy="50%" outerRadius={120} label>
              {data.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
            </Pie>
            <RechartsTooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#fff' }} />
          </PieChart>
        </ResponsiveContainer>
      );
    }

    if (type === 'line') {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" vertical={false} />
            <XAxis dataKey={xAxis} stroke="#475569" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#475569" fontSize={12} tickLine={false} axisLine={false} />
            <RechartsTooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#fff' }} itemStyle={{ color: '#38bdf8' }} />
            <Line type="monotone" dataKey={yAxis} stroke="#7c3aed" strokeWidth={3} dot={{ fill: '#0284c7', strokeWidth: 2, r: 4 }} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      );
    }

    // Default to Bar / Column
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout={type === 'column' ? 'vertical' : 'horizontal'}>
          <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" vertical={type !== 'column'} horizontal={type === 'column'} />
          {type === 'column' ? (
            <>
              <XAxis type="number" stroke="#475569" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis dataKey={xAxis} type="category" stroke="#475569" fontSize={12} tickLine={false} axisLine={false} width={110} />
            </>
          ) : (
            <>
              <XAxis dataKey={xAxis} stroke="#475569" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#475569" fontSize={12} tickLine={false} axisLine={false} />
            </>
          )}
          <RechartsTooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#fff' }} itemStyle={{ color: '#38bdf8' }} />
          <Bar dataKey={yAxis} fill="url(#colorCyanLight)" radius={[4, 4, 0, 0]} />
          <defs>
            <linearGradient id="colorCyanLight" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0284c7" stopOpacity={1}/>
              <stop offset="95%" stopColor="#7c3aed" stopOpacity={1}/>
            </linearGradient>
          </defs>
        </BarChart>
      </ResponsiveContainer>
    );
  };

  return (
    <div className="relative min-h-screen bg-black text-white font-sans selection:bg-cyan-500/30 overflow-hidden flex flex-col justify-between">
      
      {/* Animated Floating Background Orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.15, 0.3, 0.15], x: [0, 50, 0], y: [0, -50, 0] }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-[20%] -left-[10%] w-[70vw] h-[70vw] rounded-full bg-cyan-600/30 blur-[150px]"
        />
        <motion.div
          animate={{ scale: [1, 1.5, 1], opacity: [0.1, 0.25, 0.1], x: [0, -70, 0], y: [0, 70, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute top-[20%] -right-[20%] w-[60vw] h-[60vw] rounded-full bg-purple-600/30 blur-[150px]"
        />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-12 space-y-10 w-full">
        
        {/* Header */}
        <motion.header initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center text-center space-y-4">
          <motion.div whileHover={{ scale: 1.05, rotate: 5 }} className="p-4 bg-white/[0.03] border border-white/[0.08] backdrop-blur-xl rounded-2xl shadow-[0_0_30px_rgba(6,182,212,0.15)]">
            <Database className="w-10 h-10 text-cyan-400" />
          </motion.div>
          <div className="space-y-2 max-w-2xl">
            <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight bg-gradient-to-br from-white via-cyan-100 to-cyan-500 bg-clip-text text-transparent pb-2">
              DataPulse AI
            </h1>
            <p className="text-gray-300 text-lg md:text-xl font-medium">Transform Complex Datasets into Instant SQL Insights & Visual Charts</p>
            <p className="text-gray-400 text-sm leading-relaxed">Eliminate manual SQL scripting. Upload spreadsheets and query your relational data in plain English with instant AI charts.</p>
          </div>

          {/* Upgraded Status Badges */}
          <div className="flex flex-wrap justify-center gap-2 pt-1">
            <span className="text-xs bg-white/[0.03] border border-white/[0.1] text-gray-300 px-3 py-1 rounded-full flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-cyan-400" /> For Analysts & Product Managers
            </span>
            <span className="text-xs bg-white/[0.03] border border-white/[0.1] text-gray-300 px-3 py-1 rounded-full flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5 text-cyan-400" /> Dynamic AI Charting (Bar, Line, Pie)
            </span>
            <span className="text-xs bg-white/[0.03] border border-white/[0.1] text-gray-300 px-3 py-1 rounded-full flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-purple-400" /> Zero SQL Knowledge Required
            </span>
          </div>
        </motion.header>

        {/* Database Upload Section */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="flex flex-col items-center space-y-4">
          <input type="file" accept=".csv, .xlsx, .xls" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
          <motion.button 
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => fileInputRef.current.click()} disabled={uploading}
            className={`flex items-center space-x-2 px-8 py-4 rounded-full border backdrop-blur-xl transition-all duration-300 ${
              dbColumns.length > 0 ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-300 shadow-[0_0_20px_rgba(6,182,212,0.2)]' : 'bg-white/[0.03] border-white/[0.1] hover:bg-white/[0.08] hover:border-white/[0.2] text-gray-300'
            }`}
          >
            {uploading ? <Loader2 className="w-5 h-5 animate-spin text-cyan-400" /> : <UploadCloud className={`w-5 h-5 ${dbColumns.length > 0 ? 'text-cyan-400' : 'text-gray-400'}`} />}
            <span className="font-semibold tracking-wide">
              {uploading ? 'Connecting Database...' : dbColumns.length > 0 ? 'Database Connected' : 'Upload CSV or Excel Database'}
            </span>
          </motion.button>

          {dbColumns.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 max-w-2xl">
              <span className="text-xs text-gray-400 self-center w-full text-center mb-1">Available Columns:</span>
              {dbColumns.map((col, idx) => (
                <span key={idx} className="text-xs bg-white/[0.03] border border-white/[0.08] text-gray-300 px-2.5 py-1 rounded-md flex items-center space-x-1">
                  <FileText className="w-3 h-3 text-cyan-400" />
                  <span>{col}</span>
                </span>
              ))}
            </div>
          )}
        </motion.div>

        {/* Main Input Section */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className={`bg-white/[0.02] backdrop-blur-2xl border rounded-[2rem] p-2 shadow-2xl transition-all duration-500 ${dbColumns.length > 0 ? 'border-cyan-500/30 shadow-[0_0_40px_rgba(6,182,212,0.1)] hover:border-cyan-500/50' : 'border-white/[0.05] opacity-50'}`}>
          <div className="relative flex items-center group">
            <Sparkles className={`absolute left-6 w-6 h-6 transition-colors duration-300 ${dbColumns.length > 0 ? 'text-purple-400 group-focus-within:text-cyan-400' : 'text-gray-600'}`} />
            <input
              type="text" value={prompt} onChange={(e) => setPrompt(e.target.value)}
              placeholder={dbColumns.length > 0 ? "Ask a question (e.g., 'Show total sales by country' or 'Top 5 products')..." : "Upload a CSV or Excel database above to start asking questions."}
              className="w-full bg-transparent border-none py-6 pl-16 pr-32 text-lg text-white placeholder-gray-500 focus:outline-none focus:ring-0"
              onKeyDown={(e) => e.key === 'Enter' && handleGenerateAndExecute()}
              disabled={dbColumns.length === 0}
            />
            <button 
              onClick={handleGenerateAndExecute} disabled={loading || !prompt.trim() || dbColumns.length === 0} 
              className="absolute right-3 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 disabled:from-white/[0.05] disabled:to-white/[0.05] disabled:text-gray-600 text-white p-4 rounded-2xl transition-all duration-300 shadow-lg"
            >
              {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Send className="w-6 h-6" />}
            </button>
          </div>
        </motion.div>

        {/* Upgraded Feature Cards (Reflecting current status) */}
        {dbColumns.length === 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
            <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-4 space-y-2 backdrop-blur-md">
              <div className="p-2 bg-cyan-500/10 w-fit rounded-lg border border-cyan-500/20">
                <Zap className="w-4 h-4 text-cyan-400" />
              </div>
              <h3 className="font-semibold text-gray-200 text-sm">Natural Language to SQL</h3>
              <p className="text-xs text-gray-400 leading-relaxed">Auto-translates natural questions into clean SQLite queries with automated currency & comma sanitization.</p>
            </div>
            <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-4 space-y-2 backdrop-blur-md">
              <div className="p-2 bg-purple-500/10 w-fit rounded-lg border border-purple-500/20">
                <FileText className="w-4 h-4 text-purple-400" />
              </div>
              <h3 className="font-semibold text-gray-200 text-sm">Multi-Format Spreadsheet Engine</h3>
              <p className="text-xs text-gray-400 leading-relaxed">Seamlessly parse `.csv`, `.xlsx`, and `.xls` files into dynamically engineered relational tables.</p>
            </div>
            <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-4 space-y-2 backdrop-blur-md">
              <div className="p-2 bg-emerald-500/10 w-fit rounded-lg border border-emerald-500/20">
                <BarChart3 className="w-4 h-4 text-emerald-400" />
              </div>
              <h3 className="font-semibold text-gray-200 text-sm">Automated AI Visualizations</h3>
              <p className="text-xs text-gray-400 leading-relaxed">Generates instant interactive Bar, Line, Pie, and Column charts alongside full data execution grids.</p>
            </div>
          </motion.div>
        )}

        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="bg-red-900/20 border border-red-500/30 text-red-400 p-4 rounded-2xl flex items-center space-x-3 overflow-hidden">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results Container */}
        <div className="space-y-6">
          <AnimatePresence>
            {sqlQuery && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.05] rounded-3xl overflow-hidden shadow-2xl">
                <div className="flex justify-between items-center px-6 py-4 bg-black/40 border-b border-white/[0.05]">
                  <div className="flex items-center space-x-2 text-gray-400 text-xs font-bold uppercase tracking-widest">
                    <Terminal className="w-4 h-4 text-purple-400" />
                    <span>Generated SQL Execution</span>
                  </div>
                  <button onClick={handleCopy} className="text-gray-400 hover:text-white transition-colors">
                    {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <div className="p-6 overflow-x-auto">
                  <pre className="font-mono text-sm text-cyan-300 whitespace-pre-wrap">{sqlQuery}</pre>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* LIGHT THEME DATA RESULTS GRID CONTAINER */}
          <AnimatePresence>
            {queryResult && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-slate-50/95 backdrop-blur-2xl border border-slate-200/90 rounded-3xl overflow-hidden shadow-2xl flex flex-col text-slate-900">
                
                {/* Header and Toggle Controls (Light Mode Bar) */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-6 py-4 border-b border-slate-200/80 bg-slate-100/80 gap-3">
                  <div className="flex items-center space-x-2 text-slate-800 font-bold">
                    <TableIcon className="w-5 h-5 text-cyan-600" />
                    <span>Data Results ({queryResult.length} rows total)</span>
                  </div>
                  <div className="flex space-x-2 bg-slate-200/80 p-1 rounded-xl border border-slate-300/60">
                    <button onClick={() => setActiveView('table')} className={`flex items-center space-x-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-300 ${activeView === 'table' ? 'bg-slate-900 text-cyan-400 shadow-md' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-300/50'}`}>
                      <LayoutList className="w-4 h-4" /> <span>Data Grid</span>
                    </button>
                    <button onClick={() => setActiveView('chart')} className={`flex items-center space-x-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-300 ${activeView === 'chart' ? 'bg-slate-900 text-purple-400 shadow-md' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-300/50'}`}>
                      <BarChart3 className="w-4 h-4" /> <span>Visualization</span>
                    </button>
                  </div>
                </div>
                
                {/* Data Grid Table View (Clean Light Theme) */}
                <div className="p-6 min-h-[450px] relative bg-white">
                  {activeView === 'table' ? (
                    <div className="overflow-x-auto">
                      {queryResult.length === 0 ? (
                        <div className="p-8 text-center text-slate-500 italic">No records matched your query.</div>
                      ) : (
                        <table className="w-full text-left text-sm text-slate-800">
                          <thead className="text-slate-600 uppercase text-xs tracking-wider border-b border-slate-200 bg-slate-100/70 font-bold">
                            <tr>
                              {Object.keys(queryResult[0]).map((key) => (
                                <th key={key} className="px-6 py-4 font-bold text-slate-700">{key.replace(/_/g, ' ')}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {queryResult.slice(0, visibleRows).map((row, idx) => (
                              <tr key={idx} className="hover:bg-slate-100/80 transition-colors duration-150">
                                {Object.values(row).map((val, i) => (
                                  <td key={i} className="px-6 py-4 whitespace-nowrap text-slate-800 font-medium">
                                    {val !== null ? String(val) : <span className="text-slate-400 italic">NULL</span>}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  ) : (
                    <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="h-[400px] w-full flex items-center justify-center p-2">
                       {renderChart()}
                    </motion.div>
                  )}
                </div>

                {activeView === 'table' && queryResult.length > visibleRows && (
                  <div className="p-4 bg-slate-100/80 border-t border-slate-200 flex justify-center">
                    <button onClick={() => setVisibleRows((prev) => prev + 100)} className="bg-white hover:bg-slate-200/80 text-slate-800 border border-slate-300 transition-all px-6 py-2 rounded-full text-sm font-semibold flex items-center space-x-2 shadow-sm">
                      <span>Load More Rows</span>
                      <span className="text-xs text-slate-600 bg-slate-200 px-2 py-0.5 rounded-full">Showing {visibleRows} of {queryResult.length}</span>
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Footer Section */}
      <footer className="relative z-10 border-t border-white/[0.05] bg-black/60 backdrop-blur-md py-6 mt-12">
        <div className="max-w-5xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-gray-500">
          <div>
            © {new Date().getFullYear()} <span className="text-gray-300 font-semibold">DataPulse AI</span>. All rights reserved.
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <a href="mailto:vishwachiniwar@gmail.com" className="flex items-center gap-1.5 hover:text-cyan-400 transition-colors">
              <svg className="w-3.5 h-3.5 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                <polyline points="22,6 12,13 2,6"></polyline>
              </svg>
              <span>Contact Me</span>
            </a>
            <span className="text-gray-800">•</span>
            <a href="https://www.linkedin.com/in/vishwanath-chiniwar-a79867252/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-cyan-400 transition-colors">
              <svg className="w-3.5 h-3.5 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path>
                <rect x="2" y="9" width="4" height="12"></rect>
                <circle cx="4" cy="4" r="2"></circle>
              </svg>
              <span>LinkedIn</span>
            </a>
            <span className="text-gray-800">•</span>
            <a href="https://www.instagram.com/vishwa_chiniwar/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-pink-400 transition-colors">
              <svg className="w-3.5 h-3.5 text-pink-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
              </svg>
              <span>Instagram</span>
            </a>
            <span className="text-gray-800">•</span>
            <a href="https://portfolio-86664.web.app/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-purple-400 transition-colors bg-purple-500/10 border border-purple-500/20 px-2.5 py-1 rounded-full">
              <svg className="w-3.5 h-3.5 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="2" y1="12" x2="22" y2="12"></line>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
              </svg>
              <span className="text-purple-300 font-medium">Portfolio Portal</span>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}