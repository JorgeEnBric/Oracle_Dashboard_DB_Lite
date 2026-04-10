// src/components/ActiveSessionsChart.jsx
import '../estilos/Chart.css';
import { useState, useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';

Chart.register(...registerables, zoomPlugin);

const COLOR_MAP = {
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

    // Orden ascendente para que el tiempo fluya de izquierda a derecha
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

function calcularTicksPor30Min(labels) {
    if (labels.length < 2) return 30;
    const [h1, m1] = labels[0].split(':').map(Number);
    const [h2, m2] = labels[1].split(':').map(Number);
    const diffMin  = Math.abs((h2 * 60 + m2) - (h1 * 60 + m1));
    if (diffMin === 0) return 30;
    return Math.round(30 / diffMin);
}

export default function ActiveSessionsChart() {
    const [error,      setError]      = useState(null);
    const [loading,    setLoading]    = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isPanning,  setIsPanning]  = useState(false);
    const [rangeInfo,  setRangeInfo]  = useState('');
    
    // Estado para controlar el rango de tiempo seleccionado
    const [lookbackHours, setLookbackHours] = useState(1);

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
        if (minLabel && maxLabel) {
            setRangeInfo(`${minLabel} — ${maxLabel}`);
        }
    }

    async function cargar(isRefresh = false, hoursOverride) {
        const hours = hoursOverride || lookbackHours;
        isRefresh ? setRefreshing(true) : setLoading(true);
        setError(null);

        try {
            // Se envía el parámetro 'h' al endpoint modificado
            const res  = await fetch(`/api/query?q=active_sessions_chart&h=${hours}`);
            const json = await res.json();

            if (json.error) { setError(json.error); return; }

            const { labels, datasets } = procesarDatos(json);
            labelsRef.current = labels;
            const ticksPor30Min = calcularTicksPor30Min(labels);

            if (chartRef.current) {
                // Actualizar datos
                chartRef.current.data.labels   = labels;
                chartRef.current.data.datasets = datasets;
                
                // Actualizar límites de zoom para el nuevo rango de datos
                chartRef.current.options.plugins.zoom.limits.x.max = labels.length - 1;
                chartRef.current.options.plugins.zoom.pan.rangeMax.x = labels.length - 1;
                
                // Ajustar vista inicial (últimos 30 min) y refrescar
                chartRef.current.options.scales.x.min = Math.max(0, labels.length - ticksPor30Min);
                chartRef.current.options.scales.x.max = labels.length - 1;
                
                chartRef.current.resetZoom();
                chartRef.current.update();
                actualizarRangeInfo();
                return;
            }

            const ctx = canvasRef.current;
            if (!ctx) return;

            chartRef.current = new Chart(ctx, {
                type: 'bar',
                data: { labels, datasets },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    plugins: {
                        legend: {
                            display: true,
                            position: 'bottom',
                            labels: { color: '#94a3b8', boxWidth: 12, padding: 16, font: { size: 11 } },
                        },
                        tooltip: {
                            backgroundColor: '#1e293b',
                            borderColor: '#334155',
                            borderWidth: 1,
                            titleColor: '#e2e8f0',
                            bodyColor: '#94a3b8',
                            callbacks: {
                                footer: (items) => `Total: ${items.reduce((sum, i) => sum + i.parsed.y, 0)} sesiones`
                            }
                        },
                        zoom: {
                            pan: {
                                enabled: true,
                                mode: 'x',
                                speed: 5,
                                threshold: 5,
                                rangeMin: { x: 0 },
                                rangeMax: { x: labels.length - 1 },
                                onPanStart: () => setIsPanning(true),
                                onPanComplete: () => {
                                    setIsPanning(false);
                                    actualizarRangeInfo();
                                },
                            },
                            zoom: {
                                wheel: { enabled: true },
                                pinch: { enabled: true },
                                mode: 'x',
                                onZoomComplete: () => actualizarRangeInfo(),
                            },
                            limits: {
                                x: {
                                    min: 0,
                                    max: labels.length - 1,
                                    minRange: ticksPor30Min,
                                }
                            }
                        },
                    },
                    scales: {
                        x: {
                            stacked: true,
                            grid: { display: false },
                            ticks: { color: '#94a3b8', maxRotation: 45, font: { size: 10 }, maxTicksLimit: 12 },
                            title: { display: true, text: 'Hora (HH:MM)', color: '#64748b', font: { size: 11 } },
                            min: Math.max(0, labels.length - ticksPor30Min),
                            max: labels.length - 1,
                        },
                        y: {
                            stacked: true,
                            beginAtZero: true,
                            grid: { color: 'rgba(255,255,255,0.05)' },
                            ticks: { color: '#94a3b8', font: { size: 11 } },
                            title: { display: true, text: 'Sesiones', color: '#64748b', font: { size: 11 } },
                        },
                    },
                },
            });
            actualizarRangeInfo();
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }

    const handleHoursChange = (e) => {
        const val = Number(e.target.value);
        setLookbackHours(val);
        cargar(true, val);
    };

    function resetZoom() {
        if (chartRef.current) {
            chartRef.current.resetZoom();
            actualizarRangeInfo();
        }
    }

    useEffect(() => {
        cargar();
        return () => {
            if (chartRef.current) {
                chartRef.current.destroy();
                chartRef.current = null;
            }
        };
    }, []);

    return (
        <div className="chart-card">
            <div className="chart-header">
                <h3>Sesiones Activas</h3>
                <div className="chart-controls">
                    {/* Selector de ventana de tiempo */}
                    <select 
                        className="time-select" 
                        value={lookbackHours} 
                        onChange={handleHoursChange}
                        disabled={loading || refreshing}
                    >
                        <option value={1}>Última hora</option>
                        <option value={2}>Últimas 2h</option>
                        <option value={6}>Últimas 6h</option>
                        <option value={8}>Últimas 8h</option>
                        <option value={12}>Últimas 12h</option>
                        <option value={24}>Últimas 24h</option>
                    </select>

                    {rangeInfo && <span className="range-info">🕐 {rangeInfo}</span>}
                    
                    <button className="reset-btn" onClick={resetZoom} title="Ver rango completo">
                        ⊡ Reset
                    </button>
                    <button 
                        className="refresh-btn" 
                        onClick={() => cargar(true)} 
                        disabled={refreshing || loading}
                    >
                        {refreshing ? '⟳...' : '⟳ Refresh'}
                    </button>
                    <span className="status-badge">● Live</span>
                </div>
            </div>

            {!loading && !error && (
                <p className="chart-hint">
                    🖱 Arrastra para navegar · Scroll para zoom · Vista: últimos 30 min
                </p>
            )}

            {loading && <div className="chart-empty">Cargando datos...</div>}
            {error && !loading && (
                <div className="chart-error">⚠ Error al cargar datos: {error}</div>
            )}

            <div
                className="chart-container"
                style={{
                    display: loading || error ? 'none' : 'block',
                    cursor: isPanning ? 'grabbing' : 'grab',
                }}
            >
                <canvas ref={canvasRef}></canvas>
            </div>
        </div>
    );
}