// BUILD 024 — aviso de que el riesgo de una operación registrada a posteriori
// se congeló con el capital vigente AL REGISTRARLA, no con el que había a la
// hora de la entrada. Es el comportamiento actual, sin cambiar: cómo debería
// congelarse el riesgo en ese caso es DEC-013, pendiente de decisión.
//
// Sólo informa. No calcula ni propone ningún otro importe.
import styles from "./operaciones.module.css";

export function AvisoRegistroHistorico({ momento }: { momento: "antes" | "despues" }) {
  return (
    <div className={styles.aviso} role="note">
      <strong>Operación registrada a posteriori.</strong>{" "}
      {momento === "antes"
        ? "El riesgo en dinero se calculará con el capital vigente de la Cuenta AHORA, no con el que tenías a la hora de entrada. Si entre medias cerraste otras operaciones o moviste capital, el importe no coincidirá con el que arriesgaste de verdad."
        : "El riesgo en dinero se calculó con el capital vigente cuando se registró, no con el que había a la hora de entrada. Si entre medias cambió el capital, el importe no coincide con el que se arriesgó de verdad."}{" "}
      Cómo tratar este caso está pendiente de decisión (DEC-013); por ahora no se recalcula nada.
    </div>
  );
}
