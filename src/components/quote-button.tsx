"use client";

import { useState } from "react";

export function QuoteButton({ product }: { product: { id: string; name: string; page: number } }) {
  const [added, setAdded] = useState(false);
  function add() {
    const key = "tubes-rfq";
    const current = JSON.parse(localStorage.getItem(key) || "[]") as typeof product[];
    if (!current.some((item) => item.id === product.id)) localStorage.setItem(key, JSON.stringify([...current, product]));
    setAdded(true);
  }
  return <button onClick={add} className="focus-ring mt-6 w-full border-2 border-white bg-[var(--signal)] px-5 py-3 font-bold text-white hover:bg-white hover:text-[var(--ink)]">{added ? "Добавлено в запрос ✓" : "Добавить в запрос цены"}</button>;
}
