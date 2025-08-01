import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { db } from "./firebaseConfig.js";
import { v4 as uuidv4 } from "https://jspm.dev/uuid";
import { inicializarImportadorExcel } from './excelImport.js';
import { inicializarExportadorExcel } from "./excelExport.js";
import { agregarCampoStockMinimo, verificarAlerta, contarProductosConAlerta, renderizarAlertaEnFila } from "./stockAlert.js";

//agregarCampoStockMinimo(); // Se ejecutó el 1/8/2025 para agregar campo stockMinimo por defecto

const auth = getAuth();

let categoriaActual = null;
const tablaBody = document.querySelector("#productosTable tbody");
const categoryList = document.getElementById("categoryList");
const tituloCategoria = document.getElementById("tituloCategoria");

// Elemento para mostrar cantidad de alertas
const alertaBadge = document.getElementById("alertaBadge");

// Modal elementos
const modal = document.getElementById("productModal");
const addProductBtn = document.getElementById("addProductBtn");
const closeModalBtn = document.getElementById("closeModalBtn");
const modalCategoriaSelect = document.getElementById("modalCategoriaSelect");
const modalCodigo = document.getElementById("modalCodigo");
const modalNombre = document.getElementById("modalNombre");
const modalPrecio = document.getElementById("modalPrecio");
const modalStock = document.getElementById("modalStock");
const modalStockMinimo = document.getElementById("modalStockMinimo"); 
const modalGuardarBtn = document.getElementById("modalGuardarBtn");

// Botón agregar categoría
const btnAgregarCategoria = document.createElement("button");
btnAgregarCategoria.textContent = "+ Agregar categoría";
btnAgregarCategoria.classList.add("btn-agregar-categoria");
categoryList.parentElement.appendChild(btnAgregarCategoria);

// Inicializo importador y exportador Excel
inicializarImportadorExcel(cargarProductos);
inicializarExportadorExcel(() => categoriaActual);

// Variables para paginación
let productosPaginados = [];
let paginaActual = 1;
let itemsPorPagina = 15;

// Variables para búsqueda y orden
const searchInput = document.getElementById("searchInput");
const sortSelect = document.getElementById("sortSelect");

// Filtro stock bajo activo
let filtroStockBajoActivo = false;

// Botón filtro stock bajo (se crea dinámicamente y se inserta en search-sort)
const searchSortDiv = document.querySelector(".search-sort");
const btnStockBajo = document.createElement("button");
btnStockBajo.id = "btnStockBajo";
btnStockBajo.classList.add("filtro-pill");
btnStockBajo.title = "Mostrar productos con stock bajo";
btnStockBajo.textContent = "⚠️ Stock bajo";
btnStockBajo.style.marginLeft = "8px";
searchSortDiv.appendChild(btnStockBajo);

btnStockBajo.addEventListener("click", () => {
  filtroStockBajoActivo = !filtroStockBajoActivo;
  btnStockBajo.classList.toggle("activo", filtroStockBajoActivo);
  cargarProductos();
});

// Capitalizar texto
function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Función para ordenar productos
function ordenarProductos(productos, criterio) {
  const [campo, direccion] = criterio.split("-");
  return productos.sort((a, b) => {
    let valA = a[campo];
    let valB = b[campo];
    if (campo === "precio" || campo === "stock") {
      valA = Number(valA);
      valB = Number(valB);
    } else {
      valA = valA.toString().toLowerCase();
      valB = valB.toString().toLowerCase();
    }
    if (valA < valB) return direccion === "asc" ? -1 : 1;
    if (valA > valB) return direccion === "asc" ? 1 : -1;
    return 0;
  });
}

// Función para filtrar productos por búsqueda
function filtrarProductos(productos, query) {
  if (!query) return productos;
  query = query.toLowerCase();
  return productos.filter(prod =>
    (prod.codigo && prod.codigo.toLowerCase().includes(query)) ||
    (prod.nombre && prod.nombre.toLowerCase().includes(query))
  );
}

