# Documentación Técnica y Funcional - Parseador

## Descripción General

Sistema web para crear y gestionar parseadores configurables que permiten procesar archivos de texto plano (con delimitadores o posición fija), archivos con secciones múltiples, y archivos JSON. El sistema permite:

- **Crear Parseadores**: Definir configuraciones de parseo personalizadas
- **Parsear Archivos**: Procesar archivos de texto o JSON según la configuración del parseador
- **Parseo Manual**: Pegar contenido directamente para parsear
- **Exportar Resultados**: Exportar datos parseados a Excel (XLSX)
- **Gestión de Parseadores**: Crear, editar y eliminar parseadores

## Arquitectura

### Stack Tecnológico

- **Backend**: Node.js + Express.js
- **Base de Datos**: PostgreSQL (Neon)
- **Templates**: EJS
- **Estilos**: Tailwind CSS + CSS personalizado (estilo Google/Mercap)
- **Frontend Framework**: Alpine.js
- **Librerías**:
  - `xlsx`: Para exportar a Excel
  - `multer`: Para manejo de archivos
  - `csv-parser`: (instalado pero no usado activamente)
- **Hosting**: Vercel (Serverless)

### Estructura del Proyecto

```
Parseador/
├── src/
│   ├── app.js                    # Entrada principal de la aplicación
│   ├── config/
│   │   └── database.js          # Configuración del pool de PostgreSQL (con inicialización de tablas)
│   ├── controllers/
│   │   └── parserController.js  # Lógica de negocio de parseadores
│   ├── models/
│   │   ├── database.js          # Pool de PostgreSQL y inicialización
│   │   ├── Parser.js            # Clase Parser (lógica de parseo)
│   │   └── ParserDB.js          # Modelo de base de datos para parseadores
│   ├── routes/
│   │   └── parserRoutes.js      # Rutas de la API
│   ├── migrations/
│   │   ├── 001_add_json_format.js  # Migración: agregar esFormatoJson
│   │   ├── 002_add_json_config.js  # Migración: agregar config_json
│   │   ├── inspect_table.js
│   │   └── run-migrations.js
│   ├── public/
│   │   ├── css/
│   │   │   ├── styles.css
│   │   │   ├── components.css
│   │   │   ├── forms.css
│   │   │   └── table.css
│   │   ├── js/
│   │   │   ├── main.js           # Lógica principal (Alpine.js)
│   │   │   ├── parseador-app.js  # Componente Alpine.js principal
│   │   │   ├── parsing-logic.js  # Lógica de parseo
│   │   │   ├── file-handling.js  # Manejo de archivos y exportación
│   │   │   ├── parser-management.js  # Gestión de parseadores
│   │   │   ├── table.js          # Renderizado de tablas
│   │   │   ├── table-utils.js    # Utilidades de tablas
│   │   │   ├── ui-state.js       # Estado de UI
│   │   │   └── scroll-utils.js   # Utilidades de scroll
│   │   └── images/
│   └── views/
│       ├── index.ejs             # Vista principal
│       ├── layouts/
│       │   └── main.ejs
│       └── partials/
│           ├── header.ejs
│           ├── sidebar.ejs
│           ├── main-content.ejs
│           ├── table.ejs
│           ├── new-parser-modal.ejs
│           └── edit-parser-modal.ejs
├── vercel.json
├── package.json
└── .gitignore
```

---

## Base de Datos

### Estructura de Tablas

#### Tabla: `parseadores`

**Campos**:
- `id` (SERIAL): Identificador único (clave primaria)
- `nombre` (TEXT): Nombre del parseador
- `tiene_delimitador` (BOOLEAN): Si usa delimitador o posición fija
- `delimitador` (TEXT): Carácter delimitador (ej: `;`, `,`, `|`) - null si es posición fija
- `cantidad_columnas` (INTEGER): Cantidad de columnas
- `incluye_secciones` (BOOLEAN): Si el parseador maneja múltiples secciones
- `esFormatoJson` (BOOLEAN): Si el parseador procesa archivos JSON (default: false)
- `config_json` (JSONB): Configuración para parseo JSON (default: `{}`)
  - `separador`: Separador para claves anidadas (`'.'` o `'_'`)
  - `arrayPrimitivos`: Manejo de arrays de primitivos (`'expandir'` o `'serializar'`)
  - `arrayObjetos`: Manejo de arrays de objetos (`'normalizar'` o `'aplanar'`)
