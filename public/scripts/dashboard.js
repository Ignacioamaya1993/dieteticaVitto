import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { db } from "./firebaseConfig.js";
import { v4 as uuidv4 } from "https://jspm.dev/uuid";
import { inicializarImportadorExcel } from './excelImport.js';
inicializarImportadorExcel(cargarProductos);
import { inicializarExportadorExcel } from "./excelExport.js";

inicializarExportadorExcel(() => categoriaSeleccionada);
const auth = getAuth();
let categoriaActual = null;
const tablaBody = document.querySelector("#productosTable tbody");
const categoryList = document.getElementById("categoryList");

// Título de la categoría actual
const tituloCategoria = document.getElementById("tituloCategoria");

// Modal elementos
const modal = document.getElementById("productModal");
const addProductBtn = document.getElementById("addProductBtn");
const closeModalBtn = document.getElementById("closeModalBtn");
const modalCategoriaSelect = document.getElementById("modalCategoriaSelect");
const modalCodigo = document.getElementById("modalCodigo");
const modalNombre = document.getElementById("modalNombre");
const modalPrecio = document.getElementById("modalPrecio");
const modalStock = document.getElementById("modalStock");
const modalGuardarBtn = document.getElementById("modalGuardarBtn");

// Botón agregar categoría
const btnAgregarCategoria = document.createElement("button");
btnAgregarCategoria.textContent = "+ Agregar categoría";
btnAgregarCategoria.classList.add("btn-agregar-categoria");
categoryList.parentElement.appendChild(btnAgregarCategoria);

// Función para capitalizar
function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Cargar categorías en la lista lateral
async function cargarCategorias() {
  const catSnap = await getDocs(collection(db, "categorias"));
  categoryList.innerHTML = "";

  const liTodos = document.createElement("li");
  liTodos.textContent = "Todos los productos";
  liTodos.dataset.id = "todos";
  liTodos.addEventListener("click", () => {
    categoryList.querySelectorAll("li").forEach(el => el.classList.remove("active"));
    liTodos.classList.add("active");
    categoriaActual = "todos";
    cargarProductos();
  });
  categoryList.appendChild(liTodos);

  const categorias = catSnap.docs.map(d => d.id).sort();
  categorias.forEach(catId => {
    const li = document.createElement("li");
    li.dataset.id = catId;
    li.style.cursor = "pointer";

    const spanCat = document.createElement("span");
    spanCat.textContent = capitalize(catId);
    li.appendChild(spanCat);

    const btnEliminar = document.createElement("button");
    btnEliminar.textContent = "❌";
    btnEliminar.title = "Eliminar categoría";
    btnEliminar.classList.add("btn-eliminar-categoria");
    li.appendChild(btnEliminar);

    li.addEventListener("mouseenter", () => btnEliminar.style.display = "inline");
    li.addEventListener("mouseleave", () => btnEliminar.style.display = "none");

    li.addEventListener("click", () => {
      categoryList.querySelectorAll("li").forEach(el => el.classList.remove("active"));
      li.classList.add("active");
      categoriaActual = catId;
      cargarProductos();
    });

    btnEliminar.addEventListener("click", async (e) => {
      e.stopPropagation();
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
          const batchDeletes = productosSnap.docs.map(d => deleteDoc(doc(db, "categorias", catId, "productos", d.id)));
          await Promise.all(batchDeletes);
          await deleteDoc(doc(db, "categorias", catId));
          Swal.fire("Eliminado", `Categoría "${capitalize(catId)}" eliminada.`, "success");
          if (categoriaActual === catId) categoriaActual = null;
          cargarCategorias();
          cargarProductos();
          cargarCategoriasModal();
        } catch (error) {
          console.error("Error eliminando categoría:", error);
          Swal.fire("Error", "No se pudo eliminar la categoría.", "error");
        }
      }
    });

    categoryList.appendChild(li);
  });

  if (!categoriaActual) {
    liTodos.classList.add("active");
    categoriaActual = "todos";
    cargarProductos();
  }
}

// Cargar categorías en el select del modal
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

function getCategoriaProductosRef() {
  if (!categoriaActual || categoriaActual === "todos") return null;
  return collection(db, "categorias", categoriaActual, "productos");
}

// Variables de paginación
let productosPaginados = [];
let paginaActual = 1;
let itemsPorPagina = 15;

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

