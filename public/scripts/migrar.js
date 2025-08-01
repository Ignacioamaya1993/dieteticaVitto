// migrar.js
import { collection, getDocs, updateDoc, doc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { db } from "./firebaseConfig.js";

const porcentajePorDefecto = 21;

export async function migrarProductos() {
  const categoriasSnapshot = await getDocs(collection(db, "categorias"));
  for (const catDoc of categoriasSnapshot.docs) {
    const categoriaId = catDoc.id;
    const productosRef = collection(db, "categorias", categoriaId, "productos");
    const productosSnap = await getDocs(productosRef);

    for (const prodDoc of productosSnap.docs) {
      const data = prodDoc.data();

      const precioBruto = data.precio ?? 0;
      const porcentajeAplicado = porcentajePorDefecto;
      const precioNeto = +(precioBruto * (1 + porcentajeAplicado / 100)).toFixed(2);

      await updateDoc(doc(db, "categorias", categoriaId, "productos", prodDoc.id), {
        precioBruto,
        porcentajeAplicado,
        precioNeto,
        distribuidor: "",
      });

      console.log(`Producto "${data.nombre}" migrado correctamente`);
    }
  }

  console.log("✅ Migración finalizada");
}