- `created_at` (TIMESTAMP): Fecha de creación

**Índices**:
- `idx_parseador_id` en `columnas_parseador(parseador_id)`

#### Tabla: `columnas_parseador`

**Campos**:
- `id` (SERIAL): Identificador único (clave primaria)
- `parseador_id` (INTEGER): FK a `parseadores.id` (ON DELETE CASCADE)
- `nombre` (TEXT): Nombre de la columna
- `cantidad_caracteres` (INTEGER): Cantidad de caracteres (solo para posición fija, null si tiene delimitador)
- `orden` (INTEGER): Orden de la columna

**Índices**:
- `idx_parseador_id` en `parseador_id`

#### Tabla: `secciones`

**Campos**:
- `id` (SERIAL): Identificador único (clave primaria)
- `parseador_id` (INTEGER): FK a `parseadores.id` (ON DELETE CASCADE)
- `nombre` (TEXT): Nombre de la sección
- `header` (TEXT): Header de 2 caracteres que identifica la sección (ej: `"01"`, `"02"`)
- `tiene_delimitador` (BOOLEAN): Si la sección usa delimitador
- `delimitador` (TEXT): Carácter delimitador de la sección
- `cantidad_columnas` (INTEGER): Cantidad de columnas de la sección
- `orden` (INTEGER): Orden de la sección

**Índices**:
- `idx_seccion_parseador_id` en `parseador_id`

#### Tabla: `columnas_seccion`

**Campos**:
- `id` (SERIAL): Identificador único (clave primaria)
- `seccion_id` (INTEGER): FK a `secciones.id` (ON DELETE CASCADE)
- `nombre` (TEXT): Nombre de la columna
- `cantidad_caracteres` (INTEGER): Cantidad de caracteres (solo para posición fija)
- `orden` (INTEGER): Orden de la columna dentro de la sección

**Índices**:
- `idx_seccion_id` en `seccion_id`

### Inicialización de Base de Datos

La base de datos se inicializa automáticamente en desarrollo (`database.js`):
- Crea las tablas si no existen
- Crea índices para optimizar consultas
- Solo se ejecuta si `NODE_ENV !== 'production'` (en Vercel las tablas deben existir)

---

## Modelos de Datos

### ParserDB

**Funciones Principales**:

- `create(parserData)`: Crea un nuevo parseador en la BD
  - Inserta parseador principal
  - Si no incluye secciones: inserta columnas en `columnas_parseador`
  - Si incluye secciones: inserta secciones y sus columnas
  - Usa transacciones para garantizar consistencia

- `getAll()`: Obtiene todos los parseadores con sus columnas/secciones
  - Carga columnas o secciones según corresponda
  - Orden: `nombre ASC`

- `getById(id)`: Obtiene un parseador completo por ID
  - Carga columnas o secciones según corresponda
  - Convierte nombres de columnas de snake_case a camelCase

- `update(id, parserData)`: Actualiza un parseador
  - Actualiza parseador principal
  - Elimina y recrea columnas/secciones (bulk insert para optimización)
  - Usa transacciones

- `delete(id)`: Elimina un parseador y todos sus datos relacionados
  - Elimina en orden: columnas_seccion → secciones → columnas_parseador → parseador
  - Usa transacciones

- `getColumnasByParserId(parserId)`: Obtiene columnas de un parseador simple
- `getSeccionesByParserId(parserId)`: Obtiene secciones con sus columnas
- `getColumnasBySeccionId(seccionId)`: Obtiene columnas de una sección

### Parser

**Clase para procesar contenido según configuración del parseador**