function renderControlesPaginacion() {
  const totalPaginas = Math.ceil(productosPaginados.length / itemsPorPagina);
  const pagDiv = document.getElementById("paginationControls");
  pagDiv.innerHTML = "";
  if (totalPaginas <= 1) return;

  const crearBtn = (texto, n, disabled = false) => {
    const btn = document.createElement("button");
    btn.textContent = texto;
    btn.disabled = disabled;
    btn.addEventListener("click", () => {
      paginaActual = n;
      renderPaginaActual();
    });
    return btn;
  };

  pagDiv.appendChild(crearBtn("<<", 1, paginaActual === 1));
  pagDiv.appendChild(crearBtn("<", paginaActual - 1, paginaActual === 1));

  for (let i = 1; i <= totalPaginas; i++) {
    const btn = crearBtn(i, i, i === paginaActual);
    if (i === paginaActual) btn.style.fontWeight = "bold";
    pagDiv.appendChild(btn);
  }

  pagDiv.appendChild(crearBtn(">", paginaActual + 1, paginaActual === totalPaginas));
  pagDiv.appendChild(crearBtn(">>", totalPaginas, paginaActual === totalPaginas));
}

// Renderizar productos
function renderTabla(productos) {
  tablaBody.innerHTML = "";

  if (productos.length === 0) {
    tablaBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#666; font-style:italic;">No hay productos cargados.</td></tr>`;
    return;
  }

  productos.forEach((prod) => {
    const tr = document.createElement("tr");
    tr.dataset.id = prod.id;
    tr.dataset.categoria = prod.categoria;

    tr.innerHTML = `
      <td contenteditable="true" data-field="codigo">${prod.codigo}</td>
      <td contenteditable="true" data-field="nombre">${prod.nombre}</td>
      <td contenteditable="true" data-field="precio">${prod.precio}</td>
      <td contenteditable="true" data-field="stock">${prod.stock}</td>
      <td class="actions">
        <button class="guardar" disabled>Guardar</button>
        <button class="delete">Eliminar</button>
      </td>
    `;

    const btnGuardar = tr.querySelector(".guardar");
    const originalValues = [...tr.children].slice(0, 4).map(td => td.textContent.trim());

    tr.querySelectorAll("td[contenteditable=true]").forEach((td, idx) => {
      td.addEventListener("input", () => {
        const currentValues = [...tr.children].slice(0, 4).map(td => td.textContent.trim());
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
      };
      if (!updated.codigo || !updated.nombre || isNaN(updated.precio) || isNaN(updated.stock)) {
        return Swal.fire({ icon: 'error', title: 'Error', text: 'Datos inválidos.' });
      }

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
  const titulo = document.getElementById("tituloCategoria");
  if (!categoriaActual) {
    tablaBody.innerHTML = `<tr><td colspan="5" style="text-align:center; font-style: italic; color: #666;">Seleccione una categoría para ver productos</td></tr>`;
    titulo.textContent = "";
    return;
  }

  titulo.textContent = categoriaActual === "todos"
    ? "Todos los productos"
    : `Categoría: ${capitalize(categoriaActual)}`;

  if (categoriaActual === "todos") {
    const catSnap = await getDocs(collection(db, "categorias"));
    let todosProductos = [];

    for (const catDoc of catSnap.docs) {
      const prodSnap = await getDocs(collection(db, "categorias", catDoc.id, "productos"));
      prodSnap.forEach(p => {
        todosProductos.push({
          id: p.id,
          categoria: catDoc.id,
          ...p.data()
        });
      });
    }

    paginarProductos(todosProductos);
  } else {
    const ref = getCategoriaProductosRef();
    if (!ref) return;
    const querySnapshot = await getDocs(ref);
    let productos = [];
    querySnapshot.forEach(docSnap => {
      productos.push({
        id: docSnap.id,
        categoria: categoriaActual,
        ...docSnap.data()
      });
    });

    paginarProductos(productos);
  }
}

// Modal nuevo producto
addProductBtn.addEventListener("click", () => {
  modal.classList.remove("hidden");
  modalCategoriaSelect.value = categoriaActual === "todos" ? "" : categoriaActual || "";
  modalCodigo.value = "";
  modalNombre.value = "";
  modalPrecio.value = "";
  modalStock.value = "";
  modalCodigo.focus();
});

closeModalBtn.addEventListener("click", () => modal.classList.add("hidden"));
modal.addEventListener("click", (e) => {
  if (e.target === modal) modal.classList.add("hidden");
});

modalGuardarBtn.addEventListener("click", async () => {
  const categoria = modalCategoriaSelect.value;
  const codigo = modalCodigo.value.trim();
  const nombre = modalNombre.value.trim();
  const precio = parseFloat(modalPrecio.value);
  const stock = parseInt(modalStock.value);

  if (!categoria || !codigo || !nombre || isNaN(precio) || isNaN(stock)) {
    return Swal.fire({ icon: 'warning', title: 'Faltan datos', text: 'Completá todos los campos correctamente.' });
  }

  try {
    const ref = collection(db, "categorias", categoria, "productos");
    const existentes = await getDocs(ref);
    const existeCodigo = existentes.docs.some(docSnap => docSnap.data().codigo.toLowerCase() === codigo.toLowerCase());

    if (existeCodigo) {
      return Swal.fire({ icon: 'error', title: 'Código duplicado', text: 'Ya existe un producto con ese código en esta categoría.' });
    }

    const newId = uuidv4();
    await setDoc(doc(ref, newId), { codigo, nombre, precio, stock });

    Swal.fire({ icon: 'success', title: 'Producto agregado', text: 'El producto fue agregado correctamente.' });
    modal.classList.add("hidden");
    if (categoria === categoriaActual || categoriaActual === "todos") cargarProductos();
  } catch (error) {
    console.error("Error agregando producto:", error);
    Swal.fire("Error", "No se pudo agregar el producto.", "error");
  }
});

// Buscador global
document.getElementById("searchInput").addEventListener("input", async (e) => {
  const searchTerm = e.target.value.toLowerCase();
  let todosProductos = [];

  const catSnap = await getDocs(collection(db, "categorias"));
  for (const catDoc of catSnap.docs) {
    const prodSnap = await getDocs(collection(db, "categorias", catDoc.id, "productos"));
    prodSnap.forEach(p => {
      todosProductos.push({
        id: p.id,
        categoria: catDoc.id,
        ...p.data()
      });
    });
  }

  const filtrados = todosProductos.filter(p =>
    p.nombre.toLowerCase().includes(searchTerm) ||
    p.codigo.toLowerCase().includes(searchTerm)
  );

  paginarProductos(filtrados);
});

// Ordenamiento
document.getElementById("sortSelect").addEventListener("change", async (e) => {
  const valor = e.target.value;
  const catSnap = await getDocs(collection(db, "categorias"));
  let todosProductos = [];

  for (const catDoc of catSnap.docs) {
    const prodSnap = await getDocs(collection(db, "categorias", catDoc.id, "productos"));
    prodSnap.forEach(p => {
      todosProductos.push({
        id: p.id,
        categoria: catDoc.id,
        ...p.data()
      });
    });
  }

  switch (valor) {
    case "nombre-asc":
      todosProductos.sort((a, b) => a.nombre.localeCompare(b.nombre));
      break;
    case "nombre-desc":
      todosProductos.sort((a, b) => b.nombre.localeCompare(a.nombre));
      break;
    case "precio-asc":
      todosProductos.sort((a, b) => a.precio - b.precio);
      break;
    case "precio-desc":
      todosProductos.sort((a, b) => b.precio - a.precio);
      break;
    case "stock-asc":
      todosProductos.sort((a, b) => a.stock - b.stock);
      break;
    case "stock-desc":
      todosProductos.sort((a, b) => b.stock - a.stock);
      break;
    case "codigo-asc":
      todosProductos.sort((a, b) => a.codigo.localeCompare(b.codigo));
      break;
    case "codigo-desc":
      todosProductos.sort((a, b) => b.codigo.localeCompare(a.codigo));
      break;
    default:
      break;
  }

  paginarProductos(todosProductos);
});

// Crear categoría nueva
btnAgregarCategoria.addEventListener("click", async () => {
  const { value: catNueva } = await Swal.fire({
    title: "Nueva categoría",
    input: "text",
    inputLabel: "Ingrese el nombre de la nueva categoría",
    inputPlaceholder: "Ej: limpieza",
    showCancelButton: true,
    inputValidator: (value) => {
      if (!value || value.trim().length < 2) return "Debe ingresar un nombre válido (mínimo 2 caracteres).";
      return null;
    },
  });

  if (catNueva) {
    const catMin = catNueva.trim().toLowerCase();
    const catRef = doc(db, "categorias", catMin);
    const catSnap = await getDoc(catRef);
    if (catSnap.exists()) {
      Swal.fire("Error", "Ya existe una categoría con ese nombre.", "error");
      return;
    }
    await setDoc(catRef, {});
    Swal.fire("Creada", `Categoría "${capitalize(catMin)}" creada.`, "success");
    cargarCategorias();
    cargarCategoriasModal();
  }
});

// Verificar usuario logueado
onAuthStateChanged(auth, (user) => {
  if (user) {
    cargarCategorias();
    cargarCategoriasModal();
  } else {
    Swal.fire({
      icon: "error",
      title: "No autorizado",
      text: "Debe iniciar sesión para usar esta aplicación.",
    });
  }
});