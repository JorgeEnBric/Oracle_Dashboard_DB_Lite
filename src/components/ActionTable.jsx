// src/components/AccionTable.jsx
import { useState, useEffect } from 'react';
import '../estilos/Table.css';
import '../estilos/ActionTable.css';
import {  notify } from '../pages/api/notify.js';

export default function ActionTable({ data = [], title, accion }) {
    // Estado local para manejar los datos (por si se eliminan filas tras el kill)
    const [tableData, setTableData] = useState(data);
    
    // --- Lógica de Paginación ---
    const [currentPage, setCurrentPage] = useState(1);
    const recordsPerPage = 8;

    // Sincronizar tableData si los props cambian (importante para dashboards dinámicos)
    useEffect(() => {
        setTableData(data);
        setCurrentPage(1); // Resetear a la primera página si cambian los datos
    }, [data]);

    const hasData = Array.isArray(tableData) && tableData.length > 0;
    
    // Determinamos los headers dinámicamente
    const rawHeaders = hasData ? Object.keys(tableData[0]) : [];
    const headers = (accion === "Kill session" && !rawHeaders.includes('Acción')) 
        ? [...rawHeaders, 'Acción'] 
        : rawHeaders;

    // Cálculos de paginación
    const totalPages = Math.ceil(tableData.length / recordsPerPage);
    const indexOfLastRecord = currentPage * recordsPerPage;
    const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
    const currentRecords = tableData.slice(indexOfFirstRecord, indexOfLastRecord);

    const goToPage = (pageNumber) => {
        if (pageNumber >= 1 && pageNumber <= totalPages) {
            setCurrentPage(pageNumber);
        }
    };

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
                notify(`Sesión ${sid} eliminada correctamente.`, 'success');
                // Filtrar la fila eliminada de la vista local
                setTableData(prev => prev.filter(row => row.SID !== sid));
            } else {
                notify(`Error: ${result.error}`, 'error');
            }
        } catch (err) {
            notify(`API Error: ${err.message}`, 'error');
        }
    }

    return (
        <div className="table-container">
            {/* Cabecera con contador de registros (estilo Table.jsx) */}
            <div className="table-header-flex">
                {title && <h3 className="table-title">{title}</h3>}
                {hasData && tableData.length > recordsPerPage && (
                    <span className="record-count">
                        Mostrando {indexOfFirstRecord + 1}-{Math.min(indexOfLastRecord, tableData.length)} de {tableData.length}
                    </span>
                )}
            </div>

            {hasData ? (
                <>
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
                                {currentRecords.map((row, i) => (
                                    <tr key={i}>
                                        {headers.map((header) => (
                                            <td key={header}>
                                                {header === 'Acción' ? (
                                                    <button 
                                                        className="accion-button"
                                                        onClick={() => killSession(row.SID, row['SERIAL#'], row.INST_ID)}
                                                    >
                                                        Kill
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

                    {/* Controles de Paginación */}
                    {totalPages > 1 && (
                        <div className="pagination-controls">
                            <button 
                                onClick={() => goToPage(currentPage - 1)} 
                                disabled={currentPage === 1}
                                className="page-btn"
                            >
                                Anterior
                            </button>
                            
                            <span className="page-info">
                                Página <strong>{currentPage}</strong> de {totalPages}
                            </span>

                            <button 
                                onClick={() => goToPage(currentPage + 1)} 
                                disabled={currentPage === totalPages}
                                className="page-btn"
                            >
                                Siguiente
                            </button>
                        </div>
                    )}
                </>
            ) : (
                <div className="empty-state">
                    <p>No hay registros disponibles para mostrar.</p>
                </div>
            )}
        </div>
    );
}
