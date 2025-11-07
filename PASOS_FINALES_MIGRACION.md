# 🚀 Pasos Finales para Completar la Migración

## ✅ Lo que ya se completó

He migrado tu código para usar PostgreSQL/Neon en lugar de SQLite. Los cambios principales son:

1. ✅ `src/models/database.js` - Migrado de SQLite3 a PostgreSQL usando `pg`
2. ✅ `src/models/ParserDB.js` - Adaptadas todas las queries SQL a PostgreSQL
3. ✅ `src/app.js` - Ajustado para funcionar como serverless en Vercel
4. ✅ `vercel.json` - Configuración para Vercel
5. ✅ `package.json` - Actualizado con dependencia `pg` (removido `sqlite3`)
6. ✅ `.gitignore` - Agregada carpeta `.vercel`

---

## 📝 Pasos que DEBES hacer ahora

### Paso 1: Instalar la nueva dependencia `pg`

Abre tu terminal en la carpeta del proyecto y ejecuta:

```bash
cd Parseador
npm install
```

Esto instalará el paquete `pg` (PostgreSQL client) que reemplaza a `sqlite3`.

### Paso 2: Crear archivo `.env` local (para desarrollo)

Crea un archivo llamado `.env` en la raíz del proyecto `Parseador/` con el siguiente contenido:

```env
DATABASE_URL=postgresql://neondb_owner:npg_y7hUsMv3WYnr@ep-withered-sky-ahlu6p50-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
PORT=3001
NODE_ENV=development
```

**⚠️ IMPORTANTE**: Reemplaza la `DATABASE_URL` con TU URL real de Neon (la que copiaste del dashboard).

### Paso 3: Probar localmente

Antes de hacer deploy, prueba que todo funcione localmente:

```bash
npm run dev
```

Abre tu navegador en `http://localhost:3001` y verifica que:
- La aplicación carga correctamente
- Puedes crear parseadores
- Puedes ver la lista de parseadores
- Las funciones de parseo funcionan

Si ves errores de conexión a la base de datos:
- Verifica que la `DATABASE_URL` en `.env` sea correcta
- Verifica que el proyecto de Neon esté activo (no en pausa)

### Paso 4: Hacer commit de los cambios

Una vez que funcione localmente, haz commit de los cambios:

```bash
git add .
git commit -m "Migración de SQLite a PostgreSQL/Neon para Vercel"
git push origin main
```

**⚠️ NOTA**: El archivo `.env` NO se subirá a GitHub porque está en `.gitignore` (esto es correcto por seguridad).

### Paso 5: Vercel se redesplegará automáticamente

Una vez que hagas `git push`:
1. Vercel detectará los cambios automáticamente
2. Iniciará un nuevo deployment
3. Usará la variable `DATABASE_URL` que ya configuraste en Vercel

