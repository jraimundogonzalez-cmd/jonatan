// Card — SPEC-012 §6.3: "agrupar información relacionada con un límite visual
// claro". Caso prohibido explícito: "nunca anidar una Card dentro de otra
// Card" — se hace verificable en desarrollo (no solo documental) con un
// Context que detecta anidación y avisa en consola, sin romper producción.
"use client";

import { createContext, useContext, type HTMLAttributes, type ReactNode } from "react";
import cardStyles from "./Card.module.css";

const InsideCardContext = createContext(false);

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  elevated?: boolean;
  interactive?: boolean;
  children: ReactNode;
}

export function Card({ elevated = false, interactive = false, className, children, ...rest }: CardProps) {
  const alreadyInsideCard = useContext(InsideCardContext);

  if (alreadyInsideCard && process.env.NODE_ENV !== "production") {
    console.error(
      "Card anidada dentro de otra Card — caso prohibido explícitamente por SPEC-012 §6.3. " +
        "Usa un contenedor plano o divide el contenido en dos Cards hermanas.",
    );
  }

  const classes = [cardStyles.card];
  if (elevated) classes.push(cardStyles.elevated);
  if (interactive) classes.push(cardStyles.interactive);
  if (className) classes.push(className);

  return (
    <InsideCardContext.Provider value={true}>
      <div className={classes.join(" ")} {...rest}>
        {children}
      </div>
    </InsideCardContext.Provider>
  );
}