**Propiedades**:
- `id`: ID del parseador
- `nombre`: Nombre del parseador
- `tieneDelimitador`: Si usa delimitador
- `delimitador`: Carácter delimitador
- `cantidadColumnas`: Cantidad de columnas
- `incluyeSecciones`: Si maneja secciones
- `esFormatoJson`: Si procesa JSON
- `configJson`: Configuración JSON (`{separador, arrayPrimitivos, arrayObjetos}`)
- `columnas`: Array de columnas (si no incluye secciones)
- `secciones`: Array de secciones (si incluye secciones)

**Métodos Principales**:

- `parse(input)`: Parsea contenido (archivo o texto)
  - Determina si es JSON o texto plano
  - Llama a `procesarJson()` o `procesarLineasSimple()`/`procesarLineasConSecciones()`

- `parseManual(text)`: Parsea texto manual (similar a `parse()` pero retorna estructura específica)
  - Retorna `{data, columnas}` para parseadores simples
  - Retorna `{porSeccion: true, secciones: {...}}` para parseadores con secciones

- `procesarLineasSimple(lineas)`: Procesa líneas sin secciones
  - Si tiene delimitador: divide por delimitador y asigna a columnas
  - Si no tiene delimitador: extrae por posición fija (substring según `cantidad_caracteres`)
  - Usa IDs únicos de columnas para evitar sobrescritura con nombres duplicados

- `procesarLineasConSecciones(lineas)`: Procesa líneas con secciones
  - Identifica secciones por header (primeros 2 caracteres)
  - Agrupa líneas por sección
  - Procesa cada sección según su configuración (delimitador o posición fija)

- `procesarJson(contenido)`: Procesa archivos JSON
  - **Aplanamiento**: Convierte objetos anidados en objetos planos usando separador (`.` o `_`)
  - **Arrays de Primitivos**:
    - `expandir`: Crea columnas `campo_0`, `campo_1`, etc.
    - `serializar`: Serializa el array completo como JSON string
  - **Arrays de Objetos**:
    - `normalizar`: Genera múltiples filas (una por objeto en el array)
    - `aplanar`: Aplana cada objeto con índices (`campo_0_prop`, `campo_1_prop`)
  - **Normalización**: Asegura que todas las filas tengan las mismas columnas (rellena con `null`)

---

## API Endpoints

### Endpoints de Parseadores

**GET `/`**
- Retorna: Vista principal con lista de parseadores
- Renderiza: `index.ejs` con `parsers` y `data` vacío

**POST `/parser`**
- Body: `{ nombre, tieneDelimitador, delimitador?, cantidadColumnas, incluyeSecciones, columnas?, secciones?, esFormatoJson?, configJson? }`
- Validaciones:
  - `nombre` es requerido
  - Si no incluye secciones: debe tener al menos una columna
  - Si incluye secciones: debe tener al menos una sección
  - Columnas sin delimitador deben tener `caracteres`
- Retorna: `{ success: true, parser: {...} }`
- Crea parseador en BD usando transacciones

**GET `/parser/:id`**
- Params: `id` (SERIAL)
- Retorna: `{ success: true, parser: {...} }`
- Incluye columnas o secciones según corresponda

**PUT `/parser/:id`**
- Params: `id` (SERIAL)
- Body: Mismos campos que `POST /parser`
- Actualiza parseador y recrea columnas/secciones
- Retorna: `{ success: true }`

**DELETE `/parser/:id`**
- Params: `id` (SERIAL)
- Elimina parseador y todos sus datos relacionados (CASCADE)
- Retorna: `{ success: true, message: "..." }`

**GET `/debug/parsers`**
- Retorna: Lista completa de parseadores (para debugging)
- Formato: `{ success: true, count: N, parsers: [...] }`

### Endpoints de Parseo

**POST `/parse`**
- Content-Type: `multipart/form-data`
- Body: `file` (archivo de texto), `parserId` (ID del parseador)
- Validaciones:
  - Archivo máximo: 50MB
  - Parseador debe existir
- Proceso:
  1. Lee archivo como texto UTF-8
  2. Crea instancia de `Parser` con datos de BD
  3. Parsea contenido usando `parser.parse()`
  4. Retorna datos parseados
