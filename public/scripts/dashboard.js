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
const modalStockMinimo = document.getElementById("modalStockMinimo"); // Asegurate de tener este campo en el modal HTML
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

// Capitalizar texto
function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
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
        Swal.fire("Error", "El nombre debe tener al menos 2 caracteres.", "error");
        return;
      }

      if (nuevoNombre === catId.toLowerCase()) {
        cancelarEdicion();
        return;
      }

      const nuevaRef = doc(db, "categorias", nuevoNombre);
      const existente = await getDoc(nuevaRef);
      if (existente.exists()) {
        Swal.fire("Error", "Ya existe una categoría con ese nombre.", "error");
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

      Swal.fire("Actualizado", "Nombre de categoría cambiado correctamente.", "success");
      categoriaActual = nuevoNombre;
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

      const result = await Swal.fire({
        title: `¿Eliminar la categoría "${capitalize(catId)}"?`,
        text: "Esto eliminará todos los productos dentro de esta categoría. ¡No se puede deshacer!",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Sí, eliminar",
        cancelButtonText: "Cancelar",
      });

      if (result.isConfirmed) {
        try {
          const productosCol = collection(db, "categorias", catId, "productos");
          const productosSnap = await getDocs(productosCol);
          const batchDeletes = productosSnap.docs.map(d =>
            deleteDoc(doc(db, "categorias", catId, "productos", d.id))
          );
          await Promise.all(batchDeletes);
          await deleteDoc(doc(db, "categorias", catId));
          Swal.fire("Eliminado", `Categoría "${capitalize(catId)}" eliminada.`, "success");

          if (categoriaActual === catId) categoriaActual = null;
          await cargarCategorias();
          await cargarCategoriasModal();
          await cargarProductos();
        } catch (error) {
          console.error("Error eliminando categoría:", error);
          Swal.fire("Error", "No se pudo eliminar la categoría.", "error");
        }
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

function paginarProductos(productos) {
  productosPaginados = productos;
  paginaActual = 1;
  renderPaginaActual();
}

function renderPaginaActual() {
  const inicio = (paginaActual - 1) * itemsPorPagina;
  const fin = inicio + itemsPorPagina;
  const productosEnPagina = productosPaginados.slice(inicio, fin);
  renderTabla(productosEnPagina);
  renderControlesPaginacion();
}

// Paginación con máximo 3 botones visibles desplazándose
function renderControlesPaginacion() {
  const totalPaginas = Math.ceil(productosPaginados.length / itemsPorPagina);
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
        return Swal.fire({ icon: 'error', title: 'Error', text: 'Datos inválidos.' });
      }
      if (isNaN(updated.stockMinimo)) updated.stockMinimo = 5;

      try {
        const refProd = doc(db, "categorias", tr.dataset.categoria, "productos", tr.dataset.id);
        await updateDoc(refProd, updated);
        Swal.fire({ icon: 'success', title: 'Actualizado', text: 'Producto actualizado correctamente.' });
        cargarProductos();
      } catch (error) {
        console.error("Error actualizando producto:", error);
        Swal.fire("Error", "No se pudo actualizar el producto.", "error");
      }
    });

    tr.querySelector(".delete").addEventListener("click", async () => {
      const res = await Swal.fire({
        title: '¿Eliminar este producto?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
      });
      if (res.isConfirmed) {
        try {
          await deleteDoc(doc(db, "categorias", tr.dataset.categoria, "productos", tr.dataset.id));
          Swal.fire({ icon: 'success', title: 'Eliminado', text: 'Producto eliminado correctamente.' });
          cargarProductos();
        } catch (error) {
          console.error("Error eliminando producto:", error);
          Swal.fire("Error", "No se pudo eliminar el producto.", "error");
        }
      }
    });

    tablaBody.appendChild(tr);
  });
}

// Cargar productos y mostrar título
async function cargarProductos() {
  if (!categoriaActual) {
    tablaBody.innerHTML = `<tr><td colspan="7" style="text-align:center; font-style: italic; color: #666;">Seleccione una categoría para ver productos</td></tr>`;
    tituloCategoria.textContent = "";
    if (alertaBadge) alertaBadge.textContent = "";
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
    paginarProductos(productos);
  } else {
    const ref = getCategoriaProductosRef();
    if (!ref) return;
    const querySnapshot = await getDocs(ref);
    querySnapshot.forEach(docSnap => {
      productos.push({ id: docSnap.id, categoria: categoriaActual, ...docSnap.data() });
    });
    paginarProductos(productos);
  }

  // Actualizo alerta de stock bajo en la UI
  await actualizarAlertaStock(productos);
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
  modalStockMinimo.value = "5"; // Default mínimo
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
    return Swal.fire("Error", "Complete todos los campos correctamente.", "error");
  }
  if (isNaN(stockMinimo) || stockMinimo < 0) stockMinimo = 5;

  try {
    const nuevoId = uuidv4();
    const refProd = doc(db, "categorias", categoria, "productos", nuevoId);
    await setDoc(refProd, { codigo, nombre, precio, stock, stockMinimo });
    Swal.fire("Agregado", "Producto agregado correctamente.", "success");
    modal.classList.add("hidden");
    cargarProductos();
  } catch (error) {
    console.error("Error agregando producto:", error);
    Swal.fire("Error", "No se pudo agregar el producto.", "error");
  }
});

// Botón agregar categoría
btnAgregarCategoria.addEventListener("click", async () => {
  const { value: nombreCat } = await Swal.fire({
    title: "Nueva categoría",
    input: "text",
    inputLabel: "Nombre de la categoría",
    inputPlaceholder: "Ingrese nombre",
    showCancelButton: true,
  });

  if (!nombreCat) return;

  const nombreCatLower = nombreCat.trim().toLowerCase();
  if (nombreCatLower.length < 2) {
    Swal.fire("Error", "El nombre debe tener al menos 2 caracteres.", "error");
    return;
  }

  try {
    const refCat = doc(db, "categorias", nombreCatLower);
    const existente = await getDoc(refCat);
    if (existente.exists()) {
      Swal.fire("Error", "La categoría ya existe.", "error");
      return;
    }
    await setDoc(refCat, {});
    Swal.fire("Creado", "Categoría creada correctamente.", "success");
    await cargarCategorias();
    await cargarCategoriasModal();
  } catch (error) {
    console.error("Error creando categoría:", error);
    Swal.fire("Error", "No se pudo crear la categoría.", "error");
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
  // Puedes ejecutar aquí si necesitas algo al cargar, por ejemplo:
  // cargarCategorias();
  // cargarCategoriasModal();
});