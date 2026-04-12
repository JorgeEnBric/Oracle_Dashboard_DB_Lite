// src/components/InfoSGA_PGA.jsx
import { useState, useEffect } from 'react';
import Table from './Table.jsx';

export default function InfoSGAPGA() {
    const [data, setData]       = useState([]);
    const [error, setError]     = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function cargar() {
            try {
                const res  = await fetch('/api/query?q=infoSGA_PGA');
                const json = await res.json();

                if (json.error) {
                    setError(json.error);
                    return;
                }

                setData(json);
            } catch (e) {
                setError(e.message);
            } finally {
                setLoading(false);
            }
        }

        cargar();
    }, []); // [] = solo carga una vez cuando el componente aparece

    if (loading) return <p>Cargando...</p>;
    if (error)   return <p className="error">Error: {error}</p>;

    return (
        <div className="info-sga-pga zone">
            <Table data={data} title="Revisión de SGA y PGA" />
        </div>
    );
}
