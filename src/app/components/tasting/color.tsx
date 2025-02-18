"use client";

import React, { useState } from "react";
import { TastingProps } from "./props";

export const Color: React.FC<TastingProps> = ({ wine }) => {
  const [farge, setFarge] = useState<string>("");

  return (
    <article>
      <div className="row">
        <div className="max">
          <p>
            Druer:{" "}
            {wine.content.ingredients?.map((x) => x.formattedValue).join(", ")}
          </p>
          <p>Land: {wine.mainCountry.name}</p>
          {wine.district && <p>Område: {wine.district.name}</p>}
          <p>Årgang: {wine.year}</p>
          <div className="field border">
            <input
              type="text"
              value={farge}
              onChange={(event) => setFarge(event.target.value)}
            />
            <span className="helper">Farge</span>
          </div>
        </div>
      </div>
    </article>
  );
};