Puedes ver el progreso del deployment en:
- [https://vercel.com/dashboard](https://vercel.com/dashboard)
- Ve a tu proyecto `parseador`
- Haz clic en la pestaña **Deployments**

### Paso 6: Verificar que funcione en producción

Una vez que el deployment termine:
1. Haz clic en **"Visit"** en Vercel para abrir tu aplicación
2. Prueba las funcionalidades principales:
   - Crear un parseador nuevo
   - Ver la lista de parseadores
   - Probar el parseo de archivos

---

## 🔍 Verificar Variables de Entorno en Vercel

Antes de hacer el deploy, asegúrate de que en Vercel tienes configurada la variable:

1. Ve a [Vercel Dashboard](https://vercel.com/dashboard)
2. Selecciona tu proyecto `parseador`
3. Ve a **Settings** → **Environment Variables**
4. Verifica que existe la variable:
   - **Name**: `DATABASE_URL`
   - **Value**: Tu connection string de Neon (postgresql://...)
   - **Environments**: ✅ Production, ✅ Preview, ✅ Development

Si NO está configurada, agrégala ahora con la misma URL que pusiste en el `.env` local.

---

## 📋 Cambios Principales en el Código

### database.js
- **Antes**: Usaba `sqlite3` con archivo `.db` local
- **Ahora**: Usa `pg` (PostgreSQL client) conectándose a Neon
- **Pool de conexiones**: Optimizado para serverless
- **SSL**: Configurado para Neon (`rejectUnauthorized: false`)

### ParserDB.js
- **Antes**: Callbacks y placeholders `?`
- **Ahora**: async/await y placeholders `$1, $2, etc.`
- **RETURNING**: PostgreSQL devuelve IDs con `RETURNING id`
- **Transacciones**: Manejadas con `client.query('BEGIN')` y `client.query('COMMIT')`

### app.js
- **Antes**: Solo servidor Express normal
- **Ahora**: Exporta `module.exports = app` para Vercel
- **Desarrollo**: Solo inicia servidor si `NODE_ENV !== 'production'`

### package.json
- **Removido**: `sqlite3`
- **Agregado**: `pg` (PostgreSQL client)
- **Main**: Cambiado a `src/app.js`
- **Engines**: Especificado Node.js >=16.x

---

## 🚨 Solución de Problemas

### Error: "Cannot find module 'pg'"
```bash
npm install
```

### Error: "Connection refused" o "ECONNREFUSED"
- Verifica que la `DATABASE_URL` sea correcta en `.env` (local) y en Vercel (producción)
- Asegúrate de que incluya `?sslmode=require` al final

### Error: "password authentication failed"
- La contraseña en la `DATABASE_URL` es incorrecta
- Copia nuevamente la URL completa desde Neon

### Error: "relation does not exist"
- Las tablas no existen en Neon
- Ejecuta el SQL de creación de tablas en el SQL Editor de Neon (ver guía principal)

### La app funciona localmente pero NO en Vercel
- Verifica que la variable `DATABASE_URL` esté configurada en Vercel
- Revisa los logs de Vercel: Dashboard → Proyecto → Functions → Ver logs del último deployment

### Error de CORS o rutas no funcionan
- Verifica que `vercel.json` esté en la raíz del proyecto
- Verifica que la ruta `src` sea correcta en `vercel.json`

---

## 📊 Diferencias SQLite vs PostgreSQL

| Aspecto | SQLite | PostgreSQL/Neon |
|---------|---------|------------------|
| Tipo | Archivo local | Servidor remoto |
| Conexión | Archivo .db | Pool de conexiones |
| Placeholders | `?` | `$1, $2, $3` |
| Auto-increment | `AUTOINCREMENT` | `SERIAL` |
| Booleanos | 0/1 | true/false |
| Obtener ID insertado | `this.lastID` | `RETURNING id` |
| Transacciones | `db.run()` | `client.query()` |
| Callbacks | Sí | async/await |

---

## ✅ Checklist Final

Antes de hacer deploy, verifica:

- [ ] Ejecutaste `npm install` y se instaló `pg` correctamente
- [ ] Creaste el archivo `.env` con tu `DATABASE_URL` de Neon
- [ ] Probaste la aplicación localmente con `npm run dev`
- [ ] Las funcionalidades principales funcionan (crear, listar, parsear)
- [ ] Hiciste commit de los cambios (`git add . && git commit -m "..."`)
- [ ] Verificaste que la variable `DATABASE_URL` esté en Vercel
- [ ] Las tablas existen en Neon (ejecutaste el SQL de creación)
- [ ] Hiciste `git push origin main` para deployar

---

## 🎉 ¡Listo!

Una vez completados todos estos pasos, tu aplicación estará:
- ✅ Funcionando con PostgreSQL/Neon en lugar de SQLite
- ✅ Desplegada en Vercel como serverless functions
- ✅ Usando multer en memoria (compatible con serverless)
- ✅ Con conexiones optimizadas para serverless

Si tienes algún problema, revisa la sección "Solución de Problemas" o los logs de Vercel.

---

## 📚 Recursos Adicionales

- [Documentación de node-postgres (pg)](https://node-postgres.com/)
- [Guía de Neon + Vercel](https://neon.tech/docs/guides/vercel)
- [Vercel Functions Logs](https://vercel.com/docs/functions/logs)