// Cargo categorías en sidebar
async function cargarCategorias() {
  const catSnap = await getDocs(collection(db, "categorias"));
  categoryList.innerHTML = "";

  // "Todos los productos"
  const liTodos = document.createElement("li");
  liTodos.textContent = "Todos los productos";
  liTodos.dataset.id = "todos";
  liTodos.classList.add("category-item");
  liTodos.addEventListener("click", () => {
    marcarCategoriaActiva(liTodos);
    categoriaActual = "todos";
    cargarProductos();
  });
  categoryList.appendChild(liTodos);

  // Otras categorías
  const categorias = catSnap.docs.map(d => d.id).sort();
  categorias.forEach(catId => {
    const li = document.createElement("li");
    li.dataset.id = catId;
    li.classList.add("category-item");
    li.style.cursor = "pointer";

    const container = document.createElement("div");
    container.classList.add("category-content");

    const spanCat = document.createElement("span");
    spanCat.textContent = capitalize(catId);
    spanCat.classList.add("category-name");

    const btnEditar = document.createElement("button");
    btnEditar.innerHTML = "✏️";
    btnEditar.title = "Editar nombre";

    const btnEliminar = document.createElement("button");
    btnEliminar.innerHTML = "🗑️";
    btnEliminar.title = "Eliminar categoría";

    container.appendChild(spanCat);
    container.appendChild(btnEditar);
    container.appendChild(btnEliminar);
    li.appendChild(container);

    function cancelarEdicion() {
      spanCat.textContent = capitalize(catId);
      spanCat.contentEditable = false;
      li.classList.remove("editando");
      btnEditar.innerHTML = "✏️";
      btnEditar.title = "Editar nombre";
      btnEliminar.innerHTML = "🗑️";
      btnEliminar.title = "Eliminar categoría";
      document.removeEventListener("keydown", manejarTeclas);
      document.removeEventListener("click", detectarClickFuera);
    }

    function manejarTeclas(e) {
      if (e.key === "Enter") {
        e.preventDefault();
        btnEditar.click();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancelarEdicion();
      }
    }

    function detectarClickFuera(e) {
      if (!li.contains(e.target)) {
        cancelarEdicion();
      }
    }

    li.addEventListener("click", (e) => {
      if (e.target === btnEditar || e.target === btnEliminar) return;
      marcarCategoriaActiva(li);
      categoriaActual = catId;
      cargarProductos();
    });

    btnEditar.addEventListener("click", async () => {
      if (!li.classList.contains("editando")) {
        li.classList.add("editando");
        spanCat.contentEditable = true;
        spanCat.focus();
        btnEditar.innerHTML = "✅";
        btnEditar.title = "Guardar cambios";
        btnEliminar.innerHTML = "❌";
        btnEliminar.title = "Cancelar edición";
        document.addEventListener("keydown", manejarTeclas);
        document.addEventListener("click", detectarClickFuera);
        return;
      }

      const nuevoNombre = spanCat.textContent.trim().toLowerCase();
      if (!nuevoNombre || nuevoNombre.length < 2) {
        return;
      }

      if (nuevoNombre === catId.toLowerCase()) {
        cancelarEdicion();
        return;
      }

      const nuevaRef = doc(db, "categorias", nuevoNombre);
      const existente = await getDoc(nuevaRef);
      if (existente.exists()) {
        return;
      }

      const oldRef = collection(db, "categorias", catId, "productos");
      const oldDocs = await getDocs(oldRef);

      await setDoc(nuevaRef, {});
      const batch = oldDocs.docs.map(d =>
        setDoc(doc(db, "categorias", nuevoNombre, "productos", d.id), d.data())
      );
      await Promise.all(batch);
      await deleteDoc(doc(db, "categorias", catId));
      for (const docDel of oldDocs.docs) {
        await deleteDoc(doc(db, "categorias", catId, "productos", docDel.id));
      }

      // Swal eliminado según pedido
      categoriaActual = nuevaRef.id;
      await cargarCategorias();
      await cargarCategoriasModal();
      await cargarProductos();
    });

    btnEliminar.addEventListener("click", async (e) => {
      e.stopPropagation();

      if (li.classList.contains("editando")) {
        cancelarEdicion();
        return;
      }

      if (!confirm(`¿Eliminar la categoría "${capitalize(catId)}"? Esto eliminará todos los productos dentro.`)) {
        return;
      }

      try {
        const productosCol = collection(db, "categorias", catId, "productos");
        const productosSnap = await getDocs(productosCol);
        const batchDeletes = productosSnap.docs.map(d =>
          deleteDoc(doc(db, "categorias", catId, "productos", d.id))
        );
        await Promise.all(batchDeletes);
        await deleteDoc(doc(db, "categorias", catId));

        if (categoriaActual === catId) categoriaActual = null;
        await cargarCategorias();
        await cargarCategoriasModal();
        await cargarProductos();
      } catch (error) {
        console.error("Error eliminando categoría:", error);
      }
    });

    categoryList.appendChild(li);
  });

  if (!categoriaActual) {
    marcarCategoriaActiva(liTodos);
    categoriaActual = "todos";
    cargarProductos();
  }
}

