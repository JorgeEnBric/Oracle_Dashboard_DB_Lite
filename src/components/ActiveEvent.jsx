// src/components/ActiveEvents.jsx
import { useState, useEffect } from 'react';
import Table from './Table.jsx';

export default function ActiveEvents() {
    const [data, setData]       = useState([]);
    const [data2, setData2]     = useState([]);
    const [error, setError]     = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function cargar() {
            try {
                const [res1, res2] = await Promise.all([
                    fetch('/api/query?q=eventos_activos'),
                    fetch('/api/query?q=ash')
                ]);

                const json1 = await res1.json();
                const json2 = await res2.json();

                if (json1.error) { setError(json1.error); return; }
                if (json2.error) { setError(json2.error); return; }

                setData(json1);
                setData2(json2);
            } catch (e) {
                setError(e.message);
            } finally {
                setLoading(false);
            }
        }

        cargar();
    }, []);

    if (loading) return <p>Cargando...</p>;
    if (error)   return <p className="error">Error: {error}</p>;

    return (
        <div className="activeevent-zone">
            <Table data={data}  title="Eventos Activos" />
            <Table data={data2} title="Active Session History (última hora)" />
        </div>
    );
}