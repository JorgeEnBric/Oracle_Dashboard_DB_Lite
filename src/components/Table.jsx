// src/components/Table.jsx
import { useState } from 'react';
import '../estilos/Table.css';

export default function Table({ data = [], title }) {
    const [currentPage, setCurrentPage] = useState(1);
    const recordsPerPage = 8;

    const hasData = Array.isArray(data) && data.length > 0;
    const headers = hasData ? Object.keys(data[0]) : [];

    // Lógica de Paginación
    const totalPages = Math.ceil(data.length / recordsPerPage);
    const indexOfLastRecord = currentPage * recordsPerPage;
    const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
    const currentRecords = data.slice(indexOfFirstRecord, indexOfLastRecord);

    const goToPage = (pageNumber) => {
        if (pageNumber >= 1 && pageNumber <= totalPages) {
            setCurrentPage(pageNumber);
        }
    };

    return (
        <div className="table-container">
            <div className="table-header-flex">
                {title && <h3 className="table-title">{title}</h3>}
                {hasData && data.length > recordsPerPage && (
                    <span className="record-count">
                        Mostrando {indexOfFirstRecord + 1}-{Math.min(indexOfLastRecord, data.length)} de {data.length}
                    </span>
                )}
            </div>

            {hasData ? (
                <>
                    <div className="scroll-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    {headers.map(header => (
                                        <th key={header}>{header}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {currentRecords.map((row, i) => (
                                    <tr key={i}>
                                        {Object.values(row).map((value, j) => (
                                            <td key={j}>
                                                {value != null
                                                    ? value.toString()
                                                    : <span className="null-value">NULL</span>
                                                }
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