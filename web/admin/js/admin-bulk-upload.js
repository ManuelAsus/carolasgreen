import { db } from '../../js/firebase-config.js';
import { collection, doc, setDoc } from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js';

function slugify(text) {
    return text.toString().toLowerCase()
        .normalize('NFKD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

function createSectionImageDataUrl(sectionTitle, bgColor) {
    const sanitizedTitle = sectionTitle.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 280" width="400" height="280">
  <rect width="100%" height="100%" rx="28" ry="28" fill="${bgColor}" />
  <defs>
    <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="rgba(255,255,255,0.35)" />
      <stop offset="100%" stop-color="rgba(0,0,0,0.1)" />
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)" />
  <text x="50%" y="42%" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="32" font-weight="700">${sanitizedTitle}</text>
  <text x="50%" y="62%" text-anchor="middle" fill="#f2f2f2" font-family="Arial, sans-serif" font-size="18">Carolas Green</text>
</svg>`;
    return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
}

const SECTION_IMAGES = {
    'Frutas y Jugos': createSectionImageDataUrl('Frutas y Jugos', '#8cbf4f'),
    'Plato de Fruta': createSectionImageDataUrl('Plato de Fruta', '#f7b731'),
    'Cafeteria': createSectionImageDataUrl('Cafetería', '#7f5539'),
    'Bebidas': createSectionImageDataUrl('Bebidas', '#4aa8d8'),
    'Licuados': createSectionImageDataUrl('Licuados', '#8b5cf6'),
    'Adicionales': createSectionImageDataUrl('Adicionales', '#d18b47'),
    'Huevos y Omelettes': createSectionImageDataUrl('Huevos y Omelettes', '#f08c4c'),
    'Enchiladas': createSectionImageDataUrl('Enchiladas', '#ce3a3a'),
    'Chilaquiles Green': createSectionImageDataUrl('Chilaquiles Green', '#4ba56a'),
    'Especialidades Mexicanas': createSectionImageDataUrl('Mexicanas', '#2f6f3f'),
    'Desayunos Completos': createSectionImageDataUrl('Desayunos Completos', '#3678a7'),
    'Sandwichosos': createSectionImageDataUrl('Sandwichosos', '#cc8a5a'),
    'Baguette': createSectionImageDataUrl('Baguette', '#b67342'),
    'Hamburguesa': createSectionImageDataUrl('Hamburguesa', '#a83f3f'),
    'Cenas': createSectionImageDataUrl('Cenas', '#2f4f6f'),
    'Almuerzos': createSectionImageDataUrl('Almuerzos', '#5f2f46'),
};

function getImageBySection(section) {
    return SECTION_IMAGES[section] || createSectionImageDataUrl('Carolas Green', '#6c8f4c');
}

const MENU_PRODUCTS = [
    { seccion: 'Frutas y Jugos', nombre: 'Jugo Verde', categoria: 'bebidas', precio: 35, ingredientes: 'CH $35 / GDE $45. Limón, apio, pepino, manzana, piña, acelga y espinaca.', stock: 60 },
    { seccion: 'Frutas y Jugos', nombre: 'Jugo de Zanahoria', categoria: 'bebidas', precio: 35, ingredientes: 'CH $35 / GDE $45. Natural y listo para llevar.', stock: 60 },
    { seccion: 'Frutas y Jugos', nombre: 'Jugo de Betabel', categoria: 'bebidas', precio: 35, ingredientes: 'CH $35 / GDE $45. Betabel, zanahoria, kiwi, fresa y espinaca.', stock: 60 },
    { seccion: 'Plato de Fruta', nombre: 'Plato de Fruta', categoria: 'comidas', precio: 60, ingredientes: 'Papaya, melón, plátano, manzana. Sujeto a disponibilidad. Cocteles de 1 sola fruta (papaya o melón) tienen costo extra $10.', stock: 30 },
    { seccion: 'Cafeteria', nombre: 'Café Americano', categoria: 'bebidas', precio: 35, ingredientes: 'Café americano tradicional caliente.', stock: 40 },
    { seccion: 'Cafeteria', nombre: 'Combo Café + Pan', categoria: 'comidas', precio: 50, ingredientes: 'Combo con 2 panes y café.', stock: 40 },
    { seccion: 'Cafeteria', nombre: 'Café Capuccino', categoria: 'bebidas', precio: 40, ingredientes: 'Café capuccino con espuma cremosa.', stock: 40 },
    { seccion: 'Cafeteria', nombre: 'Ice Latte', categoria: 'bebidas', precio: 70, ingredientes: 'Café latte frío con hielo.', stock: 40 },
    { seccion: 'Cafeteria', nombre: 'Té Frío o Caliente', categoria: 'bebidas', precio: 35, ingredientes: 'Té disponible frío o caliente.', stock: 40 },
    { seccion: 'Cafeteria', nombre: 'Infusión de Frutos Rojos', categoria: 'bebidas', precio: 35, ingredientes: 'Infusión caliente o fría de frutos rojos.', stock: 40 },
    { seccion: 'Cafeteria', nombre: 'Combo Waffles + Ice Latte', categoria: 'comidas', precio: 120, ingredientes: 'Waffles acompañados de un ice latte.', stock: 30 },
    { seccion: 'Cafeteria', nombre: 'Desayuno Combinado', categoria: 'comidas', precio: 120, ingredientes: 'Hot cakes con huevos al gusto.', stock: 30 },
    { seccion: 'Cafeteria', nombre: 'Hot Cakes Tradicionales', categoria: 'comidas', precio: 65, ingredientes: 'Hot cakes tradicionales con sirope.', stock: 30 },
    { seccion: 'Cafeteria', nombre: 'Pan Francés Tradicional', categoria: 'comidas', precio: 60, ingredientes: '2 piezas con maple.', stock: 30 },
    { seccion: 'Cafeteria', nombre: 'Waffle con Fruta', categoria: 'comidas', precio: 70, ingredientes: 'Waffle con fresas o plátano.', stock: 30 },
    { seccion: 'Bebidas', nombre: 'Limonada con Chía', categoria: 'bebidas', precio: 35, ingredientes: 'Limonada natural con chía.', stock: 60 },
    { seccion: 'Bebidas', nombre: 'Limonada con Chía Mineral', categoria: 'bebidas', precio: 35, ingredientes: 'Limonada con chía y agua mineral.', stock: 60 },
    { seccion: 'Bebidas', nombre: 'Limonada Mineral Arándanos', categoria: 'bebidas', precio: 35, ingredientes: 'Limonada con arándanos y agua mineral.', stock: 60 },
    { seccion: 'Bebidas', nombre: 'Pepino', categoria: 'bebidas', precio: 35, ingredientes: 'Agua sabor pepino refrescante.', stock: 60 },
    { seccion: 'Bebidas', nombre: 'Pepino con Espinaca', categoria: 'bebidas', precio: 35, ingredientes: 'Pepino natural con espinaca.', stock: 60 },
    { seccion: 'Bebidas', nombre: 'Limón Fresa', categoria: 'bebidas', precio: 35, ingredientes: 'Limonada de limón con fresa.', stock: 60 },
    { seccion: 'Bebidas', nombre: 'Melón', categoria: 'bebidas', precio: 35, ingredientes: 'Agua natural sabor melón.', stock: 60 },
    { seccion: 'Bebidas', nombre: 'Papaya', categoria: 'bebidas', precio: 35, ingredientes: 'Agua natural sabor papaya.', stock: 60 },
    { seccion: 'Bebidas', nombre: 'Manzana y Avena', categoria: 'bebidas', precio: 35, ingredientes: 'Bebida de manzana con avena.', stock: 60 },
    { seccion: 'Bebidas', nombre: 'Agua Embotellada', categoria: 'bebidas', precio: 35, ingredientes: 'Agua embotellada disponible.', stock: 80 },
    { seccion: 'Bebidas', nombre: 'Refrescos', categoria: 'bebidas', precio: 35, ingredientes: 'Refrescos sujetos a disponibilidad.', stock: 80 },
    { seccion: 'Licuados', nombre: 'Licuado de Manzana', categoria: 'licuados', precio: 35, ingredientes: 'Licuado natural de manzana.', stock: 50 },
    { seccion: 'Licuados', nombre: 'Licuado de Plátano', categoria: 'licuados', precio: 35, ingredientes: 'Licuado natural de plátano.', stock: 50 },
    { seccion: 'Licuados', nombre: 'Licuado de Fresa', categoria: 'licuados', precio: 35, ingredientes: 'Licuado natural de fresa.', stock: 50 },
    { seccion: 'Licuados', nombre: 'Licuado de Melón', categoria: 'licuados', precio: 35, ingredientes: 'Licuado natural de melón.', stock: 50 },
    { seccion: 'Licuados', nombre: 'Licuado de Papaya', categoria: 'licuados', precio: 35, ingredientes: 'Licuado natural de papaya.', stock: 50 },
    { seccion: 'Adicionales', nombre: 'A Base de Agua CH', categoria: 'bebidas', precio: 30, ingredientes: 'A base de agua. CH $30 / GDE $40.', stock: 50 },
    { seccion: 'Adicionales', nombre: 'A Base de Agua GDE', categoria: 'bebidas', precio: 40, ingredientes: 'A base de agua. CH $30 / GDE $40.', stock: 50 },
    { seccion: 'Adicionales', nombre: 'A Base de Mineral CH', categoria: 'bebidas', precio: 35, ingredientes: 'A base de mineral. CH $35 / GDE $45.', stock: 50 },
    { seccion: 'Adicionales', nombre: 'A Base de Mineral GDE', categoria: 'bebidas', precio: 45, ingredientes: 'A base de mineral. CH $35 / GDE $45.', stock: 50 },
    { seccion: 'Adicionales', nombre: 'A Base de Leche CH', categoria: 'bebidas', precio: 45, ingredientes: 'A base de leche. CH $45 / GDE $55.', stock: 50 },
    { seccion: 'Adicionales', nombre: 'A Base de Leche GDE', categoria: 'bebidas', precio: 55, ingredientes: 'A base de leche. CH $45 / GDE $55.', stock: 50 },
    { seccion: 'Huevos y Omelettes', nombre: 'Tostadas de Aguacate con Huevo', categoria: 'comidas', precio: 85, ingredientes: 'Tostadas con aguacate y huevo.', stock: 35 },
    { seccion: 'Huevos y Omelettes', nombre: 'Motuleños', categoria: 'comidas', precio: 115, ingredientes: 'Huevos motuleños estilo Yucatán.', stock: 35 },
    { seccion: 'Huevos y Omelettes', nombre: 'Huevos Divorciados', categoria: 'comidas', precio: 100, ingredientes: 'Huevos divorciados con salsa.', stock: 35 },
    { seccion: 'Huevos y Omelettes', nombre: 'Huevos con Longaniza', categoria: 'comidas', precio: 100, ingredientes: 'Huevos con longaniza.', stock: 35 },
    { seccion: 'Huevos y Omelettes', nombre: 'Huevos a la Mexicana', categoria: 'comidas', precio: 100, ingredientes: 'Huevos a la mexicana.', stock: 35 },
    { seccion: 'Huevos y Omelettes', nombre: 'Huevos con Espinaca, Champiñones y Queso Panela', categoria: 'comidas', precio: 110, ingredientes: 'Huevos con espinaca, champiñones y queso panela.', stock: 35 },
    { seccion: 'Huevos y Omelettes', nombre: 'Huevo con Acelga Entomatado', categoria: 'comidas', precio: 100, ingredientes: 'Huevo con acelga entomatado.', stock: 35 },
    { seccion: 'Huevos y Omelettes', nombre: 'Omelette Veggie', categoria: 'comidas', precio: 115, ingredientes: 'Omelette con vegetales.', stock: 35 },
    { seccion: 'Huevos y Omelettes', nombre: 'Omelette Popeye', categoria: 'comidas', precio: 100, ingredientes: 'Omelette con espinacas estilo Popeye.', stock: 35 },
    { seccion: 'Huevos y Omelettes', nombre: 'Omelette con Clara de Huevos', categoria: 'comidas', precio: 120, ingredientes: 'Omelette elaborado con clara de huevo.', stock: 35 },
    { seccion: 'Huevos y Omelettes', nombre: 'Omelette Chilaquiles', categoria: 'comidas', precio: 150, ingredientes: 'Omelette con chilaquiles.', stock: 30 },
    { seccion: 'Enchiladas', nombre: 'Enchiladas Suizas Verde (5 pzas)', categoria: 'comidas', precio: 90, ingredientes: 'Enchiladas suizas verde, 5 piezas.', stock: 35 },
    { seccion: 'Enchiladas', nombre: 'Enchiladas Suizas Rojas (5 pzas)', categoria: 'comidas', precio: 85, ingredientes: 'Enchiladas suizas rojas, 5 piezas.', stock: 35 },
    { seccion: 'Enchiladas', nombre: 'Enchiladas Rellenas de Huevos Revueltos (5 pzas)', categoria: 'comidas', precio: 85, ingredientes: 'Enchiladas rellenas de huevos revueltos, 5 piezas.', stock: 35 },
    { seccion: 'Enchiladas', nombre: 'Enchiladas Suizas + 2 Huevos Estrellados Arriba', categoria: 'comidas', precio: 130, ingredientes: 'Enchiladas suizas con 2 huevos estrellados encima.', stock: 35 },
    { seccion: 'Chilaquiles Green', nombre: 'Chilaquiles Rojos con Huevo', categoria: 'comidas', precio: 85, ingredientes: 'Chilaquiles rojos servidos con huevo.', stock: 35 },
    { seccion: 'Chilaquiles Green', nombre: 'Chilaquiles Rojos con Pollo', categoria: 'comidas', precio: 85, ingredientes: 'Chilaquiles rojos servidos con pollo.', stock: 35 },
    { seccion: 'Chilaquiles Green', nombre: 'Chilaquiles Rojos con Huevo y Pollo', categoria: 'comidas', precio: 100, ingredientes: 'Chilaquiles rojos con huevo y pollo.', stock: 35 },
    { seccion: 'Chilaquiles Green', nombre: 'Chilaquiles Huevo Suizos', categoria: 'comidas', precio: 90, ingredientes: 'Chilaquiles con huevo estilo suizo.', stock: 35 },
    { seccion: 'Chilaquiles Green', nombre: 'Chilaquiles Suizos', categoria: 'comidas', precio: 90, ingredientes: 'Chilaquiles estilo suizo.', stock: 35 },
    { seccion: 'Chilaquiles Green', nombre: 'Chilaquiles Suizos Pollo y Huevo', categoria: 'comidas', precio: 120, ingredientes: 'Chilaquiles suizos con pollo y huevo.', stock: 35 },
    { seccion: 'Especialidades Mexicanas', nombre: 'Tacos Dorados de Pollo (5 pzas)', categoria: 'comidas', precio: 70, ingredientes: 'Tacos dorados de pollo, 5 piezas.', stock: 40 },
    { seccion: 'Especialidades Mexicanas', nombre: 'Tostadas de Pollo', categoria: 'comidas', precio: 20, ingredientes: 'Tostadas de pollo, precio por pieza.', stock: 60 },
    { seccion: 'Especialidades Mexicanas', nombre: 'Quesadilla de Pechuga Asada', categoria: 'comidas', precio: 70, ingredientes: 'Quesadilla con pechuga asada, 2 piezas.', stock: 40 },
    { seccion: 'Especialidades Mexicanas', nombre: 'Molletes Sencillo (2 pzas)', categoria: 'comidas', precio: 50, ingredientes: 'Molletes sencillo, 2 piezas.', stock: 40 },
    { seccion: 'Especialidades Mexicanas', nombre: 'Molletes de Pechuga Asada (2 pzas)', categoria: 'comidas', precio: 70, ingredientes: 'Molletes con pechuga asada, 2 piezas.', stock: 40 },
    { seccion: 'Desayunos Completos', nombre: 'Combo 1 Desayuno Completo', categoria: 'comidas', precio: 170, ingredientes: 'Molletes sencillos, fruta o jugo y café.', stock: 30 },
    { seccion: 'Desayunos Completos', nombre: 'Combo 2 Desayuno Completo', categoria: 'comidas', precio: 170, ingredientes: 'Chilaquiles con huevo o pollo, fruta o jugo y café.', stock: 30 },
    { seccion: 'Desayunos Completos', nombre: 'Combo 3 Desayuno Completo', categoria: 'comidas', precio: 170, ingredientes: 'Huevos, fruta o jugo y café.', stock: 30 },
    { seccion: 'Desayunos Completos', nombre: 'Combo 4 Desayuno Completo', categoria: 'comidas', precio: 170, ingredientes: 'Sándwich de pollo, fruta o jugo y café.', stock: 30 },
    { seccion: 'Sandwichosos', nombre: 'Club de Pollo', categoria: 'comidas', precio: 70, ingredientes: 'Club de pollo con ingredientes frescos.', stock: 35 },
    { seccion: 'Sandwichosos', nombre: 'Sandwich de Jamón', categoria: 'comidas', precio: 55, ingredientes: 'Sándwich de jamón clásico.', stock: 35 },
    { seccion: 'Baguette', nombre: 'Baguette de Pechuga Asada', categoria: 'comidas', precio: 100, ingredientes: 'Baguette con pechuga asada.', stock: 35 },
    { seccion: 'Baguette', nombre: 'Baguette de Pechuga Empanizada', categoria: 'comidas', precio: 100, ingredientes: 'Baguette con pechuga empanizada.', stock: 35 },
    { seccion: 'Baguette', nombre: 'Baguette de Pechuga en Salsa BBQ', categoria: 'comidas', precio: 100, ingredientes: 'Baguette sencillo en salsa BBQ.', stock: 35 },
    { seccion: 'Baguette', nombre: 'Baguette Completo', categoria: 'comidas', precio: 120, ingredientes: 'Baguette completo con papas y agua o refresco.', stock: 35 },
    { seccion: 'Hamburguesa', nombre: 'Hamburguesa Sencilla', categoria: 'comidas', precio: 70, ingredientes: 'Hamburguesa sencilla.', stock: 35 },
    { seccion: 'Hamburguesa', nombre: 'Hamburguesa Especial', categoria: 'comidas', precio: 100, ingredientes: 'Hamburguesa especial con papas y refresco.', stock: 35 },
    { seccion: 'Cenas', nombre: 'Pan Pita con Pechuga Asada', categoria: 'comidas', precio: 75, ingredientes: 'Pan pita con pechuga asada.', stock: 35 },
    { seccion: 'Cenas', nombre: 'Hotdog Salchicha de Costco', categoria: 'comidas', precio: 50, ingredientes: 'Hotdog con salchicha de Costco, precio por unidad.', stock: 35 },
    { seccion: 'Cenas', nombre: 'Pizza Pita al Gusto', categoria: 'comidas', precio: 80, ingredientes: 'Pizza pita preparada al gusto.', stock: 35 },
    { seccion: 'Cenas', nombre: 'Ensaladas al Gusto', categoria: 'comidas', precio: 80, ingredientes: 'Ensaladas al gusto.', stock: 35 },
    { seccion: 'Almuerzos', nombre: 'Milanesas Green', categoria: 'comidas', precio: 150, ingredientes: 'Milanesa Green.', stock: 35 },
    { seccion: 'Almuerzos', nombre: 'Tampico', categoria: 'comidas', precio: 150, ingredientes: 'Milanesa de res con aguacate y frijoles.', stock: 35 },
    { seccion: 'Almuerzos', nombre: 'Hawaiana', categoria: 'comidas', precio: 150, ingredientes: 'Milanesa de res con queso y piña, frijoles.', stock: 35 },
    { seccion: 'Almuerzos', nombre: 'Mexicana', categoria: 'comidas', precio: 150, ingredientes: 'Milanesa de res con pico de gallo y frijoles.', stock: 35 },
    { seccion: 'Almuerzos', nombre: 'Colonial', categoria: 'comidas', precio: 150, ingredientes: 'Pechuga asada, frijoles y 2 enchiladas rojas.', stock: 35 },
    { seccion: 'Almuerzos', nombre: 'Pechuga Asada (Ensalada)', categoria: 'comidas', precio: 100, ingredientes: 'Pechuga asada con ensalada.', stock: 35 },
    { seccion: 'Almuerzos', nombre: 'Pechuga Empanizada (Ensalada o Verduras)', categoria: 'comidas', precio: 100, ingredientes: 'Pechuga empanizada con ensalada o verduras.', stock: 35 },
];

async function bulkUploadProductos() {
    const productosCollection = collection(db, 'productos');
    let cargados = 0;
    for (const item of MENU_PRODUCTS) {
        try {
            const id = slugify(item.nombre);
            const imagen = getImageBySection(item.seccion);
            const data = {
                nombre: item.nombre,
                categoria: item.categoria,
                precio: item.precio,
                ingredientes: item.ingredientes,
                stock: item.stock,
                seccion: item.seccion,
                imagen,
                creado: new Date()
            };
            await setDoc(doc(productosCollection, id), data);
            cargados += 1;
            console.log(`✅ Producto creado: ${item.nombre}`);
        } catch (error) {
            console.error(`❌ Error guardando ${item.nombre}:`, error);
        }
    }
    alert(`Carga finalizada: ${cargados} productos creados.`);
}

window.bulkUploadProductos = bulkUploadProductos;
window.bulkUploadProductosFromMenu = bulkUploadProductos;
