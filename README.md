# 🐋 Yaqupachauy — Sistema de Gestión Financiera

Sistema de contabilidad para ONGs de conservación. Desarrollado para [Yaqupachauy](https://yaqupachauy.org) — Investigación y Conservación de Cetáceos.

**Stack:** React + Vite · Supabase (auth, base de datos, storage) · Vercel  
**Costo de operación:** $0/mes en uso normal

---

## ¿Qué hace esta app?

- 👤 Login de usuarios con roles (integrante / administradora)
- 🧾 Registro de gastos con foto de factura, por proyecto y categoría
- 🔍 Detección automática de gastos duplicados
- 🔵 Gestión de proyectos con presupuesto opcional y barra de ejecución
- ↩ Módulo de reintegros (gastos pagados de bolsillo)
- 📄 Reportes filtrables por proyecto, usuario y fechas — exportables a Excel
- 💱 Soporte para USD y pesos uruguayos (UYU)

---

## Antes de empezar

Necesitás tener instalado:

- [Node.js](https://nodejs.org) versión 18 o superior
- [Git](https://git-scm.com)
- Una cuenta en [Supabase](https://supabase.com) (gratis)
- Una cuenta en [Vercel](https://vercel.com) (gratis, podés entrar con GitHub)

---

## Instalación local paso a paso

### 1. Clonar el repositorio

```bash
git clone https://github.com/TU_USUARIO/yaqupachauy-contabilidad.git
cd yaqupachauy-contabilidad
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Crear el proyecto en Supabase

1. Entrá a [supabase.com](https://supabase.com) y creá una cuenta si no tenés
2. Hacé clic en **New project**
3. Poné el nombre que quieras (ej: `yaqupachauy`)
4. Elegí una contraseña para la base de datos (guardala en algún lado seguro)
5. Elegí la región **South America (São Paulo)** — es la más cercana a Uruguay
6. Esperá ~2 minutos a que termine de crear el proyecto

### 4. Ejecutar el schema de base de datos

1. En tu proyecto de Supabase, andá al menú lateral → **SQL Editor**
2. Hacé clic en **New query**
3. Abrí el archivo `supabase_schema.sql` de este repositorio y copiá todo el contenido
4. Pegalo en el editor y hacé clic en **Run** (o `Ctrl+Enter`)
5. Deberías ver algo como `Success. No rows returned` — eso está bien

Esto crea todas las tablas, categorías base, políticas de seguridad y los triggers automáticos.

### 5. Crear el bucket de storage para facturas

1. En Supabase, andá a **Storage** en el menú lateral
2. Hacé clic en **New bucket**
3. Nombre: `receipts`
4. Dejá **Public bucket** desactivado (privado)
5. Hacé clic en **Save**

Después configurá los permisos del bucket:

1. Hacé clic en el bucket `receipts` → **Policies** → **New policy**
2. Elegí **For full customization**
3. Creá las siguientes 2 policies:

**Policy 1 — subir archivos:**
- Policy name: `users can upload receipts`
- Allowed operation: `INSERT`
- Target roles: `authenticated`
- WITH CHECK expression: `bucket_id = 'receipts'`

**Policy 2 — ver sus propios archivos:**
- Policy name: `users can view own receipts`  
- Allowed operation: `SELECT`
- Target roles: `authenticated`
- USING expression: `bucket_id = 'receipts'`

### 6. Configurar las variables de entorno

1. En Supabase, andá a **Project Settings** (ícono de engranaje) → **API**
2. Copiá:
   - **Project URL** (algo como `https://abcdefgh.supabase.co`)
   - **anon public** key (una clave larga que empieza con `eyJ...`)

3. En la raíz del proyecto, copiá el archivo de ejemplo:

```bash
cp .env.example .env
```

4. Abrí `.env` con cualquier editor de texto y completá:

```
VITE_SUPABASE_URL=https://TU_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...TU_CLAVE_ANON
```

### 7. Levantar la app en modo desarrollo

```bash
npm run dev
```

Abrí el navegador en `http://localhost:5173` — deberías ver la pantalla de login.

---

## Crear la primera usuaria administradora

La primera vez que uses la app, tenés que crear tu usuario directamente desde Supabase:

1. En Supabase, andá a **Authentication** → **Users**
2. Hacé clic en **Invite user** (o **Add user** → **Create new user**)
3. Ingresá tu email y una contraseña
4. Hacé clic en **Create user**

Ahora dale rol de administradora:

1. Andá a **Table Editor** → tabla `profiles`
2. Buscá tu fila (debería haberse creado automáticamente)
3. Hacé clic en el campo `role` y cambialo de `member` a `admin`
4. Guardá los cambios

Desde ese momento podés invitar al resto del equipo desde la sección **Usuarios** dentro de la app.

---

## Deploy en Vercel (para usarlo desde cualquier lugar)

### 1. Subir el código a GitHub

```bash
git init  # solo si no lo hiciste antes
git add .
git commit -m "primera versión"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/yaqupachauy-contabilidad.git
git push -u origin main
```

### 2. Conectar con Vercel

1. Entrá a [vercel.com](https://vercel.com) con tu cuenta de GitHub
2. Hacé clic en **Add New Project**
3. Elegí el repositorio `yaqupachauy-contabilidad`
4. Vercel detecta automáticamente que es un proyecto Vite — no hace falta configurar nada del build

### 3. Agregar las variables de entorno en Vercel

Antes de hacer deploy, en la pantalla de configuración:

1. Expandí la sección **Environment Variables**
2. Agregá las mismas dos variables que pusiste en `.env`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

3. Hacé clic en **Deploy**

En ~2 minutos la app va a estar online en una URL del tipo `yaqupachauy-contabilidad.vercel.app`.

### 4. Conectar tu dominio propio (opcional)

Si querés usar `app.yaqupachauy.org`:

1. En Vercel → tu proyecto → **Settings** → **Domains**
2. Agregá `app.yaqupachauy.org`
3. Vercel te va a dar un registro DNS para agregar en donde tengas el dominio registrado
4. Una vez propagado (puede tardar unas horas), la app queda en tu dominio

---

## Estructura del proyecto

```
├── src/
│   ├── lib/
│   │   └── supabase.js          # cliente de Supabase
│   ├── hooks/
│   │   └── useAuth.jsx          # contexto de autenticación
│   ├── components/
│   │   └── Sidebar.jsx          # navegación lateral
│   ├── pages/
│   │   ├── LoginPage.jsx
│   │   ├── Dashboard.jsx        # métricas y últimos gastos
│   │   ├── ExpensesPage.jsx     # CRUD de gastos + detección duplicados
│   │   ├── ProjectsPage.jsx     # proyectos con presupuesto
│   │   ├── ReimbursementsPage.jsx
│   │   ├── ReportsPage.jsx      # filtros + exportar Excel
│   │   └── UsersPage.jsx        # gestión de equipo
│   ├── App.jsx                  # routing y guards
│   ├── main.jsx
│   └── index.css                # diseño completo
├── supabase_schema.sql          # estructura de la base de datos
├── .env.example                 # template de variables de entorno
└── README.md
```

---

## Cómo actualizar la app después de hacer cambios

Si hacés cambios en el código y los subís a GitHub, Vercel redeploya automáticamente. Solo tenés que hacer:

```bash
git add .
git commit -m "descripción de los cambios"
git push
```

Y en ~1 minuto la versión actualizada está online.

---

## Categorías de gasto incluidas por defecto

La base de datos viene con estas categorías preconfiguradas:

| Ícono | Categoría |
|-------|-----------|
| 🚗 | Logística / Transporte |
| 🔬 | Investigación |
| 📚 | Educación ambiental |
| 🛠️ | Equipamiento |
| 📢 | Comunicación / Difusión |
| 🍽️ | Alimentación |
| 🏕️ | Alojamiento |
| 🐋 | Veterinaria / Biología |
| 📋 | Administrativo |
| 📦 | Otro |

Para agregar o modificar categorías, por ahora hacelo directo en Supabase → **Table Editor** → tabla `categories`.

---

## Límites del plan gratuito de Supabase

| Recurso | Límite gratuito | Estimado de uso |
|---------|-----------------|-----------------|
| Base de datos | 500 MB | Suficiente para años de registros |
| Storage (fotos) | 1 GB | ~3.000 fotos de facturas a resolución normal |
| Usuarios activos | 50.000/mes | Muy por encima de lo necesario |
| Pausa del proyecto | Sí, si no hay actividad en 7 días | No aplica con uso regular |

Si algún día se llegara al límite de storage, el plan Pro de Supabase cuesta USD 25/mes.

---

## ¿Problemas? Preguntas frecuentes

**La app carga pero no puedo iniciar sesión**  
→ Verificá que las variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` estén bien copiadas en `.env`

**Aparece error al guardar un gasto**  
→ Verificá que el schema SQL se ejecutó correctamente. Podés revisar las tablas en Supabase → Table Editor

**No aparece la opción de subir factura**  
→ Verificá que creaste el bucket `receipts` en Supabase Storage y que configuraste las policies

**Quiero cambiar el logo o los colores**  
→ Los colores están definidos como variables CSS al inicio de `src/index.css`. Las variables `--ocean-*` son los azules principales.

---

## Licencia

MIT — libre para usar, modificar y distribuir. Si lo adaptás para otra ONG, ¡nos contás! 🐬

---

*Desarrollado por gingerheart con 💙 para la conservación de cetáceos en Uruguay*