function marcarCategoriaActiva(liElemento) {
  categoryList.querySelectorAll("li").forEach(el => el.classList.remove("active"));
  liElemento.classList.add("active");
}

// Cargo categorías en modal para agregar/editar productos
async function cargarCategoriasModal() {
  const catSnap = await getDocs(collection(db, "categorias"));
  modalCategoriaSelect.innerHTML = `<option value="">Seleccioná una categoría</option>`;
  catSnap.forEach((docSnap) => {
    const option = document.createElement("option");
    option.value = docSnap.id;
    option.textContent = capitalize(docSnap.id);
    modalCategoriaSelect.appendChild(option);
  });
}

// Retorna referencia a colección productos de categoría actual
function getCategoriaProductosRef() {
  if (!categoriaActual || categoriaActual === "todos") return null;
  return collection(db, "categorias", categoriaActual, "productos");
}

// Paginación
document.getElementById("itemsPerPageSelect")?.addEventListener("change", (e) => {
  itemsPorPagina = parseInt(e.target.value);
  paginaActual = 1;
  renderPaginaActual();
});

// Escuchar búsqueda y orden para recargar productos sin resetear filtro stock bajo ni paginación
searchInput?.addEventListener("input", () => {
  filtrarYRenderizarProductos();
});
sortSelect?.addEventListener("change", () => {
  filtrarYRenderizarProductos();
});

function filtrarYRenderizarProductos() {
  // Filtrar y ordenar los productos cargados en productosPaginados
  let productos = productosPaginadosOriginal || [];
  productos = filtrarProductos(productos, searchInput.value.trim());
  productos = ordenarProductos(productos, sortSelect.value);
  paginarProductos(productos);
}

let productosPaginadosOriginal = []; // Guardamos todos los productos cargados sin filtro paginación

function paginarProductos(productos) {
  productosPaginadosOriginal = productos; // guardo copia original para filtros
  paginaActual = 1;
  renderPaginaActual();
}

function renderPaginaActual() {
  const inicio = (paginaActual - 1) * itemsPorPagina;
  const fin = inicio + itemsPorPagina;
  const productosEnPagina = productosPaginadosOriginal.slice(inicio, fin);
  renderTabla(productosEnPagina);
  renderControlesPaginacion();
}

// Paginación con máximo 3 botones visibles desplazándose
function renderControlesPaginacion() {
  const totalPaginas = Math.ceil(productosPaginadosOriginal.length / itemsPorPagina);
  const pagDiv = document.getElementById("paginationControls");
  pagDiv.innerHTML = "";
  if (totalPaginas <= 1) return;

  const crearBtn = (texto, n, disabled = false) => {
    const btn = document.createElement("button");
    btn.textContent = texto;
    btn.disabled = disabled;
    if (n === paginaActual) {
      btn.classList.add("active");
      btn.style.fontWeight = "bold";
    }
    btn.addEventListener("click", () => {
      paginaActual = n;
      renderPaginaActual();
    });
    return btn;
  };

  pagDiv.appendChild(crearBtn("<<", 1, paginaActual === 1));
  pagDiv.appendChild(crearBtn("<", paginaActual - 1, paginaActual === 1));

  let startPage = paginaActual - 1;
  if (startPage < 1) startPage = 1;
  if (startPage + 2 > totalPaginas) {
    startPage = Math.max(1, totalPaginas - 2);
  }

  for (let i = startPage; i <= Math.min(startPage + 2, totalPaginas); i++) {
    pagDiv.appendChild(crearBtn(i, i));
  }

  pagDiv.appendChild(crearBtn(">", paginaActual + 1, paginaActual === totalPaginas));
  pagDiv.appendChild(crearBtn(">>", totalPaginas, paginaActual === totalPaginas));
}

