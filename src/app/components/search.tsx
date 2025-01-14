"use client"
import { Category, Flavor, Subcategory } from '../models/flavorModel';
import { searchModel } from '../models/searchModel';
import keyValues from '../data/wines-key-value.json';
import { useState } from 'react';

type SearchProperties = {
  onWineSelected: (wine: searchModel) => searchModel;
};

export const Search: React.FC<AccordionProps> = ({ onWineSelected }) => {

  const [wines, setWines] = useState([]);
  const handleChange = (e) => {
    if (e.target.value.length < 3) return;
    const results = keyValues.filter(x => x.productShortName.toLocaleLowerCase().includes(e.target.value.toLocaleLowerCase()));
    setWines(results);
  }

  const handleSelected = (wine) => {
    setWines([]);
    onWineSelected(wine)
  }
  return (
    <>
      <div className="field large prefix round fill active">
        <i className="front">search</i>
        <input onChange={handleChange} />
        <menu className="min active">
          <div className="field large prefix suffix no-margin fixed">
            <i className="front">arrow_back</i>
            <input onChange={handleChange} />
            <i className="front">close</i>
          </div>
          {wines.map(x => (
          <button key={x.productId} className="row" onClick={() => handleSelected(x)}>
              <div>{x.productShortName}</div>
          </button>
        ))}

        </menu>
      </div>
    </>
  );
};
