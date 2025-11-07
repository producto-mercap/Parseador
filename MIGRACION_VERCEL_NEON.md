# Guía de Migración: Vercel + Neon

## 📋 Precondiciones y Pasos Previos

Esta guía te ayudará a preparar tu proyecto para migrar de SQLite3 a Neon (PostgreSQL) y desplegarlo en Vercel.

---

## 🔧 Precondiciones

### 1. Cuentas Necesarias
- ✅ Cuenta en [Vercel](https://vercel.com) (gratuita) - **YA LO TIENES** ✓
- ✅ Cuenta en [Neon](https://neon.tech) (gratuita y generosa)
- ✅ Cuenta en [GitHub](https://github.com) - **YA LO TIENES** ✓

### 2. Herramientas Locales
- ✅ Node.js instalado (v16 o superior)
- ✅ Git instalado y configurado

---

## 📝 Paso 1: Crear Proyecto en Neon

### 1.1. Crear cuenta y proyecto
1. Ve a [https://neon.tech](https://neon.tech)
2. Haz clic en **"Sign Up"** o **"Log in"**
3. Inicia sesión con GitHub, Google o email
4. Una vez dentro del dashboard, haz clic en **"Create Project"**
5. Completa el formulario:
   - **Name**: `parseador` (o el nombre que prefieras)
   - **Region**: Elige la más cercana a tus usuarios (recomendado: `us-east-2` o `eu-central-1`)
   - **PostgreSQL version**: Deja la versión por defecto (15 o superior)
   - **Compute size**: Free tier (suficiente para empezar)
6. Haz clic en **"Create Project"**
7. Espera 1-2 minutos mientras se crea el proyecto

### 1.2. Obtener credenciales de conexión (DATABASE_URL)

**⚠️ IMPORTANTE: NO necesitas hacer clic en "Connect Project"** - ese botón es para integraciones automáticas dentro de la plataforma, pero para Vercel solo necesitas la `DATABASE_URL.

1. En el dashboard de Neon, verás la sección **"Quickstart"** (como en la imagen que compartiste)
2. Selecciona la pestaña **".env.local"** (ya debería estar seleccionada)
3. Verás dos variables importantes:
   - `DATABASE_URL`: Esta es la principal que necesitas (recomendada para la mayoría de usos)
   - `DATABASE_URL_UNPOOLED`: Para usos que requieren conexión sin pgbouncer (opcional)

4. Haz clic en **"Show secret"** para revelar la `DATABASE_URL` completa
5. **Copia la `DATABASE_URL`** - se verá así:
   ```
   postgresql://[user]:[password]@[host]/[database]?sslmode=require
   ```
   O más específicamente:
   ```
   postgresql://neondb_owner:[PASSWORD]@ep-xxxxx-xxxxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```

6. **Guarda esta URL de forma segura** - la necesitarás para configurar Vercel

### 1.3. Crear las tablas en Neon

1. En el dashboard de Neon, ve a **"SQL Editor"** en el menú lateral
2. Haz clic en **"New Query"**
3. Copia y pega el siguiente SQL (adaptado de SQLite a PostgreSQL):

```sql
-- Tabla para parseadores simples
CREATE TABLE IF NOT EXISTS parseadores (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    tiene_delimitador BOOLEAN NOT NULL,
    delimitador TEXT,
    cantidad_columnas INTEGER NOT NULL,
    incluye_secciones BOOLEAN NOT NULL,
    esFormatoJson BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla para columnas de parseadores
CREATE TABLE IF NOT EXISTS columnas_parseador (
    id SERIAL PRIMARY KEY,
    parseador_id INTEGER,
    nombre TEXT NOT NULL,
    cantidad_caracteres INTEGER,
    orden INTEGER NOT NULL,
    FOREIGN KEY (parseador_id) REFERENCES parseadores(id) ON DELETE CASCADE
);

-- Tabla para secciones
CREATE TABLE IF NOT EXISTS secciones (
    id SERIAL PRIMARY KEY,
    parseador_id INTEGER,
    nombre TEXT NOT NULL,
    header TEXT NOT NULL,
    tiene_delimitador BOOLEAN NOT NULL,
    delimitador TEXT,
    cantidad_columnas INTEGER NOT NULL,
    orden INTEGER NOT NULL,
    FOREIGN KEY (parseador_id) REFERENCES parseadores(id) ON DELETE CASCADE
);

-- Tabla para columnas de secciones
CREATE TABLE IF NOT EXISTS columnas_seccion (
    id SERIAL PRIMARY KEY,
    seccion_id INTEGER,
    nombre TEXT NOT NULL,
    cantidad_caracteres INTEGER,
    orden INTEGER NOT NULL,
    FOREIGN KEY (seccion_id) REFERENCES secciones(id) ON DELETE CASCADE
);

-- Crear índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_parseador_id ON columnas_parseador(parseador_id);
CREATE INDEX IF NOT EXISTS idx_seccion_parseador_id ON secciones(parseador_id);
CREATE INDEX IF NOT EXISTS idx_seccion_id ON columnas_seccion(seccion_id);
```

4. Haz clic en **"Run"** o presiona `Ctrl+Enter` (o `Cmd+Enter` en Mac) para ejecutar el script
5. Verifica que las tablas se crearon correctamente:
   - Ve a **"Tables"** en el menú lateral
   - Deberías ver las 4 tablas: `parseadores`, `columnas_parseador`, `secciones`, `columnas_seccion`

### 1.4. (Opcional) Migrar datos existentes de SQLite
Si tienes datos en SQLite que quieres migrar:

1. **Exportar datos de SQLite:**
   ```bash
   # Opción 1: Exportar a CSV
   sqlite3 src/database/parseador.db ".mode csv" ".output parseadores.csv" "SELECT * FROM parseadores;"
   
   # Opción 2: Exportar a SQL
   sqlite3 src/database/parseador.db ".dump" > dump.sql
   ```

2. **Importar en Neon:**
   - Usa el **SQL Editor** de Neon para ejecutar INSERT statements
   - O usa el **Table Editor** para importar CSV manualmente

---

## 🚀 Paso 2: Configurar Variables de Entorno en Vercel

Ya que **ya tienes el proyecto desplegado en Vercel**, solo necesitas agregar la variable de entorno:

### 2.1. Agregar DATABASE_URL en Vercel

1. Ve a tu proyecto en [Vercel Dashboard](https://vercel.com/dashboard)
2. Selecciona tu proyecto `parseador`
3. Ve a **Settings** → **Environment Variables**
4. Haz clic en **"Add New"**
5. Agrega la siguiente variable:
   - **Name**: `DATABASE_URL`
   - **Value**: Pega la `DATABASE_URL` que copiaste de Neon (la que empieza con `postgresql://...`)
   - **Environments**: Selecciona todas las opciones:
     - ✅ Production
     - ✅ Preview
     - ✅ Development
6. Haz clic en **"Save"**

### 2.2. (Opcional) Agregar PORT si es necesario
Si tu aplicación usa una variable `PORT`:

1. Agrega otra variable de entorno:
   - **Name**: `PORT`
   - **Value**: `3001` (o el puerto que uses)
   - **Environments**: Todas

### 2.3. Redesplegar la aplicación
**IMPORTANTE**: Después de agregar las variables de entorno, necesitas redesplegar:

1. En Vercel, ve a **Deployments**
2. Haz clic en los **3 puntos** (⋯) del último deployment
3. Selecciona **"Redeploy"**
4. O simplemente haz un nuevo commit y push a GitHub (si tienes auto-deploy activado)

---

## 📦 Paso 3: Preparar el Proyecto Localmente

### 3.1. Instalar dependencias necesarias
Necesitarás instalar el cliente de PostgreSQL para Node.js:

```bash
cd Parseador
npm install pg
```

### 3.2. Crear archivo de configuración de Vercel (si no existe)
Crea o verifica que existe un archivo `vercel.json` en la raíz del proyecto:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "src/app.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "src/app.js"
    }
  ]
}
```

### 3.3. Crear archivo .env local (para desarrollo)
Crea un archivo `.env` en la raíz del proyecto (y agrégalo a `.gitignore` si no está):

```env
DATABASE_URL=postgresql://[user]:[password]@[host]/[database]?sslmode=require
PORT=3001
```

**⚠️ IMPORTANTE**: Reemplaza `[user]`, `[password]`, `[host]`, `[database]` con los valores reales de tu `DATABASE_URL` de Neon.

### 3.4. Verificar .gitignore
Asegúrate de que `.gitignore` incluya:

```
.env
.env.local
node_modules/
src/database/*.db
```

---

## 🔐 Paso 4: Consideraciones Importantes

### 4.1. Ventajas de Neon sobre Supabase
- ✅ **100% gratuito** para proyectos pequeños/medianos
- ✅ **Sin límites de tiempo** en el plan gratuito
- ✅ **Conexión directa a PostgreSQL** (más simple)
- ✅ **Auto-scaling** automático
- ✅ **Branching de bases de datos** (útil para desarrollo)

### 4.2. Limitaciones de Vercel (Serverless Functions)
1. **Tiempo de ejecución**: Máximo 10 segundos en plan gratuito, 60 segundos en Pro
2. **Tamaño de archivos**: Máximo 4.5MB para funciones serverless
3. **Sistema de archivos**: Solo lectura (no puedes escribir archivos locales)
4. **Multer**: Necesitarás ajustar la configuración de multer para usar almacenamiento temporal o procesar en memoria

### 4.3. Conexiones a Neon desde Serverless
Neon está optimizado para serverless y maneja automáticamente:
- **Connection pooling**: Usa `DATABASE_URL` (con pgbouncer) para la mayoría de casos
- **Conexiones directas**: Usa `DATABASE_URL_UNPOOLED` solo si necesitas características específicas de PostgreSQL

---

## ✅ Checklist de Precondiciones

Antes de proceder con la migración del código, verifica:

- [x] Proyecto creado en Vercel - **YA LO TIENES** ✓
- [x] Repositorio Git configurado y conectado a GitHub - **YA LO TIENES** ✓
- [ ] Proyecto creado en Neon
- [ ] Tablas creadas en Neon con el SQL proporcionado
- [ ] `DATABASE_URL` copiada de Neon
- [ ] Variable `DATABASE_URL` configurada en Vercel (Settings → Environment Variables)
- [ ] Aplicación redesplegada en Vercel después de agregar la variable
- [ ] Archivo `vercel.json` creado/verificado
- [ ] Dependencia `pg` instalada (`npm install pg`)
- [ ] Archivo `.env` creado localmente (no commiteado)
- [ ] `.gitignore` actualizado para excluir `.env` y `node_modules`

---

## 🎯 Próximos Pasos (Migración del Código)

Una vez completados estos pasos previos, estarás listo para:

1. **Migrar el código de SQLite a PostgreSQL/Neon** (modificar `database.js` y `ParserDB.js`)
2. **Adaptar las queries SQL** (SQLite → PostgreSQL)
3. **Configurar multer para serverless** (almacenamiento temporal o procesamiento en memoria)
4. **Ajustar `app.js` para serverless functions** (si es necesario)
5. **Probar localmente** con las variables de entorno
6. **Hacer commit y push** para que Vercel redesplegue automáticamente

---

## 📚 Recursos Útiles

- [Documentación de Neon](https://neon.tech/docs)
- [Documentación de Vercel](https://vercel.com/docs)
- [Guía de conexión Neon + Vercel](https://neon.tech/docs/guides/vercel)
- [Cliente pg para Node.js](https://node-postgres.com/)
- [Vercel Serverless Functions](https://vercel.com/docs/functions)

---

## ❓ Preguntas Frecuentes

**P: ¿Necesito hacer clic en "Connect Project" en Neon?**  
R: **NO**. Ese botón es para integraciones automáticas dentro de la plataforma. Para conectar desde Vercel, solo necesitas copiar la `DATABASE_URL` y agregarla como variable de entorno en Vercel.

**P: ¿Puedo usar el plan gratuito de Neon?**  
R: Sí, el plan gratuito de Neon es muy generoso y suficiente para proyectos pequeños/medianos.

**P: ¿Qué pasa con los archivos subidos con multer?**  
R: En serverless, necesitarás procesar los archivos en memoria o usar almacenamiento externo (S3, Cloudinary, etc.).

**P: ¿Puedo migrar mis datos de SQLite a Neon?**  
R: Sí, puedes exportar a CSV/SQL e importar en Neon usando el SQL Editor.

**P: ¿Neon soporta transacciones?**  
R: Sí, Neon es PostgreSQL completo, así que soporta todas las características de PostgreSQL incluyendo transacciones.

**P: ¿Cuál es la diferencia entre DATABASE_URL y DATABASE_URL_UNPOOLED?**  
R: 
- `DATABASE_URL`: Usa pgbouncer (connection pooling) - **recomendada para la mayoría de casos**, especialmente serverless
- `DATABASE_URL_UNPOOLED`: Conexión directa sin pooling - úsala solo si necesitas características específicas que requieren conexión directa

---

## 🚨 Solución de Problemas Comunes

### Error: "Connection refused" o "ECONNREFUSED"
- Verifica que la `DATABASE_URL` esté correctamente configurada en Vercel
- Asegúrate de que la URL incluya `?sslmode=require` al final
- Verifica que el proyecto de Neon esté activo (no en pausa)

### Error: "password authentication failed"
- Verifica que copiaste la `DATABASE_URL` completa desde Neon
- Asegúrate de que no haya espacios extra en la variable de entorno

### Error: "relation does not exist"
- Verifica que ejecutaste el SQL para crear las tablas en Neon
- Revisa que los nombres de las tablas coincidan (case-sensitive en PostgreSQL)

### La aplicación funciona localmente pero no en Vercel
- Verifica que agregaste la variable `DATABASE_URL` en Vercel
- Asegúrate de haber redesplegado después de agregar la variable
- Revisa los logs de Vercel en la sección "Functions" para ver errores específicos

---

¿Listo para continuar con la migración del código? 🚀

