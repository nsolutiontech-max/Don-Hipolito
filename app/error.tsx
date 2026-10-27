"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <section className="panel" role="alert"><h1>No se pudo cargar la información</h1>
    <p className="my-4 text-zinc-600">Comprueba tu conexión y vuelve a intentar. Los datos guardados no se han eliminado.</p>
    <button className="button-primary" onClick={reset}>Volver a intentar</button></section>;
}
