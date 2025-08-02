import { collection, getDocs, doc, setDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { db } from "./firebaseConfig.js";
import { v4 as uuidv4 } from "https://cdn.skypack.dev/uuid";

/**
 * Inicializa el importador de productos desde Excel
 * @param {Function} cargarProductos - Función para recargar productos después del import
 */
export function inicializarImportadorExcel(cargarProductos) {
  const btnImportar = document.getElementById("btnImportarExcel");
  const modalImportar = document.getElementById("modalImportarExcel");
  const closeImportar = document.getElementById("cerrarImportarExcel");
  const subirArchivo = document.getElementById("subirArchivoExcel");
  const selectCategoriaImport = document.getElementById("categoriaImportarExcel");

  btnImportar.addEventListener("click", async () => {
    modalImportar.style.display = "block";

    // Cargar categorías
    const catSnap = await getDocs(collection(db, "categorias"));
    selectCategoriaImport.innerHTML = `<option value="">Seleccionar categoría</option>`;
    catSnap.forEach(doc => {
      selectCategoriaImport.innerHTML += `<option value="${doc.id}">${capitalize(doc.id)}</option>`;
    });
  });

  closeImportar.addEventListener("click", () => {
    modalImportar.style.display = "none";
  });

  subirArchivo.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    const categoria = selectCategoriaImport.value;
    if (!file || !categoria) {
      Swal.fire("Error", "Debe seleccionar un archivo y una categoría.", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        let agregados = 0, yaExistian = 0, errores = 0;

        // Cargar productos existentes
        const existentesSnap = await getDocs(collection(db, "categorias", categoria, "productos"));
        const codigosExistentes = new Set();
        const nombresExistentes = new Set();

        existentesSnap.forEach(p => {
          const d = p.data();
          codigosExistentes.add((d.codigo || "").toLowerCase());
          nombresExistentes.add((d.nombre || "").toLowerCase());
        });

        // Validar encabezado
        const encabezadoEsperado = ["Código", "Nombre", "Precio Bruto", "% Aplicado", "Precio Neto", "Distribuidor", "Stock", "Stock Mínimo"];
        const encabezado = json[0]?.map(e => e?.toString().trim());
        const valido = encabezadoEsperado.every((campo, i) => encabezado[i]?.toLowerCase() === campo.toLowerCase());
        if (!valido) {
          Swal.fire("Error", "El archivo Excel no tiene el formato esperado.", "error");
          return;
        }

        // Procesar filas
        for (let i = 1; i < json.length; i++) {
          const fila = json[i];
          if (!fila || fila.length < 6) {
            errores++;
            continue;
          }

          const [
            codigo,
            nombre,
            precioBruto,
            porcentajeAplicado,
            precioNeto,
            distribuidor,
            stock,
            stockMinimo
          ] = fila;

          if (!codigo || !nombre || isNaN(precioBruto) || isNaN(porcentajeAplicado) || isNaN(stock)) {
            errores++;
            continue;
          }

          const codLower = codigo.toString().trim().toLowerCase();
          const nomLower = nombre.toString().trim().toLowerCase();

          if (codigosExistentes.has(codLower) || nombresExistentes.has(nomLower)) {
            yaExistian++;
            continue;
          }

          const netoCalculado = !isNaN(precioNeto)
            ? parseFloat(precioNeto)
            : +(parseFloat(precioBruto) * (1 + parseFloat(porcentajeAplicado) / 100)).toFixed(2);

          const id = uuidv4();
          await setDoc(doc(db, "categorias", categoria, "productos", id), {
            codigo: codigo.toString().trim(),
            nombre: nombre.toString().trim(),
            precioBruto: parseFloat(precioBruto),
            porcentajeAplicado: parseFloat(porcentajeAplicado),
            precioNeto: netoCalculado,
            distribuidor: distribuidor?.toString().trim() || "",
            stock: parseInt(stock),
            stockMinimo: isNaN(stockMinimo) ? 5 : parseInt(stockMinimo)
          });

          agregados++;
        }

        Swal.fire({
          title: "Importación completada",
          icon: "success",
          html: `
            <p><b>Productos agregados:</b> ${agregados}</p>
            <p><b>Ya existentes:</b> ${yaExistian}</p>
            <p><b>Errores:</b> ${errores}</p>
          `,
          confirmButtonText: "Aceptar"
        });

        modalImportar.style.display = "none";
        cargarProductos();

      } catch (err) {
        console.error("Error al procesar archivo Excel:", err);
        Swal.fire("Error", "Hubo un problema al procesar el archivo.", "error");
      }
    };

    reader.readAsArrayBuffer(file);
  });
}

// Utilidad para capitalizar nombres de categorías
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
