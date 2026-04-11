import { useState, useEffect } from 'react';
import ActiveSessionsChart from './Chart';
import Table from './Table';

export default function PerformanceHub() {
    // Estado para los parámetros de búsqueda (vienen del Chart)
    const [params, setParams] = useState(null);

    // Estado para los datos de la tabla y control de carga
    const [tableData, setTableData] = useState([]);
    const [loadingTable, setLoadingTable] = useState(false);
    const [tableError, setTableError] = useState(null);

    // Este efecto se dispara cada vez que el Chart emite nuevos parámetros
    useEffect(() => {
        if (!params) return;
        console.log("Recibidos nuevos parámetros para la tabla:", params);
        async function cargarDetalleTabla() {
            setLoadingTable(true);
            setTableError(null);
            // Extraemos y validamos valores por defecto para evitar errores de bind
            const isRel = params.isRelative || 1;
            const hrs = params.hours || 1;
            const start = params.fStart || '';
            const end = params.fEnd || '';

            // Construimos la URL con TODOS los parámetros que el SQL espera
            const url = `/api/query?q=active_sessions_details` +
                `&isRelative=${isRel}` +
                `&hours=${hrs}` +
                `&fStart=${encodeURIComponent(start)}` +
                `&fEnd=${encodeURIComponent(end)}`;
            console.log("Esta es la URL que pido para la tabla:", url);
            try {
                const res = await fetch(url);
                const json = await res.json();
                setTableData(json.error ? [] : json);
            } catch (e) {
                console.error("Error:", e);
            } finally {
                setLoadingTable(false);
            }
        }

        cargarDetalleTabla();
    }, [params]);

    // Función que recibe los parámetros desde ActiveSessionsChart
    const handleParamsChange = (newParams) => {
        setParams(newParams);
    };

    return (
        <div className="session-monitor-container">
            {/* Componente del Gráfico */}
            <ActiveSessionsChart onParamsChange={handleParamsChange} />

            {/* Espacio entre componentes */}
            <div style={{ margin: '30px 0' }}></div>

            {/* Sección de la Tabla Detallada */}
            <div className="detail-section">
                {tableError && (
                    <div style={{ color: '#ef4444', marginBottom: '10px' }}>
                        ⚠️ {tableError}
                    </div>
                )}

                <Table
                    data={tableData}
                    title={loadingTable ? "Buscando detalles en Oracle..." : "Detalle performance hub"}
                />

                {loadingTable && (
                    <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '10px' }}>
                        Esto puede tardar unos segundos dependiendo del volumen de datos en ASH...
                    </p>
                )}
            </div>
        </div>
    );
}