- Retorna: `{ success: true, data: [...] }`
- **Nota**: Actualmente hay un error en el código: se llama a `parseContent()` que no existe. Debería usar `parser.parse()` directamente.

**POST `/parse/manual`**
- Body: `{ parserId, text }`
- Validaciones:
  - `parserId` y `text` son requeridos
  - Parseador debe existir
- Proceso:
  1. Obtiene parseador de BD
  2. Crea instancia de `Parser`
  3. Parsea texto usando `parser.parseManual()`
- Retorna:
  - Si tiene secciones: `{ success: true, porSeccion: true, secciones: {...} }`
  - Si no tiene secciones: `{ success: true, data: [...], columns: [...] }`

---

## Construcción de Vistas

### Vista Principal (`index.ejs`)

**Estructura**:
- Sidebar con lista de parseadores (Alpine.js)
- Área principal con:
  - Selector de parseador
  - Botones: Examinar, Limpiar, Exportar, Parsear
  - Textarea para entrada manual
  - Tabla de resultados (dinámica)

**Funcionalidades**:
- **Crear Parseador**: Modal con formulario
  - Campos: nombre, tipo (delimitador/posición fija), columnas/secciones
  - Validación en frontend y backend
- **Editar Parseador**: Modal similar con datos precargados
- **Eliminar Parseador**: Con confirmación
- **Seleccionar Parseador**: Carga configuración en sidebar
- **Subir Archivo**: Input file que carga contenido en textarea
- **Parsear**: Envía contenido a `/parse/manual`
- **Exportar**: Genera archivo XLSX usando `xlsx` library

**Campos del Formulario de Parseador**:

**Parseador Simple**:
- `nombre`: Nombre del parseador
- `tieneDelimitador`: Checkbox (delimitador vs posición fija)
- `delimitador`: Input (si tiene delimitador)
- `cantidadColumnas`: Número de columnas
- Para cada columna:
  - `nombre`: Nombre de la columna
  - `caracteres`: Cantidad de caracteres (solo si no tiene delimitador)

**Parseador con Secciones**:
- `nombre`: Nombre del parseador
- `incluyeSecciones`: Checkbox
- `cantidadSecciones`: Número de secciones
- Para cada sección:
  - `nombre`: Nombre de la sección
  - `header`: Header de 2 caracteres
  - `tieneDelimitador`: Checkbox
  - `delimitador`: Input
  - `cantidadColumnas`: Número de columnas
  - Para cada columna de la sección:
    - `nombre`: Nombre de la columna
    - `caracteres`: Cantidad de caracteres (solo si no tiene delimitador)

**Parseador JSON**:
- `nombre`: Nombre del parseador
- `esFormatoJson`: Checkbox
- `configJson`:
  - `separador`: Select (`'.'` o `'_'`)
  - `arrayPrimitivos`: Select (`'expandir'` o `'serializar'`)
  - `arrayObjetos`: Select (`'normalizar'` o `'aplanar'`)

### Vista de Tabla (`table.ejs`)

**Estructura Dinámica**:
- Si hay secciones: Muestra pestañas (tabs) por sección
- Si no hay secciones: Muestra tabla única
- Columnas ordenables (click en header)
- Datos editables (doble click en celda)
- Scroll horizontal y vertical
- Drag & drop para reordenar columnas (si está implementado)

**Funcionalidades**:
- Ordenamiento por columna (asc/desc)
- Edición inline de celdas
- Exportación a Excel (mantiene estructura de secciones)

---

## Lógica de Negocio

### Tipos de Parseadores

#### 1. Parseador con Delimitador

**Configuración**:
- `tieneDelimitador: true`
- `delimitador`: Carácter separador (ej: `;`, `,`, `|`)

**Proceso**:
1. Divide cada línea por el delimitador
2. Asigna valores a columnas según posición
3. Aplica `trim()` a cada valor

**Ejemplo**:
```
Línea: "Juan;Pérez;30"
Delimitador: ";"
Resultado: {nombre: "Juan", apellido: "Pérez", edad: "30"}
```

#### 2. Parseador de Posición Fija

**Configuración**:
- `tieneDelimitador: false`
- Cada columna tiene `cantidad_caracteres`

