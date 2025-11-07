'use client';
import React, { useState } from 'react';
import keyValues from '../data/wines-key-value.json';
import { searchModel } from '../models/searchModel';

type SearchProperties = {
  onWineSelected: (wine: searchModel) => void;
};

export const Search: React.FC<SearchProperties> = ({ onWineSelected }) => {
  const [wines, setWines] = useState(new Array<searchModel>());
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const searchTerm = e?.target.value;
    if (searchTerm.length < 3) return;
    const results = keyValues
      .map(product => {
        const nameLower = product.productShortName.toLowerCase();
        const idMatch = product.productId.includes(searchTerm);
        const nameMatch = nameLower.includes(searchTerm);
        const startsWithMatch = nameLower.split(' ').some(word => word.startsWith(searchTerm));

        // Calculate relevance score
        let score = 0;
        if (idMatch) score += 10;
        if (startsWithMatch) score += 5;
        if (nameMatch) score += 1;

        return { ...product, score };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score);
    setWines(results);
  };

  const handleSelected = (wine: searchModel) => {
    setWines([]);
    onWineSelected(wine);
  };
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
            <button
              key={x.productId}
              className="row"
              onClick={() => handleSelected(x)}>
              <div>{x.productShortName}</div>
            </button>
          ))}
        </menu>
      </div>
    </>
  );
};
