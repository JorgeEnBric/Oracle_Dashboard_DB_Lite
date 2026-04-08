// src/components/AlertLog.jsx
import { useState, useEffect } from 'react';
import Table from './Table.jsx';

export default function AlertLog() {
    const [data, setData]       = useState([]);
    const [error, setError]     = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function cargar() {
            try {
                const res  = await fetch('/api/query?q=alertlog');
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
        <div className="alert-zone">
            <Table data={data} title="Alertlog last 10 days" />
        </div>
    );
}