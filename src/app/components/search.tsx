"use client";
import { useState } from "react";
import keyValues from "../data/wines-key-value.json";
import { searchModel } from "../models/searchModel";

type SearchProperties = {
  onWineSelected: (wine: searchModel) => void;
};

export const Search: React.FC<SearchProperties> = ({ onWineSelected }) => {
  const [wines, setWines] = useState(new Array<searchModel>());
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e?.target.value.length < 3) return;
    const results = keyValues.filter((x) =>
      x.productShortName
        .toLocaleLowerCase()
        .includes(e.target.value.toLocaleLowerCase()),
    );
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
          {wines.map((x) => (
            <button
              key={x.productId}
              className="row"
              onClick={() => handleSelected(x)}
            >
              <div>{x.productShortName}</div>
            </button>
          ))}
        </menu>
      </div>
    </>
  );
};
