// src/components/AccionTable.jsx
import { useState } from 'react';
import '../estilos/Table.css';
import '../estilos/AcctionTable.css';

export default function AccionTable({ data = [], title, accion }) {
    // Estado local para manejar los datos (por si se eliminan filas tras el kill)
    const [tableData, setTableData] = useState(data);

    const hasData = Array.isArray(tableData) && tableData.length > 0;
    
    // Determinamos los headers dinámicamente
    const rawHeaders = hasData ? Object.keys(tableData[0]) : [];
    const headers = (accion === "Kill session" && !rawHeaders.includes('Acción')) 
        ? [...rawHeaders, 'Acción'] 
        : rawHeaders;

    /**
     * Función para terminar una sesión en Oracle
     */
    async function killSession(sid, serial, instance) {
        if (!confirm(`¿Estás seguro de terminar la sesión ${sid}?`)) return;

        try {
            const response = await fetch('/api/killSession', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sid, serial, instance })
            });
            
            const result = await response.json();
            
            if (result.success) {
                alert(`Sesión ${sid} eliminada correctamente.`);
                // Opcional: Filtrar la fila eliminada de la vista local
                setTableData(prev => prev.filter(row => row.SID !== sid));
            } else {
                alert(`Error: ${result.error}`);
            }
        } catch (err) {
            alert(`API Error: ${err.message}`);
        }
    }

    return (
        <div className="table-container">
            {title && <h3 className="table-title">{title}</h3>}

            {hasData ? (
                <div className="scroll-wrapper">
                    <table>
                        <thead>
                            <tr>
                                {headers.map((header) => (
                                    <th key={header}>{header}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {tableData.map((row, i) => (
                                <tr key={i}>
                                    {headers.map((header) => (
                                        <td key={header}>
                                            {header === 'Acción' ? (
                                                <button 
                                                    className="accion-button"
                                                    onClick={() => killSession(row.SID, row['SERIAL#'], row.INST_ID)}
                                                >
                                                    Kill session
                                                </button>
                                            ) : (
                                                row[header]?.toString() ?? <span className="null-value">NULL</span>
                                            )}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="empty-state">
                    <p>No hay registros disponibles para mostrar.</p>
                </div>
            )}
        </div>
    );
}

