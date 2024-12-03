import Link from 'next/link';

export default function Index() {
  return (
    <>
      <nav className="bottom">
        <a>
          <i>home</i>
          <div>Home</div>
        </a>
        <a>
          <i>search</i>
          <div>Search</div>
        </a>
        <a>
          <i>share</i>
          <div>share</div>
        </a>
      </nav>
      <main className="responsive">
        <h3>Vinklubb</h3>
        <article>
          <h5>Chardonnay smaking</h5>
          <p>Kveldens viner er som følger</p>
          <Link
            href="/smaking/13769701"
            className="row wave">
            Maison Romane Hautes-Cotes de Nuits 2019
          </Link>
          <hr />
          <Link
            href="/smaking/8153901"
            className="row wave">
            Rolet Arbois Chardonnay 2022
          </Link>
        </article>
      </main>
    </>
  );
}
