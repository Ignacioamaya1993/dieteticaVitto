import { collection, getDocs } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { db } from "./firebaseConfig.js";

export function inicializarExportadorExcel(getCategoriaSeleccionada) {
  const btnExportar = document.getElementById("btnExportarExcel");

  btnExportar.addEventListener("click", async () => {
    const categoria = getCategoriaSeleccionada();
    if (!categoria) {
      Swal.fire("Error", "Debe seleccionar una categoría para exportar.", "error");
      return;
    }

    try {
      const productosSnap = await getDocs(collection(db, "categorias", categoria, "productos"));
      if (productosSnap.empty) {
        Swal.fire("Sin datos", "No hay productos en esta categoría.", "info");
        return;
      }

      const data = [["Código", "Nombre", "Precio", "Stock"]];
      productosSnap.forEach(doc => {
        const d = doc.data();
        data.push([
          d.codigo || "",
          d.nombre || "",
          typeof d.precio === "number" ? d.precio : "",
          typeof d.stock === "number" ? d.stock : ""
        ]);
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, "Productos");
      XLSX.writeFile(wb, `productos_${categoria}.xlsx`);
    } catch (err) {
      console.error("Error exportando:", err);
      Swal.fire("Error", "Hubo un problema al exportar.", "error");
    }
  });
}
