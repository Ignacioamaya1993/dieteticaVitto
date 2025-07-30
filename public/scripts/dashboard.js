import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { db } from "./firebaseConfig.js";
import { v4 as uuidv4 } from "https://jspm.dev/uuid";
import { inicializarImportadorExcel } from './excelImport.js';
inicializarImportadorExcel(cargarProductos);

const auth = getAuth();
let categoriaActual = null;
const tablaBody = document.querySelector("#productosTable tbody");
const categoryList = document.getElementById("categoryList");

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
btnAgregarCategoria.style.marginTop = "1rem";
btnAgregarCategoria.style.padding = "6px 10px";
btnAgregarCategoria.style.width = "100%";
btnAgregarCategoria.style.cursor = "pointer";
btnAgregarCategoria.style.borderRadius = "6px";
btnAgregarCategoria.style.border = "none";
btnAgregarCategoria.style.backgroundColor = "#59cfb6";
btnAgregarCategoria.style.color = "white";
btnAgregarCategoria.style.fontWeight = "600";
btnAgregarCategoria.title = "Agregar nueva categoría";
categoryList.parentElement.appendChild(btnAgregarCategoria);

// Función para capitalizar
function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Cargar categorías en la lista lateral con botón eliminar (solo visible en hover)
async function cargarCategorias() {
  const catSnap = await getDocs(collection(db, "categorias"));
  categoryList.innerHTML = "";

  // Item "Todos los productos"
  const liTodos = document.createElement("li");
  liTodos.textContent = "Todos los productos";
  liTodos.dataset.id = "todos";
  liTodos.style.position = "relative";
  liTodos.addEventListener("click", () => {
    categoryList.querySelectorAll("li").forEach(el => el.classList.remove("active"));
    liTodos.classList.add("active");
    categoriaActual = "todos";
    cargarProductos();
  });
  categoryList.appendChild(liTodos);

  // Ordenar categorías alfabéticamente
  const categorias = catSnap.docs.map(d => d.id).sort();

  categorias.forEach(catId => {
    const li = document.createElement("li");
    li.dataset.id = catId;
    li.style.position = "relative";
    li.style.cursor = "pointer";

    // Texto categoría
    const spanCat = document.createElement("span");
    spanCat.textContent = capitalize(catId);
    li.appendChild(spanCat);

    // Botón eliminar (cruz)
    const btnEliminar = document.createElement("button");
    btnEliminar.textContent = "❌";
    btnEliminar.title = "Eliminar categoría";
    btnEliminar.style.position = "absolute";
    btnEliminar.style.right = "5px";
    btnEliminar.style.top = "50%";
    btnEliminar.style.transform = "translateY(-50%)";
    btnEliminar.style.border = "none";
    btnEliminar.style.background = "transparent";
    btnEliminar.style.color = "red";
    btnEliminar.style.fontSize = "1rem";
    btnEliminar.style.cursor = "pointer";
    btnEliminar.style.display = "none";  // oculto por defecto
    li.appendChild(btnEliminar);

    // Mostrar cruz solo al hover sobre li
    li.addEventListener("mouseenter", () => {
      btnEliminar.style.display = "inline";
    });
    li.addEventListener("mouseleave", () => {
      btnEliminar.style.display = "none";
    });

    // Click en categoría para cargar productos
    spanCat.addEventListener("click", () => {
      categoryList.querySelectorAll("li").forEach(el => el.classList.remove("active"));
      li.classList.add("active");
      categoriaActual = catId;
      cargarProductos();
    });

    // Click en eliminar categoría
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
          // Primero eliminar todos los productos dentro de la categoría
          const productosCol = collection(db, "categorias", catId, "productos");
          const productosSnap = await getDocs(productosCol);
          const batchDeletes = productosSnap.docs.map(d => deleteDoc(doc(db, "categorias", catId, "productos", d.id)));
          await Promise.all(batchDeletes);

          // Luego eliminar la categoría
          await deleteDoc(doc(db, "categorias", catId));

          Swal.fire("Eliminado", `Categoría "${capitalize(catId)}" eliminada.`, "success");

          // Recargar categorías y productos
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

  // Seleccionar "Todos" por defecto si no hay categoría seleccionada
  if (!categoriaActual) {
    liTodos.classList.add("active");
    categoriaActual = "todos";
    cargarProductos();
  }
}

// Cargar categorías en el select del modal para nuevo producto
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

// Referencia a productos de la categoría actual
function getCategoriaProductosRef() {
  if (!categoriaActual || categoriaActual === "todos") return null;
  return collection(db, "categorias", categoriaActual, "productos");
}

// Variables para paginación
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
    btn.style.margin = "0 4px";
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

// Renderizar tabla productos
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

    // Detectar cambios en campos editables para habilitar botón guardar
    tr.querySelectorAll("td[contenteditable=true]").forEach((td, idx) => {
      td.addEventListener("input", () => {
        const currentValues = [...tr.children].slice(0, 4).map(td => td.textContent.trim());
        const hasChanges = currentValues.some((val, i) => val !== originalValues[i]);
        btnGuardar.disabled = !hasChanges;
      });
    });

    // Guardar cambios
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

    // Eliminar producto
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

// Cargar productos según categoría seleccionada con paginación
async function cargarProductos() {
  if (!categoriaActual) {
    tablaBody.innerHTML = `<tr><td colspan="5" style="text-align:center; font-style: italic; color: #666;">Seleccione una categoría para ver productos</td></tr>`;
    return;
  }

  if (categoriaActual === "null") {
    // Cargar todos los productos de todas las categorías
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

    if (todosProductos.length === 0) {
      tablaBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#666; font-style:italic;">No hay productos cargados.</td></tr>`;
      return;
    }

    paginarProductos(todosProductos);

  } else {
    // Categoría específica
    const ref = getCategoriaProductosRef();
    if (!ref) return;

    const querySnapshot = await getDocs(ref);
    if (querySnapshot.empty) {
      tablaBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#666; font-style:italic;">No hay productos en esta categoría.</td></tr>`;
      return;
    }

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

// Abrir modal nuevo producto
addProductBtn.addEventListener("click", () => {
  modal.classList.remove("hidden");
  modalCategoriaSelect.value = categoriaActual === "todos" ? "" : categoriaActual || "";
  modalCodigo.value = "";
  modalNombre.value = "";
  modalPrecio.value = "";
  modalStock.value = "";
  modalCodigo.focus();
});

// Cerrar modal botón X
closeModalBtn.addEventListener("click", () => {
  modal.classList.add("hidden");
});

// Cerrar modal al clickear fuera del contenido
modal.addEventListener("click", (e) => {
  if (e.target === modal) {
    modal.classList.add("hidden");
  }
});

// Guardar producto nuevo desde modal
modalGuardarBtn.addEventListener("click", async () => {
  const categoria = modalCategoriaSelect.value;
  const codigo = modalCodigo.value.trim();
  const nombre = modalNombre.value.trim();
  const precio = parseFloat(modalPrecio.value);
  const stock = parseInt(modalStock.value);

  if (!categoria) {
    await Swal.fire({
      icon: 'warning',
      title: 'Faltó seleccionar',
      text: 'Seleccioná una categoría.'
    });
    return;
  }
  if (!codigo || !nombre || isNaN(precio) || isNaN(stock)) {
    await Swal.fire({
      icon: 'warning',
      title: 'Faltan datos',
      text: 'Completá todos los campos correctamente.'
    });
    return;
  }

  try {
    const ref = collection(db, "categorias", categoria, "productos");
    const existentes = await getDocs(ref);

    const existeCodigo = existentes.docs.some(docSnap => docSnap.data().codigo.toLowerCase() === codigo.toLowerCase());
    if (existeCodigo) {
      await Swal.fire({
        icon: 'error',
        title: 'Código duplicado',
        text: 'Ya existe un producto con ese código en esta categoría.'
      });
      return;
    }

    const newId = uuidv4();
    await setDoc(doc(ref, newId), {
      codigo,
      nombre,
      precio,
      stock,
    });

    await Swal.fire({
      icon: 'success',
      title: 'Producto agregado',
      text: 'El producto fue agregado correctamente.'
    });

    modal.classList.add("hidden");

    if (categoria === categoriaActual || categoriaActual === "todos") {
      cargarProductos();
    }
  } catch (error) {
    console.error("Error agregando producto:", error);
    Swal.fire("Error", "No se pudo agregar el producto.", "error");
  }
});

// Buscador
document.getElementById("searchInput").addEventListener("input", (e) => {
  const searchTerm = e.target.value.toLowerCase();
  const filas = tablaBody.querySelectorAll("tr");

  filas.forEach((fila) => {
    const texto = fila.textContent.toLowerCase();
    fila.style.display = texto.includes(searchTerm) ? "" : "none";
  });
});

// Ordenar
document.getElementById("sortSelect").addEventListener("change", async (e) => {
  const valor = e.target.value;
  if (categoriaActual === "todos") {
    await cargarProductosOrdenados(valor);
    return;
  }
  const ref = getCategoriaProductosRef();
  if (!ref) return;

  const querySnapshot = await getDocs(ref);
  let productos = querySnapshot.docs.map(doc => ({ id: doc.id, categoria: categoriaActual, ...doc.data() }));

  switch (valor) {
    case "nombre-asc":
      productos.sort((a, b) => a.nombre.localeCompare(b.nombre));
      break;
    case "nombre-desc":
      productos.sort((a, b) => b.nombre.localeCompare(a.nombre));
      break;
    case "precio-asc":
      productos.sort((a, b) => a.precio - b.precio);
      break;
    case "precio-desc":
      productos.sort((a, b) => b.precio - a.precio);
      break;
    case "stock-asc":
      productos.sort((a, b) => a.stock - b.stock);
      break;
    case "stock-desc":
      productos.sort((a, b) => b.stock - a.stock);
      break;
    default:
      break;
  }

  paginarProductos(productos);
});

async function cargarProductosOrdenados(orden) {
  // Ordenar todos los productos de todas las categorías
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

  switch (orden) {
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
    default:
      break;
  }

  paginarProductos(todosProductos);
}

// Crear nueva categoría con prompt y validación
btnAgregarCategoria.addEventListener("click", async () => {
  const { value: catNueva } = await Swal.fire({
    title: "Nueva categoría",
    input: "text",
    inputLabel: "Ingrese el nombre de la nueva categoría",
    inputPlaceholder: "Ej: limpieza",
    showCancelButton: true,
    inputValidator: (value) => {
      if (!value || value.trim().length < 2) {
        return "Debe ingresar un nombre válido (mínimo 2 caracteres).";
      }
      return null;
    },
  });

  if (catNueva) {
    const catMin = catNueva.trim().toLowerCase();

    // Verificar si ya existe
    const catRef = doc(db, "categorias", catMin);
    const catSnap = await getDoc(catRef);
    if (catSnap.exists()) {
      Swal.fire("Error", "Ya existe una categoría con ese nombre.", "error");
      return;
    }

    // Crear categoría vacía
    await setDoc(catRef, {});

    Swal.fire("Creada", `Categoría "${capitalize(catMin)}" creada.`, "success");
    cargarCategorias();
    cargarCategoriasModal();
  }
});

// Validar usuario logueado para cargar contenido
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
    // Aquí puedes redirigir al login si quieres
  }
});