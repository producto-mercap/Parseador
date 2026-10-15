// Genera src/public/css/tailwind.min.css solo con las clases de Tailwind que usa la app.
// Regenerar con `npm run build:css` después de agregar clases nuevas en vistas o JS.
module.exports = {
    purge: {
        enabled: true,
        content: [
            './src/views/**/*.ejs',
            './src/public/js/**/*.js'
        ]
    },
    theme: {
        extend: {}
    },
    variants: {
        extend: {}
    },
    plugins: []
};
