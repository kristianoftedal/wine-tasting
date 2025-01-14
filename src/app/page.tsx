"use client"
import Link from 'next/link';
import { Search } from './components/search';
import { searchModel } from './models/searchModel';
import { useState } from 'react';

export default function Index() {
  const [wines, setWines] = useState([]);

  const onSelected = (wine: searchModel) => {
    setWines([...wines, wine]);
  }
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
        <h3>Smak på vin</h3>
        <Search onWineSelected={onSelected} />
        {wines.map(x => (
          <Link
            key={x.productId}
            href={`/smaking/${x.productId}`}
            className="row wave">
            {x.productShortName}
          </Link>

        ))}
      </main>
    </>
  );
}