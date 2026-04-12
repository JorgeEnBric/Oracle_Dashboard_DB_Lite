//Importando la función de notificación
import { notify } from "./notify.js";

const tnsPanel = document.getElementById("tnsPanel");
const editor = document.getElementById("editConnections");
const connectionSelect = document.getElementById("savedConnections");


export async function testConnection() {
    const usuario = document.getElementById("usuario").value;
    const password = document.getElementById("password").value;
    const host = document.getElementById("host").value;
    const port = document.getElementById("port").value;
    const service = document.getElementById("service").value;

    try {
        const response = await fetch("/api/test-connection", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ usuario, password, host, port, service }),
        });
        const result = await response.json();
        if (result.success) {
            notify("Conexión exitosa", 'success');
        }else {
            notify("Error en la conexión: " + result.error, 'error');
        }

    } catch (err) {
        notify("Error al probar conexión: " + err.message, 'error');
    }
}

// Cargar datos del archivo físico
async function loadSavedData() {
    try {
        const res = await fetch('/api/get-tns');
        const data = await res.json();
        if (data.success && data.connections) {
            editor.value = JSON.stringify(data.connections, null, 4);
            connectionSelect.innerHTML = '<option value="">-- Seleccionar conexión --</option>';
            data.connections.forEach((conn, index) => {
                const opt = document.createElement('option');
                opt.value = index;
                opt.textContent = conn.name || `${conn.host} - ${conn.service}`;
                connectionSelect.appendChild(opt);
            });

            connectionSelect.onchange = (e) => {
                const selected = data.connections[e.target.value];
                if (selected) {
                    document.getElementById("host").value = selected.host || '';
                    document.getElementById("port").value = selected.port || 1521;
                    document.getElementById("service").value = selected.service || '';
                    document.getElementById("usuario").value = selected.usuario || '';
                }
            };
        }
    } catch (err) { console.error("Error cargando TNS:", err); }
}

export async function quickSaveConnection() {
    const newConn = {
        name: document.getElementById("service").value + " (" + document.getElementById("host").value + ")",
        host: document.getElementById("host").value,
        port: parseInt(document.getElementById("port").value),
        service: document.getElementById("service").value,
        usuario: document.getElementById("usuario").value
    };

    if (!newConn.host || !newConn.service) {
        notify("Completa al menos Host y Service Name", 'info');
        return;
    }

    try {
        const res = await fetch('/api/get-tns');
        const data = await res.json();
        const currentConns = data.connections || [];
        currentConns.push(newConn);

        const saveRes = await fetch("/api/save-tns", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ connections: currentConns }),
        });

        if ((await saveRes.json()).success) {
            notify("Conexión guardada exitosamente", 'success');
            loadSavedData();
        }
    } catch (err) { notify("Error al guardar: " + err.message, 'error'); }
}

export async function saveEditorContent() {
    try {
        const connections = JSON.parse(editor.value);
        const res = await fetch("/api/save-tns", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ connections }),
        });
        if ((await res.json()).success) {
            notify("Archivo actualizado", 'success');
            loadSavedData();
        }
    } catch (err) { notify("JSON inválido", 'error'); }
}

export function toggleTNS() {
    tnsPanel.style.display = (tnsPanel.style.display === "none" || tnsPanel.style.display === "") ? "flex" : "none";
}

document.addEventListener("DOMContentLoaded", () => {
    loadSavedData();
    document.getElementById("testButton").addEventListener("click", testConnection);
    document.getElementById("addTNS").addEventListener("click", toggleTNS);
    document.getElementById("saveTNS").addEventListener("click", saveEditorContent);
    document.getElementById("saveQuickConn").addEventListener("click", quickSaveConnection);
});

