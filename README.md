# 🚀 Oracle DBA Console Lite | Dashboard v1.0

![Astro](https://img.shields.io/badge/Astro-BC52EE?style=for-the-badge&logo=astro&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Oracle](https://img.shields.io/badge/Oracle-F80000?style=for-the-badge&logo=oracle&logoColor=white)


> Una consola de administración moderna y ligera para entornos Oracle RAC/NO-RAC, diseñada para simplificar el diagnostico de bases de datos y la visualización de reportes AWR e información clave de ASH y ADDM. Se despliegua como servidor web en tu infraestructura local y privada

---
## Características Principales
* **Información y recomendación de áreas de memoria a partir de las vistas gv$sga_target_advice y gv$pga_target_advice** 
* **AWR Viewer:**
  Generación, visualización amigable y descarga de reportes de rendimiento AWR.
* **Gestión de sesiones:**
  Identificación y depuración rápida de interbloqueos, sesiones largas, sesiones activas.
* **HUB de rendimiento:**
  Implementa un gráfico en tiempo real para visualizar sesiones agrupadas por eventos de espera. Permite rangos de horas y un modo histórico para seleccionar fechas específicas
* **ASH detallado:**
  Complementa el grafico principal ofreciendo un detalle de tiempo de ejecución de sesiones, sql_id, firmas, sql_text y evento
* **Alert log:**
  Muestra un reporte de los ultimos 10 días de errores en el alertlog
* **Reporte de ultimos backups:**
  Facilita información de los ultimos 15 dias de backups tomados a nivel de RMAN
---

## Screenshots
<img width="1366" height="699" alt="image" src="https://github.com/user-attachments/assets/853ba580-ebb1-43c0-a439-6bff3c6cb65d" />
<img width="1364" height="687" alt="image" src="https://github.com/user-attachments/assets/3070a57a-97d1-47e7-8873-8c903f26efda" />
<img width="1366" height="586" alt="image" src="https://github.com/user-attachments/assets/1f3ce854-a684-4471-8c09-6037d97fc0fe" />
<img width="1154" height="400" alt="image" src="https://github.com/user-attachments/assets/898239e1-e322-4eb7-80ac-d69634c5a6b5" />
<img width="1134" height="222" alt="image" src="https://github.com/user-attachments/assets/ac065756-7b71-4a16-ba7a-77e7455fbc93" />
<img width="1363" height="515" alt="image" src="https://github.com/user-attachments/assets/55a582b0-d585-48c7-979a-ced22f14a908" />
<img width="1363" height="515" alt="image" src="https://github.com/user-attachments/assets/e7d7848e-bcda-4cf9-9311-c0ac1a691149" />
<img width="1355" height="359" alt="image" src="https://github.com/user-attachments/assets/05752c10-ccf3-4f74-8e85-ab54c26da87e" />




---

## Instalación y uso

1. **Instala y comprueba que tienes Node.js**
   ```bash
   node --version
3. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/JorgeEnBric/Oracle_Dashboard_DB_Lite.git consolelite
   cd consolelite
   npm install
   npm run build
   npm start
