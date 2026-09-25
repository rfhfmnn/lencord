import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from generate_manuals import COMMON_CSS, generate_pdf, MANUALS_DIR

def build_technical_manual():
    html = f"""<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Manual técnico - Plataforma Lencord</title>
    <style>
        {COMMON_CSS}
    </style>
</head>
<body>

    <!-- PORTADA -->
    <div class="cover">
        <div class="cover-top">
            <div class="cover-brand">LEN<span>CORD</span></div>
            <div class="cover-badge">Documentación de ingeniería y operaciones</div>
            <h1>Manual técnico de puesta en marcha y apagado</h1>
            <div class="cover-subtitle">
                Guía completa de instalación, ejecución en entornos de desarrollo y producción, gestión de puertos y detención segura de procesos.
            </div>
        </div>
        <div class="cover-footer">
            <div><strong>Plataforma:</strong> Lencord SAS | Next.js 16 • React 19 • TypeScript</div>
            <div><strong>Versión:</strong> 1.0.0 | Entorno: Standalone / Hybrid</div>
        </div>
    </div>

    <!-- CONTENIDO -->
    <div class="page">
        <div class="header-bar">
            <div class="header-brand">LEN<span>CORD</span></div>
            <div class="header-doc-title">Manual técnico • Operación y despliegue</div>
        </div>

        <h2>1. Introducción y arquitectura del sistema</h2>
        <p>
            <strong>Lencord</strong> es una plataforma tecnológica de financiamiento colectivo peer-to-peer (P2P) orientada al ecosistema de pequeñas y medianas empresas (PyMEs) de la República Argentina. Permite vincular solicitudes crediticias corporativas con inversores particulares e institucionales mediante subastas de fondeo bajo la modalidad «todo o nada», instrumentadas jurídicamente mediante pagarés digitales y contratos de mutuo electrónico.
        </p>

        <h3>1.1. Stack tecnológico</h3>
        <p>El núcleo de la aplicación fue desarrollado bajo los estándares más modernos del ecosistema web:</p>
        <ul>
            <li><strong>Framework principal:</strong> Next.js 16 (arquitectura App Router con Server Components y Server Actions).</li>
            <li><strong>Librería de interfaz:</strong> React 19 con componentes fuertemente tipados.</li>
            <li><strong>Lenguaje:</strong> TypeScript 5 configurado en modo estricto (<code>strict: true</code>).</li>
            <li><strong>Motor de pruebas:</strong> Vitest 5 integrado con Testing Library y Happy-DOM para tests unitarios y de integración.</li>
            <li><strong>Estilizado y diseño:</strong> Vanilla CSS Modules con variables semánticas centralizadas y soporte de diseño responsivo.</li>
            <li><strong>Capa de persistencia y autenticación:</strong> Supabase SSR (PostgreSQL) con patrón adaptador de <em>Mock Services</em> en memoria para entornos desacoplados.</li>
        </ul>

        <h3>1.2. Patrón de servicios híbrido (Service Provider Pattern)</h3>
        <p>
            La plataforma cuenta con un sistema de inyección de dependencias (<code>ServiceProvider</code>) que permite operar al 100% de manera autónoma sin bases de datos externas activas utilizando servicios mock en memoria precargados con datos semilla del mercado argentino (<code>NEXT_PUBLIC_USE_MOCKS=true</code>), o conectarse a una instancia real de PostgreSQL / Supabase (<code>NEXT_PUBLIC_USE_MOCKS=false</code>).
        </p>

        <div class="alert-box alert-info">
            <strong>Modo por defecto:</strong> El sistema está configurado para operar de forma inmediata en modo Mock sin requerir configuración previa de bases de datos externas, permitiendo simular solicitudes de PyMEs, scoring BCRA, posturas de inversores y firmas de pagarés electrónicos.
        </div>

        <h2>2. Requisitos previos del sistema</h2>
        <p>Antes de levantar la aplicación, asegúrese de contar con las siguientes herramientas instaladas en su equipo host:</p>
        
        <div class="table-responsive">
            <table>
                <thead>
                    <tr>
                        <th>Componente</th>
                        <th>Versión requerida</th>
                        <th>Verificación en terminal</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td><strong>Node.js</strong></td>
                        <td>v20.x o superior (Probado en v24.x LTS)</td>
                        <td><code>node -v</code></td>
                    </tr>
                    <tr>
                        <td><strong>Gestor de paquetes npm</strong></td>
                        <td>v10.x o superior (incluido con Node.js)</td>
                        <td><code>npm -v</code></td>
                    </tr>
                    <tr>
                        <td><strong>Sistema operativo</strong></td>
                        <td>Windows 10/11, Linux (Ubuntu/Debian) o macOS</td>
                        <td>Terminal PowerShell, Bash o Zsh</td>
                    </tr>
                    <tr>
                        <td><strong>Navegador web</strong></td>
                        <td>Edge, Chrome, Firefox o Safari actualizados</td>
                        <td>Resolución estándar de escritorio y móvil</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div class="page-break"></div>
        <div class="header-bar">
            <div class="header-brand">LEN<span>CORD</span></div>
            <div class="header-doc-title">Manual técnico • Puesta en marcha</div>
        </div>

        <h2>3. Cómo hacer andar la página (puesta en marcha)</h2>
        <p>
            Para poner en funcionamiento el servidor local y acceder a la plataforma, siga minuciosamente los siguientes pasos desde la terminal de comandos de su sistema operativo:
        </p>

        <h3>Paso 3.1: Ubicación en el directorio del proyecto</h3>
        <p>Abra una consola de comandos (PowerShell o CMD en Windows, Terminal en Linux/macOS) y navegue a la carpeta raíz del proyecto:</p>
        <pre><code>cd c:\\Users\\SYC\\Desktop\\lencord</code></pre>

        <h3>Paso 3.2: Instalación de dependencias</h3>
        <p>
            Si es la primera vez que ejecuta el proyecto o se han clonado cambios recientes, instale los paquetes de Node definidos en <code>package.json</code>:
        </p>
        <pre><code>npm install</code></pre>
        <div class="alert-box alert-warning">
            <strong>Regla de oro de dependencias:</strong> No instale paquetes adicionales mediante <code>npm i &lt;libreria&gt;</code> sin previa autorización técnica del equipo de arquitectura, ya que el proyecto mantiene un control estricto de dependencias en <code>package.json</code>.
        </div>

        <h3>Paso 3.3: Ejecución en modo desarrollo (recomendado)</h3>
        <p>
            El modo desarrollo activa el compilador incremental con recarga rápida en caliente (Hot Module Replacement / Fast Refresh). Ejecute el siguiente comando:
        </p>
        <pre><code>npm run dev</code></pre>

        <p>Al iniciar, observará un mensaje similar al siguiente en la terminal:</p>
        <pre><code>  ▲ Next.js 16.3.6
  - Local:        http://localhost:3000
  - Environments: .env.local

 ✓ Starting...
 ✓ Ready in 1200ms</code></pre>

        <p>
            Abra su navegador web e ingrese a la siguiente dirección URL:
        </p>
        <pre><code>http://localhost:3000</code></pre>

        <div class="alert-box alert-success">
            <strong>Plataforma operativa:</strong> Ya puede navegar libremente por la landing page, simular créditos, cargar solicitudes en <code>/solicitar</code>, explorar oportunidades en <code>/marketplace</code>, gestionar inversiones en <code>/dashboard</code> y acceder al backoffice en <code>/admin</code>.
        </div>

        <h3>Paso 3.4: Ejecución en puerto alternativo (si el puerto 3000 está ocupado)</h3>
        <p>
            Si el puerto estándar <code>3000</code> estuviera siendo utilizado por otra aplicación, Next.js intentará automáticamente saltar al <code>3001</code>. También puede forzar un puerto específico ejecutando:
        </p>
        <pre><code>npx next dev -p 3005</code></pre>

        <h3>Paso 3.5: Compilación y ejecución en modo producción</h3>
        <p>
            Para verificar el rendimiento real de producción o validar que el código no presente errores de tipado o empaquetado, ejecute:
        </p>
        <div class="step-item">
            <div class="step-num">1</div>
            <div class="step-text"><strong>Compilar el bundle optimizado:</strong><br>
                <pre><code>npm run build</code></pre>
                Este paso genera los artefactos en la carpeta <code>.next/</code> e inspecciona los tipos TypeScript.
            </div>
        </div>
        <div class="step-item">
            <div class="step-num">2</div>
            <div class="step-text"><strong>Iniciar el servidor productivo de alto rendimiento:</strong><br>
                <pre><code>npm run start</code></pre>
            </div>
        </div>

        <h3>Paso 3.6: Verificación de la suite de pruebas automatizadas</h3>
        <p>Para comprobar la integridad de todos los módulos y componentes del sistema antes de operar:</p>
        <pre><code>npm run test</code></pre>
        <p>Para ejecutar una prueba específica de un componente (ej. Pagaré digital):</p>
        <pre><code>npx vitest run tests/components/PromissoryNoteModal.test.tsx</code></pre>

        <div class="page-break"></div>
        <div class="header-bar">
            <div class="header-brand">LEN<span>CORD</span></div>
            <div class="header-doc-title">Manual técnico • Apagado y detención</div>
        </div>

        <h2>4. Cómo apagar y detener la página</h2>
        <p>
            El apagado de la plataforma debe realizarse de forma ordenada para liberar los puertos de red y asegurar que no queden procesos residuales en memoria consumiendo recursos del procesador.
        </p>

        <h3>4.1. Método estándar interactivo (recomendado)</h3>
        <p>
            Si tiene la terminal abierta donde se inició el comando <code>npm run dev</code> o <code>npm run start</code>:
        </p>
        <div class="step-item">
            <div class="step-num">1</div>
            <div class="step-text">Haga clic sobre la ventana de la terminal activa.</div>
        </div>
        <div class="step-item">
            <div class="step-num">2</div>
            <div class="step-text">Presione la combinación de teclas: <code>Ctrl + C</code> (o <code>Cmd + C</code> en macOS).</div>
        </div>
        <div class="step-item">
            <div class="step-num">3</div>
            <div class="step-text">
                Si la consola de Windows consulta: <code>¿Desea terminar el trabajo por lotes (S/N)?</code>, escriba <strong>S</strong> y presione <strong>Enter</strong>.
            </div>
        </div>
        <p>El proceso de Node.js finalizará de inmediato y el puerto <code>3000</code> quedará liberado.</p>

        <h3>4.2. Método forzado o proceso en segundo plano (Windows PowerShell)</h3>
        <p>
            Si la terminal fue cerrada de forma abrupta o el servidor continúa corriendo en segundo plano impidiendo volver a levantarlo, utilice los siguientes comandos:
        </p>

        <h4>Opción A: Identificar PID y terminar proceso</h4>
        <p>1. Busque qué identificador de proceso (PID) está ocupando el puerto 3000:</p>
        <pre><code>netstat -ano | findstr :3000</code></pre>
        <p>Observará una línea como la siguiente (el último número de la derecha es el PID, por ejemplo <code>14520</code>):</p>
        <pre><code>TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       14520</code></pre>
        <p>2. Termine de forma forzada el proceso indicando dicho número:</p>
        <pre><code>taskkill /PID 14520 /F</code></pre>

        <h4>Opción B: Detención automática en una sola línea (PowerShell)</h4>
        <p>Ejecute directamente el siguiente comando en PowerShell para liberar el puerto 3000 sin buscar el PID manualmente:</p>
        <pre><code>Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess -ErrorAction SilentlyContinue | Stop-Process -Force</code></pre>

        <h3>4.3. Método en entornos Linux / macOS</h3>
        <p>En sistemas operativos basados en Unix, ejecute:</p>
        <pre><code># Buscar y matar el proceso en el puerto 3000
lsof -ti :3000 | xargs kill -9</code></pre>

        <h2>5. Configuración de variables de entorno</h2>
        <p>
            El comportamiento del backend se configura a través del archivo <code>.env.local</code> ubicado en la raíz del proyecto.
        </p>

        <div class="table-responsive">
            <table>
                <thead>
                    <tr>
                        <th>Variable</th>
                        <th>Valores posibles</th>
                        <th>Descripción y propósito</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td><code>NEXT_PUBLIC_USE_MOCKS</code></td>
                        <td><code>true</code> / <code>false</code></td>
                        <td>Si es <code>true</code>, activa el almacenamiento en memoria con datos semilla. Si es <code>false</code>, requiere Supabase.</td>
                    </tr>
                    <tr>
                        <td><code>NEXT_PUBLIC_SUPABASE_URL</code></td>
                        <td><code>https://xyz.supabase.co</code></td>
                        <td>URL del proyecto Supabase en la nube o local (requerido si USE_MOCKS=false).</td>
                    </tr>
                    <tr>
                        <td><code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code></td>
                        <td>Cadena JWT pública</td>
                        <td>Clave anónima para consultas del cliente web bajo políticas Row Level Security (RLS).</td>
                    </tr>
                    <tr>
                        <td><code>SUPABASE_SERVICE_ROLE_KEY</code></td>
                        <td>Cadena JWT privada</td>
                        <td>Clave administrativa restringida para Server Actions, Cron Jobs y Webhooks.</td>
                    </tr>
                    <tr>
                        <td><code>PAYMENT_PROVIDER</code></td>
                        <td><code>mock</code>, <code>bind</code>, <code>pomelo</code></td>
                        <td>Adaptador de pagos activo para retención, desembolsos y cobros automáticos.</td>
                    </tr>
                    <tr>
                        <td><code>CRON_SECRET</code></td>
                        <td>Clave alfanumérica</td>
                        <td>Token secreto de autorización para invocar el endpoint <code>/api/cron/check-deadlines</code>.</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <h2>6. Resolución de problemas frecuentes (troubleshooting)</h2>
        <div class="card-grid">
            <div class="card">
                <h4>Error: EADDRINUSE :::3000</h4>
                <p><strong>Causa:</strong> Otra instancia previa de Node sigue escuchando en el puerto 3000.</p>
                <p><strong>Solución:</strong> Ejecute el comando de detención forzada de la sección 4.2 o inicie con <code>npx next dev -p 3001</code>.</p>
            </div>
            <div class="card">
                <h4>Caché corrupta o desincronizada</h4>
                <p><strong>Causa:</strong> Inconsistencias en el directorio temporal <code>.next</code> tras cambios de ramas.</p>
                <p><strong>Solución:</strong> Borre la carpeta de compilación: <code>Remove-Item -Recurse -Force .next</code> y vuelva a levantar.</p>
            </div>
        </div>
    </div>
</body>
</html>
"""
    pdf_path = os.path.join(MANUALS_DIR, "Manual_Tecnico_Lencord.pdf")
    generate_pdf(html, pdf_path)

if __name__ == "__main__":
    build_technical_manual()
