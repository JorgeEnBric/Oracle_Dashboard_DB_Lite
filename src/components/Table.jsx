// src/components/Table.jsx
import '../estilos/Table.css';

export default function Table({ data = [], title }) {
    const hasData = Array.isArray(data) && data.length > 0;
    const headers = hasData ? Object.keys(data[0]) : [];

    return (
        <div className="table-container">
            {title && <h3 className="table-title">{title}</h3>}

            {hasData ? (
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
                            {data.map((row, i) => (
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
            ) : (
                <div className="empty-state">
                    <p>No hay registros disponibles para mostrar.</p>
                </div>
            )}
        </div>
    );
}
