import { getDocs, updateDoc, doc, collection } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { db } from "./firebaseConfig.js";

//Agrega stockMinimo a productos que no lo tienen
export async function agregarCampoStockMinimo(valorPorDefecto = 5) {
  const catSnap = await getDocs(collection(db, "categorias"));
  for (const catDoc of catSnap.docs) {
    const productosRef = collection(db, "categorias", catDoc.id, "productos");
    const prodSnap = await getDocs(productosRef);

    for (const p of prodSnap.docs) {
      const data = p.data();
      if (data.stockMinimo === undefined) {
        const ref = doc(db, "categorias", catDoc.id, "productos", p.id);
        await updateDoc(ref, { stockMinimo: valorPorDefecto });
        console.log(`Actualizado producto ${p.id} con stockMinimo = ${valorPorDefecto}`);
      }
    }
  }
}

//Devuelve true si el producto está en alerta
export function verificarAlerta(producto) {
  if (producto.stockMinimo === undefined || producto.stockMinimo === null) return false;
  return producto.stock < producto.stockMinimo;
}

//Cuenta productos con alerta
export function contarProductosConAlerta(productos) {
  return productos.filter(verificarAlerta).length;
}

//Estiliza fila si hay alerta
export function renderizarAlertaEnFila(tr, producto) {
  if (!verificarAlerta(producto)) return;

  tr.classList.add("stock-alert");

  const celdas = tr.querySelectorAll("td");
  const celdaStock = celdas[3]; // Asumiendo que el stock está en la columna 4 (índice 3)

  const alerta = document.createElement("div");
  alerta.style.color = "red";
  alerta.style.fontSize = "0.8em";
  alerta.style.fontWeight = "bold";
  alerta.innerText = "⚠️ Stock bajo";

  celdaStock.appendChild(alerta);
}

 /*Crea input editable para 'stockMinimo' y lo guarda*/
export function crearInputStockMinimo(producto, categoriaId, productoId) {
  const input = document.createElement("input");
  input.type = "number";
  input.value = producto.stockMinimo ?? 0;
  input.classList.add("input-stock-minimo");
  input.style.width = "80px";

  input.addEventListener("change", async () => {
    const nuevoValor = parseInt(input.value);
    const ref = doc(db, "categorias", categoriaId, "productos", productoId);
    await updateDoc(ref, { stockMinimo: nuevoValor });
    console.log(`Stock mínimo actualizado a ${nuevoValor} para ${producto.nombre}`);
  });

  return input;
}