// Renderizar tabla de productos, incluyendo stockMinimo y alerta visual
function renderTabla(productos) {
  tablaBody.innerHTML = "";

  if (productos.length === 0) {
    tablaBody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#666; font-style:italic;">No hay productos cargados.</td></tr>`;
    return;
  }

  productos.forEach((prod) => {
    const tr = document.createElement("tr");
    tr.dataset.id = prod.id;
    tr.dataset.categoria = prod.categoria;

    // Asegurar que stockMinimo exista, si no poner 5
    const stockMin = typeof prod.stockMinimo === "number" ? prod.stockMinimo : 5;

    tr.innerHTML = `
      <td contenteditable="true" data-field="codigo">${prod.codigo}</td>
      <td contenteditable="true" data-field="nombre">${prod.nombre}</td>
      <td contenteditable="true" data-field="precio">${prod.precio}</td>
      <td contenteditable="true" data-field="stock">${prod.stock}</td>
      <td contenteditable="true" data-field="stockMinimo">${stockMin}</td>
      <td class="alerta" style="text-align:center; font-size: 1.2em;"></td>
      <td class="actions">
        <button class="guardar" disabled>Guardar</button>
        <button class="delete">Eliminar</button>
      </td>
    `;

    // Mostrar alerta si stock < stockMinimo
    const alertaTd = tr.querySelector(".alerta");
    if (verificarAlerta(prod)) {
      alertaTd.textContent = "⚠️";
      tr.classList.add("con-alerta");
    } else {
      alertaTd.textContent = "";
      tr.classList.remove("con-alerta");
    }

    // Detectar cambios para habilitar botón guardar
    const btnGuardar = tr.querySelector(".guardar");
    const camposEditables = [...tr.querySelectorAll("td[contenteditable=true]")];
    const originalValues = camposEditables.map(td => td.textContent.trim());

    camposEditables.forEach((td, idx) => {
      td.addEventListener("input", () => {
        const currentValues = camposEditables.map(td => td.textContent.trim());
        const hasChanges = currentValues.some((val, i) => val !== originalValues[i]);
        btnGuardar.disabled = !hasChanges;
      });
    });

    btnGuardar.addEventListener("click", async () => {
      const updated = {
        codigo: tr.children[0].textContent.trim(),
        nombre: tr.children[1].textContent.trim(),
        precio: parseFloat(tr.children[2].textContent),
        stock: parseInt(tr.children[3].textContent),
        stockMinimo: parseInt(tr.children[4].textContent),
      };

      if (!updated.codigo || !updated.nombre || isNaN(updated.precio) || isNaN(updated.stock)) {
        return;
      }
      if (isNaN(updated.stockMinimo)) updated.stockMinimo = 5;

      try {
        const refProd = doc(db, "categorias", tr.dataset.categoria, "productos", tr.dataset.id);
        await updateDoc(refProd, updated);
        Object.assign(prod, updated);
        actualizarFilaAlertaYBoton(tr, prod);
      } catch (error) {
        console.error("Error actualizando producto:", error);
      }
    });

    tr.querySelector(".delete").addEventListener("click", async () => {
      if (!confirm('¿Eliminar este producto?')) return;
      try {
        await deleteDoc(doc(db, "categorias", tr.dataset.categoria, "productos", tr.dataset.id));
        cargarProductos();
      } catch (error) {
        console.error("Error eliminando producto:", error);
      }
    });

    tablaBody.appendChild(tr);
  });
}

// Función para actualizar solo la alerta y el botón guardar de una fila tras guardar
function actualizarFilaAlertaYBoton(tr, prod) {
  const alertaTd = tr.querySelector(".alerta");
  if (verificarAlerta(prod)) {
    alertaTd.textContent = "⚠️";
    tr.classList.add("con-alerta");
  } else {
    alertaTd.textContent = "";
    tr.classList.remove("con-alerta");
  }
  // Deshabilitar botón guardar luego de guardar
  const btnGuardar = tr.querySelector(".guardar");
  btnGuardar.disabled = true;
}

// Cargar productos y mostrar título
async function cargarProductos() {
  if (!categoriaActual) {
    tablaBody.innerHTML = `<tr><td colspan="7" style="text-align:center; font-style: italic; color: #666;">Seleccione una categoría para ver productos</td></tr>`;
    tituloCategoria.textContent = "";
    if (alertaBadge) alertaBadge.textContent = "";
    productosPaginadosOriginal = [];
    return;
  }

  tituloCategoria.textContent = categoriaActual === "todos"
    ? "Todos los productos"
    : `Categoría: ${capitalize(categoriaActual)}`;

  let productos = [];

  if (categoriaActual === "todos") {
    const catSnap = await getDocs(collection(db, "categorias"));
    for (const catDoc of catSnap.docs) {
      const prodSnap = await getDocs(collection(db, "categorias", catDoc.id, "productos"));
      prodSnap.forEach(p => {
        productos.push({ id: p.id, categoria: catDoc.id, ...p.data() });
      });
    }
  } else {
    const ref = getCategoriaProductosRef();
    if (!ref) return;
    const querySnapshot = await getDocs(ref);
    querySnapshot.forEach(docSnap => {
      productos.push({ id: docSnap.id, categoria: categoriaActual, ...docSnap.data() });
    });
  }

  // Aplicar filtro stock bajo si está activo
  if (filtroStockBajoActivo) {
    productos = productos.filter(p => verificarAlerta(p));
  }

  // Aplicar búsqueda y orden si hay algo en los inputs
  if (searchInput && searchInput.value.trim()) {
    productos = filtrarProductos(productos, searchInput.value.trim());
  }
  if (sortSelect && sortSelect.value) {
    productos = ordenarProductos(productos, sortSelect.value);
  }

  paginarProductos(productos);

  // Actualizo alerta de stock bajo en la UI
  await actualizarAlertaStock(productos);
  
  // 🔢 Contador total de productos
  const totalProductosInfo = document.getElementById("totalProductosInfo");
  const totalFiltrados = productosFiltrados.length;
  const totalEnCategoria = todosLosProductos.length;

  if (filtroStockBajoActivo) {
    totalProductosInfo.textContent = `Productos con stock bajo: ${totalFiltrados} de ${totalEnCategoria}`;
  } else {
    totalProductosInfo.textContent = `Productos totales: ${totalEnCategoria}`;
  }
}

