import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'
import { useUser } from '../contexts/UserContext'
import { ArrowLeft, Plus, Trash2, BarChart3, X, GripVertical, Pencil } from 'lucide-react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter } from 'recharts'

const REST_URL = import.meta.env.VITE_SUPABASE_URL
const REST_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const REST_HEADERS = { 'apikey': REST_KEY, 'Authorization': `Bearer ${REST_KEY}` }
const REST_JSON = { ...REST_HEADERS, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' }
const REST_JSON_RETURN = { ...REST_HEADERS, 'Content-Type': 'application/json', 'Prefer': 'return=representation' }

const DEFAULT_COLUMNS = [
  { name: 'Trial', type: 'number' },
  { name: 'Value', type: 'number' },
  { name: 'Target', type: 'number' },
  { name: 'Pass/Fail', type: 'passfail' },
  { name: 'Notes', type: 'text' },
]

const COLUMN_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'passfail', label: 'Pass/Fail' },
]

const CHART_TYPES = [
  { value: 'line', label: 'Line Chart' },
  { value: 'bar', label: 'Bar Chart' },
  { value: 'scatter', label: 'Scatter Plot' },
]

const CHART_COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1', '#a4de6c']

// ─── Table List View ────────────────────────────────────────
function TableList({ tables, onSelect, onCreate, onDelete }) {
  return (
    <div className="flex-1 p-6">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={onCreate}
          className="w-full mb-6 px-6 py-4 bg-gradient-to-r from-pastel-blue to-pastel-pink rounded-2xl shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 text-gray-700 font-semibold"
        >
          <Plus size={20} />
          Create a New Table
        </button>

        {tables.length === 0 && (
          <p className="text-center text-gray-400 mt-8">No test tables yet. Create one to get started.</p>
        )}

        <div className="grid gap-3">
          {tables.map(t => (
            <div
              key={t.id}
              className="flex items-center justify-between px-5 py-4 bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer"
              onClick={() => onSelect(t)}
            >
              <div>
                <span className="text-lg font-semibold text-gray-700">{t.name}</span>
                <p className="text-sm text-gray-400">{t.columns?.length || 0} columns &middot; Created by {t.created_by}</p>
              </div>
              <button
                onClick={e => { e.stopPropagation(); onDelete(t.id) }}
                className="p-2 text-gray-400 hover:text-red-500 transition-colors"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Create Table Form ──────────────────────────────────────
function CreateTableForm({ onCancel, onCreated }) {
  const { username } = useUser()
  const [name, setName] = useState('')
  const [columns, setColumns] = useState(DEFAULT_COLUMNS.map(c => ({ ...c })))
  const [saving, setSaving] = useState(false)

  const addColumn = () => setColumns(prev => [...prev, { name: '', type: 'text' }])

  const removeColumn = (i) => setColumns(prev => prev.filter((_, idx) => idx !== i))

  const updateColumn = (i, field, value) => {
    setColumns(prev => prev.map((c, idx) => idx === i ? { ...c, [field]: value } : c))
  }

  const handleSave = async () => {
    if (!name.trim()) return
    const validCols = columns.filter(c => c.name.trim())
    if (validCols.length === 0) return
    setSaving(true)
    try {
      const res = await fetch(`${REST_URL}/rest/v1/testing_tables`, {
        method: 'POST',
        headers: REST_JSON_RETURN,
        body: JSON.stringify({ name: name.trim(), columns: validCols, created_by: username }),
      })
      if (res.ok) {
        const [created] = await res.json()
        onCreated(created)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex-1 p-6">
      <div className="max-w-lg mx-auto">
        <button onClick={onCancel} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft size={16} /> Back
        </button>

        <h2 className="text-xl font-bold text-gray-700 mb-4">New Test Table</h2>

        <label className="block mb-4">
          <span className="text-sm font-medium text-gray-600">Table Name</span>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Cycle Time, Shooter Accuracy..."
            className="mt-1 w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-pastel-blue"
          />
        </label>

        <div className="mb-4">
          <span className="text-sm font-medium text-gray-600">Columns</span>
          <div className="mt-2 space-y-2">
            {columns.map((col, i) => (
              <div key={i} className="flex items-center gap-2">
                <GripVertical size={14} className="text-gray-300" />
                <input
                  value={col.name}
                  onChange={e => updateColumn(i, 'name', e.target.value)}
                  placeholder="Column name"
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-pastel-blue"
                />
                <select
                  value={col.type}
                  onChange={e => updateColumn(i, 'type', e.target.value)}
                  className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-pastel-blue"
                >
                  {COLUMN_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <button onClick={() => removeColumn(i)} className="p-1 text-gray-400 hover:text-red-500">
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
          <button onClick={addColumn} className="mt-2 text-sm text-pastel-blue-dark hover:underline flex items-center gap-1">
            <Plus size={14} /> Add Column
          </button>
        </div>

        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="w-full py-3 bg-pastel-blue hover:bg-pastel-blue-dark rounded-xl font-semibold text-gray-700 transition-colors disabled:opacity-50"
        >
          {saving ? 'Creating...' : 'Create Table'}
        </button>
      </div>
    </div>
  )
}

// ─── Add Chart Modal ────────────────────────────────────────
function AddChartModal({ columns, tableId, onClose, onCreated }) {
  const numericCols = columns.filter(c => c.type === 'number')
  const [chartType, setChartType] = useState('line')
  const [xCol, setXCol] = useState(numericCols[0]?.name || '')
  const [yCols, setYCols] = useState(numericCols.length > 1 ? [numericCols[1].name] : [])
  const [title, setTitle] = useState('')
  const [saving, setSaving] = useState(false)

  const toggleY = (name) => {
    setYCols(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name])
  }

  const handleSave = async () => {
    if (!xCol || yCols.length === 0) return
    setSaving(true)
    try {
      const res = await fetch(`${REST_URL}/rest/v1/testing_charts`, {
        method: 'POST',
        headers: REST_JSON_RETURN,
        body: JSON.stringify({ table_id: tableId, chart_type: chartType, x_column: xCol, y_columns: yCols, title: title.trim() || null }),
      })
      if (res.ok) {
        const [created] = await res.json()
        onCreated(created)
      }
    } finally {
      setSaving(false)
    }
  }

  if (numericCols.length < 2) {
    return (
      <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div className="bg-white rounded-2xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
          <p className="text-gray-600">You need at least 2 numeric columns to create a chart.</p>
          <button onClick={onClose} className="mt-4 px-4 py-2 bg-pastel-blue rounded-lg text-sm">OK</button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-gray-700 mb-4">Add Chart</h3>

        <label className="block mb-3">
          <span className="text-sm font-medium text-gray-600">Title (optional)</span>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Chart title" className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-pastel-blue" />
        </label>

        <label className="block mb-3">
          <span className="text-sm font-medium text-gray-600">Chart Type</span>
          <select value={chartType} onChange={e => setChartType(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-pastel-blue">
            {CHART_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>

        <label className="block mb-3">
          <span className="text-sm font-medium text-gray-600">X-Axis Column</span>
          <select value={xCol} onChange={e => setXCol(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-pastel-blue">
            {numericCols.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
        </label>

        <div className="mb-4">
          <span className="text-sm font-medium text-gray-600">Y-Axis Columns</span>
          <div className="mt-1 space-y-1">
            {numericCols.filter(c => c.name !== xCol).map(c => (
              <label key={c.name} className="flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" checked={yCols.includes(c.name)} onChange={() => toggleY(c.name)} className="rounded" />
                {c.name}
              </label>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={handleSave} disabled={saving || yCols.length === 0} className="flex-1 py-2 bg-pastel-blue hover:bg-pastel-blue-dark rounded-lg text-sm font-semibold text-gray-700 disabled:opacity-50">
            {saving ? 'Saving...' : 'Add Chart'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Chart Renderer ─────────────────────────────────────────
function ChartView({ chart, rows, columns, onDelete }) {
  const data = rows
    .sort((a, b) => a.row_order - b.row_order)
    .map(r => {
      const point = {}
      columns.forEach(c => {
        if (c.type === 'number') point[c.name] = parseFloat(r.row_data[c.name]) || 0
      })
      return point
    })

  const ChartComponent = chart.chart_type === 'bar' ? BarChart : chart.chart_type === 'scatter' ? ScatterChart : LineChart

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-sm mb-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-gray-600">{chart.title || `${chart.chart_type} chart`}</h4>
        <button onClick={() => onDelete(chart.id)} className="p-1 text-gray-400 hover:text-red-500">
          <Trash2 size={14} />
        </button>
      </div>
      <ResponsiveContainer width="100%" height={250}>
        <ChartComponent data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={chart.x_column} />
          <YAxis />
          <Tooltip />
          <Legend />
          {chart.chart_type === 'scatter' ? (
            chart.y_columns.map((yCol, i) => (
              <Scatter key={yCol} name={yCol} dataKey={yCol} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))
          ) : chart.chart_type === 'bar' ? (
            chart.y_columns.map((yCol, i) => (
              <Bar key={yCol} dataKey={yCol} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))
          ) : (
            chart.y_columns.map((yCol, i) => (
              <Line key={yCol} type="monotone" dataKey={yCol} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
            ))
          )}
        </ChartComponent>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Spreadsheet View (single table) ────────────────────────
function SpreadsheetView({ table, onBack }) {
  const { username } = useUser()
  const [rows, setRows] = useState([])
  const [charts, setCharts] = useState([])
  const [showChartModal, setShowChartModal] = useState(false)
  const [editingCell, setEditingCell] = useState(null) // { rowId, colName }
  const [editValue, setEditValue] = useState('')

  const columns = table.columns || []

  // Fetch rows & charts
  useEffect(() => {
    Promise.all([
      fetch(`${REST_URL}/rest/v1/testing_rows?table_id=eq.${table.id}&order=row_order.asc`, { headers: REST_HEADERS }).then(r => r.ok ? r.json() : []),
      fetch(`${REST_URL}/rest/v1/testing_charts?table_id=eq.${table.id}&order=created_at.asc`, { headers: REST_HEADERS }).then(r => r.ok ? r.json() : []),
    ]).then(([r, c]) => {
      setRows(r)
      setCharts(c)
    })
  }, [table.id])

  // Real-time
  useEffect(() => {
    const channel = supabase
      .channel(`testing-${table.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'testing_rows', filter: `table_id=eq.${table.id}` }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setRows(prev => prev.some(r => r.id === payload.new.id) ? prev : [...prev, payload.new])
        } else if (payload.eventType === 'UPDATE') {
          setRows(prev => prev.map(r => r.id === payload.new.id ? payload.new : r))
        } else if (payload.eventType === 'DELETE') {
          setRows(prev => prev.filter(r => r.id !== payload.old.id))
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'testing_charts', filter: `table_id=eq.${table.id}` }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setCharts(prev => prev.some(c => c.id === payload.new.id) ? prev : [...prev, payload.new])
        } else if (payload.eventType === 'DELETE') {
          setCharts(prev => prev.filter(c => c.id !== payload.old.id))
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [table.id])

  const addRow = async () => {
    const nextOrder = rows.length > 0 ? Math.max(...rows.map(r => r.row_order)) + 1 : 1
    const rowData = {}
    columns.forEach(c => {
      if (c.type === 'number' && c.name === 'Trial') rowData[c.name] = nextOrder
      else if (c.type === 'number') rowData[c.name] = 0
      else if (c.type === 'passfail') rowData[c.name] = ''
      else rowData[c.name] = ''
    })
    const res = await fetch(`${REST_URL}/rest/v1/testing_rows`, {
      method: 'POST',
      headers: REST_JSON_RETURN,
      body: JSON.stringify({ table_id: table.id, row_data: rowData, row_order: nextOrder }),
    })
    if (res.ok) {
      const [created] = await res.json()
      setRows(prev => prev.some(r => r.id === created.id) ? prev : [...prev, created])
    }
  }

  const deleteRow = async (rowId) => {
    setRows(prev => prev.filter(r => r.id !== rowId))
    await fetch(`${REST_URL}/rest/v1/testing_rows?id=eq.${rowId}`, {
      method: 'DELETE',
      headers: REST_HEADERS,
    })
  }

  const startEdit = (rowId, colName, currentValue) => {
    setEditingCell({ rowId, colName })
    setEditValue(currentValue ?? '')
  }

  const commitEdit = async () => {
    if (!editingCell) return
    const row = rows.find(r => r.id === editingCell.rowId)
    if (!row) return
    const col = columns.find(c => c.name === editingCell.colName)
    let val = editValue
    if (col?.type === 'number') val = editValue === '' ? 0 : parseFloat(editValue) || 0
    const newData = { ...row.row_data, [editingCell.colName]: val }
    setRows(prev => prev.map(r => r.id === editingCell.rowId ? { ...r, row_data: newData } : r))
    setEditingCell(null)
    await fetch(`${REST_URL}/rest/v1/testing_rows?id=eq.${editingCell.rowId}`, {
      method: 'PATCH',
      headers: REST_JSON,
      body: JSON.stringify({ row_data: newData }),
    })
  }

  const togglePassFail = async (rowId, colName) => {
    const row = rows.find(r => r.id === rowId)
    if (!row) return
    const current = row.row_data[colName]
    const next = current === 'Pass' ? 'Fail' : current === 'Fail' ? '' : 'Pass'
    const newData = { ...row.row_data, [colName]: next }
    setRows(prev => prev.map(r => r.id === rowId ? { ...r, row_data: newData } : r))
    await fetch(`${REST_URL}/rest/v1/testing_rows?id=eq.${rowId}`, {
      method: 'PATCH',
      headers: REST_JSON,
      body: JSON.stringify({ row_data: newData }),
    })
  }

  const deleteChart = async (chartId) => {
    setCharts(prev => prev.filter(c => c.id !== chartId))
    await fetch(`${REST_URL}/rest/v1/testing_charts?id=eq.${chartId}`, {
      method: 'DELETE',
      headers: REST_HEADERS,
    })
  }

  const convertToGraph = async () => {
    const numericCols = columns.filter(c => c.type === 'number')
    if (numericCols.length < 2) return
    const xCol = numericCols[0].name
    const yCols = numericCols.slice(1).map(c => c.name)
    const res = await fetch(`${REST_URL}/rest/v1/testing_charts`, {
      method: 'POST',
      headers: REST_JSON_RETURN,
      body: JSON.stringify({ table_id: table.id, chart_type: 'line', x_column: xCol, y_columns: yCols, title: `${table.name} Overview` }),
    })
    if (res.ok) {
      const [created] = await res.json()
      setCharts(prev => prev.some(c => c.id === created.id) ? prev : [...prev, created])
    }
  }

  const sortedRows = [...rows].sort((a, b) => a.row_order - b.row_order)

  return (
    <div className="flex-1 flex flex-col p-4 md:p-6 overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
            <ArrowLeft size={16} /> Back
          </button>
          <h2 className="text-xl font-bold text-gray-700">{table.name}</h2>
        </div>
        <div className="flex gap-2 flex-wrap">
          {columns.filter(c => c.type === 'number').length >= 2 && (
            <button
              onClick={convertToGraph}
              className="flex items-center gap-1 px-3 py-2 bg-pastel-blue hover:bg-pastel-blue-dark rounded-lg text-sm text-gray-700 transition-colors"
            >
              <BarChart3 size={16} /> Convert to Graph
            </button>
          )}
          <button
            onClick={() => setShowChartModal(true)}
            className="flex items-center gap-1 px-3 py-2 bg-pastel-orange hover:bg-pastel-orange-dark rounded-lg text-sm text-gray-700 transition-colors"
          >
            <BarChart3 size={16} /> Add Chart
          </button>
          <button
            onClick={addRow}
            className="flex items-center gap-1 px-3 py-2 bg-pastel-pink hover:bg-pastel-pink-dark rounded-lg text-sm text-gray-700 transition-colors"
          >
            <Plus size={16} /> Add Row
          </button>
        </div>
      </div>

      {/* Charts */}
      {charts.length > 0 && (
        <div className="mb-4 space-y-2">
          {charts.map(chart => (
            <ChartView key={chart.id} chart={chart} rows={sortedRows} columns={columns} onDelete={deleteChart} />
          ))}
        </div>
      )}

      {/* Spreadsheet Table */}
      <div className="flex-1 overflow-auto rounded-2xl bg-white/80 backdrop-blur-sm shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 sticky top-0 z-[1]">
            <tr>
              <th className="w-10 px-2 py-3 text-left text-xs font-semibold text-gray-500">#</th>
              {columns.map(col => (
                <th key={col.name} className="px-3 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">
                  {col.name}
                  <span className="ml-1 text-gray-300 font-normal">({col.type})</span>
                </th>
              ))}
              <th className="w-10 px-2 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, idx) => (
              <tr key={row.id} className="border-t border-gray-100 hover:bg-pastel-blue/10 transition-colors">
                <td className="px-2 py-2 text-xs text-gray-400">{idx + 1}</td>
                {columns.map(col => (
                  <td key={col.name} className="px-3 py-2">
                    {col.type === 'passfail' ? (
                      <button
                        onClick={() => togglePassFail(row.id, col.name)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                          row.row_data[col.name] === 'Pass'
                            ? 'bg-green-100 text-green-700'
                            : row.row_data[col.name] === 'Fail'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-400'
                        }`}
                      >
                        {row.row_data[col.name] || '—'}
                      </button>
                    ) : editingCell?.rowId === row.id && editingCell?.colName === col.name ? (
                      <input
                        autoFocus
                        type={col.type === 'number' ? 'number' : 'text'}
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingCell(null) }}
                        className="w-full px-2 py-1 rounded border border-pastel-blue text-sm focus:outline-none focus:ring-1 focus:ring-pastel-blue"
                        step={col.type === 'number' ? 'any' : undefined}
                      />
                    ) : (
                      <div
                        onClick={() => startEdit(row.id, col.name, row.row_data[col.name])}
                        className="cursor-pointer min-h-[28px] px-2 py-1 rounded hover:bg-gray-50 text-gray-700"
                      >
                        {row.row_data[col.name] !== undefined && row.row_data[col.name] !== '' ? row.row_data[col.name] : <span className="text-gray-300">—</span>}
                      </div>
                    )}
                  </td>
                ))}
                <td className="px-2 py-2">
                  <button onClick={() => deleteRow(row.id)} className="p-1 text-gray-400 hover:text-red-500">
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
            {sortedRows.length === 0 && (
              <tr>
                <td colSpan={columns.length + 2} className="text-center py-8 text-gray-400">
                  No data yet. Click "Add Row" to start logging test results.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showChartModal && (
        <AddChartModal
          columns={columns}
          tableId={table.id}
          onClose={() => setShowChartModal(false)}
          onCreated={(chart) => { setCharts(prev => [...prev, chart]); setShowChartModal(false) }}
        />
      )}
    </div>
  )
}

// ─── Main Dashboard ─────────────────────────────────────────
export default function TestingDashboard({ onBack }) {
  const [tables, setTables] = useState([])
  const [view, setView] = useState('list') // 'list' | 'create' | 'spreadsheet'
  const [selectedTable, setSelectedTable] = useState(null)

  useEffect(() => {
    fetch(`${REST_URL}/rest/v1/testing_tables?order=created_at.desc`, { headers: REST_HEADERS })
      .then(r => r.ok ? r.json() : [])
      .then(setTables)
  }, [])

  // Real-time for table list
  useEffect(() => {
    const channel = supabase
      .channel('testing-tables-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'testing_tables' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setTables(prev => prev.some(t => t.id === payload.new.id) ? prev : [payload.new, ...prev])
        } else if (payload.eventType === 'UPDATE') {
          setTables(prev => prev.map(t => t.id === payload.new.id ? payload.new : t))
        } else if (payload.eventType === 'DELETE') {
          setTables(prev => prev.filter(t => t.id !== payload.old.id))
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const handleDelete = async (id) => {
    setTables(prev => prev.filter(t => t.id !== id))
    await fetch(`${REST_URL}/rest/v1/testing_tables?id=eq.${id}`, {
      method: 'DELETE',
      headers: REST_HEADERS,
    })
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center gap-2 px-4 pt-4">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors">
          <ArrowLeft size={16} /> Back to Special Controls
        </button>
      </div>
      <div className="px-4 pt-2 pb-1">
        <h2 className="text-xl font-bold bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent">
          Testing
        </h2>
        <p className="text-sm text-gray-400">Create test tables, log results, and visualize data</p>
      </div>

      {view === 'create' ? (
        <CreateTableForm
          onCancel={() => setView('list')}
          onCreated={(t) => { setTables(prev => [t, ...prev]); setSelectedTable(t); setView('spreadsheet') }}
        />
      ) : view === 'spreadsheet' && selectedTable ? (
        <SpreadsheetView
          table={selectedTable}
          onBack={() => { setView('list'); setSelectedTable(null) }}
        />
      ) : (
        <TableList
          tables={tables}
          onSelect={t => { setSelectedTable(t); setView('spreadsheet') }}
          onCreate={() => setView('create')}
          onDelete={handleDelete}
        />
      )}
    </div>
  )
}