**Proceso**:
1. Lee cada línea sin hacer `trim()` (los espacios son parte de los datos)
2. Extrae substrings según posición y longitud
3. No elimina líneas vacías (solo las completamente vacías)

**Ejemplo**:
```
Línea: "Juan    Pérez    30"
Columnas: nombre (0-10), apellido (10-20), edad (20-22)
Resultado: {nombre: "Juan    ", apellido: "Pérez    ", edad: "30"}
```

#### 3. Parseador con Secciones

**Configuración**:
- `incluyeSecciones: true`
- Cada sección tiene:
  - `header`: Primeros 2 caracteres que identifican la sección
  - `tieneDelimitador`: Configuración propia
  - `delimitador`: Configuración propia
  - `columnas`: Columnas propias

**Proceso**:
1. Identifica secciones por header (primeros 2 caracteres)
2. Agrupa líneas por sección
3. Procesa cada sección según su configuración
4. Retorna datos agrupados por sección

**Ejemplo**:
```
01;Cliente;Juan;Pérez
01;Cliente;María;García
02;Producto;Laptop;1000
02;Producto;Mouse;50
```
Secciones: `01` (Clientes), `02` (Productos)

#### 4. Parseador JSON

**Configuración**:
- `esFormatoJson: true`
- `configJson`:
  - `separador`: `'.'` o `'_'` para claves anidadas
  - `arrayPrimitivos`: `'expandir'` o `'serializar'`
  - `arrayObjetos`: `'normalizar'` o `'aplanar'`

**Proceso de Aplanamiento**:
- Objetos anidados se convierten en claves planas: `usuario.nombre` → `usuario.nombre`
- Arrays de primitivos:
  - `expandir`: `tags: ["a", "b"]` → `tags_0: "a", tags_1: "b"`
  - `serializar`: `tags: ["a", "b"]` → `tags: '["a","b"]'`
- Arrays de objetos:
  - `normalizar`: Genera múltiples filas (una por objeto)
  - `aplanar`: Aplana cada objeto con índice: `items_0_prop`, `items_1_prop`

**Ejemplo Normalización**:
```json
{
  "id": 1,
  "nombre": "Juan",
  "items": [
    {"producto": "Laptop", "precio": 1000},
    {"producto": "Mouse", "precio": 50}
  ]
}
```
Con `arrayObjetos: 'normalizar'`:
```
Fila 1: {id: 1, nombre: "Juan", items_producto: "Laptop", items_precio: 1000, items_index: 0}
Fila 2: {id: 1, nombre: "Juan", items_producto: "Mouse", items_precio: 50, items_index: 1}
```

### Manejo de Nombres de Columnas Duplicados

**Problema**: Si hay columnas con el mismo nombre, se sobrescriben en el objeto resultado.

**Solución**: Se usan claves únicas basadas en ID de columna:
- Clave única: `col_{id}` o `col_{index}` si no hay ID
- Clave por nombre: Se mantiene para compatibilidad (puede sobrescribirse)

**Ejemplo**:
```
Columnas: [{id: 1, nombre: "campo"}, {id: 2, nombre: "campo"}]
Resultado: {
  col_1: "valor1",  // Clave única
  col_2: "valor2",  // Clave única
  campo: "valor2"   // Último valor (sobrescrito)
}
```

### Exportación a Excel

**Proceso**:
1. Si hay secciones: Crea una hoja por sección
2. Si no hay secciones: Crea una hoja "Datos"
3. Usa `xlsx` library para generar archivo
4. Intenta usar File System Access API (si está disponible)
5. Fallback: Descarga automática

**Formato**:
- Headers en primera fila
- Datos en filas siguientes
- Nombres de hojas sanitizados (máx 31 caracteres, sin caracteres especiales)

---

## Variables de Entorno

```env
# Base de Datos
DATABASE_URL=postgresql://user:password@host.neon.tech/database?sslmode=require

# Servidor
PORT=3001
NODE_ENV=development|production
```

---

## Deployment en Vercel