// Función para actualizar contador de productos con stock bajo
async function actualizarAlertaStock(productos) {
  if (!alertaBadge) return;

  const cantidadAlertas = contarProductosConAlerta(productos);
  alertaBadge.textContent = cantidadAlertas > 0
    ? `⚠️ Productos con stock bajo: ${cantidadAlertas}`
    : "";
}

// Modal nuevo producto
addProductBtn.addEventListener("click", () => {
  modal.classList.remove("hidden");
  modalCategoriaSelect.value = categoriaActual !== "todos" ? categoriaActual : "";
  modalCodigo.value = "";
  modalNombre.value = "";
  modalPrecio.value = "";
  modalStock.value = "";
  modalStockMinimo.value = "5";
  modalGuardarBtn.disabled = true;
});

// Cerrar modal
closeModalBtn.addEventListener("click", () => {
  modal.classList.add("hidden");
});

// Habilitar botón guardar si hay cambios en modal
[modalCategoriaSelect, modalCodigo, modalNombre, modalPrecio, modalStock, modalStockMinimo].forEach(el => {
  el.addEventListener("input", () => {
    const habilitar = modalCategoriaSelect.value && modalCodigo.value.trim() && modalNombre.value.trim()
      && modalPrecio.value.trim() && modalStock.value.trim() && modalStockMinimo.value.trim();
    modalGuardarBtn.disabled = !habilitar;
  });
});

// Guardar producto nuevo
modalGuardarBtn.addEventListener("click", async () => {
  const categoria = modalCategoriaSelect.value.trim();
  const codigo = modalCodigo.value.trim();
  const nombre = modalNombre.value.trim();
  const precio = parseFloat(modalPrecio.value);
  const stock = parseInt(modalStock.value);
  let stockMinimo = parseInt(modalStockMinimo.value);

  if (!categoria || !codigo || !nombre || isNaN(precio) || isNaN(stock)) {
    return;
  }
  if (isNaN(stockMinimo) || stockMinimo < 0) stockMinimo = 5;

  try {
    const nuevoId = uuidv4();
    const refProd = doc(db, "categorias", categoria, "productos", nuevoId);
    await setDoc(refProd, { codigo, nombre, precio, stock, stockMinimo });
    // Swal eliminado según pedido
    modal.classList.add("hidden");
    cargarProductos();
  } catch (error) {
    console.error("Error agregando producto:", error);
  }
});

// Botón agregar categoría
btnAgregarCategoria.addEventListener("click", async () => {
  const nombreCat = prompt("Nombre de la nueva categoría:");
  if (!nombreCat) return;

  const nombreCatLower = nombreCat.trim().toLowerCase();
  if (nombreCatLower.length < 2) {
    return;
  }

  try {
    const refCat = doc(db, "categorias", nombreCatLower);
    const existente = await getDoc(refCat);
    if (existente.exists()) {
      // Swal eliminado según pedido
      return;
    }
    await setDoc(refCat, {});
    await cargarCategorias();
    await cargarCategoriasModal();
  } catch (error) {
    console.error("Error creando categoría:", error);
  }
});

// Verifico usuario logueado
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "./login.html";
  } else {
    cargarCategorias();
    cargarCategoriasModal();
  }
});

// Logout
document.getElementById("logoutBtn")?.addEventListener("click", () => {
  signOut(auth);
});

// Inicialización al cargar página
window.addEventListener("DOMContentLoaded", () => {
});