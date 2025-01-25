"use client"
import { Search } from './components/search';
import { searchModel } from './models/searchModel';
import { useState } from 'react';
import { redirect } from 'next/navigation';

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
          <button className="responsive primary"
          key={x.productId} onClick={() => redirect(`/smaking/${x.productId}`)}>

            {x.productShortName}
            </button>
        ))}
      </main>
    </>
  );
}