// src/components/ActiveSessionsChart.jsx
import '../estilos/Chart.css';
import { useState, useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";

Chart.register(...registerables, zoomPlugin);

const COLOR_MAP = {
    'CPU':            '#3b82f6', // Mapeado desde NVL en SQL
    'CPU/Other':      '#3b82f6',
    'User I/O':       '#f59e0b',
    'System I/O':     '#8b5cf6',
    'Wait':           '#ef4444',
    'Concurrency':    '#ec4899',
    'Application':    '#06b6d4',
    'Commit':         '#10b981',
    'Network':        '#f97316',
    'Administrative': '#6b7280',
    'Configuration':  '#84cc16',
    'Scheduler':      '#a78bfa',
    'Cluster':        '#fb7185',
    'Other':          '#94a3b8',
};

function getColor(tipo) {
    return COLOR_MAP[tipo] ?? '#94a3b8';
}

function procesarDatos(rawData) {
    const labelsSet = new Set();
    const tiposSet  = new Set();

    for (const row of rawData) {
        labelsSet.add(row.TIEMPO);
        tiposSet.add(row.TIPO);
    }

    const labels = Array.from(labelsSet).sort();
    const tipos  = Array.from(tiposSet).sort();

    const matrix = {};
    for (const tipo of tipos) {
        matrix[tipo] = {};
        for (const label of labels) {
            matrix[tipo][label] = 0;
        }
    }
    for (const row of rawData) {
        matrix[row.TIPO][row.TIEMPO] = Number(row.SESIONES);
    }

    const datasets = tipos.map(tipo => ({
        label: tipo,
        data: labels.map(l => matrix[tipo][l]),
        backgroundColor: getColor(tipo) + 'cc',
        borderColor:     getColor(tipo),
        borderWidth: 1,
    }));

    return { labels, datasets };
}

export default function ActiveSessionsChart() {
    const [error,      setError]      = useState(null);
    const [loading,    setLoading]    = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [rangeInfo,  setRangeInfo]  = useState('');
    
    // --- NUEVOS ESTADOS PARA CONVIVENCIA ---
    const [mode, setMode] = useState('live'); // 'live' o 'history'
    const [lookbackHours, setLookbackHours] = useState(1);
    const [dateRange, setDateRange] = useState([null, null]);
    const [startDate, endDate] = dateRange;

    const canvasRef = useRef(null);
    const chartRef  = useRef(null);
    const labelsRef = useRef([]);

    function actualizarRangeInfo() {
        const chart = chartRef.current;
        if (!chart || !labelsRef.current.length) return;
        const { min, max } = chart.scales.x;
        const labels = labelsRef.current;
        const minLabel = labels[Math.max(0, Math.round(min))];
        const maxLabel = labels[Math.min(labels.length - 1, Math.round(max))];
        if (minLabel && maxLabel) setRangeInfo(`${minLabel} — ${maxLabel}`);
    }
    const formatOracleDate = (date, isEndOfDay = false) => {
    if (!date) return null;
    const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    const day = String(date.getDate()).padStart(2, '0');
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const mins = String(date.getMinutes()).padStart(2, '0');
    const time = isEndOfDay ? "23:59" : "00:00";
    
 
    return `${day}-${month}-${year} ${time}`;
    };

    async function cargar(isRefresh = false) {
        isRefresh ? setRefreshing(true) : setLoading(true);
        setError(null);

        let url = `/api/query?q=active_sessions_chart`;
        
        // Lógica de parámetros según modo
        if (mode === 'live') {
            url += `&h=${lookbackHours}`;
        } else if (startDate && endDate) {
        // Formateamos aquí antes de enviar
        const startStr = formatOracleDate(startDate, false); // 00:00
        const endStr = formatOracleDate(endDate, true);      // 23:59
        console.log('Fechas formateadas para Oracle:', { startStr, endStr });
        url += `&start=${encodeURIComponent(startStr)}&end=${encodeURIComponent(endStr)}`;
    }

        try {
            const res  = await fetch(url);
            const json = await res.json();
            if (json.error) { setError(json.error); return; }

            const { labels, datasets } = procesarDatos(json);
            labelsRef.current = labels;

            if (chartRef.current) {
                chartRef.current.data.labels   = labels;
                chartRef.current.data.datasets = datasets;
                chartRef.current.options.plugins.zoom.limits.x.max = labels.length - 1;
                chartRef.current.options.plugins.zoom.pan.rangeMax.x = labels.length - 1;
                chartRef.current.resetZoom();
                chartRef.current.update();
                actualizarRangeInfo();
                return;
            }

            const ctx = canvasRef.current;
            chartRef.current = new Chart(ctx, {
                type: 'bar',
                data: { labels, datasets },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom', labels: { color: '#94a3b8' } },
                        zoom: {
                            pan: { enabled: true, mode: 'x', rangeMin: { x: 0 }, rangeMax: { x: labels.length - 1 } },
                            zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' },
                            limits: { x: { min: 0, max: labels.length - 1 } }
                        }
                    },
                    scales: {
                        x: { stacked: true, ticks: { color: '#94a3b8', autoSkip: true, maxTicksLimit: 8 } },
                        y: { stacked: true, beginAtZero: true, ticks: { color: '#94a3b8' } }
                    }
                }
            });
            actualizarRangeInfo();
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }

    useEffect(() => {
        if (mode === 'live' || (mode === 'history' && startDate && endDate)) {
            cargar();
        }
    }, [mode, lookbackHours, endDate]);

    return (
        <div className="chart-card">
            <div className="chart-header">
                <div className="header-controls-group">
                    <h3>Sesiones Activas</h3>
                    {/* Tabs de Modo */}
                    <div className="mode-selector">
                        <button className={mode === 'live' ? 'active' : ''} onClick={() => setMode('live')}>Live</button>
                        <button className={mode === 'history' ? 'active' : ''} onClick={() => setMode('history')}>Histórico</button>
                    </div>
                </div>

                <div className="chart-controls">
                    {mode === 'live' ? (
                        <select 
                            className="time-select" 
                            value={lookbackHours} 
                            onChange={(e) => setLookbackHours(Number(e.target.value))}
                        >
                            <option value={1}>Última hora</option>
                            <option value={6}>6 Horas</option>
                            <option value={12}>12 Horas</option>
                            <option value={24}>24 Horas</option>
                        </select>
                    ) : (
                        <div className="datepicker-wrapper">
                            <DatePicker
                                selectsRange={true}
                                startDate={startDate}
                                endDate={endDate}
                                onChange={(update) => setDateRange(update)}
                                maxDate={new Date()}
                                placeholderText="Seleccionar rango"
                                className="custom-datepicker"
                                filterDate={(d) => {
                                    if (!startDate || endDate) return true;
                                    return Math.abs(d - startDate) <= 8 * 24 * 60 * 60 * 1000;
                                }}
                            />
                        </div>
                    )}

                    {rangeInfo && <span className="range-info">🕐 {rangeInfo}</span>}
                    
                    <button className="refresh-btn" onClick={() => cargar(true)} disabled={refreshing}>
                        {refreshing ? '...' : '⟳'}
                    </button>
                </div>
            </div>

            <div className="chart-container" style={{ height: '550px' }}>
                <canvas ref={canvasRef}></canvas>
            </div>
        </div>
    );
}