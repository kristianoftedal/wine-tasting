"use client"
import Link from 'next/link';
import { Search } from './components/search';
import { searchModel } from './models/searchModel';
import { useState } from 'react';

export default function Index() {
  const [wines, setWines] = useState(new Array<searchModel>());

  const onSelected = (wine: searchModel) => {
    setWines([...wines, wine]);
  }
  return (
    <>
      <nav className="bottom">
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