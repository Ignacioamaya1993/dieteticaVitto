import { collection, getDocs } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { db } from "./firebaseConfig.js";

/**
 * Inicializa el botón para exportar productos a Excel
 * @param {Function} getCategoriaSeleccionada - Función que retorna la categoría actual seleccionada
 */
export function inicializarExportadorExcel(getCategoriaSeleccionada) {
  const btnExportar = document.getElementById("btnExportarExcel");

  btnExportar.addEventListener("click", async () => {
    const categoria = getCategoriaSeleccionada();
    if (!categoria || categoria === "todos") {
      Swal.fire("Error", "Debe seleccionar una categoría válida para exportar.", "error");
      return;
    }

    try {
      // Obtener productos de la categoría
      const productosSnap = await getDocs(collection(db, "categorias", categoria, "productos"));

      if (productosSnap.empty) {
        Swal.fire("Sin datos", "No hay productos en esta categoría.", "info");
        return;
      }

      // Encabezados para Excel
      const data = [[
        "Código", 
        "Nombre", 
        "Precio Bruto", 
        "% Aplicado", 
        "Precio Neto", 
        "Distribuidor", 
        "Stock", 
        "Stock Mínimo"
      ]];

      // Agregar cada producto
      productosSnap.forEach(docSnap => {
        const d = docSnap.data();
        data.push([
          d.codigo || "",
          d.nombre || "",
          typeof d.precioBruto === "number" ? d.precioBruto : "",
          typeof d.porcentajeAplicado === "number" ? d.porcentajeAplicado : "",
          typeof d.precioNeto === "number" ? d.precioNeto : "",
          d.distribuidor || "",
          typeof d.stock === "number" ? d.stock : "",
          typeof d.stockMinimo === "number" ? d.stockMinimo : ""
        ]);
      });

      // Crear libro y hoja de Excel
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, "Productos");

      // Descargar archivo Excel
      XLSX.writeFile(wb, `productos_${categoria}.xlsx`);

    } catch (error) {
      console.error("Error exportando Excel:", error);
      Swal.fire("Error", "Hubo un problema al exportar el archivo Excel.", "error");
    }
  });
}