### Configuración (`vercel.json`)

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
  ],
  "env": {
    "NODE_ENV": "production"
  }
}
```

### Variables de Entorno en Vercel

Configurar en el dashboard de Vercel:
- `DATABASE_URL`: URL completa de conexión a Neon
- `NODE_ENV`: `production`

### Migraciones

**Ejecutar migraciones antes del deploy**:
1. `001_add_json_format.js`: Agrega columna `esFormatoJson`
2. `002_add_json_config.js`: Agrega columna `config_json` (JSONB)

**Ejecutar desde línea de comandos**:
```bash
node src/migrations/002_add_json_config.js
```

---

## Flujos Principales

### Flujo de Creación de Parseador

1. Usuario hace clic en "Nuevo Parseador"
2. Completa formulario:
   - Nombre del parseador
   - Tipo (delimitador/posición fija/secciones/JSON)
   - Configuración de columnas o secciones
3. Al guardar:
   - Validación en frontend y backend
   - Se crea registro en `parseadores`
   - Se crean registros en `columnas_parseador` o `secciones` + `columnas_seccion`
   - Transacción garantiza consistencia
4. Se recarga la página para mostrar el nuevo parseador

### Flujo de Parseo

1. Usuario selecciona un parseador del sidebar
2. Opciones de entrada:
   - **Archivo**: Sube archivo (se carga en textarea)
   - **Manual**: Pega texto directamente en textarea
3. Usuario hace clic en "Parsear"
4. Se envía `POST /parse/manual` con `parserId` y `text`
5. Backend:
   - Obtiene parseador de BD
   - Crea instancia de `Parser`
   - Ejecuta `parser.parseManual(text)`
   - Retorna datos parseados
6. Frontend:
   - Si hay secciones: Muestra tabs y tabla por sección
   - Si no hay secciones: Muestra tabla única
   - Habilita edición, ordenamiento y exportación

### Flujo de Exportación

1. Usuario parsea contenido (obtiene datos en tabla)
2. Usuario hace clic en "Exportar"
3. Frontend:
   - Si hay secciones: Crea una hoja Excel por sección
   - Si no hay secciones: Crea una hoja "Datos"
   - Genera archivo XLSX usando `xlsx` library
   - Intenta guardar con File System Access API
   - Fallback: Descarga automática
4. Archivo se descarga con nombre: `{nombre_parseador}_{fecha}.xlsx`

---

## Notas Importantes

1. **Error en `parseFile`**: El controlador `parseFile` llama a `parseContent()` que no está definida. Debería usar `parser.parse()` directamente. Actualmente este endpoint puede fallar.

2. **Inicialización de BD**: En desarrollo, las tablas se crean automáticamente. En producción (Vercel), las tablas deben existir previamente o ejecutarse las migraciones manualmente.

3. **Nombres de Columnas Duplicados**: El sistema maneja duplicados usando claves únicas (`col_{id}`), pero mantiene el nombre original para compatibilidad (último valor gana).

4. **Parseo de Posición Fija**: Los espacios son parte de los datos. No se hace `trim()` de las líneas completas, solo se extraen substrings según posición.

5. **Parseo JSON**: El sistema puede procesar JSON complejos con objetos anidados y arrays. La configuración `configJson` permite controlar cómo se aplanan y normalizan los datos.

6. **Secciones**: Las secciones se identifican por los primeros 2 caracteres de cada línea. El header debe ser único por sección.

7. **Transacciones**: Todas las operaciones de creación/actualización/eliminación usan transacciones para garantizar consistencia.

8. **Bulk Insert**: Las actualizaciones de columnas/secciones usan bulk insert para optimizar rendimiento.

9. **Alpine.js**: El frontend usa Alpine.js para reactividad. El estado se maneja en `parseador-app.js`.

10. **Exportación Excel**: La exportación usa la librería `xlsx` (SheetJS). Intenta usar File System Access API moderno, con fallback a descarga tradicional.

11. **Límite de Archivos**: Los archivos tienen un límite de 50MB (configurado en multer).

12. **Encoding**: Los archivos se leen como UTF-8. Archivos con otros encodings pueden causar problemas.
